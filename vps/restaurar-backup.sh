#!/bin/bash
# =============================================================================
# ReConnect - Script de Restauracao de Backup
# Descricao: Restaura backup do PostgreSQL e volumes do Docker
# Uso: sudo bash restaurar-backup.sh [data]
# Exemplo: sudo bash restaurar-backup.sh 2026-03-08_0300
# =============================================================================
set -euo pipefail

BACKUP_DIR="/opt/backups/reconnect"

# Se nenhuma data foi informada, listar backups disponiveis
if [ -z "${1:-}" ]; then
    echo "============================================"
    echo " ReConnect - Restauracao de Backup"
    echo "============================================"
    echo ""
    echo "Backups disponiveis:"
    echo ""

    if ls "${BACKUP_DIR}"/evolution-db_*.sql.gz 1>/dev/null 2>&1; then
        for f in "${BACKUP_DIR}"/evolution-db_*.sql.gz; do
            NOME=$(basename "$f" | sed 's/evolution-db_//' | sed 's/.sql.gz//')
            TAMANHO=$(du -h "$f" | awk '{print $1}')
            echo "  ${NOME}  (${TAMANHO})"
        done
    else
        echo "  Nenhum backup encontrado em ${BACKUP_DIR}"
    fi

    echo ""
    echo "Uso: sudo bash restaurar-backup.sh <data>"
    echo "Exemplo: sudo bash restaurar-backup.sh 2026-03-08_0300"
    exit 0
fi

DATA="$1"

# Verificar se os arquivos existem
if [ ! -f "${BACKUP_DIR}/evolution-db_${DATA}.sql.gz" ]; then
    echo "ERRO: Arquivo de backup nao encontrado: evolution-db_${DATA}.sql.gz"
    echo ""
    echo "Backups disponiveis:"
    ls -la "${BACKUP_DIR}"/evolution-db_*.sql.gz 2>/dev/null || echo "  Nenhum backup encontrado"
    exit 1
fi

echo "============================================"
echo " ReConnect - Restauracao de Backup"
echo " Data: ${DATA}"
echo "============================================"
echo ""
echo "Arquivos encontrados:"
ls -lh "${BACKUP_DIR}"/*_${DATA}* 2>/dev/null
echo ""
echo "ATENCAO: Isso vai SOBRESCREVER o banco de dados atual!"
read -p "Continuar? (sim/nao): " CONFIRMA
if [ "$CONFIRMA" != "sim" ]; then
    echo "Restauracao cancelada."
    exit 0
fi

# --- 1. Restaurar PostgreSQL ---
echo ""
echo "[1/3] Restaurando PostgreSQL..."
gunzip -c "${BACKUP_DIR}/evolution-db_${DATA}.sql.gz" | \
    docker exec -i reconnect-evolution-db psql -U evolution -d evolution

echo "PostgreSQL restaurado com sucesso"

# --- 2. Restaurar volumes (se existir) ---
if [ -f "${BACKUP_DIR}/evolution-instances_${DATA}.tar.gz" ]; then
    echo "[2/3] Restaurando volumes Docker..."
    VOLUME_NAME=$(docker volume ls --format '{{.Name}}' | grep evolution-instances || echo "")
    if [ -n "$VOLUME_NAME" ]; then
        docker run --rm \
            -v "${VOLUME_NAME}:/data" \
            -v "${BACKUP_DIR}:/backup:ro" \
            alpine sh -c "rm -rf /data/* && tar xzf /backup/evolution-instances_${DATA}.tar.gz -C /data"
        echo "Volumes restaurados"
    else
        echo "AVISO: Volume evolution-instances nao encontrado - pulando"
    fi
else
    echo "[2/3] Backup de volumes nao encontrado - pulando"
fi

# --- 3. Reiniciar containers ---
echo "[3/3] Reiniciando containers..."
cd /opt/reconnect && docker compose restart evolution evolution-db

echo ""
echo "============================================"
echo " Restauracao concluida com sucesso!"
echo "============================================"
echo ""
echo "Verifique o status: docker compose ps"
echo "Verifique os logs: docker compose logs --tail 20 evolution-db"
