#!/bin/bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl unzip xz-utils xvfb python3-pil xdotool
if ! command -v bun >/dev/null; then
  curl -fsSL https://bun.com/install | BUN_INSTALL=/usr/local bash -s 'bun-v1.3.14'
fi
mkdir -p /opt/kritovas /workspace
tar -xzf /tmp/kritovas-computer.tar.gz -C /opt/kritovas
cd /opt/kritovas/agent-computer
bun install --frozen-lockfile
export PLAYWRIGHT_BROWSERS_PATH=/opt/kritovas/browsers
bunx --bun playwright install --with-deps chromium
cat > /usr/local/bin/kritovas-computer-start <<'START'
#!/bin/bash
set -euo pipefail
if curl -fsS http://127.0.0.1:4100/health >/dev/null 2>&1; then exit 0; fi
: "${COMPUTER_TOKEN:?The server must supply its computer token}"
export PLAYWRIGHT_BROWSERS_PATH=/opt/kritovas/browsers
export WORKSPACE_DIR=/workspace
export PORT=4100
export COMPUTER_BROWSER_MODE=headed
export COMPUTER_DESKTOP_DISPLAY=:1
export DISPLAY=:1
cd /opt/kritovas/agent-computer
nohup /usr/local/bin/bun src/index.ts >/tmp/kritovas-computer.log 2>&1 </dev/null &
for attempt in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:4100/health >/dev/null 2>&1; then exit 0; fi
  sleep 0.25
done
exit 1
START
chmod 0755 /usr/local/bin/kritovas-computer-start
rm /tmp/kritovas-computer.tar.gz
