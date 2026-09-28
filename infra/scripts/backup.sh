#!/usr/bin/env bash
# Backup do PostgreSQL com compressão e retenção.
set -euo pipefail
source .env 2>/dev/null || true
DIR="${BACKUP_DIR:-./backups}"; KEEP="${BACKUP_RETENTION_DAYS:-14}"
mkdir -p "$DIR"
FILE="$DIR/fad_$(date +%Y%m%d_%H%M%S).sql.gz"
echo "💾 Gerando backup em $FILE"
docker compose --env-file .env -f infra/docker/docker-compose.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --clean | gzip > "$FILE"
find "$DIR" -name 'fad_*.sql.gz' -mtime +"$KEEP" -delete
echo "✅ Backup concluído. Retenção: $KEEP dias."
