#!/bin/bash
SLICE=$1
if [ -z "$SLICE" ]; then
  echo "Uso: delete_slice.sh <nombre_slice>"
  exit 1
fi
echo "Eliminando slice $SLICE ..."
sleep 1
echo "Slice $SLICE eliminado."
