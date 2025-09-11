# Strun Mobile App Setup Guide

## 📱 Quick Setup

### 1. Transfer Project to GitHub
1. Click "Export to GitHub" button in Lovable
2. Clone your repository locally:
```bash
git clone YOUR_REPO_URL
cd strun-app
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Add Mobile Platforms
```bash
# For Android
npx cap add android

# For iOS (Mac only)
npx cap add ios

# Update platforms
npx cap update
```

### 4. Build & Sync
```bash
# Build the web app
npm run build

# Sync with native platforms
npx cap sync
```

### 5. Run on Device/Emulator

**Android:**
```bash
npx cap run android
```
Requirements:
- Android Studio installed
- Android SDK configured
- Emulator or physical device with USB debugging

**iOS (Mac only):**
```bash
npx cap run ios
```
Requirements:
- Xcode installed
- iOS Simulator or physical device
- Apple Developer account (for device testing)

## 🔐 zkLogin Setup

### 1. Get Google OAuth Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to Credentials → Create Credentials → OAuth client ID
5. Choose "Web application"
6. Add authorized redirect URIs:
   - `http://localhost:5173` (development)
   - `https://YOUR_DOMAIN.com` (production)
   - Your Lovable preview URL
7. Copy the Client ID

### 2. Update Environment Variables

Edit `.env` file:
```env
VITE_GOOGLE_CLIENT_ID="YOUR_ACTUAL_CLIENT_ID"
```

## 🗺️ OpenStreetMap Configuration

The app uses OpenStreetMap which doesn't require an API key. GPS permissions are handled automatically.

## ⛓️ Sui Blockchain Deployment

### 1. Install Sui CLI
```bash
# macOS/Linux
curl --proto '=https' --tlsv1.2 -sSf https://sh.sui.io/install | sh

# Windows - download from GitHub releases
```

### 2. Create Wallet & Get Test SUI
```bash
# Create new address
sui client new-address ed25519

# Get your address
sui client active-address

# Request test SUI (replace YOUR_ADDRESS)
curl --location --request POST 'https://faucet.testnet.sui.io/gas' \
--header 'Content-Type: application/json' \
--data-raw '{
    "FixedAmountRequest": {
        "recipient": "YOUR_ADDRESS"
    }
}'
```

### 3. Deploy Smart Contract
```bash
# Create Sui project
sui move new strun
cd strun

# Copy contract file
cp ../src/contracts/strun.move sources/

# Build
sui move build

# Deploy (save the Package ID!)
sui client publish --gas-budget 100000000
```

### 4. Update Frontend Config

Edit `src/lib/sui-config.ts`:
```typescript
export const PACKAGE_ID = '0x...YOUR_PACKAGE_ID';
```

Also update the `GAME_STATE_ID` in `src/lib/sui-transactions.ts` after deployment.

## 📲 APK Generation

### For Android APK:

1. Build release version:
```bash
npm run build
npx cap sync android
```

2. Open in Android Studio:
```bash
npx cap open android
```

3. In Android Studio:
   - Build → Generate Signed Bundle/APK
   - Choose APK
   - Create or use existing keystore
   - Select release build type
   - APK will be in `android/app/release/`

### For iOS IPA:

1. Build and sync:
```bash
npm run build
npx cap sync ios
```

2. Open in Xcode:
```bash
npx cap open ios
```

3. In Xcode:
   - Select Generic iOS Device
   - Product → Archive
   - Distribute App → Ad Hoc or App Store
   - Requires Apple Developer account

## 🌍 Live Deployment

For web deployment:
1. Use the "Publish" button in Lovable
2. Or deploy to your own hosting:
```bash
npm run build
# Upload dist/ folder to your hosting
```

## 🐛 Troubleshooting

**GPS not working:**
- Ensure location permissions are granted
- For Android: Check app permissions in settings
- For iOS: Check Settings → Privacy → Location Services

**zkLogin issues:**
- Verify Google Client ID is correct
- Check redirect URIs match your domain
- Ensure cookies are enabled

**Sui connection failed:**
- Check you have test SUI in wallet
- Verify Package ID is correct
- Ensure you're on testnet

**Build errors:**
- Clear cache: `rm -rf node_modules && npm install`
- Update Capacitor: `npm update @capacitor/core @capacitor/cli`
- Sync again: `npx cap sync`

## 📚 Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Sui Documentation](https://docs.sui.io/)
- [zkLogin Guide](https://docs.sui.io/concepts/cryptography/zklogin)
- [OpenStreetMap Usage](https://www.openstreetmap.org/about)

## 🤝 Support

For issues:
1. Check the [Lovable Discord](https://discord.gg/lovable)
2. Open issue on GitHub repository
3. Contact through Lovable support

## 🚀 Ready to Run!

Your Strun app is now ready for:
- ✅ Mobile deployment (Android/iOS)
- ✅ zkLogin authentication
- ✅ Real GPS tracking with OpenStreetMap
- ✅ NFT territory claiming on Sui blockchain
- ✅ Web and mobile compatibility

Start running and claim your territories! 🏃‍♂️🗺️