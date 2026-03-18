#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="/root/nanocircuitDB"
BACKUP_ROOT="${PROJECT_DIR}/instance_backups"

DB_DATA_PARENT="${PROJECT_DIR}/volumes/db"
DB_DATA_DIR="${DB_DATA_PARENT}/data"
STORAGE_PARENT="${PROJECT_DIR}/volumes"
STORAGE_DIR="${STORAGE_PARENT}/storage"

NOW_TAG="$(date -u +%Y-%m-%dT%H-%M-%SZ)"

cd "${PROJECT_DIR}"

echo "Available instance backups:"
mapfile -t BACKUPS < <(find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d | sort -r)

if [ "${#BACKUPS[@]}" -eq 0 ]; then
  echo "No backups found in ${BACKUP_ROOT}"
  exit 1
fi

for i in "${!BACKUPS[@]}"; do
  echo "[$((i+1))] ${BACKUPS[$i]}"
done

echo
read -rp "Select backup number: " PICK

if ! [[ "${PICK}" =~ ^[0-9]+$ ]] || [ "${PICK}" -lt 1 ] || [ "${PICK}" -gt "${#BACKUPS[@]}" ]; then
  echo "Invalid selection."
  exit 1
fi

SELECTED_DIR="${BACKUPS[$((PICK-1))]}"

if [ ! -f "${SELECTED_DIR}/db_data.tar.gz" ]; then
  echo "Missing required file: ${SELECTED_DIR}/db_data.tar.gz"
  exit 1
fi

echo
echo "Selected backup: ${SELECTED_DIR}"
echo "This will REPLACE the current PostgreSQL data directory."
echo "It can also restore storage files if available."
read -rp "Type YES to continue: " CONFIRM

if [ "${CONFIRM}" != "YES" ]; then
  echo "Cancelled."
  exit 1
fi

echo
echo "Stopping all containers..."
docker compose down

if [ -d "${DB_DATA_DIR}" ]; then
  echo "Saving current DB data as rollback copy..."
  mv "${DB_DATA_DIR}" "${DB_DATA_PARENT}/data.before-restore-${NOW_TAG}"
fi

if [ -d "${STORAGE_DIR}" ]; then
  echo "Saving current storage as rollback copy..."
  mv "${STORAGE_DIR}" "${STORAGE_PARENT}/storage.before-restore-${NOW_TAG}"
fi

mkdir -p "${DB_DATA_PARENT}"
mkdir -p "${STORAGE_PARENT}"

echo "Restoring PostgreSQL data directory..."
tar -xzf "${SELECTED_DIR}/db_data.tar.gz" -C "${DB_DATA_PARENT}"

if [ -f "${SELECTED_DIR}/storage.tar.gz" ]; then
  echo "Restoring storage files..."
  tar -xzf "${SELECTED_DIR}/storage.tar.gz" -C "${STORAGE_PARENT}"
else
  echo "No storage.tar.gz found in backup. Skipping storage restore."
fi

echo "Fixing PostgreSQL data permissions..."
chown -R 999:999 "${DB_DATA_DIR}" || true
chmod 700 "${DB_DATA_DIR}" || true

if [ -d "${STORAGE_DIR}" ]; then
  echo "Fixing storage permissions..."
  chown -R 1000:1000 "${STORAGE_DIR}" || true
fi

echo "Starting containers..."
docker compose up -d

echo
echo "[$(date -u +%F' '%T)] Full instance restore completed."
echo "Restored from: ${SELECTED_DIR}"
echo
echo "Rollback copies kept as:"
echo "  ${DB_DATA_PARENT}/data.before-restore-${NOW_TAG}"
echo "  ${STORAGE_PARENT}/storage.before-restore-${NOW_TAG}"