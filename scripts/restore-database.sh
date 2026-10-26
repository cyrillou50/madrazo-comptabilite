#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

usage() {
  cat <<'EOF'
Usage:
  restore-database.sh --database NOM --defaults-file FICHIER --input DUMP \
    --pre-backup-dir DOSSIER [--apply --confirm 'RESTORE:NOM']

Sans --apply, affiche uniquement le plan. Avec --apply, crée d'abord une
sauvegarde de l'état courant puis importe dans la base NOM. Le dump ne doit pas
contenir CREATE DATABASE ni USE, afin que la cible reste explicite.
EOF
}

database=''
defaults_file=''
input_file=''
pre_backup_dir=''
apply=0
confirmation=''

while (($#)); do
  case "$1" in
    --database) database="${2:-}"; shift 2 ;;
    --defaults-file) defaults_file="${2:-}"; shift 2 ;;
    --input) input_file="${2:-}"; shift 2 ;;
    --pre-backup-dir) pre_backup_dir="${2:-}"; shift 2 ;;
    --apply) apply=1; shift ;;
    --confirm) confirmation="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'Argument inconnu: %s\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ ! "$database" =~ ^[A-Za-z0-9_]+$ ]]; then
  printf 'Nom de base vide ou invalide.\n' >&2
  exit 2
fi
if [[ ! -f "$defaults_file" || ! -f "$input_file" ]]; then
  printf 'Fichier d’identifiants ou dump introuvable.\n' >&2
  exit 2
fi
if [[ -z "$pre_backup_dir" || "$pre_backup_dir" != /* || "$pre_backup_dir" == / ]]; then
  printf 'Le dossier de pré-sauvegarde doit être un chemin absolu dédié.\n' >&2
  exit 2
fi
if ! command -v mariadb >/dev/null 2>&1; then
  printf 'Le client mariadb est requis.\n' >&2
  exit 1
fi

credential_mode="$(stat -c '%a' "$defaults_file")"
if (( (8#$credential_mode & 077) != 0 )); then
  printf 'Permissions trop larges sur %s (attendu 0600 ou 0400).\n' "$defaults_file" >&2
  exit 1
fi

case "$input_file" in
  *.gz)
    gzip -t -- "$input_file"
    reader=(gzip -dc -- "$input_file")
    ;;
  *.sql)
    reader=(cat -- "$input_file")
    ;;
  *)
    printf 'Le dump doit se terminer par .sql ou .gz.\n' >&2
    exit 2
    ;;
esac

if "${reader[@]}" | grep -Eiq '^[[:space:]]*(CREATE[[:space:]]+DATABASE|USE[[:space:]]+)'; then
  printf 'Refus: le dump sélectionne/crée une base. Fournir un dump ciblé sans CREATE DATABASE ni USE.\n' >&2
  exit 1
fi

if [[ -f "${input_file}.sha256" ]]; then
  (
    cd -- "$(dirname -- "$input_file")"
    sha256sum -c -- "$(basename -- "$input_file").sha256"
  )
else
  printf '[avertissement] aucun fichier %s.sha256; empreinte actuelle: ' "$input_file"
  sha256sum -- "$input_file" | awk '{print $1}'
fi

printf 'Plan de restauration:\n'
printf '  cible       : %s\n' "$database"
printf '  entrée      : %s\n' "$(realpath -- "$input_file")"
printf '  pré-sauvegarde: %s\n' "$pre_backup_dir"

if ((apply == 0)); then
  printf 'SIMULATION: aucune écriture effectuée. Ajouter --apply --confirm %q après autorisation.\n' "RESTORE:${database}"
  exit 0
fi

if [[ "$confirmation" != "RESTORE:${database}" ]]; then
  printf 'Confirmation incorrecte. Valeur exacte requise: RESTORE:%s\n' "$database" >&2
  exit 2
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
"${script_dir}/backup-database.sh" \
  --database "$database" \
  --defaults-file "$defaults_file" \
  --output-dir "$pre_backup_dir"

printf 'Import autorisé vers la base exacte %s...\n' "$database"
"${reader[@]}" | mariadb --defaults-extra-file="$defaults_file" --database="$database"
printf 'Restauration terminée. Exécuter immédiatement les contrôles d’intégrité et fonctionnels.\n'

