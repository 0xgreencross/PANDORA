#!/bin/bash
# Serves the repo root on 127.0.0.1:8931 and runs SCRIPT with node. Usage: SCRIPT=x.js timeout N bash serve.sh
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
python3 - "$ROOT" <<'PY' &
import http.server, socketserver, os, sys
os.chdir(sys.argv[1])
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
class S(socketserver.ThreadingTCPServer):
    allow_reuse_address=True; daemon_threads=True
with S(("127.0.0.1",8931),H) as s: s.serve_forever()
PY
SRV=$!
sleep 1.5
NODE_PATH=/home/claude/node_modules node "$SCRIPT" 2>&1 | tail -${TAIL:-40}
kill $SRV 2>/dev/null
echo XDONE
