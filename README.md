# BTK Easy

Application web et mobile de gestion des files d'attente des agences BTK.

BTK Easy permet aux clients de prendre un ticket ou un rendez-vous, aux chargés de gérer les files, aux écrans d'afficher les appels en direct et aux administrateurs de configurer les agences, les guichets, les horaires et les conseillers.

## Sommaire

- Fonctionnalités
- Architecture
- Installation web
- Application mobile Expo
- Horaires et temps d'attente
- API et temps réel
- Notifications et Outlook
- Structure du projet
- Dépannage

## Fonctionnalités

### Client

- recherche d'une agence par nom, ville ou code ;
- affichage des tickets en attente et du temps estimé ;
- prise de ticket pour un service ;
- consultation d'un ticket avec son code ;
- recherche de l'agence la plus proche ;
- suivi des appels en direct ;
- prise de rendez-vous avec un chargé ;
- sélection d'une date et d'un créneau ;
- confirmation et annulation d'un rendez-vous ;
- itinéraire vers l'agence.

### Chargé et agence

- connexion par agence ;
- consultation de la file ;
- appel du ticket suivant ;
- mise en attente ou déclaration d'absence ;
- association d'un ticket à un guichet ;
- affichage du ticket appelé ;
- mise à jour périodique et temps réel.

### Administration

- gestion des agences et guichets ;
- activation et désactivation des agences ;
- gestion des chargés/conseillers ;
- gestion des jours fériés ;
- horaires standard, séance unique et Ramadan ;
- disponibilités et blocages des chargés ;
- statistiques et temps d'attente ;
- connexion Outlook des chargés.

### Mobile

- accueil mobile avec statut du service ;
- prise de ticket et rendez-vous ;
- écran d'agence en direct ;
- pagination de 10 agences par page ;
- recherche d'agence ;
- bandeau de service fermé hors horaires ;
- notifications push et rappels ;
- interface Android et iOS avec Expo.

## Architecture

~~~text
Application web / Application mobile
                 |
                 v
        API Next.js + Socket.io
                 |
                 v
           Prisma ORM
                 |
                 v
          MySQL / MariaDB
~~~

Les applications web et mobile utilisent les mêmes API et la même base de données.

## Stack technique

### Web

- Next.js 14 et App Router ;
- React 18 ;
- TypeScript ;
- Tailwind CSS ;
- Socket.io ;
- Prisma ORM ;
- MySQL/MariaDB ;
- qrcode et bcryptjs.

### Mobile

- Expo SDK 57 ;
- React Native 0.86 ;
- React 19 ;
- expo-location ;
- expo-notifications ;
- expo-dev-client ;
- EAS Build.

## Pages web

| Fonction | URL | Description |
|---|---|---|
| Accueil | / | Présentation et navigation |
| Client | /client | Choix d'agence et prise de ticket |
| Ticket | /ticket/[code] | Consultation d'un ticket |
| Rendez-vous | /rdv | Réservation d'un rendez-vous |
| Chargé | /agent | Gestion de la file |
| Borne | /borne | Prise de ticket sur place |
| Écran | /ecran | Affichage public des appels |
| Administration | /dashboard | Gestion de la plateforme |
| Dashboard chargé | /charge-dashboard | Rendez-vous et disponibilités |

## Prérequis

- Node.js 18 ou supérieur ;
- npm ;
- MySQL ou MariaDB ;
- XAMPP recommandé sous Windows ;
- téléphone et PC sur le même réseau local pour tester le mobile ;
- compte Expo/EAS pour les builds mobiles.

## Installation web

Depuis la racine du projet :

~~~bash
npm install
~~~

Créer le fichier d'environnement.

Sous macOS/Linux :

~~~bash
cp .env.example .env
~~~

Sous PowerShell :

~~~powershell
Copy-Item .env.example .env
~~~

Configurer ensuite la base de données, puis exécuter :

~~~bash
npm run db:setup
~~~

Cette commande exécute la génération Prisma, la mise à jour du schéma et le seed initial.

## Variables d'environnement

### Web

Configuration minimale :

~~~env
DATABASE_URL="mysql://root:@127.0.0.1:3306/btkticket"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
~~~

Variables disponibles :

| Variable | Utilisation |
|---|---|
| DATABASE_URL | Connexion MySQL/MariaDB |
| NEXT_PUBLIC_BASE_URL | URL publique |
| MAIL_HOST / MAIL_PORT | Serveur SMTP |
| MAIL_FROM | Adresse d'envoi |
| MAIL_USER / MAIL_PASSWORD | Authentification SMTP optionnelle |
| CALENDAR_ORGANIZER_EMAIL | Organisateur des invitations |
| CRON_SECRET | Protection des rappels |
| EXPO_ACCESS_TOKEN | Token Expo |
| MICROSOFT_TENANT_ID | Tenant Microsoft |
| MICROSOFT_CLIENT_ID | Client Outlook |
| MICROSOFT_CLIENT_SECRET | Secret Outlook |
| MICROSOFT_REDIRECT_URI | Callback OAuth |
| MICROSOFT_TOKEN_ENCRYPTION_KEY | Chiffrement des tokens |

### Mobile

Créer mobile/.env depuis mobile/.env.example :

~~~env
EXPO_PUBLIC_API_URL=http://ADRESSE_IP_DU_PC:3000
EXPO_PUBLIC_EAS_PROJECT_ID=
~~~

Sur un téléphone réel, localhost désigne le téléphone. Utiliser l'adresse IP locale du PC ou l'URL HTTPS de production.

Ne jamais publier .env ou mobile/.env.

## Base de données

Le schéma officiel est dans prisma/schema.prisma. La documentation détaillée se trouve dans README_BD.md.

Commandes utiles :

~~~bash
npm run db:push
npm run db:seed
npm run db:studio
npx prisma generate
~~~

Principaux modèles :

- Agency : agences ;
- Guichet : guichets ;
- Ticket : tickets ;
- DailyCounter : compteur journalier ;
- Holiday : jours fériés ;
- Charge : chargés/conseillers ;
- ChargeAvailability : disponibilités ;
- ChargeDayBlock : blocages ;
- Appointment : rendez-vous ;
- ServiceHours : horaires.

Le seed crée les données initiales, dont 45 agences et leurs guichets.

## Lancement

### Développement web

~~~bash
npm run dev
~~~

Ouvrir http://localhost:3000.

### Réseau local

~~~bash
npm run dev:lan
~~~

Ouvrir ensuite http://ADRESSE_IP_DU_PC:3000 depuis le téléphone.

### Production

~~~bash
npm run build
npm start
~~~

npm start nécessite un build présent dans .next.

### Scripts racine

| Script | Description |
|---|---|
| npm run dev | Développement Next.js |
| npm run dev:lan | Développement sur le réseau |
| npm run build | Build de production |
| npm start | Serveur de production |
| npm run db:setup | Prisma, schéma et seed |
| npm run db:push | Appliquer le schéma |
| npm run db:seed | Données initiales |
| npm run db:studio | Prisma Studio |

## Application mobile Expo

L'application mobile se trouve dans mobile/ et utilise les mêmes API que le web.

### Installation et Expo Go

~~~powershell
cd mobile
npm install
Copy-Item .env.example .env
~~~

Lancer Expo Go :

~~~bash
npm run start:expo-go
~~~

Le téléphone et le PC doivent être sur le même Wi-Fi. Le serveur web doit être lancé avec npm run dev:lan.

Si Expo détecte une mauvaise adresse réseau :

~~~powershell
$expoHost = '192.168.x.x'
$env:REACT_NATIVE_PACKAGER_HOSTNAME = $expoHost
npm.cmd run start:expo-go -- --lan --port 8083
~~~

### Development Build

Le projet utilise expo-dev-client :

~~~bash
cd mobile
npm run build:android:dev
npm run start
~~~

Installer l'APK générée sur Android, puis ouvrir l'application Development Build.

Les modules natifs comme les notifications peuvent nécessiter un Development Build et ne sont pas toujours disponibles dans Expo Go.

### EAS

~~~bash
cd mobile
npm install -g eas-cli
eas login
eas init
~~~

Profils définis dans mobile/eas.json :

| Profil | Utilisation |
|---|---|
| development | Development Build interne |
| preview | Build interne de test |
| production | Build de distribution |

Commandes :

~~~bash
npm run build:android:dev
npm run build:android
npm run build:ios
~~~

Le projectId EAS est configuré dans mobile/app.json.

Assets :

- mobile/assets/icon.png : icône et splash screen ;
- mobile/assets/BTK.png : logo de l'interface ;
- mobile/app.json : configuration Expo ;
- mobile/eas.json : profils EAS.

Vérification mobile :

~~~bash
cd mobile
npm.cmd exec tsc -- --noEmit
~~~

## Horaires du service

Les horaires utilisent le fuseau Africa/Tunis.

- lundi à vendredi : 08:00–16:30 ;
- samedi et dimanche : fermé ;
- jours fériés : fermé ;
- hors horaires : création de ticket bloquée côté API et interface.

Modes disponibles :

- service standard ;
- séance unique ;
- Ramadan.

La route /api/service-status est sans cache pour que le statut passe correctement à fermé après 16:30. Les interfaces web et mobile demandent également cette route sans cache.

## Temps d'attente

Le calcul utilise, selon les données disponibles :

- tickets devant le client ;
- tickets prioritaires ;
- tickets en cours ;
- service demandé ;
- agents actifs et compatibles ;
- durée moyenne de traitement ;
- historiques récents.

La logique est centralisée dans src/lib/wait-time.ts.

## Temps réel

Socket.io diffuse les événements par agence :

- new-ticket ;
- ticket-update ;
- number-called.

Les écrans et le mobile effectuent également une actualisation périodique afin de fonctionner même si le WebSocket est temporairement indisponible.

## API principale

| Méthode | Route | Description |
|---|---|---|
| GET | /api/service-status | État du service |
| GET | /api/agency | Liste des agences |
| GET | /api/agency/[id] | Données live d'une agence |
| GET | /api/agency/[id]/guichets | Guichets |
| POST | /api/agency/[id]/verify-pin | Vérification du PIN |
| POST | /api/ticket | Créer un ticket |
| GET | /api/ticket/[code] | Consulter un ticket |
| GET | /api/agent/queue | Consulter une file |
| POST | /api/agent/next | Appeler le ticket suivant |
| GET | /api/charges | Liste des chargés |
| GET | /api/charges/[id]/availability | Créneaux disponibles |
| POST | /api/appointments | Créer un rendez-vous |
| GET/DELETE | /api/appointments/[id] | Consulter ou annuler |
| POST | /api/push/register | Enregistrer un token push |
| POST | /api/cron/appointment-reminders | Envoyer les rappels |

Les routes /api/admin gèrent les agences, guichets, chargés, jours fériés et horaires.

## Notifications et Outlook

### SMTP et calendrier

À la confirmation d'un rendez-vous, BTK Easy peut envoyer une invitation Outlook compatible iCalendar. L'annulation met à jour ou supprime l'événement associé.

Configuration SMTP locale :

~~~env
MAIL_HOST=127.0.0.1
MAIL_PORT=1025
MAIL_FROM="BTK Easy <rdv@btk.local>"
CALENDAR_ORGANIZER_EMAIL=rdv@btk.local
~~~

MailCatcher :

~~~bash
mailcatcher --ip 127.0.0.1 --smtp-port 1025 --http-port 1080
~~~

Interface : http://127.0.0.1:1080.

### Microsoft Graph

1. créer une application Web dans Microsoft Entra ID ;
2. enregistrer /api/outlook/callback ;
3. accorder User.Read et Calendars.ReadWrite ;
4. renseigner les variables MICROSOFT_* ;
5. connecter Outlook depuis le dashboard du chargé.

### Push mobile

Les notifications couvrent la création et l'appel d'un ticket, l'approche du tour, les rendez-vous et les rappels 24 heures et 1 heure avant le rendez-vous.

Pour les push Android, utiliser un Development Build ou un build EAS.

La route de rappels peut être appelée toutes les cinq minutes. Si CRON_SECRET est configuré, envoyer :

~~~text
Authorization: Bearer CRON_SECRET
~~~

## Structure du projet

~~~text
btkticket/
├── mobile/
│   ├── App.tsx
│   ├── app.json
│   ├── eas.json
│   ├── package.json
│   ├── theme.ts
│   └── assets/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── client/page.tsx
│   │   ├── rdv/page.tsx
│   │   ├── agent/page.tsx
│   │   ├── borne/page.tsx
│   │   ├── ecran/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── charge-dashboard/page.tsx
│   │   └── api/
│   ├── components/
│   ├── hooks/
│   └── lib/
│       ├── appointments.ts
│       ├── hours.ts
│       ├── prisma.ts
│       ├── push.ts
│       ├── socket-server.ts
│       └── wait-time.ts
├── .env.example
├── package.json
├── README.md
└── README_BD.md
~~~

## Dépannage

### Erreur de build de production

~~~bash
npm run build
npm start
~~~

### Le mobile ne voit pas l'API

Vérifier que :

1. Next.js est lancé avec npm run dev:lan ;
2. mobile/.env utilise l'IP du PC ;
3. le téléphone et le PC sont sur le même Wi-Fi ;
4. le port 3000 est autorisé par le pare-feu ;
5. l'application a été rechargée après la modification de .env.

### Le statut reste ouvert après 16:30

Redémarrer le serveur web et recharger l'application. La route /api/service-status utilise des réponses sans cache.

### Module natif Expo manquant

~~~bash
cd mobile
npm run build:android:dev
npm run start
~~~

### Port 3000 occupé sous Windows

~~~powershell
Get-NetTCPConnection -LocalPort 3000
Stop-Process -Id PID
~~~

Remplacer PID par l'identifiant réel du processus.

## Sécurité

- ne pas publier .env ;
- modifier les PIN et secrets avant la production ;
- utiliser HTTPS en production ;
- protéger CRON_SECRET ;
- utiliser une clé forte pour MICROSOFT_TOKEN_ENCRYPTION_KEY ;
- ne pas exposer Prisma Studio sur Internet ;
- sauvegarder régulièrement la base ;
- limiter les permissions OAuth.

## Documentation complémentaire

- README_BD.md : connexion et structure de la base ;
- MOBILE_APP.md : notes détaillées du mobile ;
- mobile/.env.example : variables Expo ;
- mobile/app.json : identité et configuration Expo ;
- mobile/eas.json : profils EAS ;
- prisma/schema.prisma : schéma de la base.

## Vérification

Build web :

~~~bash
npm run build
~~~

Vérification mobile :

~~~bash
cd mobile
npm.cmd exec tsc -- --noEmit
~~~

Le projet ne contient pas de script de tests automatisés dans package.json. Les parcours web et mobile doivent être vérifiés manuellement après toute modification importante.
