#!/bin/bash
# Serves the repo root on 127.0.0.1:$PORT (ThreadingTCPServer, law 16) and runs the wallet tests against $TARGET.
# usage: PORT=8932 TARGET=/path/to/index.html LABEL=name [CASES=a1,b] bash tools/stormglass/wallet-tests/run.sh
# Long: start it in the background, e.g. (setsid nohup timeout 900 bash run.sh > /tmp/x.log 2>&1 &) and poll the log.
DIR="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$DIR/../../.." && pwd)"; PORT=${PORT:-8932}
python3 - "$ROOT" "$PORT" <<'PY' &
import http.server, socketserver, os, sys
os.chdir(sys.argv[1])
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
class S(socketserver.ThreadingTCPServer):
    allow_reuse_address=True; daemon_threads=True
with S(("127.0.0.1",int(sys.argv[2])),H) as s: s.serve_forever()
PY
SRV=$!
sleep 1
# the server must be ours and alive (a port already taken makes python exit; the tests would then talk to someone else's server)
if ! kill -0 $SRV 2>/dev/null; then echo "HARNESS FAIL the HTTP server on 127.0.0.1:$PORT did not start (port taken?)"; echo "XDONE rc=1"; exit 1; fi
NODE_PATH=${NODE_PATH:-/home/claude/node_modules} PORT=$PORT node "$DIR/${SCRIPT:-wallet.test.js}"
RC=$?
kill $SRV 2>/dev/null
echo "XDONE rc=$RC"
exit $RC
