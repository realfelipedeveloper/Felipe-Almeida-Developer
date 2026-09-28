#!/usr/bin/env bash
# Restaura um backup: pnpm db:restore backups/fad_AAAAMMDD_HHMMSS.sql.gz
set -euo pipefail
source .env 2>/dev/null || true
FILE="${1:?Informe o arquivo de backup}"
read -r -p "⚠️  Isso vai SOBRESCREVER o banco $POSTGRES_DB. Confirmar? (s/N) " ok
[[ "$ok" == "s" ]] || { echo "Cancelado."; exit 0; }
gunzip -c "$FILE" | docker compose --env-file .env -f infra/docker/docker-compose.yml exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
echo "✅ Restauração concluída."
