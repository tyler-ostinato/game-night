# Shortcuts for local development. Run `just` to list them.
# Testing mode uses TEST_DATABASE_URL (a separate database), never the real data. See README "Testing mode".

state := ".test-mode"
pidfile := state / "pid"
logfile := state / "test.log"

# List the commands
default:
    @just --list

# Start testing mode in the background (test site on http://localhost:5174, API on :3002)
test-up:
    #!/usr/bin/env bash
    set -euo pipefail
    mkdir -p {{state}}
    if [ -f {{pidfile}} ] && kill -0 "$(cat {{pidfile}})" 2>/dev/null; then
      echo "Testing mode is already running: http://localhost:5174"; exit 0
    fi
    if ! grep -q '^TEST_DATABASE_URL=' .env.local 2>/dev/null; then
      echo "TEST_DATABASE_URL isn't in .env.local. See README > Testing mode, then run: npx vercel env pull"; exit 1
    fi
    # setsid gives it its own process group, so test-down can stop the API and the site together
    setsid nohup npm run dev:test > {{logfile}} 2>&1 < /dev/null &
    echo $! > {{pidfile}}
    for _ in $(seq 30); do
      if curl -sf -o /dev/null http://localhost:5174/api/mode; then
        echo "Testing mode is running: http://localhost:5174 (logs: just test-logs, stop: just test-down)"; exit 0
      fi
      sleep 1
    done
    echo "Didn't come up within 30s. Last lines of the log:"; tail -20 {{logfile}}; exit 1

# Stop testing mode
test-down:
    #!/usr/bin/env bash
    set -uo pipefail
    if [ -f {{pidfile}} ] && kill -0 "$(cat {{pidfile}})" 2>/dev/null; then
      kill -- -"$(cat {{pidfile}})" 2>/dev/null
    fi
    rm -f {{pidfile}}
    # Also stop anything else still holding the test ports (e.g. a copy started by hand)
    for port in 3002 5174; do
      pids=$(lsof -ti tcp:$port -sTCP:LISTEN 2>/dev/null || true)
      [ -n "$pids" ] && kill $pids 2>/dev/null
    done
    echo "Testing mode stopped."

# Restart testing mode
test-restart: test-down test-up

# Is testing mode running?
test-status:
    #!/usr/bin/env bash
    if curl -sf http://localhost:5174/api/mode | grep -q '"test":true'; then
      echo "Running: http://localhost:5174"
    else
      echo "Not running. Start it with: just test-up"
    fi

# Follow testing mode's output (Ctrl+C stops following, not the servers)
test-logs:
    tail -f {{logfile}}

# Typecheck, lint and unit tests: the same as CI and the pre-commit hook
check:
    npm run check

# Unit tests only
test:
    npm test
