# Sauvegarde et restauration MariaDB

## Objectifs

- sauvegarde logique quotidienne de la base `madrazo` uniquement ;
- copie chiffrée hors du VPS ;
- empreinte d'intégrité SHA-256 ;
- rétention définie, par exemple 7 quotidiennes, 4 hebdomadaires et 6 mensuelles ;
- test de restauration périodique dans une base isolée.

Une sauvegarde non restaurée en test n'est pas une garantie de reprise.

## Identifiants dédiés

Créer `/etc/madrazo/backup.cnf` en mode `0600`, hors Git :

```ini
[client]
host=127.0.0.1
port=3306
user=madrazo_backup
password=REMPLACER_HORS_GIT
```

Le compte de sauvegarde reçoit seulement les privilèges requis sur `madrazo`. Le script refuse un fichier lisible par tous.

## Sauvegarde

```bash
sudo install -d -o root -g root -m 0700 /var/backups/madrazo
sudo scripts/backup-database.sh \
  --database madrazo \
  --defaults-file /etc/madrazo/backup.cnf \
  --output-dir /var/backups/madrazo
```

Copier ensuite l'archive vers un stockage chiffré distinct et vérifier l'empreinte. Éviter de placer un mot de passe sur la ligne de commande.

## Restauration test

1. choisir une instance MariaDB isolée ;
2. créer une base vide au nom distinct, par exemple `madrazo_restore_test_YYYYMMDD` ;
3. vérifier `gzip -t` et `sha256sum -c` ;
4. exécuter le script d'abord sans `--apply` pour voir son plan ;
5. exécuter avec le nom de la base de test et la confirmation exacte ;
6. lancer migrations/contrôles d'intégrité et scénarios métier ;
7. supprimer la base de test seulement après validation et autorisation.

## Restauration de production

La restauration écrase logiquement l'état courant et nécessite une décision d'incident. Avant l'import :

- stopper les écritures applicatives de façon contrôlée ;
- préserver une sauvegarde de l'état actuel ;
- identifier l'instant et les transactions perdues ;
- vérifier que l'archive cible concerne bien `madrazo` ;
- préparer les versions code/migrations compatibles ;
- obtenir une autorisation explicite.

Le script `restore-database.sh` fonctionne en simulation par défaut et exige `--apply` plus une phrase de confirmation liée au nom exact de la base. Il ne sélectionne jamais une base par motif ou variable vide.

## Automatisation

Après plusieurs sauvegardes manuelles réussies, les modèles `systemd/madrazo-backup.service.example` et `systemd/madrazo-backup.timer.example` peuvent appeler `backup-database.sh`. Les relire, vérifier leurs chemins, puis utiliser `systemd-analyze verify` avant installation. Leur activation reste une opération de production soumise à autorisation.

Ne pas supprimer automatiquement des fichiers tant que la copie hors hôte et les règles de rétention n'ont pas été testées. Surveiller le code de sortie, l'âge de la dernière archive et l'espace disque :

```bash
systemctl list-timers madrazo-backup.timer --no-pager
systemctl status madrazo-backup.service --no-pager
journalctl -u madrazo-backup.service -n 100 --no-pager
find /var/backups/madrazo -maxdepth 1 -type f -name '*.sql.gz' -printf '%TY-%Tm-%Td %TH:%TM %s %p\n'
```

