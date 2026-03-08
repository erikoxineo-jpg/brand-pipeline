#!/bin/bash
# =============================================================================
# ReConnect - Script de Seguranca do VPS
# Descricao: Configura firewall UFW, SSH seguro, fail2ban e atualizacoes
#            automaticas de seguranca
# Uso: sudo bash setup-seguranca.sh
# =============================================================================
set -euo pipefail

echo "============================================"
echo " ReConnect - Configuracao de Seguranca"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"

# Verificar se esta rodando como root
if [ "$(id -u)" -ne 0 ]; then
    echo "ERRO: Execute como root (sudo bash setup-seguranca.sh)"
    exit 1
fi

# --- 1. Atualizar sistema ---
echo ""
echo "=== [1/5] Atualizando sistema ==="
apt update && apt upgrade -y
apt install -y ufw fail2ban unattended-upgrades

# --- 2. Configurar UFW (Firewall) ---
echo ""
echo "=== [2/5] Configurando UFW (Firewall) ==="
ufw default deny incoming
ufw default allow outgoing
ufw allow 2222/tcp comment 'SSH personalizado'
ufw allow 80/tcp comment 'HTTP - Let'\''s Encrypt e redirecionamento'
ufw allow 443/tcp comment 'HTTPS - Trafego principal'
echo "y" | ufw enable
echo "Firewall ativado. Regras:"
ufw status verbose

# --- 3. Endurecer SSH ---
echo ""
echo "=== [3/5] Endurecendo SSH ==="
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak

# Criar configuracao segura
mkdir -p /etc/ssh/sshd_config.d
cat > /etc/ssh/sshd_config.d/hardened.conf <<'SSHEOF'
# ReConnect - SSH Hardening
Port 2222
PermitRootLogin prohibit-password
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
LoginGraceTime 30
ClientAliveInterval 300
ClientAliveCountMax 2
X11Forwarding no
AllowTcpForwarding no
SSHEOF

systemctl restart sshd
echo "SSH configurado na porta 2222 (somente chave publica)"
echo ""
echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
echo "!! IMPORTANTE: Teste a conexao em outra janela:     !!"
echo "!! ssh -p 2222 root@reconnect.oxineo.com.br        !!"
echo "!! NAO feche esta sessao ate confirmar o acesso!    !!"
echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"

# --- 4. Configurar Fail2ban ---
echo ""
echo "=== [4/5] Configurando Fail2ban ==="
cat > /etc/fail2ban/jail.local <<'F2BEOF'
# ReConnect - Configuracao Fail2ban
[DEFAULT]
# Ban por 1 hora apos 3 tentativas em 10 minutos
bantime = 3600
findtime = 600
maxretry = 3
backend = systemd

[sshd]
enabled = true
port = 2222
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600

[nginx-limit-req]
enabled = true
port = http,https
filter = nginx-limit-req
logpath = /var/log/nginx/*error.log
maxretry = 10
bantime = 600
F2BEOF

systemctl enable fail2ban
systemctl restart fail2ban
echo "Fail2ban ativado (SSH + Nginx)"

# --- 5. Atualizacoes automaticas de seguranca ---
echo ""
echo "=== [5/5] Configurando atualizacoes automaticas ==="
cat > /etc/apt/apt.conf.d/50unattended-upgrades <<'UUEOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
UUEOF

cat > /etc/apt/apt.conf.d/20auto-upgrades <<'AUTOEOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
AUTOEOF

echo "Atualizacoes automaticas de seguranca configuradas"

echo ""
echo "============================================"
echo " Seguranca configurada com sucesso!"
echo "============================================"
echo ""
echo "Resumo:"
echo "  - Firewall UFW: ativo (portas 2222, 80, 443)"
echo "  - SSH: porta 2222, somente chave publica"
echo "  - Fail2ban: ativo (SSH + Nginx)"
echo "  - Updates: automaticos para patches de seguranca"
echo ""
echo "PROXIMO PASSO: Testar SSH em outra janela!"
