# SCM Scanner

Bare React Native TypeScript project for the SCM scanner mobile app.

- App name: `ScannerApp`
- Display name: `SCM Scanner`
- Android application ID: `com.retail.scm.scanner`
- iOS bundle identifier: `com.retail.scm.scanner`
- React Native: `0.85.0`
- React: `19.2.3`

## Development

```bash
cd mobile/ScannerApp
npm install
npm run start
```

In another terminal:

```bash
npm run android
```

For iOS, install pods from `ios/` on macOS before running:

```bash
cd ios
bundle exec pod install
cd ..
npm run ios
```
