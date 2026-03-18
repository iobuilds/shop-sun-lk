#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="/root/nanocircuitDB"
BACKUP_ROOT="${PROJECT_DIR}/instance_backups"

TS="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
OUT_DIR="${BACKUP_ROOT}/${TS}"

DB_DATA_DIR="${PROJECT_DIR}/volumes/db/data"
STORAGE_DIR="${PROJECT_DIR}/volumes/storage"

mkdir -p "${OUT_DIR}"

cd "${PROJECT_DIR}"

echo "[$(date -u +%F' '%T)] Starting full instance backup..."
echo "Backup folder: ${OUT_DIR}"

if [ ! -d "${DB_DATA_DIR}" ]; then
  echo "ERROR: DB data directory not found: ${DB_DATA_DIR}"
  exit 1
fi

# Read current auth/public counts before shutdown
AUTH_USERS_COUNT=$(docker compose exec -T db psql -U postgres -d postgres -tAc "select count(*) from auth.users;" | tr -d ' ')
AUTH_IDENTITIES_COUNT=$(docker compose exec -T db psql -U postgres -d postgres -tAc "select count(*) from auth.identities;" | tr -d ' ')
AUTH_SESSIONS_COUNT=$(docker compose exec -T db psql -U postgres -d postgres -tAc "select count(*) from auth.sessions;" | tr -d ' ')
USER_ROLES_COUNT=$(docker compose exec -T db psql -U postgres -d postgres -tAc "select count(*) from public.user_roles;" | tr -d ' ')

# Stop everything for a clean physical snapshot
echo "Stopping all containers..."
docker compose down

# Backup postgres data dir
echo "Archiving PostgreSQL data directory..."
tar -czf "${OUT_DIR}/db_data.tar.gz" -C "${PROJECT_DIR}/volumes/db" data

# Backup storage files too
if [ -d "${STORAGE_DIR}" ]; then
  echo "Archiving storage files..."
  tar -czf "${OUT_DIR}/storage.tar.gz" -C "${PROJECT_DIR}/volumes" storage
fi

# Backup key config files
echo "Saving config files..."
cp -a "${PROJECT_DIR}/docker-compose.yml" "${OUT_DIR}/docker-compose.yml"
cp -a "${PROJECT_DIR}/.env" "${OUT_DIR}/.env"

cat > "${OUT_DIR}/manifest.txt" <<EOF
Backup timestamp (UTC): ${TS}
Type: full physical instance backup

Included:
- PostgreSQL data directory
- Storage files directory
- docker-compose.yml
- .env

Files:
- db_data.tar.gz
- storage.tar.gz
- docker-compose.yml
- .env

Auth snapshot:
- auth.users: ${AUTH_USERS_COUNT}
- auth.identities: ${AUTH_IDENTITIES_COUNT}
- auth.sessions: ${AUTH_SESSIONS_COUNT}
- public.user_roles: ${USER_ROLES_COUNT}
EOF

# Optional zip
if command -v zip >/dev/null 2>&1; then
  cd "${BACKUP_ROOT}"
  zip -r "${TS}.zip" "${TS}" >/dev/null
  ZIP_MSG="${BACKUP_ROOT}/${TS}.zip"
else
  ZIP_MSG="zip not installed"
fi

echo "Starting containers again..."
docker compose up -d

echo "[$(date -u +%F' '%T)] Full instance backup completed."
echo "Created:"
echo "  ${OUT_DIR}/db_data.tar.gz"
if [ -f "${OUT_DIR}/storage.tar.gz" ]; then
  echo "  ${OUT_DIR}/storage.tar.gz"
fi
echo "  ${OUT_DIR}/docker-compose.yml"
echo "  ${OUT_DIR}/.env"
echo "  ${OUT_DIR}/manifest.txt"
echo "  ${ZIP_MSG}"