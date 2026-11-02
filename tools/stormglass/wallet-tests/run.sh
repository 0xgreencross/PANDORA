#!/bin/bash
# Serves the repo root on 127.0.0.1:$PORT (ThreadingTCPServer, law 16) and runs the wallet tests against $TARGET.
# usage: PORT=8932 TARGET=/path/to/index.html LABEL=name [CASES=a1,b | RELEASE=1] [OUT=dir] bash tools/stormglass/wallet-tests/run.sh
# Long: start it in the background, e.g. (setsid nohup timeout 900 bash run.sh > /tmp/x.log 2>&1 &) and poll the log.
# The status is node's (0 only for a complete, passing, saved run; see runner.js, shared by wallet.test.js and ../staging/staging.test.js). SIGTERM/SIGINT are passed to node, which
# writes an "interrupted" results file and exits 143/130; the HTTP server is always stopped. The last line is always "XDONE rc=N"
# (a log without it means this script itself was killed: treat it as a failure).
DIR="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$DIR/../../.." && pwd)"; PORT=${PORT:-8932}
READY=$(mktemp); trap 'rm -f "$READY"' EXIT
python3 - "$ROOT" "$PORT" "$READY" <<'PY' &
import http.server, socketserver, os, sys
os.chdir(sys.argv[1])
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
class S(socketserver.ThreadingTCPServer):
    allow_reuse_address=True; daemon_threads=True
with S(("127.0.0.1",int(sys.argv[2])),H) as s:
    open(sys.argv[3],"w").write("bound\n")   # written only once this process holds the port
    s.serve_forever()
PY
SRV=$!
NODE=
stop(){ [ -n "$NODE" ] && kill -"$1" "$NODE" 2>/dev/null; }
trap 'stop TERM' TERM; trap 'stop INT' INT
# gate, not a sleep: the server must be ours, alive and bound (it writes $READY after the bind) (a port already taken makes python exit; the tests would then talk to someone else's server)
UP=0; for i in $(seq 1 50); do
  if ! kill -0 $SRV 2>/dev/null; then break; fi
  if [ -s "$READY" ]; then UP=1; break; fi
  sleep 0.1; done
if [ $UP != 1 ] || ! kill -0 $SRV 2>/dev/null; then echo "HARNESS FAIL the HTTP server on 127.0.0.1:$PORT did not start (port taken?)"; kill $SRV 2>/dev/null; echo "XDONE rc=1"; exit 1; fi
NODE_PATH=${NODE_PATH:-/home/claude/node_modules} PORT=$PORT node "$DIR/${SCRIPT:-wallet.test.js}" &
NODE=$!
# wait returns early when a trapped signal arrives: keep waiting until node itself has ended (it writes the interrupted results first)
while :; do wait $NODE; RC=$?; kill -0 $NODE 2>/dev/null || break; done
kill $SRV 2>/dev/null
echo "XDONE rc=$RC"
exit $RC
