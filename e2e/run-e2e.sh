#!/bin/bash
set -e

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

# 2. Verify DATABASE_URL is set (provided by the caller / CI environment)
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL is not set. Start PostgreSQL and export DATABASE_URL before running this script."
    exit 1
fi
echo "Using DATABASE_URL: ${DATABASE_URL}"

# 3. Setup environment and Prisma
export NEXTAUTH_URL="http://localhost:3001"
export NEXTAUTH_SECRET="e2e-test-secret-123456"
export PORT=3001
export NODE_ENV="development"
export ALLOW_SIGNUP="true"

echo "Generating Prisma client..."
npx prisma generate

echo "Running Prisma migrations..."
npx prisma migrate deploy

# 4. Start Next.js App
echo "Starting Next.js application on port 3001..."
npm run dev &
NEXT_PID=$!

echo "Waiting for Next.js to be ready on port 3001..."
npx wait-on http://localhost:3001 --timeout 120000
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
kill $NEXT_PID 2>/dev/null || true
wait $NEXT_PID 2>/dev/null || true

echo "=== Done ==="
exit $TEST_EXIT_CODE
