#!/usr/bin/env bash
set -u

# Inventaire strictement en lecture seule. Ce script n'utilise pas sudo et ne
# change aucun fichier, service, paquet, règle réseau ou objet MariaDB.

section() {
  printf '\n=== %s ===\n' "$1"
}

run_if_available() {
  local command_name="$1"
  shift
  if command -v "$command_name" >/dev/null 2>&1; then
    "$@" 2>&1 || printf '[avertissement] commande en échec: %s\n' "$*"
  else
    printf '[indisponible] %s\n' "$command_name"
  fi
}

section "Identité et système"
printf 'date_utc=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf 'utilisateur=%s uid=%s\n' "$(id -un)" "$(id -u)"
run_if_available uname uname -a
if [[ -r /etc/os-release ]]; then
  sed -n 's/^\(PRETTY_NAME\|ID\|VERSION_ID\)=/\1=/p' /etc/os-release
fi

section "Ressources"
run_if_available df df -hT
run_if_available free free -h

section "Ports TCP en écoute"
if command -v ss >/dev/null 2>&1; then
  ss -ltnp 2>&1 || ss -ltn 2>&1 || true
else
  printf '[indisponible] ss\n'
fi

section "Port proposé 3002"
if command -v ss >/dev/null 2>&1; then
  if ss -ltnH '( sport = :3002 )' 2>/dev/null | grep -q .; then
    printf 'OCCUPÉ: ne pas utiliser 3002 avant identification du service.\n'
    ss -ltnp '( sport = :3002 )' 2>&1 || true
  else
    printf 'Aucune écoute TCP détectée sur 3002 au moment du contrôle.\n'
  fi
fi

section "Versions"
run_if_available node node --version
run_if_available npm npm --version
run_if_available nginx nginx -v
run_if_available mariadb mariadb --version
run_if_available mysql mysql --version

section "Services actifs (sans contenu des environnements)"
if command -v systemctl >/dev/null 2>&1; then
  systemctl list-units --type=service --state=running --no-pager 2>&1 || true
  printf '\nUnité madrazo-api existante:\n'
  systemctl list-unit-files madrazo-api.service --no-pager 2>&1 || true
else
  printf '[indisponible] systemctl\n'
fi

section "Nginx"
if command -v nginx >/dev/null 2>&1; then
  nginx -t 2>&1 || printf '[avertissement] nginx -t nécessite peut-être des droits supplémentaires ou la configuration est invalide.\n'
  for config_dir in /etc/nginx/sites-available /etc/nginx/sites-enabled /etc/nginx/conf.d; do
    if [[ -d "$config_dir" ]]; then
      printf '%s\n' "$config_dir"
      find "$config_dir" -maxdepth 1 -mindepth 1 -printf '  %f -> %l\n' 2>/dev/null || true
    fi
  done
fi

section "Chemins Madrazo existants"
for target in /opt/madrazo /etc/madrazo /etc/systemd/system/madrazo-api.service /etc/nginx/sites-available/madrazo-api; do
  if [[ -e "$target" || -L "$target" ]]; then
    ls -ld "$target" 2>&1 || true
  else
    printf 'absent: %s\n' "$target"
  fi
done

section "Pare-feu (lecture seule)"
if command -v ufw >/dev/null 2>&1; then
  ufw status verbose 2>&1 || true
elif command -v firewall-cmd >/dev/null 2>&1; then
  firewall-cmd --state 2>&1 || true
  firewall-cmd --list-all 2>&1 || true
else
  printf 'Aucun outil ufw/firewalld détecté; inspecter nftables/iptables selon le système.\n'
fi

section "Conclusion"
printf '%s\n' 'Inventaire terminé sans modification. Relire les collisions et compléter avec un administrateur avant toute action.'

