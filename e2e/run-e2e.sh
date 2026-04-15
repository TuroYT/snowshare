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

# 2. Start PostgreSQL via Docker Compose
echo "Starting temporary PostgreSQL database..."
docker compose -f e2e/docker-compose.yml up -d

# Wait for DB to be healthy
echo "Waiting for database to be ready..."
sleep 3
until docker exec snowshare-e2e-db pg_isready -U e2e_user -d e2e_db >/dev/null 2>&1; do
  echo "Waiting..."
  sleep 1
done

# 3. Setup Prisma
echo "Generating Prisma client..."
npx prisma generate

echo "Pushing Prisma schema to temporary database..."
export DATABASE_URL="postgresql://e2e_user:e2e_password@localhost:5433/e2e_db?schema=public"
export NEXTAUTH_URL="http://localhost:3001"
export NEXTAUTH_SECRET="e2e-test-secret-123456"
export PORT=3001
export NODE_ENV="development"
export ALLOW_SIGNUP="true"

npx prisma db push

# Create admin user if needed ? We can let Robot Framework register it

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
set +e # Don't exit script immediately if tests fail
cd e2e
source .venv/bin/activate
robot -d results tests/
TEST_EXIT_CODE=$?
cd ..

# 6. Teardown
echo "Tearing down E2E environment..."
kill $NEXT_PID || true
docker compose -f e2e/docker-compose.yml down -v

echo "=== Done ==="
exit $TEST_EXIT_CODE
