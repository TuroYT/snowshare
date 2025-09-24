.PHONY: help build up down logs restart clean backup

help: ## Show this help message
	@echo "SnowShare Docker Commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

build: ## Build the Docker image
	docker-compose build --no-cache

up: ## Start the application
	docker-compose up -d

down: ## Stop the application
	docker-compose down

logs: ## Show application logs
	docker-compose logs -f snowshare

restart: ## Restart the application
	docker-compose restart snowshare

clean: ## Clean up containers and images (CAREFUL: removes data)
	docker-compose down -v --rmi all

backup: ## Backup database and uploads
	@echo "Creating backup..."
	@mkdir -p backups
	@docker run --rm -v snowshare_data:/data -v $(PWD)/backups:/backup alpine cp /data/snowshare.db /backup/snowshare-$(shell date +%Y%m%d-%H%M%S).db
	@docker run --rm -v snowshare_uploads:/uploads -v $(PWD)/backups:/backup alpine tar czf /backup/uploads-$(shell date +%Y%m%d-%H%M%S).tar.gz -C /uploads .
	@echo "Backup completed in ./backups/"

dev: ## Start in development mode
	docker-compose -f docker-compose.dev.yml up

setup: ## Initial setup - copy environment file
	@if [ ! -f .env.production ]; then \
		cp .env.production.example .env.production; \
		echo "Created .env.production - please edit it with your settings"; \
	else \
		echo ".env.production already exists"; \
	fi