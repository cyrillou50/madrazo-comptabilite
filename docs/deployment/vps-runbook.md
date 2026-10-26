# Runbook de déploiement VPS

Ce document prépare le déploiement, il ne l'autorise pas. **Aucune commande modifiant le VPS, MariaDB, Nginx ou systemd ne doit être exécutée sans accord explicite du propriétaire.** Commencer dans une fenêtre de maintenance et conserver une seconde session SSH ouverte.

Les exemples ciblent Debian/Ubuntu. Adapter chemins et gestionnaire de paquets après inspection, pas avant.

## 1. Inventaire en lecture seule

Copier uniquement `scripts/inspect-vps.sh`, le relire, puis l'exécuter sans `sudo` :

```bash
bash scripts/inspect-vps.sh | tee madrazo-inspection.txt
```

Compléter manuellement avec les privilèges appropriés si certaines sections sont masquées :

```bash
ss -ltnp
systemctl list-units --type=service --state=running
systemctl list-unit-files 'madrazo-api.service'
nginx -T
mariadb --execute="SHOW DATABASES; SELECT User,Host FROM mysql.user;"
df -h
free -h
node --version
```

Avant de continuer, consigner :

- distribution, versions Node, Nginx et MariaDB ;
- services/API existants et leurs utilisateurs système ;
- hôtes virtuels, certificats et ports déjà utilisés ;
- méthode de pare-feu, espace disque et mémoire ;
- stratégie de sauvegarde existante ;
- existence éventuelle de `/opt/madrazo`, `/etc/madrazo`, de la base ou du compte SQL prévus.

En cas de collision de nom ou de port, s'arrêter et choisir explicitement une autre valeur. Ne jamais réutiliser un compte SQL ni un répertoire d'une autre application.

## 2. Choix du port

Le port proposé est `3002`, uniquement s'il est libre :

```bash
ss -ltn '( sport = :3002 )'
```

Une sortie contenant une ligne d'écoute signifie que le port n'est pas disponible. Choisir un autre port non exposé, le documenter dans `PORT`, Nginx et les contrôles de santé. L'API doit écouter sur `127.0.0.1`, pas sur toutes les interfaces.

## 3. Préparer les sauvegardes ciblées

Avant toute modification autorisée :

```bash
change_id="$(date -u +%Y%m%dT%H%M%SZ)"
sudo install -d -m 0700 "/root/madrazo-change-${change_id}"
sudo cp -a /etc/nginx/nginx.conf "/root/madrazo-change-${change_id}/"
sudo cp -a /etc/nginx/sites-available "/root/madrazo-change-${change_id}/sites-available"
sudo cp -a /etc/nginx/sites-enabled "/root/madrazo-change-${change_id}/sites-enabled"
sudo systemctl cat madrazo-api >"/root/madrazo-change-${change_id}/madrazo-api.service.before" 2>/dev/null || true
```

Le répertoire est nouveau et horodaté. Vérifier son contenu avant de modifier quoi que ce soit. Une sauvegarde MariaDB séparée est décrite dans [Sauvegarde et restauration](backups.md).

## 4. Utilisateur et arborescence indépendants

Après validation qu'ils n'existent pas ou appartiennent bien au projet :

```bash
sudo adduser --system --group --home /opt/madrazo --no-create-home madrazo
sudo install -d -o madrazo -g madrazo -m 0750 /opt/madrazo/releases
sudo install -d -o root -g madrazo -m 0750 /etc/madrazo
sudo install -d -o root -g root -m 0755 /var/www/letsencrypt
```

Ne jamais appliquer récursivement un changement de propriétaire à `/opt` ou `/etc`.

## 5. Base dédiée

1. Inspecter les bases et comptes existants.
2. Générer un secret hors Git.
3. Copier `docs/deployment/mariadb/create-database.sql.example` dans un fichier temporaire protégé.
4. Remplacer le marqueur dans cette copie.
5. Relire la cible, puis exécuter la copie avec un compte DBA autorisé.
6. Supprimer de façon sûre la copie qui contient le secret.

Appliquer ensuite les migrations versionnées avec la commande du backend, sous le compte applicatif. Ne jamais importer les migrations dans une autre base. Avant chaque évolution ultérieure, sauvegarder la base et lire la migration.

Le compte runtime ne reçoit pas `DROP`, `GRANT`, `FILE`, `PROCESS` ni de droits globaux. Si les migrations nécessitent ponctuellement d'autres droits, utiliser une identité de migration distincte puis la révoquer.

## 6. Construire une release

Construire depuis un commit identifié, sans écraser la release courante :

```bash
release_id="$(date -u +%Y%m%dT%H%M%SZ)-$(git rev-parse --short HEAD)"
release_dir="/opt/madrazo/releases/${release_id}"
sudo install -d -o madrazo -g madrazo -m 0750 "$release_dir"
sudo -u madrazo git clone --no-local --depth 1 /chemin/du/depot "$release_dir/source"
cd "$release_dir/source/backend"
sudo -u madrazo npm ci
sudo -u madrazo npm run typecheck
sudo -u madrazo npm test -- --run
sudo -u madrazo npm run build
sudo -u madrazo npm prune --omit=dev
```

Sur un déploiement depuis archive signée, remplacer le clone local par l'extraction dans ce répertoire neuf. Conserver le SHA Git dans le journal de changement.

Créer ou remplacer le lien `current` seulement après une construction réussie :

```bash
sudo ln -sfn "$release_dir/source" /opt/madrazo/current.next
sudo mv -Tf /opt/madrazo/current.next /opt/madrazo/current
```

Vérifier avec `readlink -f /opt/madrazo/current`. Conserver au moins la release précédente pour le retour arrière.

## 7. Environnement serveur

Créer `/etc/madrazo/madrazo-api.env` depuis [Configuration](../configuration.md), sans exposer les secrets :

```bash
sudo install -o root -g madrazo -m 0640 /dev/null /etc/madrazo/madrazo-api.env
sudoedit /etc/madrazo/madrazo-api.env
sudo stat -c '%U:%G %a %n' /etc/madrazo/madrazo-api.env
```

Vérifier `NODE_ENV=production`, le port libre, `TRUST_PROXY=1`, le compte/base dédiés et l'origine Pages exacte.

## 8. Service systemd indépendant

Comparer d'abord l'état :

```bash
systemctl cat madrazo-api 2>/dev/null || true
```

Si l'unité appartient déjà à un autre service, ne pas l'écraser. Sinon installer une copie relue de `docs/deployment/systemd/madrazo-api.service.example` dans `/etc/systemd/system/madrazo-api.service`.

Valider avant lancement :

```bash
sudo systemd-analyze verify /etc/systemd/system/madrazo-api.service
sudo systemctl daemon-reload
```

Le démarrage et l'activation sont des actions de production distinctes, à effectuer seulement avec l'accord explicite :

```bash
sudo systemctl enable --now madrazo-api
systemctl status madrazo-api --no-pager
journalctl -u madrazo-api -n 100 --no-pager
curl --fail http://127.0.0.1:3002/api/health
```

## 9. Nginx et TLS

Ne jamais modifier un fichier d'un autre hôte. Commencer avec la configuration HTTP temporaire :

1. vérifier l'absence de conflit `server_name` dans `nginx -T` ;
2. copier le modèle vers un **nouveau** fichier `/etc/nginx/sites-available/madrazo-api` ;
3. créer le lien dédié dans `sites-enabled` ;
4. exécuter obligatoirement `sudo nginx -t` ;
5. ne recharger qu'après succès et autorisation : `sudo systemctl reload nginx`.

Vérifier le DNS A/AAAA avant Certbot. Émettre ensuite le certificat en mode webroot, sans lui permettre de réécrire les autres vhosts :

```bash
sudo certbot certonly --webroot -w /var/www/letsencrypt -d api-madrazo.code-eternal.fr
```

Installer alors une copie relue de `madrazo-api.conf.example`, puis de nouveau :

```bash
sudo nginx -t
sudo systemctl reload nginx
curl --fail https://api-madrazo.code-eternal.fr/api/health
```

Ne pas activer HSTS avant d'avoir confirmé renouvellement TLS et retour arrière.

## 10. Vérifications fonctionnelles

- santé locale puis publique ;
- certificat, chaîne et nom d'hôte ;
- CORS depuis l'origine GitHub Pages exacte ;
- connexion, déconnexion, expiration et CSRF ;
- permissions de chaque rôle ;
- commande multi-articles sur données de recette ;
- livraison répétée avec même clé d'idempotence ;
- paiement partiel et refus du dépassement ;
- journaux applicatifs/Nginx sans secret ;
- sauvegarde manuelle et restauration dans une base isolée.

## 11. Retour arrière applicatif

Si le nouveau code échoue mais que la migration est compatible :

```bash
sudo ln -sfn /opt/madrazo/releases/RELEASE_PRECEDENTE/source /opt/madrazo/current.next
sudo mv -Tf /opt/madrazo/current.next /opt/madrazo/current
sudo systemctl restart madrazo-api
curl --fail http://127.0.0.1:3002/api/health
```

Le redémarrage exige la même autorisation que le déploiement. Ne jamais « revenir » sur une migration en supprimant des tables à l'aveugle. Si le schéma n'est pas compatible, arrêter la procédure, préserver les journaux et suivre un plan de restauration testé.

Pour Nginx, restaurer uniquement les fichiers Madrazo ou la sauvegarde exacte réalisée au début, puis `nginx -t` avant recharge. Ne pas restaurer globalement `sites-available` si d'autres services ont changé entre-temps.

## 12. Fin de changement

Consigner le commit, la migration, la release, l'heure, les tests, la sauvegarde et la personne ayant autorisé l'opération. Surveiller erreurs HTTP, mémoire, espace disque et journaux pendant la période convenue.

