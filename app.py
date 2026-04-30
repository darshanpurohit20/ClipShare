from flask import Flask, request, redirect, url_for, send_from_directory, render_template, jsonify, send_file
import zipfile
import os
import qrcode
import io
import secrets
import time
import threading
import shutil
from werkzeug.utils import secure_filename

app = Flask(__name__)
UPLOAD_FOLDER = 'uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB limit

ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'docx', 'doc', 'xlsx', 'xls', 'csv', 'zip', 'rar', 'mp4', 'mp3'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

data_store = {}

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
        expired_codes = [code for code, data in data_store.items() if 'expires_at' in data and current_time > data['expires_at']]
        
        for code in expired_codes:
            data = data_store.pop(code, None)
            if data and data['type'] in ('file', 'multi_file'):
                folder = os.path.join(app.config['UPLOAD_FOLDER'], code)
                if os.path.exists(folder):
                    shutil.rmtree(folder, ignore_errors=True)

threading.Thread(target=cleanup_expired_data, daemon=True).start()

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
    
    saved = []
    for file in files:
        if file and file.filename and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            folder = os.path.join(app.config['UPLOAD_FOLDER'], code)
            os.makedirs(folder, exist_ok=True)
            path = os.path.join(folder, filename)
            file.save(path)
            saved.append({'filename': filename, 'path': path})

    if not saved:
        return jsonify({'error': 'No valid files uploaded'}), 400

    data_store[code] = {'type': 'multi_file', 'files': saved, 'expires_at': time.time() + ttl_mins * 60}
    return jsonify({'code': code})

@app.route('/get/<code>')
def get_data(code):
    data = data_store.get(code)
    if not data or ('expires_at' in data and time.time() > data['expires_at']):
        if data:
            data_store.pop(code, None)
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

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        for file_entry in data['files']:
            zf.write(file_entry['path'], arcname=file_entry['filename'])

    zip_buffer.seek(0)
    return send_file(
        zip_buffer,
        mimetype='application/zip',
        as_attachment=True,
        download_name=f'clipshare_{code}.zip'
    )


@app.route('/qr/<code>')
def generate_qr(code):
    url = request.host_url + 'get/' + code
    img = qrcode.make(url)
    img_io = io.BytesIO()
    img.save(img_io, 'PNG')
    img_io.seek(0)
    return send_file(img_io, mimetype='image/png')

if __name__ == '__main__':
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    port = int(os.environ.get('PORT', 5001))
    debug_mode = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    app.run(host='0.0.0.0', port=port, debug=debug_mode)
