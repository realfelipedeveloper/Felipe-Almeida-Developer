#!/usr/bin/env bash
# Restaura backup PostgreSQL após validar checksum e confirmação explícita.
set -euo pipefail

if [[ "${SKIP_DOTENV:-false}" != "true" && -f .env ]]; then
  source .env
fi

FILE="${1:?Uso: pnpm db:restore <arquivo.sql.gz|arquivo.sql.gz.aesgcm>}"
USE_DOCKER="${BACKUP_USE_DOCKER:-true}"

if [[ ! -f "$FILE" ]]; then
  echo "Arquivo de backup não encontrado: $FILE" >&2
  exit 1
fi
if [[ ! -f "$FILE.sha256" ]]; then
  echo "Checksum obrigatório ausente: $FILE.sha256" >&2
  exit 1
fi

sha256sum --check "$FILE.sha256"

if [[ "$USE_DOCKER" == "true" ]]; then
  : "${POSTGRES_USER:?POSTGRES_USER não configurado}"
  : "${POSTGRES_DB:?POSTGRES_DB não configurado}"
  TARGET_NAME="$POSTGRES_DB"
else
  RESTORE_CONNECTION_URL="${RESTORE_DATABASE_URL:-${DATABASE_URL:-}}"
  : "${RESTORE_CONNECTION_URL:?RESTORE_DATABASE_URL ou DATABASE_URL não configurada}"
  TARGET_NAME="${RESTORE_DATABASE_NAME:-banco configurado na URL}"
fi

EXPECTED_CONFIRMATION="RESTAURAR:${TARGET_NAME}"
CONFIRMATION="${RESTORE_CONFIRMATION:-}"
if [[ -z "$CONFIRMATION" ]]; then
  read -r -p "Esta operação sobrescreve '$TARGET_NAME'. Digite '$EXPECTED_CONFIRMATION': " CONFIRMATION
fi
if [[ "$CONFIRMATION" != "$EXPECTED_CONFIRMATION" ]]; then
  echo "Restauração cancelada: confirmação inválida." >&2
  exit 1
fi

restore_stream() {
  if [[ "$FILE" == *.aesgcm ]]; then
    : "${BACKUP_ENCRYPTION_PASSPHRASE:?BACKUP_ENCRYPTION_PASSPHRASE é obrigatória para backup criptografado}"
    node infra/scripts/backup-crypto.mjs decrypt "$FILE" | gunzip -c
  else
    gunzip -c -- "$FILE"
  fi
}

echo "Restaurando backup validado em '$TARGET_NAME'"
if [[ "$USE_DOCKER" == "true" ]]; then
  restore_stream | docker compose --env-file .env -f infra/docker/docker-compose.yml exec -T postgres \
    psql --single-transaction -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"
else
  restore_stream | psql --single-transaction -v ON_ERROR_STOP=1 "$RESTORE_CONNECTION_URL"
fi

echo "Restauração concluída com sucesso."
