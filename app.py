from flask import Flask, request, redirect, url_for, send_from_directory, render_template, jsonify, send_file
import os
import qrcode
import io
import random
from werkzeug.utils import secure_filename

app = Flask(__name__)
UPLOAD_FOLDER = 'uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

data_store = {}

def generate_code():
    while True:
        code = str(random.randint(1000, 9999))
        if code not in data_store:
            return code

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload_text', methods=['POST'])
def upload_text():
    text = request.form['text']
    code = generate_code()
    data_store[code] = {'type': 'text', 'content': text}
    return jsonify({'code': code})

@app.route('/upload_file', methods=['POST'])
def upload_file():
    file = request.files['file']
    if file:
        filename = secure_filename(file.filename)
        code = generate_code()
        path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(path)
        data_store[code] = {'type': 'file', 'content': path, 'filename': filename}
        return jsonify({'code': code})
    return "No file uploaded", 400

@app.route('/get/<code>')
def get_data(code):
    data = data_store.get(code)
    if not data:
        return redirect(url_for('index', error='invalid', code=code))

    if data['type'] == 'text':
        return render_template('display_text.html', text=data['content'])
    elif data['type'] == 'file':
        full_path = data['content']
        filepath = os.path.basename(full_path)
        filename = data['filename']
        return render_template('display_file.html', filename=filename, filepath=filepath)

@app.route('/download/<filename>')
def download_file(filename):
    return send_from_directory(directory='uploads', path=filename, as_attachment=True)


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
    app.run(host='0.0.0.0', port=port, debug=True)
