# Comptabilité Madrazo

Application de gestion financière et logistique pour une organisation **fictive** de jeu de rôle FiveM. Le dépôt sépare clairement le client statique publié sur GitHub Pages, l'API privée exécutée sur un VPS et le schéma MariaDB.

> Le projet ne contient aucun mot de passe par défaut. Le premier compte Patron est créé par une commande d'initialisation explicite, directement sur le serveur.

## Vue d'ensemble

| Partie | Technologies | Hébergement prévu |
|---|---|---|
| `frontend/` | React, TypeScript, Vite, Tailwind CSS | GitHub Pages |
| `backend/` | Node.js LTS, Express, TypeScript, Zod | VPS via systemd |
| `database/` | MariaDB, migrations SQL versionnées | VPS |
| `docs/` | Architecture, sécurité et procédures | Dépôt |
| `scripts/` | Inspection, sauvegarde et restauration prudentes | Exécution manuelle sur le VPS |

Les montants et stocks affichés par le frontend viennent de l'API. Le navigateur n'est jamais la source de vérité métier. L'API recalcule les prix, les totaux, les marges et les soldes dans des transactions SQL.

## Fonctionnalités

- tableau de bord et indicateurs financiers filtrables ;
- groupes, contacts et tarifs personnalisés ;
- catalogue, seuils d'alerte et historique de prix ;
- commandes multi-articles, livraisons partielles et réservations ;
- mouvements de stock traçables et idempotence des livraisons ;
- paiements partiels, dettes, dépenses et registre de caisse ;
- trésorerie séparée en argent propre et argent sale, apports des membres et blanchiment avec commission ;
- pseudos de connexion, rôles personnalisables, permissions fines, sessions serveur et journal d'audit lisible ;
- catégories de marchandises et de dépenses, types de groupes et moyens de paiement entièrement administrables ;
- centre de notifications filtré selon les droits, avec suivi lu / non lu ;
- apparence personnalisable (thèmes prêts à l'emploi ou couleurs libres) avec lisibilité des textes garantie ;
- exports et documentation OpenAPI ;
- tests de logique métier et d'API.

## Prérequis de développement

- Node.js 22.12 ou ultérieur ;
- npm 10 ou ultérieur ;
- MariaDB 10.11 ou ultérieur pour l'exécution réelle ;
- Git.

## Installation locale

```bash
git clone <url-du-depot> madrazo-comptabilite
cd madrazo-comptabilite
npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Créer une base locale dédiée, renseigner `backend/.env`, puis appliquer les migrations selon les commandes documentées dans [`database/README.md`](database/README.md).

Lancer les deux processus dans deux terminaux :

```bash
npm run dev:backend
npm run dev:frontend
```

L'interface Vite est normalement disponible sur `http://localhost:5173` et l'API sur `http://localhost:3002`. Les ports restent configurables.

## Variables indispensables

Backend :

- `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD` ;
- `SESSION_SECRET` avec au moins 32 octets aléatoires ;
- `ALLOWED_ORIGINS`, liste stricte séparée par des virgules ;
- `PORT`, `NODE_ENV`, `TRUST_PROXY`.

La création initiale du Patron utilise temporairement `FIRST_ADMIN_USERNAME`,
`FIRST_ADMIN_PASSWORD` et `FIRST_ADMIN_DISPLAY_NAME`. Ces variables ne servent
qu'à `npm run admin:create` et doivent être retirées de l'environnement après
la création du compte.

Frontend :

- `VITE_API_URL`, URL publique de l'API, sans secret ;
- `VITE_BASE_PATH`, chemin de base Vite (`/` en local, `/<depot>/` sur Pages).

La liste complète et les méthodes de génération de secrets se trouvent dans [Configuration](docs/configuration.md). Ne jamais versionner un fichier `.env` réel.

## Commandes

```bash
npm run typecheck        # frontend + backend
npm test                 # suites Vitest
npm run build            # compilations de production
npm run lint             # ESLint
```

Les mêmes vérifications sont exécutées par `.github/workflows/ci.yml`. La publication Pages n'a lieu qu'après types, tests et build réussis.

## Sécurité

- mots de passe hachés avec Argon2id ;
- cookie de session `HttpOnly`, `Secure` en production et `SameSite` adapté ;
- jeton CSRF pour toute mutation authentifiée ;
- CORS limité aux origines explicitement autorisées ;
- limitation des tentatives de connexion et validation Zod ;
- autorisation vérifiée côté API, jamais seulement dans l'interface ;
- requêtes paramétrées, transactions atomiques et journal d'audit ;
- aucun secret ou compte administrateur intégré au code.

Consulter [Sécurité](docs/security.md) avant une mise en ligne.

## Déploiement

Le frontend est préparé pour GitHub Pages avec `HashRouter`. Le workflow calcule automatiquement `VITE_BASE_PATH` à partir du nom réel du dépôt et prend `VITE_API_URL` dans une variable GitHub si elle existe.

Le backend n'est **jamais déployé automatiquement** par ce dépôt. La procédure VPS impose d'abord un inventaire en lecture seule, la sélection d'un port libre, des sauvegardes ciblées, une configuration Nginx indépendante et `nginx -t` avant toute recharge. Aucun script ne doit être exécuté en production sans validation explicite du propriétaire du VPS.

Lire le [runbook VPS](docs/deployment/vps-runbook.md) dans son intégralité. Les exemples systemd, Nginx et MariaDB ne modifient rien tant qu'un administrateur ne les installe pas volontairement.

## Documentation

- [Architecture](docs/architecture.md)
- [Configuration](docs/configuration.md)
- [Contrat API](docs/api.md)
- [Modèle de sécurité](docs/security.md)
- [Déploiement et retour arrière VPS](docs/deployment/vps-runbook.md)
- [Sauvegarde et restauration](docs/deployment/backups.md)

## Règles de contribution

1. Ne jamais introduire de secret ou de données RP sensibles dans Git.
2. Ajouter une migration plutôt que modifier une migration déjà appliquée.
3. Toute modification de stock, paiement ou caisse doit rester transactionnelle et auditée.
4. Une correction comptable crée une écriture compensatrice ; elle ne supprime pas l'historique.
5. Exécuter types, tests et build avant une revue.

## État du déploiement

Le dépôt prépare l'application et les procédures, mais ne constitue pas une preuve de déploiement. L'accès au VPS, la création de la base, l'émission du certificat TLS, l'installation systemd et le premier compte Patron restent des opérations administratives manuelles et autorisées.

