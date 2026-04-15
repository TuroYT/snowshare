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

    echo "Installing Playwright system dependencies..."
    .venv/bin/python -m playwright install-deps chromium || true
else
    source .venv/bin/activate
fi
cd ..

# 2. Start embedded PostgreSQL
# Use a temp file (not a FIFO) so the node process stdout is never blocked
# and the process stays alive after we read the ready signal.
echo "Starting embedded PostgreSQL..."
DB_OUTPUT=$(mktemp)
node e2e/start-db.mjs > "$DB_OUTPUT" 2>&1 &
DB_PID=$!

echo "Waiting for embedded PostgreSQL to be ready..."
TIMEOUT=30
ELAPSED=0
until grep -q "EMBEDDED_PG_READY" "$DB_OUTPUT" 2>/dev/null; do
  if [ $ELAPSED -ge $TIMEOUT ]; then
    echo "ERROR: embedded PostgreSQL did not become ready within ${TIMEOUT}s"
    cat "$DB_OUTPUT"
    kill $DB_PID 2>/dev/null || true
    rm -f "$DB_OUTPUT"
    exit 1
  fi
  sleep 1
  ELAPSED=$((ELAPSED + 1))
done

export DATABASE_URL
DATABASE_URL=$(grep "^DATABASE_URL=" "$DB_OUTPUT" | tail -1 | cut -d= -f2-)
rm -f "$DB_OUTPUT"

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: embedded PostgreSQL started but DATABASE_URL is empty"
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

echo "Running Prisma migrations..."
npx prisma migrate deploy

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
