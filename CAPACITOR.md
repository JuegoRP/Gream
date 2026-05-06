# Building Gream for iOS and Android with Capacitor

This guide assumes you've already:
- Apple Developer Account ($99/year) → developer.apple.com
- Google Play Developer Account ($25 one-time) → play.google.com/console
- Xcode installed (for iOS) → from Mac App Store
- Android Studio installed (for Android) → developer.android.com/studio

## One-time setup

```bash
# Install Capacitor
npm install -g @capacitor/cli @capacitor/core
npm init -y                  # creates package.json
npm install @capacitor/core @capacitor/ios @capacitor/android
npm install @capacitor/geolocation @capacitor/camera @capacitor/filesystem @capacitor/preferences

# Initialize Capacitor in this folder (capacitor.config.json already exists)
npx cap init "Gream" "com.gream.app"

# Add iOS and Android platforms
npx cap add ios
npx cap add android
```

## Each time you change code

```bash
# Sync web changes to native projects
npx cap sync

# Open in Xcode (for iOS build/release)
npx cap open ios

# Open in Android Studio (for Android build/release)
npx cap open android
```

## iOS App Store release

In Xcode:
1. Set bundle identifier to `com.gream.app`
2. Select team (your Apple Developer Account)
3. Product → Archive
4. Distribute App → App Store Connect
5. Upload, then in App Store Connect:
   - Add screenshots (6.7", 6.5", 5.5", iPad)
   - Description (CS + EN)
   - Privacy questionnaire (NO data collection, NO ads, NO tracking)
   - Age rating: 4+
   - Submit for review (usually 24-48 hours)

## Google Play release

In Android Studio:
1. Build → Generate Signed Bundle (AAB)
2. Create signing key (KEEP THE KEYSTORE FILE SAFE!)
3. Build release AAB
4. Upload to Google Play Console:
   - Add screenshots (phone, tablet)
   - Description (CS + EN)
   - Content rating questionnaire
   - Age 5+ rating
   - Data safety form (NO collection, NO sharing)
   - Submit for review (usually 24-72 hours)

## Required Privacy Policy URL

You'll need a public URL for Privacy Policy (Apple + Google require it).
Quickest: GitHub Pages with the policy text from in-app settings.

```
1. Create repo: gream-legal
2. Add privacy.html and terms.html
3. Settings → Pages → Deploy from main
4. Use https://yourname.github.io/gream-legal/privacy.html
```

## What WILL break in native that doesn't on web

- `localStorage` works but is ephemeral on iOS — use `@capacitor/preferences` plugin
- Camera in native is via Capacitor plugin, not getUserMedia
- Geolocation needs explicit `Info.plist` and `AndroidManifest.xml` keys
- Service Worker doesn't work in Capacitor — use native cache instead
- File:// URLs in native are different scheme

These are all addressed by adding Capacitor plugins later.

## TestFlight and Internal Testing

For beta testing with kids before launch:
- iOS: TestFlight (up to 100 testers, free)
- Android: Internal Testing track (up to 100 testers, immediate)
