# Android Google Sign-In Setup

This guide explains how to configure Google Sign-In for the Android native app.

## Prerequisites

1. Your app must be added to Firebase/Google Cloud Console
2. SHA-1 fingerprint must be registered for your signing key
3. Web Client ID: `52777395492-vnlk2hkr3pv15dtpgp2m51p7418vll90.apps.googleusercontent.com`

## MainActivity.java Configuration

After running `npx cap add android`, the @capgo/capacitor-social-login plugin auto-registers. No manual plugin registration is needed in MainActivity.

### Location
`android/app/src/main/java/nota/npd/com/MainActivity.java`

### Required Code

```java
package nota.npd.com;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }
}
```

**Note:** The @capgo/capacitor-social-login plugin automatically registers itself. If you encounter issues, ensure you have run `npx cap sync android` after installation.

## strings.xml Configuration

Add the server client ID to your Android strings resources.

### Location
`android/app/src/main/res/values/strings.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Npd</string>
    <string name="title_activity_main">Npd</string>
    <string name="package_name">nota.npd.com</string>
    <string name="custom_url_scheme">nota.npd.com</string>
    <string name="server_client_id">52777395492-vnlk2hkr3pv15dtpgp2m51p7418vll90.apps.googleusercontent.com</string>
</resources>
```

## Build Steps

1. Export your project to GitHub
2. Clone the repository locally
3. Run `npm install`
4. Run `npx cap add android` (if not already added)
5. Open `android/app/src/main/java/nota/npd/com/MainActivity.java` and add the code above
6. Update `android/app/src/main/res/values/strings.xml` with the server_client_id
7. Run `npx cap sync android`
8. Run `npx cap run android` or open in Android Studio

## Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. Go to APIs & Services → Credentials
4. Create an OAuth 2.0 Client ID for Android:
   - Application type: Android
   - Package name: `nota.npd.com`
   - SHA-1 certificate fingerprint: Get this from your keystore using:
     ```bash
     keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
     ```
5. Enable the following APIs:
   - Google Drive API
   - Google People API (optional)

## Scopes

The app requests the following OAuth scopes:
- `profile` - User's basic profile info
- `email` - User's email address
- `https://www.googleapis.com/auth/drive.appdata` - App-specific folder in Google Drive

## Troubleshooting

### Error 10 (Developer Error)
- SHA-1 fingerprint doesn't match what's registered in Google Cloud Console
- Make sure you're using the correct keystore (debug vs release)

### Sign-in cancelled
- User cancelled the sign-in flow (normal behavior)

### No access token
- Check that `forceCodeForRefreshToken: true` is set in capacitor.config.ts
- Verify the Web Client ID is correct
