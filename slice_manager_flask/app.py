from flask import Flask, render_template, request, redirect, url_for, flash
import subprocess, json, os

app = Flask(__name__)
app.secret_key = "clave-secreta-para-flash"

@app.route('/')
def index():
    try:
        result = subprocess.check_output(['bash', 'list_slices.sh'])
        slices = result.decode().splitlines()
    except:
        slices = []
    return render_template('index.html', slices=slices)

@app.route('/create', methods=['GET', 'POST'])
def create_slice():
    if request.method == 'POST':
        file = request.files['json_file']
        if not file:
            flash("Debe seleccionar un archivo JSON")
            return redirect(url_for('create_slice'))
        path = f"/tmp/{file.filename}"
        file.save(path)
        subprocess.run(['python3', 'deploy_from_jsonv2.py', path])
        flash("Slice desplegado exitosamente ✅")
        return redirect(url_for('index'))
    return render_template('create.html')

@app.route('/slice/<name>')
def slice_detail(name):
    info = subprocess.check_output(['bash', 'show_slice_info.sh', name]).decode()
    return render_template('detail.html', name=name, info=info)

@app.route('/delete/<name>')
def delete_slice(name):
    subprocess.run(['bash', 'delete_slice.sh', name])
    flash(f"Slice '{name}' eliminado ❌")
    return redirect(url_for('index'))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
