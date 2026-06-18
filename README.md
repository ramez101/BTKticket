# BTKticket — BTK Bank Queue Management System

Système de gestion de tickets en ligne pour les 44 agences BTK Bank.

## Stack technique
- **Frontend** : Next.js 14, TypeScript, Tailwind CSS
- **Backend** : Next.js API Routes, Socket.io (WebSocket temps réel)
- **Base de données** : PostgreSQL + Prisma ORM
- **QR Code** : qrcode npm
- **Auth** : bcryptjs (PIN par agence)

---

## 4 Pages (URLs indépendantes)

| Page | URL | Usage |
|------|-----|-------|
| Client | `/client` | Prendre un ticket en ligne |
| Chargé | `/agent` | Gérer les numéros au guichet |
| Borne | `/borne` | Borne d'impression sur place |
| Écran | `/ecran` | Écran d'affichage salle d'attente |
| Admin | `/dashboard` | Gestion agences & guichets |

---

## Installation

### 1. Prérequis
- Node.js 18+
- PostgreSQL 14+

### 2. Installer les dépendances
```bash
cd btkticket
npm install
```

### 3. Configurer la base de données
```bash
cp .env.example .env
# Éditer .env avec vos credentials PostgreSQL
# DATABASE_URL="postgresql://user:password@localhost:5432/btkticket"
```

### 4. Créer la base et peupler
```bash
npx prisma db push
npm run db:seed
```

### 5. Lancer en développement
```bash
npm run dev
# → http://localhost:3000
```

### 6. Build production
```bash
npm run build
npm start
```

---

## Identifiants par défaut

### PIN Agences (chargé + borne)
| Agence | Code | PIN |
|--------|------|-----|
| Tunis Centre | AG01 | 1000 |
| Tunis Lafayette | AG02 | 1001 |
| Hammamet | AG11 | 1010 |
| ... | ... | ... |
| Ben Gardane | AG44 | 1043 |
> Formule : PIN = 999 + numéro agence

### Dashboard Admin
- PIN : `btk2024`

---

## Architecture temps réel

```
Client browser ──WebSocket──► Socket.io Server (Next.js)
                                      │
                          ┌───────────┴──────────┐
                          │   Room: agency-{id}   │
                          │                       │
                    Agent prend ticket      Agent appelle suivant
                          │                       │
                    emit('new-ticket')   emit('number-called')
                    emit('ticket-update') emit('ticket-update')
                          │                       │
                          └───────────────────────┘
                                      │
                    ┌─────────────────┴──────────────────┐
                    │                 │                   │
               /client            /ecran             /borne
          (stats live)      (numéro animé)      (stats live)
```

## Horaires d'ouverture
- **Lundi – Vendredi : 08h00 – 16h30**
- Samedi, Dimanche : Fermé
- Timezone : Africa/Tunis (UTC+1)
- Hors horaires : prise de ticket bloquée côté API et UI

## Numérotation par agence
- Chaque agence a son propre compteur journalier (`DailyCounter`)
- Réinitialisation automatique chaque jour à minuit
- Format : `001`, `002`, ..., `999`
- Hammamet peut être à `100` pendant que Manouba est à `020` — totalement indépendants

## Structure du projet
```
src/
├── app/
│   ├── page.tsx              # Accueil / navigation
│   ├── client/page.tsx       # Page client
│   ├── agent/page.tsx        # Page chargé
│   ├── borne/page.tsx        # Page borne
│   ├── ecran/page.tsx        # Page écran
│   ├── dashboard/page.tsx    # Dashboard admin
│   └── api/
│       ├── socket/           # Init Socket.io
│       ├── agency/           # GET agencies, GET agency/{id}, POST verify-pin
│       ├── ticket/           # POST create ticket
│       ├── agent/            # POST next ticket, GET queue
│       └── admin/            # CRUD agencies & guichets
├── components/
│   └── shared/
│       ├── BTKHeader.tsx
│       ├── PinModal.tsx
│       └── ClosedBanner.tsx
├── hooks/
│   └── useSocket.ts
├── lib/
│   ├── prisma.ts
│   ├── socket-server.ts
│   └── hours.ts
└── types/index.ts
prisma/
├── schema.prisma
└── seed.ts
```
