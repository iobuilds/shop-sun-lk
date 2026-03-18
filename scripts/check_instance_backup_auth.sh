#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="/root/nanocircuitDB"
BACKUP_ROOT="${PROJECT_DIR}/instance_backups"
DB_PARENT="${PROJECT_DIR}/volumes/db"
DB_DATA="${DB_PARENT}/data"
TMP_TAG="$(date -u +%Y-%m-%dT%H-%M-%SZ)"

cd "${PROJECT_DIR}"

echo "Available instance backups:"
mapfile -t BACKUPS < <(find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d | sort -r)

if [ "${#BACKUPS[@]}" -eq 0 ]; then
  echo "No backups found."
  exit 1
fi

for i in "${!BACKUPS[@]}"; do
  echo "[$((i+1))] ${BACKUPS[$i]}"
done

echo
read -rp "Select backup number to TEST: " PICK

if ! [[ "${PICK}" =~ ^[0-9]+$ ]] || [ "${PICK}" -lt 1 ] || [ "${PICK}" -gt "${#BACKUPS[@]}" ]; then
  echo "Invalid selection."
  exit 1
fi

SELECTED="${BACKUPS[$((PICK-1))]}"

if [ ! -f "${SELECTED}/db_data.tar.gz" ]; then
  echo "Missing ${SELECTED}/db_data.tar.gz"
  exit 1
fi

echo
echo "Selected backup: ${SELECTED}"
echo "This will TEMPORARILY swap current db data folder for testing."
read -rp "Type YES to continue: " CONFIRM
[ "${CONFIRM}" = "YES" ] || { echo "Cancelled."; exit 1; }

docker compose down

if [ -d "${DB_DATA}" ]; then
  mv "${DB_DATA}" "${DB_PARENT}/data.test-backup-saved-${TMP_TAG}"
fi

tar -xzf "${SELECTED}/db_data.tar.gz" -C "${DB_PARENT}"

chown -R 999:999 "${DB_DATA}"
chmod 700 "${DB_DATA}"

docker compose up -d db
sleep 12

echo
echo "Auth counts from tested backup:"
docker compose exec -T db psql -U postgres -d postgres -c "select count(*) as auth_users from auth.users;"
docker compose exec -T db psql -U postgres -d postgres -c "select count(*) as identities from auth.identities;"
docker compose exec -T db psql -U postgres -d postgres -c "select count(*) as sessions from auth.sessions;"
docker compose exec -T db psql -U postgres -d postgres -c "select count(*) as user_roles from public.user_roles;"
docker compose exec -T db psql -U postgres -d postgres -c "select id,email,created_at from auth.users order by created_at desc limit 20;"

echo
echo "If this backup is not correct:"
echo "  docker compose down"
echo "  rm -rf ${DB_DATA}"
echo "  mv ${DB_PARENT}/data.test-backup-saved-${TMP_TAG} ${DB_DATA}"
echo "  chown -R 999:999 ${DB_DATA}"
echo "  chmod 700 ${DB_DATA}"
echo "  docker compose up -d"