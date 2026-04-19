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

echo "Installing Playwright system dependencies..."
PLAYWRIGHT_BIN=$(find .venv -path "*/node_modules/.bin/playwright" | head -1)
if [ -n "$PLAYWRIGHT_BIN" ]; then
    sudo "$PLAYWRIGHT_BIN" install-deps chromium || true
else
    echo "Warning: playwright binary not found, skipping install-deps"
fi
cd ..

# 2. Start PostgreSQL via Docker Compose
echo "Starting PostgreSQL via Docker Compose..."
docker compose -f e2e/docker-compose.yml down -v --remove-orphans 2>/dev/null || true
docker compose -f e2e/docker-compose.yml up -d

echo "Waiting for PostgreSQL to be healthy..."
TIMEOUT=60
ELAPSED=0
until docker compose -f e2e/docker-compose.yml exec -T db-e2e pg_isready -U e2e_user -d e2e_db > /dev/null 2>&1; do
    if [ $ELAPSED -ge $TIMEOUT ]; then
        echo "ERROR: PostgreSQL did not become ready within ${TIMEOUT}s"
        docker compose -f e2e/docker-compose.yml logs db-e2e
        docker compose -f e2e/docker-compose.yml down -v
        exit 1
    fi
    sleep 1
    ELAPSED=$((ELAPSED + 1))
done
echo "PostgreSQL is ready!"

# 3. Setup environment and Prisma
export DATABASE_URL="postgresql://e2e_user:e2e_password@localhost:5433/e2e_db?schema=public"
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
docker compose -f e2e/docker-compose.yml down -v

echo "=== Done ==="
exit $TEST_EXIT_CODE
