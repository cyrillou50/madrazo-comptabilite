# Base MariaDB Madrazo

Les migrations sont exécutées dans l'ordre lexical par `npm run migrate` depuis `backend/`. Elles ciblent exclusivement la base configurée dans l'environnement et n'exécutent ni `CREATE DATABASE`, ni `CREATE USER`, ni modification globale MariaDB.

Les montants utilisent des centimes entiers (`BIGINT`) et les stocks/caisse/audits sont des journaux immuables. Une erreur est compensée par une nouvelle écriture ou une procédure métier de contrepassation.

Le script `scripts/provision-mariadb.sql.example` du dépôt indique les commandes à adapter et faire valider avant toute exécution sur le VPS.
