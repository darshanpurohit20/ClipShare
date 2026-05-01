from flask import Flask, request, redirect, url_for, send_from_directory, render_template, jsonify, send_file, make_response
import zipfile
import os
import qrcode
import io
import secrets
import time
import threading
import shutil
import requests
from PIL import Image
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.moduledrawers import RoundedModuleDrawer
from qrcode.image.styles.colormasks import SolidFillColorMask
from werkzeug.utils import secure_filename

app = Flask(__name__)
UPLOAD_FOLDER = 'uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 1024 * 1024 * 1024  # 16 MB limit modified to 1 gb

def allowed_file(filename):
    return bool(filename)

# ── Thread-safe data store ──
data_store = {}
data_store_lock = threading.Lock()

# ── QR code cache (code → PNG bytes) ──
qr_cache = {}

def generate_code():
    attempts = 0
    while attempts < 100:
        code = ''.join(secrets.choice('0123456789') for _ in range(4))
        if code not in data_store:
            return code
        attempts += 1
    return None

def cleanup_expired_data():
    while True:
        time.sleep(60)
        current_time = time.time()

        # Snapshot expired codes under lock
        with data_store_lock:
            expired_codes = [code for code, data in data_store.items()
                           if 'expires_at' in data and current_time > data['expires_at']]

        # Remove each expired entry (lock per-item to minimize hold time)
        for code in expired_codes:
            with data_store_lock:
                data = data_store.pop(code, None)
            if data and data['type'] in ('file', 'multi_file'):
                folder = os.path.join(app.config['UPLOAD_FOLDER'], code)
                if os.path.exists(folder):
                    shutil.rmtree(folder, ignore_errors=True)
            # Also free cached QR image
            qr_cache.pop(code, None)

threading.Thread(target=cleanup_expired_data, daemon=True).start()

# ── Persistent HTTP session for keep-alive pings ──
_http_session = requests.Session()

def keep_awake():
    while True:
        time.sleep(600)  # 10 minutes (Render sleeps after 15 min of inactivity)
        try:
            space_host = os.environ.get('SPACE_HOST')
            render_host = os.environ.get('RENDER_EXTERNAL_HOSTNAME')
            if space_host:
                url = f"https://{space_host}/health"
            elif render_host:
                url = f"https://{render_host}/health"
            else:
                url = "http://127.0.0.1:5000/health"
            _http_session.get(url, timeout=10)
        except Exception as e:
            print(f"Health ping failed: {e}")

threading.Thread(target=keep_awake, daemon=True).start()

# ── Request timing middleware ──
@app.before_request
def start_timer():
    request._start_time = time.time()

@app.after_request
def log_request_time(response):
    if hasattr(request, '_start_time'):
        elapsed = (time.time() - request._start_time) * 1000
        if elapsed > 100:  # only log slow requests (>100ms)
            app.logger.warning(f"SLOW {request.method} {request.path} — {elapsed:.0f}ms")
    return response

@app.route('/health')
def health():
    return jsonify({"status": "ok", "timestamp": time.time()})


@app.route('/')
def index():
    return render_template('index.html')



@app.route('/upload_text', methods=['POST'])
def upload_text():
    text = request.form['text']
    ttl_mins = min(max(int(request.form.get('ttl', 1440)), 1), 43200) # Default 1 day, max 30 days
    code = generate_code()
    if not code:
        return jsonify({'error': 'Server full'}), 503
    with data_store_lock:
        data_store[code] = {'type': 'text', 'content': text, 'expires_at': time.time() + ttl_mins * 60}
    return jsonify({'code': code})

@app.route('/upload_file', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return "No file uploaded", 400
    file = request.files['file']
    if file and allowed_file(file.filename):
        ttl_mins = min(max(int(request.form.get('ttl', 1440)), 1), 43200)
        filename = secure_filename(file.filename)
        code = generate_code()
        if not code:
            return jsonify({'error': 'Server full'}), 503
        folder = os.path.join(app.config['UPLOAD_FOLDER'], code)
        os.makedirs(folder, exist_ok=True)
        path = os.path.join(folder, filename)
        file.save(path)
        with data_store_lock:
            data_store[code] = {'type': 'file', 'content': path, 'filename': filename, 'expires_at': time.time() + ttl_mins * 60}
        return jsonify({'code': code})
    return "Invalid file type or no file uploaded", 400

@app.route('/upload_files', methods=['POST'])
def upload_files():
    files = request.files.getlist('files')
    if not files or all(f.filename == '' for f in files):
        return jsonify({'error': 'No files uploaded'}), 400

    ttl_mins = min(max(int(request.form.get('ttl', 1440)), 1), 43200)
    code = generate_code()
    if not code:
        return jsonify({'error': 'Server full'}), 503
    
    # Create folder once, not per-file
    folder = os.path.join(app.config['UPLOAD_FOLDER'], code)
    os.makedirs(folder, exist_ok=True)

    saved = []
    for file in files:
        if file and file.filename and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            path = os.path.join(folder, filename)
            file.save(path)
            saved.append({'filename': filename, 'path': path})

    if not saved:
        # Clean up the empty folder we created
        shutil.rmtree(folder, ignore_errors=True)
        return jsonify({'error': 'No valid files uploaded'}), 400

    with data_store_lock:
        if len(saved) == 1:
            data_store[code] = {'type': 'file', 'content': saved[0]['path'], 'filename': saved[0]['filename'], 'expires_at': time.time() + ttl_mins * 60}
        else:
            data_store[code] = {'type': 'multi_file', 'files': saved, 'expires_at': time.time() + ttl_mins * 60}
    return jsonify({'code': code})

@app.route('/get/<code>')
def get_data(code):
    data = data_store.get(code)
    if not data or ('expires_at' in data and time.time() > data['expires_at']):
        if data:
            with data_store_lock:
                data_store.pop(code, None)
            qr_cache.pop(code, None)
            if data['type'] in ('file', 'multi_file'):
                folder = os.path.join(app.config['UPLOAD_FOLDER'], code)
                if os.path.exists(folder):
                    shutil.rmtree(folder, ignore_errors=True)
        return redirect(url_for('index', error='invalid', code=code))

    expires_at = data.get('expires_at')
    expiry_msg = ""
    if expires_at:
        remaining_mins = max(1, int((expires_at - time.time()) / 60))
        expiry_msg = f"Expires in {remaining_mins} min{'s' if remaining_mins != 1 else ''}"

    if data['type'] == 'text':
        return render_template('display_text.html', text=data['content'], expiry_msg=expiry_msg)
    elif data['type'] == 'file':
        filename = data['filename']
        return render_template('display_file.html', filename=filename, code=code, expiry_msg=expiry_msg)
    elif data['type'] == 'multi_file':
        return render_template('display_multi_file.html', files=data['files'], code=code, expiry_msg=expiry_msg)

@app.route('/download/<code>/<filename>')
def download_bundle_file(code, filename):
    folder = os.path.join(app.config['UPLOAD_FOLDER'], code)
    return send_from_directory(directory=folder, path=filename, as_attachment=True)

@app.route('/download_zip/<code>')
def download_zip(code):
    data = data_store.get(code)
    if not data or data['type'] != 'multi_file':
        return "Bundle not found", 404

    # Use ZIP_STORED (no compression) — much faster for already-compressed files
    # like images, PDFs, MP4s which are the majority of uploads
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_STORED) as zf:
        for file_entry in data['files']:
            zf.write(file_entry['path'], arcname=file_entry['filename'])

    zip_buffer.seek(0)

    # Add Content-Length so browsers show real download progress
    response = make_response(send_file(
        zip_buffer,
        mimetype='application/zip',
        as_attachment=True,
        download_name=f'clipshare_{code}.zip'
    ))
    response.headers['Content-Length'] = zip_buffer.getbuffer().nbytes
    return response


@app.route('/qr/<code>')
def generate_qr(code):
    # Serve from cache if available (eliminates repeated CPU-heavy QR generation)
    if code in qr_cache:
        return send_file(io.BytesIO(qr_cache[code]), mimetype='image/png')

    url = request.host_url + 'get/' + code
    
    qr = qrcode.QRCode(
        version=4,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)

    try:
        # Fetch the monster avatar
        avatar_url = f"https://robohash.org/{code}.png?set=set2&size=100x100"
        response = _http_session.get(avatar_url, timeout=0.5)
        response.raise_for_status()
        
        logo = Image.open(io.BytesIO(response.content)).convert("RGBA")
        
        # Make stylish QR with logo
        img = qr.make_image(
            image_factory=StyledPilImage,
            module_drawer=RoundedModuleDrawer(),
            color_mask=SolidFillColorMask(front_color=(40, 30, 60), back_color=(255, 255, 255)),
            embeded_image_path=io.BytesIO(response.content)
        )
    except Exception as e:
        # Fallback to basic stylish QR without logo
        img = qr.make_image(
            image_factory=StyledPilImage,
            module_drawer=RoundedModuleDrawer(),
            color_mask=SolidFillColorMask(front_color=(40, 30, 60), back_color=(255, 255, 255))
        )

    img_io = io.BytesIO()
    img.save(img_io, 'PNG')
    qr_bytes = img_io.getvalue()

    # Cache the rendered QR for subsequent requests
    qr_cache[code] = qr_bytes

    return send_file(io.BytesIO(qr_bytes), mimetype='image/png')

if __name__ == '__main__':
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    port = int(os.environ.get('PORT', 5001))
    debug_mode = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    app.run(host='0.0.0.0', port=port, debug=debug_mode)
