from flask import Flask, render_template, request, redirect, url_for, flash
import subprocess, json, os, tempfile

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
        # Check if data comes from the visual editor (slice_data field)
        slice_data = request.form.get('slice_data')
        file = request.files.get('json_file')
        
        if slice_data:
            # Data from visual editor
            payload = json.loads(slice_data)
            tf = tempfile.NamedTemporaryFile(delete=False, suffix='.json', mode='w', encoding='utf-8')
            json.dump(payload, tf, ensure_ascii=False, indent=2)
            tf.close()
            path = tf.name
        elif file and getattr(file, 'filename', ''):
            # Uploaded JSON file
            tf = tempfile.NamedTemporaryFile(delete=False, suffix='.json')
            file.save(tf.name)
            path = tf.name
        else:
            # Legacy form fields (if still needed)
            name = request.form.get('slice_name') or 'unnamed-slice'
            topology = request.form.get('topology') or 'Anillo'
            try:
                num_vms = int(request.form.get('num_vms') or 0)
            except ValueError:
                num_vms = 0

            flavor_map = {
                'f1': {'cores': 1, 'disk_gb': 10, 'ram_gb': 2},
                'f2': {'cores': 1, 'disk_gb': 10, 'ram_gb': 4},
                'f3': {'cores': 2, 'disk_gb': 10, 'ram_gb': 2},
                'f4': {'cores': 2, 'disk_gb': 10, 'ram_gb': 4},
            }

            vms = []
            for i in range(1, num_vms + 1):
                vm_name = request.form.get(f'vm_name_{i}') or f"{name}-vm{i}"
                vm_flavor_key = request.form.get(f'vm_flavor_{i}') or 'f1'
                vms.append({
                    'name': vm_name,
                    'flavor_key': vm_flavor_key,
                    'flavor': flavor_map.get(vm_flavor_key, {})
                })

            payload = {
                'name': name,
                'topology': topology,
                'vms': vms
            }

            tf = tempfile.NamedTemporaryFile(delete=False, suffix='.json', mode='w', encoding='utf-8')
            json.dump(payload, tf, ensure_ascii=False, indent=2)
            tf.close()
            path = tf.name

        try:
            subprocess.run(['python3', 'deploy_from_jsonv2.py', path], check=True)
            flash("Slice desplegado exitosamente ✅")
        except subprocess.CalledProcessError as e:
            flash(f"Error desplegando slice: {e}")

        return redirect(url_for('index'))
    return render_template('create.html')

@app.route('/slice/<name>')
def slice_detail(name):
    info = subprocess.check_output(['bash', 'show_slice_info.sh', name]).decode()
    return render_template('detail.html', name=name, info=info)

@app.route('/delete/<name>', methods=['GET', 'POST'])
def delete_slice(name):
    # Allow deletion via POST (from a form) while keeping GET for compatibility
    subprocess.run(['bash', 'delete_slice.sh', name])
    flash(f"Slice '{name}' eliminado ❌")
    return redirect(url_for('index'))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
