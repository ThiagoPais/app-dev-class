# Firebase backend

CPF login and forum counters use callable functions in `us-central1`. The app calls these functions through the existing Firebase JavaScript SDK. No native dependency is needed.

`signInWithCpf` reads the CPF mapping on the server, verifies the password with Firebase Auth, and returns a custom token. Invalid credentials and unknown CPFs return the same error. User profiles stay private.

`createForumMessage`, `deleteForumMessage`, and `castForumVote` update messages, votes, and counters in transactions. Direct client writes to counters and votes are denied. Reply deletion is idempotent, including concurrent retries. Deleted replies and replies inside deleted topics are unreadable.

## Deploy

Install the backend's Node.js dependencies with `npm ci --prefix functions`. Install the app's dependencies with `bun install`.

Set `AUTH_WEB_API_KEY` in `functions/.env.app-dev-class-c3f1e` to the web API key used by the app. Set `FIRESTORE_DATABASE_ID=app-db`, matching `firebase.json` and the app's `FIRESTORE_DB_NAME`. Firebase also prompts for missing parameter values during deployment. Do not commit environment files.

The runtime service account must have permission to sign custom tokens. Enable the IAM Service Account Credentials API and grant that account the Service Account Token Creator role, as described in [Firebase's custom-token setup](https://firebase.google.com/docs/auth/admin/create-custom-tokens#letting_the_admin_sdk_discover_a_service_account).

Deploy the functions and indexes first:

```bash
bunx firebase-tools deploy --only functions,firestore:indexes
```

Then ship the app service changes and deploy the rules:

```bash
bunx firebase-tools deploy --only firestore:rules
```

These service changes and rules must ship together. Older clients write counters directly and will be denied by the new rules. Existing documents and vote formats are unchanged; no data migration is required.

## Test

Install the app and backend dependencies, then run the regression suite against Auth and Firestore emulators. Use Node.js 22 and the Java version required by your Firebase CLI.

```bash
FIRESTORE_DATABASE_ID=app-db AUTH_WEB_API_KEY=demo-key \
  bunx firebase-tools emulators:exec --only firestore,auth \
  --project demo-app-dev-class-review 'npm test --prefix functions && bun run test:forum:emulator'
```

The tests cover CPF login with a real emulated password check and custom-token session, private profiles, counter tampering, vote toggles, ownership, locked and deleted topics, and concurrent reply deletion. They refuse to run without emulator addresses and a `demo-` project.

The forum pagination tests read through multiple pages of topics and replies, including tied timestamps and deleted documents. They also search older topics by title, content, or city. Search scans cursor pages until it finds matches or reaches the end. Sparse searches read more documents; canceled searches stop before requesting another page.

Run the React component and hook tests without emulators:

```bash
bun run test:forum
```

These tests cover switching between replies with identical text, native Google button visibility, pagination retries, and stale requests after refresh or a search change.

Run the app checks from the repository root:

```bash
bunx expo lint
bunx tsc --noEmit
```
