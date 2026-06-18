# README_BD - Connexion et tables

Ce fichier resume la connexion a la base de donnees et la structure des tables utilisees par le projet BTKticket.

## Technologie

- Base de donnees : PostgreSQL
- ORM : Prisma
- Schema Prisma : `prisma/schema.prisma`
- Client Prisma : `src/lib/prisma.ts`
- Fichier d'exemple des variables : `.env.example`

## Connexion a la base de donnees

La connexion est configuree avec la variable d'environnement `DATABASE_URL`.

Exemple :

```env
DATABASE_URL="postgresql://btkuser:btkpass123@localhost:5432/btkticket"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
```

Format de `DATABASE_URL` :

```text
postgresql://UTILISATEUR:MOT_DE_PASSE@HOTE:PORT/NOM_BASE
```

Exemple local :

```text
postgresql://postgres:motdepasse@localhost:5432/btkticket
```

Important : le vrai fichier `.env` peut contenir un mot de passe reel. Il ne faut pas le publier dans Git.

## Commandes utiles

Installer les dependances :

```bash
npm install
```

Appliquer le schema Prisma dans PostgreSQL :

```bash
npm run db:push
```

Inserer les donnees initiales :

```bash
npm run db:seed
```

Ouvrir Prisma Studio :

```bash
npm run db:studio
```

Regenerer le client Prisma apres modification du schema :

```bash
npx prisma generate
```

## Tables de la base de donnees

### 1. `agencies`

Modele Prisma : `Agency`

Cette table contient les agences BTK.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `Int` | Cle primaire, auto-increment | Identifiant interne de l'agence |
| `code` | `String` | Unique | Code agence, exemple `AG01` |
| `name` | `String` | Obligatoire | Nom de l'agence |
| `city` | `String` | Obligatoire | Ville de l'agence |
| `pin` | `String` | Obligatoire | PIN chiffre avec bcrypt |
| `isActive` | `Boolean` | Defaut `true` | Etat actif/inactif de l'agence |
| `createdAt` | `DateTime` | Defaut `now()` | Date de creation |

Relations :

- Une agence possede plusieurs guichets.
- Une agence possede plusieurs tickets.

### 2. `guichets`

Modele Prisma : `Guichet`

Cette table contient les guichets rattaches aux agences.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `Int` | Cle primaire, auto-increment | Identifiant interne du guichet |
| `number` | `Int` | Unique avec `agencyId` | Numero du guichet dans une agence |
| `label` | `String` | Obligatoire | Libelle affiche, exemple `Guichet 1` |
| `agencyId` | `Int` | Cle etrangere vers `agencies.id` | Agence du guichet |
| `isActive` | `Boolean` | Defaut `true` | Etat actif/inactif du guichet |

Contraintes :

- `@@unique([agencyId, number])` : une meme agence ne peut pas avoir deux guichets avec le meme numero.
- Suppression en cascade : si une agence est supprimee, ses guichets sont supprimes.

Relations :

- Un guichet appartient a une agence.
- Un guichet peut etre lie a plusieurs tickets.

### 3. `tickets`

Modele Prisma : `Ticket`

Cette table contient les tickets generes par les clients ou la borne.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `Int` | Cle primaire, auto-increment | Identifiant interne du ticket |
| `number` | `Int` | Obligatoire | Numero journalier du ticket dans l'agence |
| `label` | `String` | Obligatoire | Libelle affiche, actuellement le numero en texte, exemple `1` ou `2` |
| `service` | `String` | Obligatoire | Service demande, exemple `Caisse` |
| `status` | `TicketStatus` | Defaut `WAITING` | Statut du ticket |
| `qrCode` | `String?` | Optionnel | QR code du ticket |
| `agencyId` | `Int` | Cle etrangere vers `agencies.id` | Agence du ticket |
| `guichetId` | `Int?` | Cle etrangere optionnelle vers `guichets.id` | Guichet qui appelle ou traite le ticket |
| `dayDate` | `String` | Obligatoire | Date du jour utilisee pour le compteur |
| `createdAt` | `DateTime` | Defaut `now()` | Date de creation du ticket |
| `calledAt` | `DateTime?` | Optionnel | Date d'appel du ticket |
| `servedAt` | `DateTime?` | Optionnel | Date de traitement du ticket |

Relations :

- Un ticket appartient a une agence.
- Un ticket peut etre rattache a un guichet.

### 4. `daily_counters`

Modele Prisma : `DailyCounter`

Cette table gere le compteur journalier par agence.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `Int` | Cle primaire, auto-increment | Identifiant interne du compteur |
| `agencyId` | `Int` | Unique avec `dayDate` | Agence concernee |
| `dayDate` | `String` | Unique avec `agencyId` | Date du compteur |
| `counter` | `Int` | Defaut `0` | Dernier numero genere pour cette agence et cette date |

Contraintes :

- `@@unique([agencyId, dayDate])` : une agence a un seul compteur par jour.

Remarque :

- Le modele ne declare pas de relation Prisma directe vers `Agency`, mais `agencyId` correspond a l'identifiant d'une agence.

### 5. `holidays`

Modele Prisma : `Holiday`

Cette table contient les jours feries ou jours de fermeture.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `Int` | Cle primaire, auto-increment | Identifiant interne du jour ferie |
| `date` | `String` | Unique | Date du jour ferie |
| `label` | `String?` | Optionnel | Description du jour ferie |
| `createdAt` | `DateTime` | Defaut `now()` | Date de creation |

## Enum `TicketStatus`

L'enum `TicketStatus` definit les statuts possibles d'un ticket.

| Valeur | Description |
|---|---|
| `WAITING` | Ticket en attente |
| `CALLED` | Ticket appele au guichet |
| `SERVED` | Ticket servi |
| `ABSENT` | Client absent |

## Relations principales

```text
agencies 1 ----- n guichets
agencies 1 ----- n tickets
guichets 1 ----- n tickets
daily_counters utilise agencies.id via agencyId
```

## Donnees initiales

Le fichier `prisma/seed.ts` cree :

- 44 agences BTK.
- 3 guichets par agence.
- Un PIN chiffre pour chaque agence.

Commande :

```bash
npm run db:seed
```

## Schema Prisma complet

Le schema complet et officiel se trouve dans :

```text
prisma/schema.prisma
```
