# StRun Mobile App Build Instructions

## APK Build Process

To build the StRun mobile app as an APK:

### Prerequisites
1. Transfer project to GitHub via "Export to Github" button
2. Clone the repository to your local machine
3. Install Android Studio
4. Install Node.js and npm

### Build Steps

1. **Install dependencies:**
```bash
npm install
```

2. **Build the web app:**
```bash
npm run build
```

3. **Add Android platform:**
```bash
npx cap add android
```

4. **Sync the project:**
```bash
npx cap sync android
```

5. **Open in Android Studio:**
```bash
npx cap open android
```

6. **Generate APK in Android Studio:**
   - Go to Build → Build Bundle(s) / APK(s) → Build APK(s)
   - Wait for the build to complete
   - Find the APK in `android/app/build/outputs/apk/debug/app-debug.apk`

### Direct Installation (Debug APK)

For testing purposes, you can:
1. Enable "Install from Unknown Sources" on your Android device
2. Transfer the APK to your phone
3. Install directly

### Production Release

For Google Play Store release:
1. Generate a signed APK/AAB
2. Create keystore file
3. Follow Google Play Console upload process

## Live Preview URL

The app is currently configured to load from:
```
https://8e42f826-5e18-40c4-bf99-45b222b02529.lovableproject.com
```

This allows hot-reload development while testing on mobile devices.

## Important Notes

- The app requires location permissions for GPS tracking
- Google OAuth is configured with Client ID: `1089761021386-43lch5ha2bt1cqamdujbggdkh65jjvas.apps.googleusercontent.com`
- Ensure all redirect URIs are properly configured in Google Cloud Console