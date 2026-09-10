This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Architecture: Domain-Driven Design (DDD)

This project follows **Domain-Driven Design (DDD)** principles to organize code by business capabilities and feature domains:

```
src/
├── app/                          # Expo Router routes (thin entry points only)
│   ├── (auth)/                   # Public auth routes (login, signup)
│   ├── (logged)/                 # Protected routes wrapped with AuthGuard
│   │   ├── (tabs)/               # Bottom tab navigation screens
│   │   └── _layout.tsx           # Protected layout with <AuthGuard>
│   └── _layout.tsx               # Root layout & providers
├── domains/                      # Domain-specific modules
│   └── auth/                     # "Auth" business domain
│       ├── components/           # Domain-specific UI components & guards (e.g., AuthGuard)
│       ├── hooks/                # Domain-specific hooks (e.g., useLoginForm, useSignupForm)
│       ├── models/               # Domain entities, DTOs, and value objects (auth.types.ts)
│       ├── screens/              # Domain screen implementations (LoginScreen, SignupScreen)
│       ├── services/             # Domain business logic & data access (auth.service, user.service)
│       └── index.ts              # Public barrel export for the domain
├── shared/                       # Domain-agnostic reusable code
│   ├── components/               # Base UI design system (AppButton, AppTextInput, etc.)
│   ├── constants/                # Global tokens (colors, typography)
│   └── utils/                    # Generic utilities (e.g., cpf.ts)
└── services/                     # Infrastructure clients (firebase.ts, api.ts)
```

### DDD Rules & Boundaries:
- **Routes (`src/app/`) must remain thin**: Never put business logic, form validation, or complex UI trees directly inside `src/app/`. Route files only mount domain screens (e.g. `return <LoginScreen />;`) or define navigators.
- **Encapsulation**: Each domain in `src/domains/<domain>` is self-contained. Any cross-domain access must go through the domain's public entry point (`src/domains/<domain>/index.ts`).
- **Shared vs. Domain**: Components and helpers used across multiple domains without domain-specific business rules belong in `src/shared/`. Business-specific logic strictly belongs to its respective domain.
- **Route Protection**: Protected areas (e.g. `(logged)`) must be shielded by an `AuthGuard` domain component that checks session state and redirects unauthenticated users to `/login`.

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
