from flask import Flask, render_template, request, redirect, url_for, flash
import subprocess, json, os, tempfile, re

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

            # Flavors: user requested 6 flavors. The original 4 are kept
            # and two additional flavors (f5, f6) are added. Assumption:
            # f5 = 1 CPU, 10 GB SSD, 8 GB RAM
            # f6 = 2 CPUs, 10 GB SSD, 8 GB RAM
            # If you want different values for f5/f6, tell me and I will change them.
            flavor_map = {
                'f1': {'cores': 1, 'disk_gb': 10, 'ram_gb': 2},
                'f2': {'cores': 1, 'disk_gb': 10, 'ram_gb': 4},
                'f3': {'cores': 2, 'disk_gb': 10, 'ram_gb': 2},
                'f4': {'cores': 2, 'disk_gb': 10, 'ram_gb': 4},
                'f5': {'cores': 1, 'disk_gb': 10, 'ram_gb': 8},
                'f6': {'cores': 2, 'disk_gb': 10, 'ram_gb': 8},
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


@app.after_request
def style_buttons(response):
    """Post-process HTML responses to style buttons:
    - Make 'Cancelar' buttons red (btn-danger)
    - Ensure 'Cancelar' and 'Editar Topología' buttons have the same size
    This is a conservative, template-free change.
    """
    try:
        ct = response.headers.get('Content-Type', '')
        if 'text/html' in ct.lower():
            html = response.get_data(as_text=True)

            # Replace "Cancelar" buttons: add btn-danger class if btn class exists
            # otherwise add inline red style matching the size of other buttons
            def _repl_cancelar(m):
                attrs = m.group(1) or ''
                inner = m.group(2) or ''
                # Check if class attribute exists
                if re.search(r'class\s*=\s*["\']', attrs, re.IGNORECASE):
                    # Append btn-danger to existing class
                    attrs = re.sub(r'(class\s*=\s*["\'])(.*?)(["\'])',
                                   lambda mm: f"{mm.group(1)}{mm.group(2).strip()} btn-danger{mm.group(3)}",
                                   attrs, flags=re.IGNORECASE)
                    return f"<button{attrs}>{inner}</button>"
                else:
                    # Add inline red style with consistent sizing
                    style = ' class="btn btn-danger"'
                    return f"<button{attrs}{style}>{inner}</button>"

            # Apply to Cancelar buttons
            html_new = re.sub(r'<button([^>]*)>(\s*Cancelar\s*)</button>', _repl_cancelar, html, flags=re.IGNORECASE)
            
            # Ensure both button types have consistent btn class for sizing
            # If "Editar Topología" doesn't have btn class, add it
            def _repl_editar(m):
                attrs = m.group(1) or ''
                inner = m.group(2) or ''
                if not re.search(r'class\s*=\s*["\'][^"\']*\bbtn\b', attrs, re.IGNORECASE):
                    # Add btn class if not present
                    if re.search(r'class\s*=\s*["\']', attrs, re.IGNORECASE):
                        attrs = re.sub(r'(class\s*=\s*["\'])(.*?)(["\'])',
                                       lambda mm: f"{mm.group(1)}btn {mm.group(2).strip()}{mm.group(3)}",
                                       attrs, flags=re.IGNORECASE)
                    else:
                        attrs += ' class="btn"'
                return f"<button{attrs}>{inner}</button>"
            
            html_new = re.sub(r'<button([^>]*)>(\s*Editar\s+Topolog[ií]a\s*)</button>', _repl_editar, html_new, flags=re.IGNORECASE)
            
            if html_new != html:
                response.set_data(html_new)
    except Exception:
        # Don't break responses on any error; fail silently.
        pass
    return response

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
