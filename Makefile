.PHONY: help setup up down restart logs rebuild shell-api shell-mongo test backup clean

# ── Default target ────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  IPAM Portal — Make Targets"
	@echo "  ──────────────────────────────────────────"
	@echo "  make setup        Run automated setup wizard"
	@echo "  make up           Start all services"
	@echo "  make down         Stop all services"
	@echo "  make restart      Restart all services"
	@echo "  make logs         Tail logs (all services)"
	@echo "  make logs-api     Tail API logs only"
	@echo "  make logs-nginx   Tail Nginx logs only"
	@echo "  make rebuild      Rebuild images and restart"
	@echo "  make shell-api    Open shell in API container"
	@echo "  make shell-mongo  Open mongosh in MongoDB"
	@echo "  make test         Run backend unit tests"
	@echo "  make backup       Backup MongoDB to ./backups/"
	@echo "  make clean        Remove containers, volumes, and images"
	@echo ""

# ── Setup ─────────────────────────────────────────────────────────────────────
setup:
	@bash setup.sh

# ── Stack management ──────────────────────────────────────────────────────────
up:
	docker compose up -d
	@echo ""
	@echo "✓ Stack started. Waiting for health checks..."
	@sleep 5
	@docker compose ps

down:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f --tail=100

logs-api:
	docker compose logs -f --tail=100 api

logs-nginx:
	docker compose logs -f --tail=100 nginx

rebuild:
	docker compose down
	docker compose build --no-cache
	docker compose up -d

# ── Shells ────────────────────────────────────────────────────────────────────
shell-api:
	docker compose exec api /bin/sh

shell-mongo:
	docker compose exec mongodb mongosh \
		-u $$(grep MONGO_APP_USER .env | cut -d= -f2) \
		-p $$(grep MONGO_APP_PASSWORD .env | cut -d= -f2) \
		--authenticationDatabase ipam ipam

# ── Testing ───────────────────────────────────────────────────────────────────
test:
	docker compose exec api pytest tests/ -v --tb=short

test-unit:
	docker compose exec api pytest tests/unit/ -v

test-integration:
	docker compose exec api pytest tests/integration/ -v

# ── Backup ────────────────────────────────────────────────────────────────────
backup:
	@mkdir -p backups
	@TIMESTAMP=$$(date +%Y%m%d_%H%M%S); \
	docker compose exec mongodb mongodump \
		--uri="mongodb://$$(grep MONGO_APP_USER .env | cut -d= -f2):$$(grep MONGO_APP_PASSWORD .env | cut -d= -f2)@localhost:27017/ipam?authSource=ipam" \
		--out=/tmp/backup_$$TIMESTAMP && \
	docker compose exec mongodb tar czf /tmp/ipam_backup_$$TIMESTAMP.tar.gz -C /tmp backup_$$TIMESTAMP && \
	docker compose cp mongodb:/tmp/ipam_backup_$$TIMESTAMP.tar.gz backups/ && \
	echo "✓ Backup saved to backups/ipam_backup_$$TIMESTAMP.tar.gz"

# ── Cleanup ───────────────────────────────────────────────────────────────────
clean:
	@echo "WARNING: This will remove all containers, images, and MongoDB data."
	@read -p "Type 'yes' to confirm: " confirm; \
	if [ "$$confirm" = "yes" ]; then \
		docker compose down -v --rmi all; \
		echo "✓ Cleanup complete"; \
	else \
		echo "Aborted."; \
	fi
