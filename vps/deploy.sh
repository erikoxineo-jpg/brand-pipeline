#!/bin/bash
# =============================================================================
# ReConnect - Script de Deploy
# Descricao: Deploy padronizado com backup pre-deploy e rollback automatico
# Uso: sudo bash deploy.sh [--rollback]
# =============================================================================
set -euo pipefail

PROJECT_DIR="/opt/reconnect"
LOG="/var/log/reconnect-deploy.log"
DATA=$(date '+%Y-%m-%d_%H%M%S')

cd "$PROJECT_DIR"

# --- Funcao: Rollback ---
if [ "${1:-}" = "--rollback" ]; then
    echo "=== Iniciando rollback ==="
    ULTIMO_COMMIT=$(git log --format='%H' -n 2 | tail -1)
    if [ -z "$ULTIMO_COMMIT" ]; then
        echo "ERRO: Nenhum commit anterior encontrado para rollback"
        exit 1
    fi
    echo "Voltando para commit: $ULTIMO_COMMIT"
    git checkout "$ULTIMO_COMMIT"
    docker compose build --no-cache app
    docker compose up -d app
    echo "[${DATA}] ROLLBACK para ${ULTIMO_COMMIT}" >> "$LOG"
    echo "=== Rollback concluido ==="
    exit 0
fi

echo "============================================"
echo " ReConnect - Deploy"
echo " ${DATA}"
echo "============================================"
echo "[${DATA}] Deploy iniciado" >> "$LOG"

# --- 1. Salvar commit atual (para rollback) ---
COMMIT_ANTERIOR=$(git rev-parse HEAD)
echo "Commit atual: ${COMMIT_ANTERIOR:0:8}"

# --- 2. Puxar alteracoes ---
echo ""
echo "[1/5] Puxando alteracoes do Git..."
git pull origin main

COMMIT_NOVO=$(git rev-parse HEAD)
if [ "$COMMIT_ANTERIOR" = "$COMMIT_NOVO" ]; then
    echo "Nenhuma alteracao detectada. Abortando deploy."
    echo "[${DATA}] Deploy cancelado - sem alteracoes" >> "$LOG"
    exit 0
fi
echo "Novo commit: ${COMMIT_NOVO:0:8}"

# --- 3. Build da imagem ---
echo ""
echo "[2/5] Construindo imagem Docker..."
docker compose build app

# --- 4. Atualizar container ---
echo ""
echo "[3/5] Atualizando container..."
docker compose up -d app

# --- 5. Aguardar healthcheck ---
echo ""
echo "[4/5] Aguardando healthcheck..."
TENTATIVAS=0
MAX_TENTATIVAS=30
while [ $TENTATIVAS -lt $MAX_TENTATIVAS ]; do
    HEALTH=$(docker inspect --format='{{.State.Health.Status}}' reconnect-app 2>/dev/null || echo "unknown")
    if [ "$HEALTH" = "healthy" ]; then
        echo "Container saudavel!"
        break
    fi
    TENTATIVAS=$((TENTATIVAS + 1))
    echo "  Aguardando... (${TENTATIVAS}/${MAX_TENTATIVAS}) - status: ${HEALTH}"
    sleep 5
done

if [ $TENTATIVAS -ge $MAX_TENTATIVAS ]; then
    echo ""
    echo "ALERTA: Healthcheck nao passou apos ${MAX_TENTATIVAS} tentativas!"
    echo "Executando rollback automatico..."
    git checkout "$COMMIT_ANTERIOR"
    docker compose build app
    docker compose up -d app
    echo "[${DATA}] ROLLBACK automatico: ${COMMIT_NOVO:0:8} -> ${COMMIT_ANTERIOR:0:8}" >> "$LOG"
    echo "Rollback concluido. Verifique os logs: docker compose logs app"
    exit 1
fi

# --- 6. Limpar imagens antigas ---
echo ""
echo "[5/5] Limpando imagens Docker antigas..."
docker image prune -f

echo ""
echo "[${DATA}] Deploy concluido: ${COMMIT_ANTERIOR:0:8} -> ${COMMIT_NOVO:0:8}" >> "$LOG"
echo "============================================"
echo " Deploy concluido com sucesso!"
echo " ${COMMIT_ANTERIOR:0:8} -> ${COMMIT_NOVO:0:8}"
echo "============================================"
