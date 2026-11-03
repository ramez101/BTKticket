# BTK Easy — application Android et iOS

Le dossier `mobile/` contient une application React Native Expo qui utilise les mêmes API et la même base de données que l'application Next.js.

## Fonctionnalités

- accueil avec statut du service et files d'attente en direct ;
- prise de ticket avec agence et service ;
- rendez-vous avec agence, chargé, date et créneau disponible ;
- écran d'agence avec ticket appelé et file d'attente actualisée ;
- navigation mobile native Android/iOS.

## Installation locale

```bash
cd mobile
npm install
copy .env.example .env
```

Dans `mobile/.env`, renseignez l'URL publique du serveur web :

```env
EXPO_PUBLIC_API_URL=https://votre-domaine-btk-easy.com
```

Pour un téléphone réel, `localhost` ne pointe pas vers votre ordinateur. Utilisez l'adresse IP du PC sur le réseau local en développement, ou l'URL HTTPS de production.

```bash
npm run start
```

### Tester avec Expo Go sur un téléphone

Le fichier doit s'appeler exactement `mobile/.env` — et non `.env copy.example` — avec l'adresse IP du PC sur le même Wi-Fi que le téléphone :

```env
EXPO_PUBLIC_API_URL=http://192.168.10.92:3000
```

Sous Windows PowerShell, si Expo affiche `127.0.0.1` dans le QR code, forcez l'adresse LAN :

```powershell
$expoHost = '192.168.10.92'
$env:REACT_NATIVE_PACKAGER_HOSTNAME = $expoHost
npm.cmd run start -- --go --lan --port 8083
```

Scannez ensuite le QR code avec Expo Go. Le téléphone et le PC doivent rester sur le même réseau. Si le port 8081 est libre, `--port 8083` peut être remplacé par `--port 8081`.

Le projet utilise Expo SDK 57 avec React Native 0.86. Expo Go doit utiliser la même version de SDK. Sur Android, installez Expo Go SDK 57 si votre version du Play Store ne l'inclut pas encore. Sur un iPhone physique, utilisez un build Expo Go compatible via EAS si l'App Store ne propose pas encore SDK 57.

## Générer les applications téléchargeables

Installez EAS CLI puis connectez le projet Expo :

```bash
npm install -g eas-cli
eas login
cd mobile
eas init
```

Remplacez ensuite `replace-with-your-eas-project-id` dans `mobile/app.json` par le `projectId` fourni par EAS.

Build Android :

```bash
npm run build:android
```

Build iOS :

```bash
npm run build:ios
```

## Notifications push

Les notifications utilisent `expo-notifications` et le service Expo Push : confirmation du ticket, approche avec trois personnes devant, appel au guichet, confirmation ou annulation d'un rendez-vous, et rappels 24 heures et 1 heure avant le rendez-vous.

Pour activer les push distantes, renseignez `EXPO_PUBLIC_EAS_PROJECT_ID` dans `mobile/.env`, remplacez le project ID fictif dans `mobile/app.json`, puis reconstruisez l'application avec EAS. Les push distantes Android ne fonctionnent pas dans Expo Go ; utilisez un development build ou une APK EAS.

### Suivi dynamique du ticket

Lorsqu'un ticket est créé depuis l'application mobile, son abonnement push est associé au ticket. Chaque appel de guichet met à jour la même notification au lieu d'en créer une nouvelle :

- le nombre de personnes avant le client est actualisé ;
- une barre de progression textuelle évolue dans la notification ;
- une alerte sonore est envoyée lorsque le ticket arrive dans les trois prochains ;
- l'appel du ticket remplace la progression par une notification prioritaire avec le guichet.

La présentation avec remplacement de notification et barre de progression est prise en charge sur Android dans le build EAS. Les notifications iOS affichent les mêmes informations dans le centre de notifications, mais une barre réellement native de type Live Activity nécessiterait une intégration iOS dédiée.

Le champ `initialPosition` doit être appliqué à la base avec `npm run db:push` avant le premier déploiement de cette fonctionnalité.

Les rappels sont également programmés localement lors de la confirmation du rendez-vous. Le serveur expose en plus `POST /api/cron/appointment-reminders` pour un planificateur externe. Appelez cette route toutes les 5 minutes ; si `CRON_SECRET` est défini, envoyez `Authorization: Bearer <CRON_SECRET>`.

## Parcours mobile

- Le ticket suit deux écrans : agence, puis service.
- Le rendez-vous suit trois écrans : agence, chargé, puis créneau et informations client.
- La localisation propose l’agence ouverte la plus proche.
- Après création du ticket, « Itinéraire vers l’agence » ouvre Google Maps.
- `mobile/assets/icon.png` est utilisé dans l’en-tête et au lancement de l’application.

EAS produit un fichier Android installable pour les tests et un build iOS distribuable via TestFlight/App Store selon les identifiants Apple et Google configurés. La publication nécessite les comptes développeur Google Play et Apple Developer.
