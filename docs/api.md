# API REST

L'API est servie sous `/api`. Sa spécification OpenAPI générée par le backend est la référence exécutable et est exposée à `/api/docs` lorsque la configuration l'autorise. Le présent document décrit les conventions stables.

## Authentification

Le navigateur utilise un cookie de session serveur. Toutes les requêtes doivent inclure les credentials :

```ts
fetch(`${apiUrl}/api/auth/me`, { credentials: "include" });
```

Après connexion, le client récupère/conserve le jeton CSRF associé à la session. Toute méthode mutante le transmet dans l'en-tête prévu par l'API. Le cookie et le jeton ne remplacent pas les contrôles de permission.

Le corps de connexion contient `username` (le pseudo) et `password`. Une
adresse e-mail n'est ni requise ni utilisée comme identifiant.

Routes principales :

| Domaine | Préfixe | Exemples d'opérations |
|---|---|---|
| Santé | `/api/health` | disponibilité et état des dépendances |
| Authentification | `/api/auth` | connexion par pseudo, déconnexion, session courante et préférences d'affichage, changement de son mot de passe, CSRF |
| Notifications | `/api/notifications` | alertes et activité récente filtrées par droits, marquage comme lu (`POST /read`) |
| Utilisateurs | `/api/users` | comptes par pseudo, modification du pseudo, réinitialisation du mot de passe, activation, permissions fines |
| Rôles | `/api/roles` | rôles personnalisés et permissions associées |
| Groupes | `/api/groups` | CRUD logique, tarifs, activité, dettes |
| Types de groupes | `/api/group-types` | liste administrable |
| Contacts | `/api/contacts` | contacts, groupe, interactions, archivage |
| Articles | `/api/items` | catalogue, prix et historique |
| Catégories | `/api/item-categories`, `/api/expense-categories` | catégories administrables |
| Commandes | `/api/orders` | lignes, transitions, livraisons et annulations |
| Stocks | `/api/stocks` | état, mouvements, ajustements, alertes |
| Moyens de paiement | `/api/payment-methods` | liste administrable (Espèces, Virement, Argent sale…) |
| Paiements | `/api/payments` | règlements partiels et annulations compensées |
| Dépenses | `/api/expenses` | dépenses et catégories |
| Tableau de bord | `/api/dashboard` | indicateurs et séries filtrées |
| Audit | `/api/audit-logs` | consultation autorisée du journal, recherche par utilisateur ou adresse IP |

Les listes administrables (`/api/item-categories`, `/api/expense-categories`, `/api/group-types`,
`/api/payment-methods`) partagent les mêmes opérations : `GET` (avec `includeInactive=true`
pour inclure les entrées archivées), `POST`, `PUT /:id`, `POST /:id/archive`,
`POST /:id/restore` et `DELETE /:id` (refusé tant que l'entrée est utilisée).

## Conventions

- JSON UTF-8 pour requêtes et réponses ;
- dates ISO 8601 en UTC ;
- montants sérialisés en chaîne décimale ou unité entière selon le schéma OpenAPI, jamais supposés exacts s'ils arrivent en flottant ;
- pagination bornée avec curseur ou `page`/`limit` selon l'endpoint ;
- filtres de dates avec bornes inclusives documentées ;
- tri limité à une liste de colonnes autorisées ;
- identifiant de corrélation retourné afin de retrouver une erreur dans les journaux.

## Erreurs

Les erreurs ne doivent pas exposer de pile, requête SQL ou secret. Le format normalisé contient au minimum un code stable, un message français exploitable et l'identifiant de corrélation. Les erreurs de validation peuvent ajouter une liste de champs.

Codes HTTP usuels :

- `400` requête invalide ou transition impossible ;
- `401` session absente/expirée ;
- `403` permission ou CSRF insuffisant ;
- `404` ressource inexistante ou non visible ;
- `409` conflit métier, version ou idempotence ;
- `422` validation sémantique ;
- `429` limitation de débit ;
- `500` erreur interne masquée.

## Idempotence et concurrence

Les livraisons et autres écritures critiques acceptent ou génèrent une clé d'idempotence. Répéter une requête avec la même clé ne produit pas une seconde sortie de stock. Les conflits de mise à jour sont refusés plutôt qu'écrasés silencieusement.

## Vérifications rapides

Depuis le VPS :

```bash
curl --fail --silent --show-error http://127.0.0.1:3002/api/health
```

Depuis l'extérieur, après TLS :

```bash
curl --fail --silent --show-error https://api-madrazo.code-eternal.fr/api/health
```

Ne jamais placer de cookie de production dans une commande conservée dans l'historique du shell.

