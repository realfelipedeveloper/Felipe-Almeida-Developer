#!/usr/bin/env bash
# Backup PostgreSQL comprimido, verificável e opcionalmente criptografado.
set -euo pipefail

if [[ "${SKIP_DOTENV:-false}" != "true" && -f .env ]]; then
  source .env
fi

BACKUP_TARGET_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
ENVIRONMENT_NAME="${APP_ENV:-${NODE_ENV:-development}}"
USE_DOCKER="${BACKUP_USE_DOCKER:-true}"

if [[ ! "$RETENTION_DAYS" =~ ^[0-9]+$ ]]; then
  echo "BACKUP_RETENTION_DAYS deve ser um número inteiro não negativo." >&2
  exit 1
fi

SAFE_ENVIRONMENT="$(printf '%s' "$ENVIRONMENT_NAME" | tr -cd '[:alnum:]_-')"
[[ -n "$SAFE_ENVIRONMENT" ]] || SAFE_ENVIRONMENT="unknown"
mkdir -p -- "$BACKUP_TARGET_DIR"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
PLAIN_FILE="$BACKUP_TARGET_DIR/fad_${SAFE_ENVIRONMENT}_${TIMESTAMP}.sql.gz"
FINAL_FILE="$PLAIN_FILE"

echo "Gerando backup PostgreSQL em $PLAIN_FILE"
if [[ "$USE_DOCKER" == "true" ]]; then
  : "${POSTGRES_USER:?POSTGRES_USER não configurado}"
  : "${POSTGRES_DB:?POSTGRES_DB não configurado}"
  docker compose --env-file .env -f infra/docker/docker-compose.yml exec -T postgres \
    pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --clean --if-exists | gzip -9 > "$PLAIN_FILE"
else
  BACKUP_CONNECTION_URL="${BACKUP_DATABASE_URL:-${DATABASE_URL:-}}"
  : "${BACKUP_CONNECTION_URL:?BACKUP_DATABASE_URL ou DATABASE_URL não configurada}"
  pg_dump "$BACKUP_CONNECTION_URL" --no-owner --clean --if-exists | gzip -9 > "$PLAIN_FILE"
fi

gzip -t "$PLAIN_FILE"

if [[ -n "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ]]; then
  FINAL_FILE="$PLAIN_FILE.aesgcm"
  node infra/scripts/backup-crypto.mjs encrypt "$PLAIN_FILE" "$FINAL_FILE"
  rm -- "$PLAIN_FILE"
fi

sha256sum "$FINAL_FILE" > "$FINAL_FILE.sha256"

find "$BACKUP_TARGET_DIR" -maxdepth 1 -type f \
  \( -name 'fad_*.sql.gz' -o -name 'fad_*.sql.gz.aesgcm' -o -name 'fad_*.sql.gz.sha256' -o -name 'fad_*.sql.gz.aesgcm.sha256' \) \
  -mtime "+$RETENTION_DAYS" -delete

echo "Backup concluído e validado: $FINAL_FILE"
echo "Checksum: $FINAL_FILE.sha256"
echo "Retenção: $RETENTION_DAYS dias"
