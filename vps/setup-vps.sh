#!/bin/bash
# =============================================================================
# ReConnect - Setup Completo do VPS
# Descricao: Configura seguranca, monitoramento, backups e deploy automatizado
# Uso: sudo bash setup-vps.sh
# Executar APENAS uma vez em VPS novo ou existente
# =============================================================================
set -euo pipefail

echo "============================================"
echo " ReConnect - Setup Completo do VPS"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"

PROJECT_DIR="/opt/reconnect"

# Verificar se esta rodando como root
if [ "$(id -u)" -ne 0 ]; then
    echo "ERRO: Execute como root (sudo bash setup-vps.sh)"
    exit 1
fi

# Verificar se o diretorio do projeto existe
if [ ! -d "$PROJECT_DIR" ]; then
    echo "ERRO: Diretorio $PROJECT_DIR nao encontrado"
    echo "Clone o repositorio primeiro:"
    echo "  git clone https://github.com/erikoxineo-jpg/brand-pipeline.git $PROJECT_DIR"
    exit 1
fi

# --- 1. Seguranca ---
echo ""
echo "=== [1/6] Configurando seguranca ==="
bash "${PROJECT_DIR}/vps/setup-seguranca.sh"

# --- 2. Permissoes do .env ---
echo ""
echo "=== [2/6] Protegendo arquivo .env ==="
if [ -f "${PROJECT_DIR}/.env" ]; then
    chmod 600 "${PROJECT_DIR}/.env"
    chown root:root "${PROJECT_DIR}/.env"
    echo ".env protegido (chmod 600, owner root)"
else
    echo "AVISO: ${PROJECT_DIR}/.env nao encontrado"
    echo "Crie o arquivo com as variaveis EVOLUTION_API_KEY e EVOLUTION_DB_PASS"
fi

# --- 3. Diretorios ---
echo ""
echo "=== [3/6] Criando diretorios ==="
mkdir -p /opt/backups/reconnect
echo "Diretorio de backups criado: /opt/backups/reconnect"

# --- 4. Permissoes dos scripts ---
echo ""
echo "=== [4/6] Configurando permissoes dos scripts ==="
chmod +x "${PROJECT_DIR}/vps/deploy.sh"
chmod +x "${PROJECT_DIR}/vps/backup.sh"
chmod +x "${PROJECT_DIR}/vps/restaurar-backup.sh"
chmod +x "${PROJECT_DIR}/vps/monitoramento.sh"
chmod +x "${PROJECT_DIR}/vps/setup-seguranca.sh"
echo "Scripts com permissao de execucao"

# --- 5. Crontab ---
echo ""
echo "=== [5/6] Configurando crontab ==="

# Remover entradas anteriores do ReConnect
crontab -l 2>/dev/null | grep -v 'reconnect' > /tmp/crontab_reconnect || true

# Adicionar novas entradas
cat >> /tmp/crontab_reconnect <<'CRONEOF'
# ReConnect - Backup diario as 3h da manha
0 3 * * * /opt/reconnect/vps/backup.sh

# ReConnect - Monitoramento a cada 5 minutos
*/5 * * * * /opt/reconnect/vps/monitoramento.sh

# ReConnect - Limpeza Docker semanal (domingo as 4h)
0 4 * * 0 docker system prune -f > /dev/null 2>&1
CRONEOF

crontab /tmp/crontab_reconnect
rm -f /tmp/crontab_reconnect
echo "Crontab configurado:"
echo "  - Backup: diario as 3h"
echo "  - Monitoramento: a cada 5 minutos"
echo "  - Limpeza Docker: domingo as 4h"

# --- 6. Logrotate ---
echo ""
echo "=== [6/6] Configurando logrotate ==="
cat > /etc/logrotate.d/reconnect <<'LREOF'
/var/log/reconnect-*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
}
LREOF
echo "Logrotate configurado (7 dias de retencao)"

echo ""
echo "============================================"
echo " Setup concluido com sucesso!"
echo "============================================"
echo ""
echo "Proximos passos:"
echo "  1. TESTAR SSH na nova porta (em outra janela):"
echo "     ssh -p 2222 root@reconnect.oxineo.com.br"
echo ""
echo "  2. Fazer deploy:"
echo "     sudo bash /opt/reconnect/vps/deploy.sh"
echo ""
echo "  3. Verificar containers:"
echo "     docker compose -f /opt/reconnect/docker-compose.yml ps"
echo ""
echo "Scripts disponiveis:"
echo "  - Deploy:    sudo bash /opt/reconnect/vps/deploy.sh"
echo "  - Rollback:  sudo bash /opt/reconnect/vps/deploy.sh --rollback"
echo "  - Backup:    sudo bash /opt/reconnect/vps/backup.sh"
echo "  - Restaurar: sudo bash /opt/reconnect/vps/restaurar-backup.sh"
echo "  - Monitor:   cat /var/log/reconnect-monitor.log"
echo ""
