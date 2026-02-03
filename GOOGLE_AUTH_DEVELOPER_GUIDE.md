# Google Authentication Developer Guide

This document provides a comprehensive guide for understanding and setting up Google Authentication in the Npd app.

---

## 📁 File Structure & Roles

| File | Location | Purpose |
|------|----------|---------|
| `GoogleAuthContext.tsx` | `src/contexts/` | **CORE** - Main authentication logic, React Context, hooks |
| `SmartSyncProvider.tsx` | `src/components/` | Auto-sync manager that triggers Google Drive sync on auth changes |
| `googleDriveSync.ts` | `src/utils/` | Google Drive API operations for data sync |
| `Profile.tsx` | `src/pages/` | UI component with Sign In/Sign Out buttons |
| `App.tsx` | `src/` | Wraps app with `<GoogleAuthProvider>` |
| `capacitor.config.ts` | Root | Native plugin configuration with `webClientId` |

---

## 🔄 Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER CLICKS SIGN IN                       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Check Platform Type  │
                    └───────────────────────┘
                                │
            ┌───────────────────┴───────────────────┐
            ▼                                       ▼
    ┌───────────────┐                       ┌───────────────┐
    │   Web (PWA)   │                       │ Native (iOS/  │
    │               │                       │   Android)    │
    └───────────────┘                       └───────────────┘
            │                                       │
            ▼                                       ▼
    ┌───────────────┐                       ┌───────────────┐
    │ Google Identity│                      │ Capgo Social  │
    │ Services OAuth │                      │ Login Plugin  │
    └───────────────┘                       └───────────────┘
            │                                       │
            └───────────────────┬───────────────────┘
                                ▼
                    ┌───────────────────────┐
                    │  Receive OAuth Token  │
                    │  + User Profile Info  │
                    └───────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ Store in localStorage │
                    │ Update React Context  │
                    └───────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ Dispatch 'googleAuth  │
                    │ Changed' Event        │
                    └───────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ SmartSyncProvider     │
                    │ Triggers Google Drive │
                    │ Sync Automatically    │
                    └───────────────────────┘
```

---

## 🔑 Google Cloud Console Setup

### Step 1: Create OAuth 2.0 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client IDs**

### Step 2: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** user type
3. Fill in required fields:
   - App name: `Npd`
   - User support email: Your email
   - Developer contact: Your email
4. Add scopes:
   ```
   .../auth/userinfo.email
   .../auth/userinfo.profile
   openid
   https://www.googleapis.com/auth/drive.appdata
   ```

### Step 3: Create Web Client ID

1. **Application type:** Web application
2. **Name:** `Npd Web Client`
3. **Authorized JavaScript origins:**
   ```
   https://your-domain.lovable.app
   https://your-preview-url.lovableproject.com
   http://localhost:5173 (for local development)
   ```
4. **Authorized redirect URIs:**
   ```
   https://your-domain.lovable.app
   https://your-preview-url.lovableproject.com
   ```

### Step 4: Create Android Client ID (for Native App)

1. **Application type:** Android
2. **Name:** `Npd Android Client`
3. **Package name:** `app.lovable.50841fa6da0045ee9595ec5e1a9cdd28`
4. **SHA-1 certificate fingerprint:** 
   - For debug: Run `./gradlew signingReport` in Android project
   - For release: Use your release keystore

### Step 5: Create iOS Client ID (for Native App)

1. **Application type:** iOS
2. **Name:** `Npd iOS Client`
3. **Bundle ID:** `app.lovable.50841fa6da0045ee9595ec5e1a9cdd28`

---

## ⚙️ Configuration Files

### capacitor.config.ts
```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.50841fa6da0045ee9595ec5e1a9cdd28',
  appName: 'Npd',
  webDir: 'dist',
  plugins: {
    SocialLogin: {
      google: {
        // This is the WEB Client ID (not Android/iOS)
        webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
      },
    },
  },
};

export default config;
```

### GoogleAuthContext.tsx - Key Constants
```typescript
// Web Client ID - same as in capacitor.config.ts
const GOOGLE_WEB_CLIENT_ID = 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com';

// OAuth Scopes requested
const SCOPES = [
  'profile',                                    // Basic profile info
  'email',                                      // Email address
  'https://www.googleapis.com/auth/drive.appdata'  // App-specific Drive folder
];
```

---

## 📱 Platform-Specific Setup

### Web Platform

1. Add Google Identity Services script to `index.html`:
```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

2. The `signInWeb()` function uses Google Identity Services OAuth2 popup flow

### Android Platform

1. **Install dependencies:**
```bash
npm install @capgo/capacitor-social-login
npx cap sync android
```

2. **Update `android/app/build.gradle`:**
```gradle
dependencies {
    implementation 'com.google.android.gms:play-services-auth:20.7.0'
}
```

3. **Update `android/app/src/main/res/values/strings.xml`:**
```xml
<resources>
    <string name="server_client_id">YOUR_WEB_CLIENT_ID.apps.googleusercontent.com</string>
</resources>
```

4. **Configure SHA-1 fingerprint** in Google Cloud Console (see Step 4 above)

### iOS Platform

1. **Install dependencies:**
```bash
npm install @capgo/capacitor-social-login
npx cap sync ios
```

2. **Update `ios/App/App/Info.plist`:**
```xml
<key>GIDClientID</key>
<string>YOUR_IOS_CLIENT_ID.apps.googleusercontent.com</string>
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>com.googleusercontent.apps.YOUR_IOS_CLIENT_ID</string>
        </array>
    </dict>
</array>
```

---

## 🔌 API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `https://accounts.google.com/gsi/client` | Google Identity Services SDK |
| `https://www.googleapis.com/oauth2/v3/userinfo` | Fetch user profile info |
| `https://www.googleapis.com/drive/v3/files` | Google Drive API for sync |

---

## 💾 Data Storage

### localStorage Keys
| Key | Content |
|-----|---------|
| `google_user` | Serialized GoogleUser object with profile and tokens |

### GoogleUser Object Structure
```typescript
interface GoogleUser {
  id: string;              // Google user ID
  email: string;           // User email
  name: string;            // Display name
  givenName?: string;      // First name
  familyName?: string;     // Last name
  imageUrl?: string;       // Profile picture URL
  authentication: {
    accessToken: string;   // OAuth access token
    refreshToken?: string; // OAuth refresh token (native only)
    idToken?: string;      // JWT ID token
  };
}
```

---

## 🔄 Event System

### Custom Events Dispatched

| Event Name | When Fired | Payload |
|------------|------------|---------|
| `googleAuthChanged` | Sign in/out | `{ user: GoogleUser, signedIn: boolean }` |

### Listening to Auth Changes
```typescript
window.addEventListener('googleAuthChanged', (event: CustomEvent) => {
  const { user, signedIn } = event.detail;
  if (signedIn) {
    console.log('User signed in:', user.email);
    // Access token available at: user.authentication.accessToken
  } else {
    console.log('User signed out');
  }
});
```

---

## 🛠️ Using the Auth Hook

```typescript
import { useGoogleAuth } from '@/contexts/GoogleAuthContext';

function MyComponent() {
  const { 
    user,           // GoogleUser | null
    isLoading,      // boolean - true during initial check
    isSignedIn,     // boolean - convenience flag
    signIn,         // () => Promise<void>
    signOut,        // () => Promise<void>
    refreshToken    // () => Promise<string | null>
  } = useGoogleAuth();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {isSignedIn ? (
        <>
          <p>Welcome, {user?.name}</p>
          <button onClick={signOut}>Sign Out</button>
        </>
      ) : (
        <button onClick={signIn}>Sign In with Google</button>
      )}
    </div>
  );
}
```

---

## 🐛 Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "popup_closed_by_user" | User closed OAuth popup | Normal behavior, no action needed |
| "access_denied" | User denied permissions | Check scopes, ensure consent screen is configured |
| "invalid_client" | Wrong Client ID | Verify Client ID matches Google Console |
| Token expired | Access token is 1 hour | Call `refreshToken()` before API calls |
| Native login fails | Missing SHA-1 | Add debug/release SHA-1 to Google Console |

### Debug Logging

The auth context logs important events to console:
```
[GoogleAuth] Initializing...
[GoogleAuth] Checking existing session...
[GoogleAuth] User signed in: user@example.com
[GoogleAuth] Sign out successful
```

### Testing Checklist

- [ ] Web: OAuth popup opens and closes properly
- [ ] Web: User info is fetched after login
- [ ] Web: Token is stored in localStorage
- [ ] Native Android: Login dialog appears
- [ ] Native iOS: Login sheet appears
- [ ] Token refresh works after 1 hour
- [ ] Sign out clears all stored data
- [ ] Google Drive sync triggers after login

---

## 📚 Dependencies

```json
{
  "@capgo/capacitor-social-login": "^8.2.17",
  "@capacitor/core": "^8.0.1"
}
```

---

## 🔗 Related Documentation

- [Google Identity Services](https://developers.google.com/identity/gsi/web)
- [Capgo Social Login Plugin](https://github.com/Cap-go/capacitor-social-login)
- [Google Drive API](https://developers.google.com/drive/api/v3/about-sdk)
- [Capacitor Documentation](https://capacitorjs.com/docs)

---

## 📞 Support

For issues specific to this implementation, check:
1. Browser console for web issues
2. Android Logcat for native Android issues
3. Xcode console for native iOS issues

Filter logs by "GoogleAuth" or "SocialLogin" for relevant entries.
