#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

usage() {
  cat <<'EOF'
Usage: backup-database.sh --database NOM --defaults-file FICHIER --output-dir DOSSIER

Crée un dump SQL gzip et son empreinte SHA-256. Le mot de passe doit rester dans
un fichier MariaDB protégé, jamais sur la ligne de commande.
EOF
}

database=''
defaults_file=''
output_dir=''

while (($#)); do
  case "$1" in
    --database) database="${2:-}"; shift 2 ;;
    --defaults-file) defaults_file="${2:-}"; shift 2 ;;
    --output-dir) output_dir="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'Argument inconnu: %s\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ ! "$database" =~ ^[A-Za-z0-9_]+$ ]]; then
  printf 'Nom de base vide ou invalide.\n' >&2
  exit 2
fi
if [[ ! -f "$defaults_file" ]]; then
  printf 'Fichier d’identifiants introuvable: %s\n' "$defaults_file" >&2
  exit 2
fi
if [[ -z "$output_dir" || "$output_dir" != /* || "$output_dir" == / ]]; then
  printf 'Le dossier de sortie doit être un chemin absolu dédié, différent de /.\n' >&2
  exit 2
fi
if ! command -v mariadb-dump >/dev/null 2>&1; then
  printf 'mariadb-dump est requis.\n' >&2
  exit 1
fi
if ! command -v gzip >/dev/null 2>&1 || ! command -v sha256sum >/dev/null 2>&1; then
  printf 'gzip et sha256sum sont requis.\n' >&2
  exit 1
fi

credential_mode="$(stat -c '%a' "$defaults_file")"
if (( (8#$credential_mode & 077) != 0 )); then
  printf 'Permissions trop larges sur %s (attendu 0600 ou 0400).\n' "$defaults_file" >&2
  exit 1
fi

mkdir -p -- "$output_dir"
chmod 0700 -- "$output_dir"
output_dir="$(realpath -- "$output_dir")"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
final_path="${output_dir}/${database}-${timestamp}.sql.gz"
temporary_path="$(mktemp --tmpdir="$output_dir" ".${database}-${timestamp}.XXXXXX.sql.gz")"
trap 'rm -f -- "$temporary_path"' EXIT

{
  printf '%s\n' "-- Sauvegarde logique de ${database}, créée à ${timestamp} UTC"
  mariadb-dump \
    --defaults-extra-file="$defaults_file" \
    --single-transaction \
    --quick \
    --routines \
    --triggers \
    --events \
    --hex-blob \
    --default-character-set=utf8mb4 \
    --no-tablespaces \
    -- "$database"
} | gzip -9 >"$temporary_path"

gzip -t -- "$temporary_path"
mv -- "$temporary_path" "$final_path"
trap - EXIT
(
  cd -- "$output_dir"
  sha256sum -- "$(basename -- "$final_path")" >"$(basename -- "$final_path").sha256"
)

printf 'Sauvegarde créée: %s\n' "$final_path"
printf 'Empreinte: %s.sha256\n' "$final_path"

