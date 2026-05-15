#!/usr/bin/env bash
# Bootstrap local dev: db + migrations + seed + all services
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if ! command -v pnpm >/dev/null; then
  echo "pnpm not found. Install: npm i -g pnpm"
  exit 1
fi
if ! command -v docker >/dev/null; then
  echo "docker not found."
  exit 1
fi

echo "→ Starting Postgres"
docker compose up -d postgres

echo "→ Waiting for Postgres"
until docker compose exec -T postgres pg_isready -U dangkiem >/dev/null 2>&1; do
  sleep 1
done

echo "→ Installing deps"
pnpm install

echo "→ Generating Prisma client"
pnpm --filter @dangkiem/api prisma generate

echo "→ Running migrations"
pnpm --filter @dangkiem/api db:migrate

echo "→ Seeding"
pnpm --filter @dangkiem/api db:seed

echo ""
echo "Dev environment ready. Now run:"
echo "  pnpm dev                                  # all services"
echo "  cd services/predictor && uvicorn app.main:app --reload --port 8000"
echo ""
echo "Web:       http://localhost:3000"
echo "API docs:  http://localhost:4000/docs"
echo "Predictor: http://localhost:8000/docs"
