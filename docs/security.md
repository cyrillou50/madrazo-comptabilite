# Modèle de sécurité

## Menaces prises en compte

Le périmètre couvre le vol de session, CSRF, XSS, injection SQL, force brute, élévation de privilège, manipulation des montants, double livraison, corruption de stock, falsification d'historique et fuite de secrets.

## Contrôles applicatifs

### Authentification

- Argon2id avec paramètres adaptés à la capacité réelle du VPS ;
- réponses de connexion non distinctives pour ne pas révéler les comptes ;
- limitation par IP et par identité normalisée ;
- régénération de l'identifiant de session après connexion ;
- expiration absolue et par inactivité ;
- révocation des sessions lors d'une désactivation ou d'une rotation sensible.

### Cookies, CORS et CSRF

- cookie sans contenu métier, `HttpOnly`, `Secure` en production ;
- `SameSite=None` uniquement si l'hébergement croisé GitHub Pages/API l'exige, avec `Secure` obligatoire ;
- origines CORS comparées à une liste exacte ;
- aucune réflexion aveugle de l'en-tête `Origin` ;
- jeton CSRF par session sur `POST`, `PUT`, `PATCH` et `DELETE` ;
- contrôle de `Origin`/`Referer` en défense supplémentaire.

### Autorisation

Chaque endpoint déclare une permission. Le serveur charge les droits effectifs et refuse par défaut. Les rôles facilitent l'administration mais ne remplacent pas les permissions fines. Un vendeur ne peut pas augmenter ses droits en modifiant le JSON envoyé.

Les dérogations, comme une commande pour un groupe blacklisté, exigent une permission dédiée, un motif obligatoire et un événement d'audit.

### Validation et base

- schémas Zod stricts ;
- paramètres SQL exclusivement liés ;
- limites sur pagination, tailles de chaîne et nombre de lignes d'une commande ;
- transactions avec verrouillage des lignes concernées ;
- contraintes SQL pour compléter les contrôles applicatifs ;
- calculs de montants côté serveur et arrondis explicites ;
- identifiants opaques non interprétés comme preuve d'accès.

### Journalisation

Les audits enregistrent l'acteur, l'action, la cible, l'horodatage, un identifiant de corrélation et un résumé avant/après nettoyé. Ne jamais journaliser mots de passe, cookie, jeton CSRF, secret, chaîne de connexion ou corps de requête non filtré.

Les audits ne doivent pas pouvoir être modifiés par les rôles métier ordinaires. Leur consultation est paginée et elle-même contrôlée.

## Durcissement du service

L'exemple systemd utilise un utilisateur non privilégié, un système de fichiers protégé, un répertoire temporaire privé et une liste limitée de familles réseau. Nginx est le seul point d'entrée public ; le port Node reste lié à `127.0.0.1`.

TLS 1.2/1.3 est requis. Activer HSTS uniquement après validation complète de HTTPS et du plan de retour arrière.

## Secrets

- production : fichier `/etc/madrazo/madrazo-api.env`, mode `0640` ;
- développement : `.env` ignoré par Git ;
- CI frontend : aucune variable privée ;
- sauvegardes : répertoire `0700`, chiffrement hors hôte recommandé ;
- rotation après toute suspicion, avec invalidation des sessions si `SESSION_SECRET` change.

## Checklist avant production

- [ ] dépendances et images système à jour ;
- [ ] aucun secret suivi par Git (`git grep` et scanner de secrets) ;
- [ ] CORS limité à l'URL Pages exacte ;
- [ ] cookies observés `Secure` et `HttpOnly` ;
- [ ] tests permissions/CSRF/force brute réussis ;
- [ ] API liée uniquement à `127.0.0.1` ;
- [ ] `nginx -t` réussi avant toute recharge ;
- [ ] sauvegarde et restauration testées sur une base isolée ;
- [ ] premier Patron créé sans mot de passe par défaut ;
- [ ] journaux exempts de secrets ;
- [ ] alertes d'espace disque et d'échec de sauvegarde configurées.

## Réponse à incident

1. préserver les journaux et noter l'heure ;
2. isoler l'API si nécessaire sans effacer les preuves ;
3. révoquer sessions et secrets compromis ;
4. sauvegarder l'état avant correction ;
5. restaurer une version connue et vérifier migrations/intégrité ;
6. documenter la cause et ajouter un test de non-régression.

