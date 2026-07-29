# VELO — Ghana's Premium Bike-Hailing App

Ghana's #1 motorcycle (okada) ride-hailing app. Uber for bikes, built for Ghanaians — with Mobile Money payments, transparent pricing in GHS, and safety-first features.

**Tagline:** Ride Safe. Ride Fast. Ride VELO. 🏍️🇬🇭

## Run & Operate

- `pnpm --filter @workspace/velo run dev` — run the Expo dev server
- Scan the QR code in the terminal with Expo Go to preview on device
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: Expo (React Native) + Expo Router (file-based routing)
- State: React Context + AsyncStorage (no backend in v1)
- Icons: @expo/vector-icons (Ionicons, MaterialIcons)
- Graphics: react-native-svg (abstract map, route visualization)
- Fonts: Inter (400/500/600/700) via @expo-google-fonts/inter

## App Structure

```
artifacts/velo/
├── app/
│   ├── _layout.tsx          # Root Stack + AppProvider
│   ├── index.tsx            # Auth gate / redirect
│   ├── onboarding.tsx       # 3-slide onboarding
│   ├── (auth)/
│   │   ├── login.tsx        # Phone + password login
│   │   └── signup.tsx       # Full name + phone signup
│   └── (tabs)/
│       ├── _layout.tsx      # Custom floating pill tab bar
│       ├── index.tsx        # Home: location, map, services, booking
│       ├── map.tsx          # SVG live map (route / nearby modes)
│       ├── rides.tsx        # Ride history with filters
│       └── profile.tsx      # User profile + settings
├── context/
│   └── AppContext.tsx        # Auth state + ride history (AsyncStorage)
├── constants/
│   └── colors.ts            # VELO dark theme tokens (#09090B bg, #FFD000 primary)
└── assets/images/           # App icon, onboarding hero, bike illustration
```

## Design

- **Theme:** Deep black (#09090B) background, golden yellow (#FFD000) accent
- **Tab bar:** Floating pill-style (active tab expands with label)
- **Maps:** Custom SVG grid map (route + nearby modes)
- **Booking flow:** Confirm → Searching → Driver Found modal

## Product Features

- 3-slide onboarding (Premium Rides, Transparent Pricing, Mobile Money)
- Sign up / Sign in with Ghana phone number
- Home screen: current location, pickup/destination input, abstract map, service selector (Standard/Premium/Group), featured bike card
- Book a Ride: confirm details → searching animation → driver found with call/message
- Map tab: full-screen SVG map with Route and Nearby toggle
- Ride History: filterable list (All / Completed / Cancelled)
- Profile: stats, VELO Wallet, safety features (SOS, location share), settings, logout

## User Preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Pointers

- See the `pnpm-workspace` skill for workspace structure and TypeScript setup
- See the `expo` skill for Expo Router patterns, font loading, and safe area usage
- AsyncStorage keys: `velo_onboarded`, `velo_user`, `velo_rides`
