# App Store Deployment Guide for Arcyn Find

This guide explains how to deploy your Next.js PWA to Google Play Store and Apple App Store.

## Prerequisites

- Your app is already deployed as a PWA (Progressive Web App)
- You have developer accounts:
  - [Google Play Console](https://play.google.com/console) ($25 one-time fee)
  - [Apple App Store Connect](https://appstoreconnect.apple.com) ($99/year)

## Option 1: Google Play Store (TWA - Trusted Web Activity)

### Using Bubblewrap (Recommended)

1. **Install Bubblewrap CLI:**
   ```bash
   npm install -g @bubblewrap/cli
   ```

2. **Initialize TWA:**
   ```bash
   bubblewrap init --manifest https://your-domain.com/manifest.json
   ```

3. **Build the Android App:**
   ```bash
   bubblewrap build
   ```

4. **Generate Signed APK/AAB:**
   ```bash
   bubblewrap update
   cd android
   ./gradlew bundleRelease  # For AAB (recommended for Play Store)
   # or
   ./gradlew assembleRelease  # For APK
   ```

5. **Upload to Play Console:**
   - Go to [Google Play Console](https://play.google.com/console)
   - Create a new app
   - Upload the AAB file from `android/app/build/outputs/bundle/release/`
   - Fill in store listing, screenshots, etc.
   - Submit for review

### Using PWABuilder (Alternative)

1. Visit [PWABuilder](https://www.pwabuilder.com/)
2. Enter your app URL: `https://arcyn-find.vercel.app`
3. Click "Start" and follow the prompts
4. Download the Android package
5. Follow the instructions to build and submit

## Option 2: Apple App Store

### Using Capacitor (Recommended)

1. **Install Capacitor:**
   ```bash
   npm install @capacitor/core @capacitor/cli @capacitor/ios
   ```

2. **Initialize Capacitor:**
   ```bash
   npx cap init "Arcyn Find" "com.arcyn.find"
   ```

3. **Add iOS platform:**
   ```bash
   npx cap add ios
   ```

4. **Build your Next.js app:**
   ```bash
   npm run build
   ```

5. **Sync web assets:**
   ```bash
   npx cap sync ios
   ```

6. **Open in Xcode:**
   ```bash
   npx cap open ios
   ```

7. **In Xcode:**
   - Configure signing & capabilities
   - Set bundle identifier
   - Build and archive
   - Upload to App Store Connect via Xcode or Transporter

### Using PWABuilder (Alternative)

1. Visit [PWABuilder](https://www.pwabuilder.com/)
2. Enter your app URL: `https://arcyn-find.vercel.app`
3. Click "Start" and follow the prompts
4. Download the iOS package
5. Open in Xcode and follow the submission process

## Option 3: Both Stores with Capacitor

1. **Install Capacitor:**
   ```bash
   npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
   ```

2. **Initialize:**
   ```bash
   npx cap init "Arcyn Find" "com.arcyn.find"
   ```

3. **Add platforms:**
   ```bash
   npx cap add ios
   npx cap add android
   ```

4. **Build and sync:**
   ```bash
   npm run build
   npx cap sync
   ```

5. **Build for each platform:**
   - **Android:** `npx cap open android` → Build in Android Studio
   - **iOS:** `npx cap open ios` → Build in Xcode

## Required Assets

### For Google Play Store:
- App icon: 512x512px (PNG)
- Feature graphic: 1024x500px (PNG)
- Screenshots: At least 2, up to 8
  - Phone: 16:9 or 9:16, min 320px, max 3840px
  - Tablet: 16:9 or 9:16, min 320px, max 3840px

### For Apple App Store:
- App icon: 1024x1024px (PNG, no transparency)
- Screenshots: Required for each device size
  - iPhone 6.7": 1290x2796px
  - iPhone 6.5": 1242x2688px
  - iPhone 5.5": 1242x2208px
  - iPad Pro 12.9": 2048x2732px
  - iPad Pro 11": 1668x2388px

## Store Listing Information

### App Name
- **Google Play:** Arcyn Find - Discover AI Tools
- **Apple App Store:** Arcyn Find

### Short Description
Discover and explore AI tools, models, and platforms worldwide. Search, filter, and find the perfect AI solution for your needs.

### Full Description
Arcyn Find is your comprehensive directory for discovering AI tools, models, and platforms from around the world. Whether you're looking for code assistants, video editing tools, image generators, or language models, Arcyn Find helps you find exactly what you need.

**Features:**
- 🔍 Advanced search with natural language queries
- 🏷️ Filter by category, region, and access type
- 📊 Browse trending AI tools
- 📱 Works offline with PWA support
- 🌍 Discover tools from different regions
- ⭐ See popularity and ratings

### Keywords
AI tools, machine learning, artificial intelligence, AI search, AI discovery, AI models, ML tools, deep learning, neural networks, AI platforms

### Category
- **Google Play:** Productivity / Utilities
- **Apple App Store:** Productivity / Utilities

### Privacy Policy
Make sure to have a complete Privacy Policy at `/privacy` before submitting.

### Support URL
Your website URL or support email

## Testing Before Submission

1. **Test PWA functionality:**
   - Install on device
   - Test offline mode
   - Test all features
   - Check performance

2. **Test on different devices:**
   - Android: Various screen sizes
   - iOS: iPhone and iPad

3. **Check compliance:**
   - Privacy policy is accessible
   - Terms of service are accessible
   - All links work
   - No broken functionality

## Submission Checklist

### Google Play Store
- [ ] Developer account created
- [ ] App signed with release key
- [ ] Store listing completed
- [ ] Screenshots uploaded
- [ ] Privacy policy URL added
- [ ] Content rating completed
- [ ] App tested on multiple devices
- [ ] APK/AAB uploaded

### Apple App Store
- [ ] Developer account created
- [ ] App ID and certificates configured
- [ ] Store listing completed
- [ ] Screenshots for all required sizes
- [ ] Privacy policy URL added
- [ ] App tested on iOS devices
- [ ] App archived and uploaded

## Post-Submission

1. **Monitor reviews:**
   - Respond to user feedback
   - Fix reported bugs
   - Update app regularly

2. **Update your app:**
   - Make changes to your Next.js app
   - Rebuild and resubmit
   - Update version numbers

3. **Analytics:**
   - Set up analytics to track usage
   - Monitor crash reports
   - Track user engagement

## Resources

- [Google Play Console Help](https://support.google.com/googleplay/android-developer)
- [Apple App Store Connect Help](https://help.apple.com/app-store-connect/)
- [PWABuilder Documentation](https://docs.pwabuilder.com/)
- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Bubblewrap Documentation](https://github.com/GoogleChromeLabs/bubblewrap)

## Notes

- The PWA is already configured with a manifest and service worker
- Your app icons are in `/public/android-chrome-*.png` and `/public/apple-touch-icon.png`
- The manifest is available at `/manifest.json` and `/manifest.webmanifest`
- Service worker is registered automatically in the layout

Good luck with your app store submission! 🚀

