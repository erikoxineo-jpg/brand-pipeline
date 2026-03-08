#!/bin/bash
# =============================================================================
# ReConnect - Script de Monitoramento
# Descricao: Verifica saude dos containers, uso de disco e memoria
# Uso: Rodar via cron a cada 5 minutos
# Crontab: */5 * * * * /opt/reconnect/vps/monitoramento.sh
# =============================================================================

LOG="/var/log/reconnect-monitor.log"
ALERTA_DISCO=85
ALERTA_MEMORIA=90
DATA=$(date '+%Y-%m-%d %H:%M:%S')

# --- 1. Verificar containers ---
CONTAINERS=("reconnect-app" "reconnect-evolution" "reconnect-evolution-db")

for CONTAINER in "${CONTAINERS[@]}"; do
    STATUS=$(docker inspect --format='{{.State.Status}}' "$CONTAINER" 2>/dev/null || echo "nao_encontrado")
    if [ "$STATUS" != "running" ]; then
        echo "[$DATA] ALERTA: Container $CONTAINER nao esta rodando (status: $STATUS)" >> "$LOG"
        # Tentar reiniciar automaticamente
        docker compose -f /opt/reconnect/docker-compose.yml up -d "$CONTAINER" 2>> "$LOG"
        echo "[$DATA] Tentativa de reinicio: $CONTAINER" >> "$LOG"
    fi
done

# --- 2. Verificar healthcheck do app ---
HEALTH=$(docker inspect --format='{{.State.Health.Status}}' reconnect-app 2>/dev/null || echo "unknown")
if [ "$HEALTH" = "unhealthy" ]; then
    echo "[$DATA] ALERTA: reconnect-app esta unhealthy - reiniciando" >> "$LOG"
    docker compose -f /opt/reconnect/docker-compose.yml restart app 2>> "$LOG"
fi

# --- 3. Verificar uso de disco ---
USO_DISCO=$(df / | tail -1 | awk '{print $5}' | tr -d '%')
if [ "$USO_DISCO" -gt "$ALERTA_DISCO" ]; then
    echo "[$DATA] ALERTA: Disco em ${USO_DISCO}% (limite: ${ALERTA_DISCO}%)" >> "$LOG"
    # Limpar imagens Docker nao utilizadas
    docker image prune -f >> "$LOG" 2>&1
    echo "[$DATA] Limpeza de imagens Docker executada" >> "$LOG"
fi

# --- 4. Verificar uso de memoria ---
MEM_TOTAL=$(free -m | awk '/^Mem:/{print $2}')
MEM_USADA=$(free -m | awk '/^Mem:/{print $3}')
MEM_PERC=$((MEM_USADA * 100 / MEM_TOTAL))
if [ "$MEM_PERC" -gt "$ALERTA_MEMORIA" ]; then
    echo "[$DATA] ALERTA: Memoria em ${MEM_PERC}% (${MEM_USADA}MB/${MEM_TOTAL}MB)" >> "$LOG"
fi

# --- 5. Rotacionar log de monitoramento (manter ultimas 500 linhas) ---
if [ -f "$LOG" ]; then
    LINHAS=$(wc -l < "$LOG")
    if [ "$LINHAS" -gt 1000 ]; then
        tail -500 "$LOG" > "${LOG}.tmp" && mv "${LOG}.tmp" "$LOG"
    fi
fi
