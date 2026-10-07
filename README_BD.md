# README_BD - Connexion et tables

Ce fichier resume la connexion a la base de donnees et la structure des tables utilisees par le projet BTKticket.

## Technologie

- Base de donnees : MySQL/MariaDB (XAMPP/phpMyAdmin)
- ORM : Prisma
- Schema Prisma : `prisma/schema.prisma`
- Client Prisma : `src/lib/prisma.ts`
- Fichier d'exemple des variables : `.env.example`

## Connexion a la base de donnees

La connexion est configuree avec la variable d'environnement `DATABASE_URL`.

Exemple :

```env
DATABASE_URL="mysql://root:@127.0.0.1:3306/btkticket"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
```

Format de `DATABASE_URL` :

```text
mysql://UTILISATEUR:MOT_DE_PASSE@HOTE:PORT/NOM_BASE
```

Exemple local :

```text
mysql://root:motdepasse@127.0.0.1:3306/btkticket
```

Important : le vrai fichier `.env` peut contenir un mot de passe reel. Il ne faut pas le publier dans Git.

## Commandes utiles

Installer les dependances :

```bash
npm install
```

Appliquer le schema Prisma dans MySQL/MariaDB :

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
| `code` | `String` | Unique | Code agence, exemple `00101` |
| `name` | `String` | Obligatoire | Nom de l'agence |
| `city` | `String` | Obligatoire | Ville de l'agence |
| `address` | `String?` | Optionnel | Adresse de l'agence |
| `latitude` | `Float?` | Optionnel | Latitude GPS de l'agence |
| `longitude` | `Float?` | Optionnel | Longitude GPS de l'agence |
| `pin` | `String` | Obligatoire | PIN chiffre avec bcrypt |
| `isActive` | `Boolean` | Defaut `true` | Etat actif/inactif de l'agence |
| `createdAt` | `DateTime` | Defaut `now()` | Date de creation |

Relations :

- Une agence possede plusieurs guichets.
- Une agence possede plusieurs tickets.
- Une agence possede plusieurs charges.
- Une agence possede plusieurs rendez-vous.

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
| `onHold` | `Boolean` | Defaut `false` | Indique si le ticket est mis en attente |

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

### 6. `charges`

Modele Prisma : `Charge`

Cette table contient les charges ou conseillers qui recoivent les rendez-vous.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `Int` | Cle primaire, auto-increment | Identifiant interne de la charge |
| `code` | `String` | Unique, obligatoire | Code interne de la charge |
| `name` | `String` | Obligatoire | Nom de la charge |
| `agencyId` | `Int` | Cle etrangere vers `agencies.id` | Agence de rattachement |
| `email` | `String?` | Optionnel | Adresse email de la charge |
| `phone` | `String?` | Optionnel | Numero de telephone |
| `outlookEmail` | `String?` | Optionnel | Email utilise pour Outlook |
| `outlookRefreshToken` | `String?` | Optionnel | Token de rafraichissement Outlook |
| `isActive` | `Boolean` | Defaut `true` | Etat actif/inactif |
| `createdAt` | `DateTime` | Defaut `now()` | Date de creation |
| `updatedAt` | `DateTime` | Mis a jour automatiquement | Date de derniere modification |

Contraintes et relations :

- `code` est unique.
- `agencyId` reference `agencies.id`.
- Suppression en cascade : les donnees de la charge sont supprimees avec son agence.
- Une charge possede plusieurs disponibilites, blocages et rendez-vous.

### 7. `charge_availabilities`

Modele Prisma : `ChargeAvailability`

Cette table definit les horaires habituels de disponibilite d'une charge par jour de la semaine.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `Int` | Cle primaire, auto-increment | Identifiant interne |
| `chargeId` | `Int` | Cle etrangere vers `charges.id` | Charge concernee |
| `weekday` | `Int` | Obligatoire | Jour de la semaine |
| `enabled` | `Boolean` | Defaut `false` | Disponibilite active ou non |
| `startTime` | `String` | Defaut `08:30` | Heure de debut |
| `endTime` | `String` | Defaut `16:00` | Heure de fin |
| `slotMinutes` | `Int` | Defaut `30` | Duree d'un rendez-vous en minutes |

Contraintes :

- `@@unique([chargeId, weekday])` : une seule configuration par charge et par jour.
- Suppression en cascade lorsque la charge est supprimee.

### 8. `charge_day_blocks`

Modele Prisma : `ChargeDayBlock`

Cette table contient les indisponibilites exceptionnelles d'une charge.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `Int` | Cle primaire, auto-increment | Identifiant interne |
| `chargeId` | `Int` | Cle etrangere vers `charges.id` | Charge concernee |
| `date` | `String` | Obligatoire | Date du blocage |
| `startTime` | `String?` | Optionnel | Heure de debut du blocage |
| `endTime` | `String?` | Optionnel | Heure de fin du blocage |
| `allDay` | `Boolean` | Defaut `false` | Blocage pour toute la journee |
| `label` | `String?` | Optionnel | Motif ou libelle du blocage |
| `createdAt` | `DateTime` | Defaut `now()` | Date de creation |

Contraintes et index :

- Index `@@index([chargeId, date])` pour rechercher les blocages d'une charge par date.
- Suppression en cascade lorsque la charge est supprimee.

### 9. `appointments`

Modele Prisma : `Appointment`

Cette table contient les rendez-vous pris avec une charge dans une agence.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `Int` | Cle primaire, auto-increment | Identifiant interne du rendez-vous |
| `reference` | `String` | Unique, obligatoire | Reference publique du rendez-vous |
| `chargeId` | `Int` | Cle etrangere vers `charges.id` | Charge concernee |
| `agencyId` | `Int` | Cle etrangere vers `agencies.id` | Agence concernee |
| `date` | `String` | Obligatoire | Date du rendez-vous |
| `time` | `String` | Obligatoire | Heure du rendez-vous |
| `customerName` | `String` | Obligatoire | Nom du client |
| `customerPhone` | `String` | Obligatoire | Telephone du client |
| `customerEmail` | `String?` | Optionnel | Email du client |
| `subject` | `String?` | Optionnel | Objet du rendez-vous |
| `outlookEventId` | `String?` | Optionnel | Identifiant de l'evenement Outlook |
| `status` | `String` | Defaut `CONFIRMED` | Statut du rendez-vous |
| `createdAt` | `DateTime` | Defaut `now()` | Date de creation |

Contraintes et relations :

- `reference` est unique.
- `@@unique([chargeId, date, time])` : une charge ne peut pas avoir deux rendez-vous au meme moment.
- Les relations vers la charge et l'agence utilisent la suppression en cascade.

### 10. `service_hours`

Modele Prisma : `ServiceHours`

Cette table contient la configuration generale des horaires de service.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `key` | `String` | Cle primaire, defaut `default` | Cle de la configuration |
| `activeMode` | `String` | Defaut `service` | Mode horaire actif |
| `singleSessionStart` | `String` | Defaut `08:00` | Debut de la session normale |
| `singleSessionEnd` | `String` | Defaut `16:30` | Fin de la session normale |
| `singleSessionStartMonth` | `String?` | Optionnel | Mois de debut de la periode speciale |
| `singleSessionEndMonth` | `String?` | Optionnel | Mois de fin de la periode speciale |
| `ramadanEnabled` | `Boolean` | Defaut `false` | Active les horaires de Ramadan |
| `ramadanMonth` | `String?` | Optionnel | Mois de Ramadan |
| `ramadanStartDate` | `String?` | Optionnel | Date de debut de Ramadan |
| `ramadanEndDate` | `String?` | Optionnel | Date de fin de Ramadan |
| `ramadanStartTime` | `String` | Defaut `08:00` | Heure de debut pendant Ramadan |
| `ramadanEndTime` | `String` | Defaut `14:00` | Heure de fin pendant Ramadan |
| `updatedAt` | `DateTime` | Mis a jour automatiquement | Date de derniere modification |

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

- 45 agences BTK.
- 3 guichets par agence.
- Un PIN chiffre par defaut pour chaque agence.

Commande :

```bash
npm run db:seed
```

## Schema Prisma complet

Le schema complet et officiel se trouve dans :

```text
prisma/schema.prisma
```
