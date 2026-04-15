#!/bin/bash
set -e

# Change directory to the root of the project
cd "$(dirname "$0")/.."

echo "=== SnowShare E2E Test Runner ==="

# 1. Setup Python Virtual Environment
cd e2e
if [ ! -d ".venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv .venv
    source .venv/bin/activate
    echo "Installing dependencies (first time only)..."
    pip install -q -r requirements.txt

    echo "Initializing robotframework-browser (Playwright)..."
    rfbrowser init
else
    source .venv/bin/activate
fi
cd ..

# 2. Start embedded PostgreSQL
echo "Starting embedded PostgreSQL..."
FIFO=$(mktemp -u)
mkfifo "$FIFO"
node e2e/start-db.mjs > "$FIFO" &
DB_PID=$!

# Read DATABASE_URL from the script output, wait for ready signal
while IFS= read -r line; do
    case "$line" in
        DATABASE_URL=*)
            export "${line}"
            ;;
        EMBEDDED_PG_READY)
            break
            ;;
    esac
done < "$FIFO"
rm -f "$FIFO"

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: embedded PostgreSQL failed to start, DATABASE_URL is empty"
  kill $DB_PID 2>/dev/null || true
  exit 1
fi

echo "Embedded PostgreSQL ready (DATABASE_URL=${DATABASE_URL})"

# 3. Setup Prisma
export NEXTAUTH_URL="http://localhost:3001"
export NEXTAUTH_SECRET="e2e-test-secret-123456"
export PORT=3001
export NODE_ENV="development"
export ALLOW_SIGNUP="true"

echo "Generating Prisma client..."
npx prisma generate

echo "Pushing Prisma schema to temporary database..."
npx prisma db push

# 4. Start Next.js App
echo "Starting Next.js application on port 3001..."
npm run dev &
NEXT_PID=$!

echo "Waiting for Next.js to be ready on port 3001..."
until npx wait-on http://localhost:3001; do
  sleep 1
done
echo "Next.js is ready!"

# 5. Run Robot Framework Tests
echo "Running Robot Framework E2E tests..."
set +e
cd e2e
source .venv/bin/activate
robot -d results tests/
TEST_EXIT_CODE=$?
cd ..

# 6. Teardown
echo "Tearing down E2E environment..."
kill $NEXT_PID || true
kill $DB_PID || true
wait $DB_PID 2>/dev/null || true

echo "=== Done ==="
exit $TEST_EXIT_CODE
