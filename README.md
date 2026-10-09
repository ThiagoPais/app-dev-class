# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

CPF login and forum writes require the Firebase backend. See [backend setup](functions/README.md) for configuration, deployment, and emulator tests.

1. Install dependencies

   ```bash
   bun install --frozen-lockfile
   ```

2. Start the app

   ```bash
   bunx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Build an Android APK

Use Bun 1.4.0 for this app. Every EAS build profile inherits that version from
`build.base` in `eas.json`. Older Bun versions, including the build image's default
1.3.14, cannot read this project's version 2 `bun.lock` and fail during dependency
installation with `Unknown lockfile version`. Keep `bun.lock` as the app's only
lockfile. The Firebase backend in `functions/` uses its own npm lockfile.

Log in to the Expo account that owns the project:

```bash
bunx eas-cli login
```

Copy `.env.example` to `.env` and fill in the Firebase client settings. For the
first build, upload those settings to the EAS preview environment:

```bash
bunx eas-cli env:push preview --path .env
```

The local `.env` is excluded from build uploads. EAS needs these settings to
include the Firebase configuration in the installed app. Push them again if the
Firebase configuration changes.

Build the APK:

```bash
bun run build:apk
# Equivalent: bunx eas-cli build --platform android --profile preview
```

Download the `.apk` from the build page and open it on your Android device to
install it. The `preview` profile creates a release APK with the JavaScript bundle
included, so it can launch without a Metro server. The `production` profile builds
an AAB for Google Play. See [Expo's APK guide](https://docs.expo.dev/build-reference/apk/).

Before building, check the project:

```bash
bunx expo lint
bunx tsc --noEmit
bunx expo-doctor
```

## Get a fresh project

When you're ready, run:

```bash
bun run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `bunx expo lint`, or follow the guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
