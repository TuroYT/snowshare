.PHONY: help dev dev-next build test test-watch test-coverage \
        lint lint-fix format type-check db-setup db-migrate db-generate \
        db-studio clean setup ci

.DEFAULT_GOAL := help

help: ## Show available commands
	@echo ""
	@echo "SnowShare - Developer Commands"
	@echo "================================"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
	@echo ""

# --- Development --------------------------------------------------------------

dev: ## Start dev server with tus uploads (default)
	npm run dev

dev-next: ## Start Next.js only (faster reload, no file uploads)
	npm run dev:next

build: ## Generate Prisma client and build Next.js
	npm run build

start: ## Start production server
	npm start

# --- Code Quality -------------------------------------------------------------

lint: ## Check code with ESLint
	npm run lint

lint-fix: ## Fix linting errors and format code
	npm run lint:fix && npm run format

format: ## Format all files with Prettier
	npm run format

format-check: ## Check formatting without writing
	npm run format:check

type-check: ## Check TypeScript types without compiling
	npm run type-check

# --- Testing ------------------------------------------------------------------

test: ## Run all tests
	npm test

test-watch: ## Run tests in watch mode
	npm run test:watch

test-coverage: ## Run tests with coverage report
	npm run test:coverage

# --- Database -----------------------------------------------------------------

db-setup: db-migrate db-generate ## Run migrations + generate Prisma client

db-migrate: ## Run Prisma migrations (dev)
	npx prisma migrate dev

db-generate: ## Regenerate Prisma client
	npx prisma generate

db-studio: ## Open Prisma Studio (DB GUI)
	npx prisma studio

db-deploy: ## Deploy migrations (production)
	npx prisma migrate deploy

# --- Maintenance --------------------------------------------------------------

setup: ## First-time setup: install deps + copy .env + DB setup
	npm install
	@if [ ! -f .env ]; then cp .env.example .env; echo ".env created from .env.example — fill in your values"; fi
	$(MAKE) db-setup

cleanup: ## Remove expired shares
	npm run cleanup:expired

clean: ## Remove build artifacts and reinstall deps
	rm -rf .next node_modules
	npm install

ci: lint type-check test ## Run full CI pipeline locally (lint + type-check + tests)
