#!/bin/bash
# =============================================================================
# ReConnect - Script de Backup
# Descricao: Backup diario do PostgreSQL (Evolution), volumes Docker e configs
# Uso: Rodar via cron diariamente as 3h da manha
# Crontab: 0 3 * * * /opt/reconnect/vps/backup.sh
# =============================================================================
set -euo pipefail

BACKUP_DIR="/opt/backups/reconnect"
DATA=$(date '+%Y-%m-%d_%H%M')
RETENTION_DAYS=7
LOG="/var/log/reconnect-backup.log"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] === Iniciando backup ===" >> "$LOG"

# --- 1. Backup do PostgreSQL (Evolution DB) ---
echo "[$(date)] Fazendo dump do PostgreSQL..." >> "$LOG"
if docker exec reconnect-evolution-db pg_dumpall -U evolution \
    | gzip > "${BACKUP_DIR}/evolution-db_${DATA}.sql.gz"; then
    TAMANHO_DB=$(du -h "${BACKUP_DIR}/evolution-db_${DATA}.sql.gz" | awk '{print $1}')
    echo "[$(date)] PostgreSQL OK: evolution-db_${DATA}.sql.gz (${TAMANHO_DB})" >> "$LOG"
else
    echo "[$(date)] ERRO: Falha no backup do PostgreSQL!" >> "$LOG"
fi

# --- 2. Backup dos volumes Docker (instancias WhatsApp) ---
echo "[$(date)] Fazendo backup dos volumes Docker..." >> "$LOG"
VOLUME_NAME=$(docker volume ls --format '{{.Name}}' | grep evolution-instances || echo "")
if [ -n "$VOLUME_NAME" ]; then
    docker run --rm \
        -v "${VOLUME_NAME}:/data:ro" \
        -v "${BACKUP_DIR}:/backup" \
        alpine tar czf "/backup/evolution-instances_${DATA}.tar.gz" -C /data . 2>> "$LOG"
    echo "[$(date)] Volumes OK: evolution-instances_${DATA}.tar.gz" >> "$LOG"
else
    echo "[$(date)] AVISO: Volume evolution-instances nao encontrado" >> "$LOG"
fi

# --- 3. Backup das configuracoes ---
echo "[$(date)] Fazendo backup das configuracoes..." >> "$LOG"
tar czf "${BACKUP_DIR}/configs_${DATA}.tar.gz" \
    -C /opt/reconnect \
    .env docker-compose.yml nginx-ssl.conf nginx.conf nginx-performance.conf Dockerfile 2>/dev/null || true
echo "[$(date)] Configs OK: configs_${DATA}.tar.gz" >> "$LOG"

# --- 4. Rotacao: remover backups antigos ---
echo "[$(date)] Removendo backups com mais de ${RETENTION_DAYS} dias..." >> "$LOG"
REMOVIDOS=$(find "$BACKUP_DIR" -name "*.gz" -mtime +${RETENTION_DAYS} -delete -print | wc -l)
echo "[$(date)] ${REMOVIDOS} arquivo(s) antigo(s) removido(s)" >> "$LOG"

# --- 5. Resumo ---
TAMANHO_TOTAL=$(du -sh "$BACKUP_DIR" | awk '{print $1}')
ARQUIVOS_TOTAL=$(find "$BACKUP_DIR" -name "*.gz" | wc -l)
echo "[$(date)] === Backup concluido. ${ARQUIVOS_TOTAL} arquivo(s), ${TAMANHO_TOTAL} total ===" >> "$LOG"
