#!/bin/bash
# =============================================================================
# ReConnect - Script de Deploy para VPS
# Uso: ./scripts/deploy.sh
# =============================================================================

set -euo pipefail

echo "=== ReConnect: Deploy ==="

# Pull latest code
echo "[1/5] Atualizando codigo..."
git pull origin main

# Build and restart all containers
echo "[2/5] Construindo containers..."
docker compose build --no-cache app api

echo "[3/5] Aplicando migrations do banco..."
docker compose up -d db
sleep 5
docker compose run --rm api npx prisma migrate deploy

echo "[4/5] Reiniciando todos os servicos..."
docker compose up -d

echo "[5/5] Verificando health..."
sleep 10
curl -sf http://localhost:3001/api/health && echo " API OK" || echo " API FALHOU"
curl -sf http://localhost:80/ > /dev/null && echo " Nginx OK" || echo " Nginx FALHOU"

echo ""
echo "=== Deploy concluido! ==="
docker compose ps
