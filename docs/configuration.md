# Configuration

## Backend

Copier `backend/.env.example` vers `backend/.env`. En production, utiliser `/etc/madrazo/madrazo-api.env`, propriété de `root:madrazo` et mode `0640`.

| Variable | Exemple local | Rôle |
|---|---|---|
| `NODE_ENV` | `development` | Active les comportements développement/production |
| `PORT` | `3002` | Port interne ; vérifier sa disponibilité avant usage |
| `TRUST_PROXY` | `0` local, `1` derrière Nginx | Nombre de proxies de confiance |
| `DATABASE_HOST` | `127.0.0.1` | Hôte MariaDB |
| `DATABASE_PORT` | `3306` | Port MariaDB |
| `DATABASE_NAME` | `madrazo` | Base dédiée |
| `DATABASE_USER` | `madrazo_app` | Compte SQL dédié |
| `DATABASE_PASSWORD` | valeur aléatoire | Secret SQL, serveur uniquement |
| `SESSION_SECRET` | 32 octets aléatoires minimum | Signature/protection des sessions |
| `SESSION_COOKIE_DOMAIN` | vide ou domaine exact | Domaine facultatif du cookie |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | Origines exactes séparées par des virgules |
| `LOG_LEVEL` | `info` | Niveau de journalisation |

Générer les secrets sur une machine de confiance :

```bash
openssl rand -base64 48
```

Ne jamais copier le résultat dans une issue, un journal CI ou une commande shell historisée. Les mots de passe contenant des caractères spéciaux doivent être placés dans le fichier d'environnement avec les règles de syntaxe prévues par systemd.

Exemple de production, volontairement sans secret :

```dotenv
NODE_ENV=production
PORT=3002
TRUST_PROXY=1
DATABASE_HOST=127.0.0.1
DATABASE_PORT=3306
DATABASE_NAME=madrazo
DATABASE_USER=madrazo_app
DATABASE_PASSWORD=REMPLACER_HORS_GIT
SESSION_SECRET=REMPLACER_HORS_GIT
SESSION_COOKIE_DOMAIN=api-madrazo.code-eternal.fr
ALLOWED_ORIGINS=https://UTILISATEUR.github.io
LOG_LEVEL=info
```

Si le dépôt Pages est servi sous un chemin, l'origine CORS n'inclut que le schéma et l'hôte, pas le chemin.

## Frontend

```dotenv
VITE_API_URL=http://localhost:3002
VITE_BASE_PATH=/
```

Toutes les variables préfixées `VITE_` sont publiques dans le bundle. Elles ne doivent jamais contenir de mot de passe, clé API privée ou secret de session.

En production, `.github/workflows/pages.yml` prend `VITE_API_URL` dans la variable de dépôt GitHub du même nom, avec `https://api-madrazo.code-eternal.fr` comme valeur de repli. Il calcule le chemin Pages à partir du nom réel du dépôt.

## GitHub Pages

Dans les paramètres du dépôt :

1. sélectionner **GitHub Actions** comme source Pages ;
2. créer la variable Actions `VITE_API_URL` si l'URL diffère de celle prévue ;
3. protéger l'environnement `github-pages` si une validation manuelle est souhaitée ;
4. n'ajouter aucun secret backend au dépôt frontend.

## Configuration initiale du Patron

Aucun identifiant par défaut n'existe. Les connexions utilisent un pseudo, et
non une adresse e-mail. Renseigner temporairement les variables suivantes dans
l'environnement utilisé par la commande d'initialisation :

```dotenv
FIRST_ADMIN_USERNAME=Patron
FIRST_ADMIN_PASSWORD=REMPLACER_PAR_UN_SECRET_LONG
FIRST_ADMIN_DISPLAY_NAME=Patron
```

Exécuter ensuite `npm run admin:create` depuis `backend/`, puis retirer
immédiatement `FIRST_ADMIN_PASSWORD` de l'environnement. Cette opération doit :

- refuser de s'exécuter si un Patron actif existe déjà ;
- appliquer Argon2id ;
- créer l'événement d'audit initial ;
- recommander une rotation immédiate si le mot de passe a été transmis par un canal temporaire.

Les rôles, leurs permissions, ainsi que les catégories de marchandises et de
dépenses se gèrent ensuite depuis l'interface. Aucun libellé métier par défaut
n'est imposé après la migration de personnalisation.

