#!/bin/bash
# =============================================================================
# ReConnect - Migracao de dados do Supabase Cloud para PostgreSQL local
# Executar na VPS apos subir os containers db e api
# =============================================================================

set -euo pipefail

SUPABASE_DB_URL="${1:?Uso: ./migrate-data.sh <SUPABASE_DB_URL>}"
LOCAL_DB_URL="postgresql://reconnect:${DB_PASSWORD}@localhost:5432/reconnect"

echo "=== ReConnect: Migracao de Dados ==="
echo ""

# 1. Exportar dados do Supabase (apenas dados, sem schema - Prisma cuida do schema)
echo "[1/4] Exportando dados do Supabase Cloud..."
pg_dump "$SUPABASE_DB_URL" \
  --data-only \
  --no-owner \
  --no-privileges \
  --table=public.profiles \
  --table=public.workspaces \
  --table=public.workspace_members \
  --table=public.leads \
  --table=public.imports \
  --table=public.campaigns \
  --table=public.dispatches \
  --table=public.messages \
  --table=public.whatsapp_config \
  --table=public.subscriptions \
  --table=public.payments \
  > /tmp/reconnect_data.sql

echo "[2/4] Exportando usuarios do Supabase Auth..."
psql "$SUPABASE_DB_URL" -c "
  COPY (
    SELECT id, email, encrypted_password as password_hash, created_at
    FROM auth.users
  ) TO STDOUT WITH CSV HEADER
" > /tmp/reconnect_users.csv

echo "[3/4] Garantindo que Prisma migrations foram aplicadas..."
docker exec reconnect-api npx prisma migrate deploy

echo "[4/4] Importando dados no banco local..."

# Importar usuarios primeiro (FK dependencia)
docker exec -i reconnect-db psql -U reconnect -d reconnect -c "
  COPY users(id, email, password_hash, created_at) FROM STDIN WITH CSV HEADER
" < /tmp/reconnect_users.csv

# Importar demais dados
docker exec -i reconnect-db psql -U reconnect -d reconnect < /tmp/reconnect_data.sql

# Limpar arquivos temporarios
rm -f /tmp/reconnect_data.sql /tmp/reconnect_users.csv

echo ""
echo "=== Migracao concluida! ==="
echo "Usuarios e dados foram importados com sucesso."
echo "As senhas bcrypt do Supabase sao compativeis - nenhum usuario precisa redefinir senha."
