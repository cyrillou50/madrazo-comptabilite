# Architecture technique

## Principes

L'application suit une architecture trois tiers. Le frontend statique ne détient ni secret ni logique d'autorité. L'API applique les permissions et orchestre les transactions. MariaDB reste l'unique source de vérité durable.

```text
Navigateur
  │ HTTPS + cookie de session + jeton CSRF
  ▼
GitHub Pages (React) ─────── HTTPS ──────► api-madrazo.code-eternal.fr
                                            │ Nginx, terminaison TLS
                                            ▼
                                      127.0.0.1:3002
                                      Express / Node.js
                                            │ compte SQL dédié
                                            ▼
                                         MariaDB
```

## Frontend

Le client utilise React, TypeScript strict, Vite et Tailwind CSS. `HashRouter` permet le rafraîchissement des routes sur GitHub Pages sans réécriture serveur. Une couche API centralise `fetch`, les cookies, le jeton CSRF et les erreurs normalisées.

Le frontend peut masquer les commandes interdites pour améliorer l'expérience, mais cela ne remplace jamais le contrôle d'autorisation de l'API.

## Backend

L'API Express est découpée par domaine : authentification, utilisateurs, groupes, contacts, catalogue, commandes, stocks, paiements, dépenses, tableau de bord et audit. Chaque requête suit le même pipeline :

1. identification de la requête et journalisation structurée ;
2. limitation de débit pour les routes sensibles ;
3. contrôle de session et de CSRF lorsque requis ;
4. validation des paramètres, filtres et corps ;
5. vérification de permission ;
6. service métier et transaction SQL ;
7. réponse JSON normalisée ;
8. écriture d'audit pour les opérations sensibles.

L'API tourne sous l'utilisateur système `madrazo`, derrière Nginx, et n'écoute que sur `127.0.0.1`. `TRUST_PROXY=1` est requis uniquement derrière ce proxy de confiance.

## Données et invariants

- Les montants utilisent `DECIMAL` en SQL et une représentation exacte dans les services ; aucun calcul monétaire critique n'utilise un flottant transmis par le navigateur.
- Le stock courant est dérivé des mouvements confirmés. Toute correction ajoute un mouvement avec motif et auteur.
- Une livraison possède une clé d'idempotence et ne peut pas déduire deux fois le même stock.
- Un paiement validé ne dépasse pas le reste dû. Une erreur est annulée par une écriture compensatrice auditée.
- L'archivage est logique pour les groupes, contacts, articles et comptes référencés par l'historique.
- Les transitions de commande, livraison, paiement et stock sont atomiques.

## Sessions et origine croisée

GitHub Pages et l'API sont sur des sites différents. En production, le client envoie les requêtes avec `credentials: include`. L'API renvoie une origine CORS précise, jamais `*`, ainsi que `Access-Control-Allow-Credentials: true`. Le cookie est `HttpOnly`, `Secure` et sa politique `SameSite` est configurée selon le domaine réel.

Un jeton CSRF associé à la session est obtenu après authentification et envoyé dans un en-tête pour les méthodes mutantes. Le mécanisme CORS n'est pas considéré comme une protection CSRF suffisante à lui seul.

## Déploiement

Deux cycles sont indépendants :

- le workflow GitHub Pages compile et publie seulement `frontend/` ;
- le backend est construit en CI mais installé manuellement sur le VPS après validation.

Cette séparation évite qu'un push de documentation puisse redémarrer un service de production. Le service `madrazo-api` ne partage ni répertoire, ni utilisateur SQL, ni unité systemd avec les autres applications.

## Observabilité

- `GET /api/health` sert de contrôle de disponibilité ;
- les journaux applicatifs vont vers stdout/stderr et sont collectés par journald ;
- les événements métier sensibles vont dans `audit_logs` ;
- Nginx conserve des journaux dédiés à l'hôte API ;
- les sauvegardes MariaDB produisent une empreinte SHA-256 et une politique de rétention séparée.

