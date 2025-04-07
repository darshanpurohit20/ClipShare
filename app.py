
from flask import Flask, request, redirect, url_for, send_from_directory, render_template, jsonify
import os
import uuid
import qrcode
import io
from flask import send_file 
from werkzeug.utils import secure_filename
from flask import send_file 

app = Flask(__name__)
UPLOAD_FOLDER = 'uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

data_store = {}  # In-memory store for simplicity

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload_text', methods=['POST'])
def upload_text():
    text = request.form['text']
    code = str(uuid.uuid4())[:8]
    data_store[code] = {'type': 'text', 'content': text}
    return jsonify({'code': code})

@app.route('/upload_file', methods=['POST'])
def upload_file():
    file = request.files['file']
    if file:
        filename = secure_filename(file.filename)
        code = str(uuid.uuid4())[:8]
        path = os.path.join(app.config['UPLOAD_FOLDER'], code + "_" + filename)
        file.save(path)
        data_store[code] = {'type': 'file', 'content': path, 'filename': filename}
        return jsonify({'code': code})
    return "No file uploaded", 400

@app.route('/get/<code>')
def get_data(code):
    data = data_store.get(code)
    if not data:
        return "Invalid code", 404
    if data['type'] == 'text':
        return render_template('display_text.html', text=data['content'])
    elif data['type'] == 'file':
        return send_from_directory(directory='uploads', path=os.path.basename(data['content']), as_attachment=True, download_name=data['filename'])




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
    app.run(debug=True)
