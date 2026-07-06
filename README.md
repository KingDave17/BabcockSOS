# BabcockSOS 🚨

A real-time emergency alert and response system built for **Babcock University**, Ilishan-Remo. BabcockSOS lets students and staff report emergencies, trigger instant SOS alerts, and get the right people notified — fast.

Built with **React Native (Expo)**, **Firebase**, and a lot of care for the people on that campus.

---

## What This App Does

BabcockSOS is a two-sided emergency platform:

- **Students** can trigger a panic SOS, report incidents (Medical, Fire, Security, Accident), attach photo/audio evidence, and view nearby active alerts on a live map.
- **Staff/Admins** get a dedicated dashboard to monitor incoming alerts, manage users, broadcast campus-wide notifications, and view analytics on incident trends.

The entire alert lifecycle — from submission to resolution — is handled in real-time via Firestore listeners. No refreshing, no delays.

---

## Features

### Student Side
- **One-hold SOS Button** — Hold to trigger a Critical SOS. Sends your GPS coordinates, auto-records audio, dispatches push notifications to all relevant staff, and fires an SMS backup if network is unstable.
- **Incident Reporting** — Structured report form for Medical, Fire, Security Threat, and Accident categories. Attach image or audio evidence. Full offline fallback via SMS if Firebase is unreachable.
- **Live Alert Feed** — Real-time feed of active campus alerts, filterable by category.
- **Alert Map** — Live map view of all active alert locations on campus (centered on Babcock University).
- **History** — View a log of all your previously submitted reports and their resolution status.
- **Safety Resources** — Campus emergency contacts and first-response guidelines, available offline.
- **Profile** — Manage your name, toggle push notification preferences, switch between light/dark mode.

### Admin Side
- **Dashboard** — Real-time stats (total alerts, active vs resolved, total users). See the most recent alerts at a glance.
- **Alert Management** — Review all incoming alerts, update their status (Active → Resolved), and respond directly.
- **Broadcast** — Push a campus-wide notification to all users from the dashboard.
- **User Management** — View all registered users, their roles, and activity status.
- **Analytics** — Breakdown of incidents by category and role. Horizontal bar charts built without any charting library.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native (Expo SDK 54) |
| Navigation | Expo Router (file-based) |
| Backend / DB | Firebase Firestore |
| Auth | Firebase Authentication |
| Push Notifications | Expo Notifications + Expo Push API |
| Media Uploads | Cloudinary |
| Maps | react-native-maps (Google Maps) |
| Location | expo-location |
| SMS Fallback | expo-sms |
| Audio Recording | expo-av |
| Biometrics | expo-local-authentication |
| Speech Recognition | expo-speech-recognition |
| State (Theme/Auth/Location) | React Context API |
| Styling | React Native StyleSheet (no CSS-in-JS) |
| Language | TypeScript |

---

## Project Structure

```
BabcockSOS/
├── app/
│   ├── _layout.tsx              # Root layout — auth guard, context providers, routing
│   ├── login.tsx                # Student login screen
│   ├── admin-login.tsx          # Admin login (separate entry with biometric support)
│   ├── register.tsx             # Student registration + email verification flow
│   ├── privacy.tsx              # Privacy policy modal
│   ├── alertsModal.tsx          # Shared alerts modal (accessible cross-tab)
│   ├── modal.tsx                # Generic modal wrapper
│   │
│   ├── (tabs)/                  # Student tab navigator
│   │   ├── _layout.tsx          # Tab bar config
│   │   ├── index.tsx            # Home screen — SOS button, nearby alerts, staff mini-map
│   │   ├── report.tsx           # Incident reporting form
│   │   ├── alerts.tsx           # Live alert feed
│   │   ├── map.tsx              # Live campus alert map
│   │   ├── history.tsx          # User's report history
│   │   ├── safety.tsx           # Emergency contacts + first-response guides
│   │   └── profile.tsx          # User profile + notification preferences
│   │
│   └── (admin)/                 # Admin navigator (role-gated)
│       ├── _layout.tsx          # Admin tab bar config
│       ├── dashboard.tsx        # Stats overview + broadcast + recent alerts
│       ├── alerts.tsx           # Full alert management (update status, view details)
│       ├── users.tsx            # User management panel
│       └── analytics.tsx        # Incident breakdown by type and role
│
├── hooks/
│   ├── AuthContext.tsx          # Global auth state (user, profile, isLoading)
│   ├── LocationContext.tsx      # Global location state (updates every 30s)
│   ├── ThemeContext.tsx         # Light/dark mode + color tokens
│   ├── use-color-scheme.ts      # Native color scheme hook
│   └── use-theme-color.ts       # Theme-aware color resolver
│
├── utils/
│   ├── notifications.ts         # Push registration, broadcast, targeted send
│   ├── location.ts              # Reverse geocoding (Google + native fallback)
│   └── cloudinary.ts            # Image/audio upload to Cloudinary
│
├── components/
│   ├── ui/                      # Shared UI primitives
│   ├── themed-text.tsx
│   ├── themed-view.tsx
│   ├── parallax-scroll-view.tsx
│   └── ...
│
├── assets/                      # Icons, splash screen, images
├── constants/                   # App-wide constants
├── mocks/                       # Dev/test mocks
├── firebaseConfig.ts            # Firebase init (Auth + Firestore, platform-safe)
├── app.json                     # Expo config (permissions, plugins, EAS)
├── eas.json                     # EAS Build config (dev / preview / production)
├── tsconfig.json
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- Expo CLI (`npm install -g expo-cli` or just use `npx`)
- An Android device/emulator or iOS simulator
- A Firebase project with Firestore and Authentication enabled
- A Cloudinary account (for media uploads)

### 1. Clone and Install

```bash
git clone https://github.com/KingDave17/BabcockSOS.git
cd BabcockSOS
npm install
```

### 2. Environment Variables

Create a `.env` file in the root:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key_here
```

The rest of the Firebase config (projectId, authDomain, etc.) is already hardcoded in `firebaseConfig.ts` since this is a closed university system. If you're forking this for another institution, update that file directly.

### 3. Run the App

```bash
# Start the dev server
npx expo start

# Or target a specific platform
npm run android
npm run ios
```

Scan the QR code with **Expo Go** or use a development build for full native functionality (push notifications, maps, biometrics won't fully work in Expo Go).

---

## Building for Production

This project uses **EAS Build**.

```bash
# Install EAS CLI
npm install -g eas-cli

# Preview build (APK for internal testing)
eas build --profile preview --platform android

# Production build
eas build --profile production --platform android
```

---

## Firebase Setup

In Firestore, the app expects these collections:

| Collection | Description |
|---|---|
| `users` | User profiles — `firstName`, `lastName`, `role`, `pushToken`, `preferences` |
| `alerts` | Emergency reports — `type`, `description`, `location`, `status`, `timestamp`, `senderName`, etc. |

**Roles** used in the `role` field: `student`, `medical`, `security`, `admin`

Authentication requires **email verification** to be enabled. Users cannot access the app until their email is verified.

---

## Notification Architecture

Push notifications are handled client-side via the Expo Push API (suitable for a university-scale deployment). Here's how it works:

1. On login, each device registers and saves its `pushToken` to their Firestore profile.
2. When an alert is created, `broadcastAlertNotification()` queries Firestore for tokens matching the target audience (`all`, `staff-medical`, `staff-security`, etc.) and sends them in batch.
3. Targeted notifications (`sendTargetedNotification()`) are used for direct responses to a specific user.

> **Note:** For a larger-scale production deployment, this notification logic should be moved to **Firebase Cloud Functions** to avoid running Firestore queries from client devices.

---

## Dark Mode

The app fully supports light and dark mode. Theme toggling is handled globally through `ThemeContext`, which exposes a `colors` object used consistently across all screens. Users can toggle from their Profile screen.

---

## Known Limitations / In Progress

- Google Maps API key is currently `null` in `app.json`. The map still renders (using Apple Maps on iOS / default on Android), but POI-level reverse geocoding won't work without a valid key. Add your key to `app.json > android > config > googleMaps > apiKey`.
- Push notification delivery on the admin broadcast is client-initiated. Moving this to Cloud Functions is the right next step before going live.
- Speech recognition integration (`expo-speech-recognition`) is wired in but not fully surfaced in the UI yet.

---

## License

Private — built for Babcock University internal use.

---

*Built by [KingDave17](https://github.com/KingDave17)*
