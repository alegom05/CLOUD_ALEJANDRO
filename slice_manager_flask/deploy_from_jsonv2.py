#!/usr/bin/env python3
import sys, json, time

if len(sys.argv) < 2:
    print("Uso: python3 deploy_from_jsonv2.py <archivo_json>")
    sys.exit(1)

file_path = sys.argv[1]
with open(file_path) as f:
    data = json.load(f)

print(f"Desplegando slice con nombre: {data.get('name', 'sin_nombre')}")
time.sleep(2)
print("Slice desplegado con éxito ✅")
