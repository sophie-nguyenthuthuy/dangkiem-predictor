.PHONY: help install dev dev-api dev-web dev-predictor build test typecheck lint format \
        db-up db-down db-migrate db-seed db-studio docker-up docker-down clean

help:
	@echo "Đăng kiểm Predictor — common commands"
	@echo ""
	@echo "  make install        Install all Node + Python deps"
	@echo "  make dev            Run web + api + predictor + db locally"
	@echo "  make db-up          Start Postgres in Docker"
	@echo "  make db-migrate     Run Prisma migrations"
	@echo "  make db-seed        Seed centers, slots, demo users"
	@echo "  make test           Run all tests (Node + Python)"
	@echo "  make docker-up      docker compose up --build"
	@echo "  make clean          Remove node_modules + venv + dist"

install:
	pnpm install
	cd services/predictor && pip install -e ".[dev]"

dev: db-up
	pnpm dev

dev-api:
	pnpm --filter @dangkiem/api dev

dev-web:
	pnpm --filter @dangkiem/web dev

dev-predictor:
	cd services/predictor && uvicorn app.main:app --reload --port 8000

build:
	pnpm build

test:
	pnpm test
	cd services/predictor && pytest -q

typecheck:
	pnpm typecheck

lint:
	pnpm lint

format:
	pnpm format

db-up:
	docker compose up -d postgres

db-down:
	docker compose down

db-migrate:
	pnpm --filter @dangkiem/api db:migrate

db-seed:
	pnpm --filter @dangkiem/api db:seed

db-studio:
	pnpm --filter @dangkiem/api db:studio

docker-up:
	docker compose up --build

docker-down:
	docker compose down

clean:
	find . -name node_modules -type d -prune -exec rm -rf {} +
	find . -name __pycache__ -type d -prune -exec rm -rf {} +
	find . -name dist -type d -prune -exec rm -rf {} +
	find . -name .next -type d -prune -exec rm -rf {} +
	find . -name .venv -type d -prune -exec rm -rf {} +
