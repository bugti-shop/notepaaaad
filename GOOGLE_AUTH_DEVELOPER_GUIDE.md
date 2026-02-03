# Google Authentication Developer Guide

**Package Name:** `nota.npd.com`

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
| `MainActivity.java` | `android/app/.../` | **CRITICAL** - Handles Google sign-in result |

---

## ⚠️ CRITICAL: Android Native Sign-In Not Working

If sign-in shows the account picker but nothing happens after selecting an account, follow this troubleshooting guide:

### Most Common Issue: SHA-1 Mismatch

You need MULTIPLE SHA-1 fingerprints in Google Cloud Console:

| Build Type | When Used | How to Get |
|------------|-----------|------------|
| Debug SHA-1 | Running from Android Studio | `./gradlew signingReport` |
| Release SHA-1 | Signed APK/AAB | `keytool -printcert -jarfile app-release.apk` |
| Play Store SHA-1 | Apps from Google Play | Google Play Console → App Signing |

### Get SHA-1 from Your Release APK

```bash
# From signed APK
keytool -printcert -jarfile app-release.apk

# From keystore directly
keytool -list -v -keystore /path/to/your-release.keystore -alias your-alias
```

### Required Google Cloud Console Setup

You need **2 OAuth Client IDs**:

1. **Web Client** (Type: Web application)
   - Client ID: `52777395492-vnlk2hkr3pv15dtpgp2m51p7418vll90.apps.googleusercontent.com`
   - This goes in: `capacitor.config.ts`, `strings.xml`, `GoogleAuthContext.tsx`

2. **Android Client** (Type: Android)
   - Package name: `nota.npd.com`
   - SHA-1: Your **RELEASE** keystore SHA-1
   - Create separate clients for debug and release SHA-1s

### MainActivity.java Must Be Modified

```java
package nota.npd.com;

import android.content.Intent;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;
import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {
    
    private static final String TAG = "MainActivity";
    
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        Log.d(TAG, "onActivityResult: requestCode=" + requestCode + ", resultCode=" + resultCode);
        
        // CRITICAL: Handle Google Sign-In result BEFORE calling super
        if (requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN && 
            requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) {
            Log.d(TAG, "Handling Google Sign-In result");
            PluginHandle pluginHandle = getBridge().getPlugin("SocialLogin");
            if (pluginHandle != null) {
                SocialLoginPlugin plugin = (SocialLoginPlugin) pluginHandle.getInstance();
                if (plugin != null) {
                    plugin.handleGoogleLoginIntent(requestCode, data);
                }
            }
        }
        
        super.onActivityResult(requestCode, resultCode, data);
    }
    
    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {}
}
```

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
```

---

## 🔑 Google Cloud Console Setup

### Step 1: Create OAuth 2.0 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Click **Create Credentials** → **OAuth 2.0 Client IDs**

### Step 2: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** user type
3. Fill in required fields
4. Add scopes:
   ```
   email
   profile
   openid
   https://www.googleapis.com/auth/drive.appdata
   ```
5. **Testing mode**: Add your test email addresses
6. **Publishing**: For production, submit for verification

### Step 3: Create Web Client ID

- **Application type:** Web application
- **Name:** `Npd Web Client`
- Copy the Client ID

### Step 4: Create Android Client ID

- **Application type:** Android
- **Name:** `Npd Android Release`
- **Package name:** `nota.npd.com`
- **SHA-1:** From your RELEASE keystore

⚠️ Create SEPARATE Android clients for each SHA-1 (debug, release, Play Store)

### Step 5: Enable Required APIs

- ✅ Google People API
- ✅ Google Drive API

---

## ⚙️ Configuration Files

### capacitor.config.ts
```typescript
plugins: {
  SocialLogin: {
    google: {
      webClientId: '52777395492-vnlk2hkr3pv15dtpgp2m51p7418vll90.apps.googleusercontent.com',
    },
  },
},
```

### android/app/src/main/res/values/strings.xml
```xml
<string name="server_client_id">52777395492-vnlk2hkr3pv15dtpgp2m51p7418vll90.apps.googleusercontent.com</string>
```

### GoogleAuthContext.tsx
```typescript
const GOOGLE_WEB_CLIENT_ID = '52777395492-vnlk2hkr3pv15dtpgp2m51p7418vll90.apps.googleusercontent.com';
```

**All three must use the SAME Web Client ID!**

---

## 🐛 Error Codes and Solutions

### Error 10: "Developer console is not set up correctly"

**Cause:** SHA-1 mismatch

**Solution:**
1. Get SHA-1 from your actual signed APK:
   ```bash
   keytool -printcert -jarfile app-release.apk
   ```
2. Create Android OAuth client with this SHA-1
3. Package name must be exactly: `nota.npd.com`

### Error 16: "Account reauth failed"

**Solution:**
1. Clear app data on device
2. Remove app from https://myaccount.google.com/permissions
3. Try again

### Sign-in completes but nothing happens

**Solution:**
1. Verify MainActivity implements `ModifiedMainActivityForSocialLoginPlugin`
2. Ensure `onActivityResult` forwards to `handleGoogleLoginIntent`
3. Rebuild: `npx cap sync android`

---

## 🔍 Debugging with Logcat

Check Android logs after attempting sign-in:

```bash
adb logcat | grep -E "(GoogleAuth|MainActivity|SocialLogin)"
```

Look for these messages:
```
[GoogleAuth] signIn called, platform: android
[GoogleAuth] Using native sign-in
[GoogleAuth] Starting native sign-in...
[GoogleAuth] Login response received: {...}
[GoogleAuth] Sign-in successful for: user@email.com
```

If you see ERROR 10 message, your SHA-1 is wrong.

---

## ✅ Debugging Checklist

- [ ] Web Client ID is the same in all 3 places
- [ ] Android OAuth client exists with correct package name (`nota.npd.com`)
- [ ] Android OAuth client has SHA-1 from your **release** keystore
- [ ] If using Play App Signing, also add Play Store's SHA-1
- [ ] MainActivity implements `ModifiedMainActivityForSocialLoginPlugin`
- [ ] MainActivity's `onActivityResult` forwards to `handleGoogleLoginIntent`
- [ ] Test email is added to OAuth consent screen test users
- [ ] Required APIs are enabled (People API, Drive API)
- [ ] App rebuilt after changes: `npx cap sync android`

---

## 💾 Data Storage

### localStorage Keys
| Key | Content |
|-----|---------|
| `google_user` | Serialized GoogleUser object with profile and tokens |

### GoogleUser Object Structure
```typescript
interface GoogleUser {
  id: string;
  email: string;
  name: string;
  givenName?: string;
  familyName?: string;
  imageUrl?: string;
  authentication: {
    accessToken: string;
    refreshToken?: string;
    idToken?: string;
  };
}
```

---

## 🛠️ Using the Auth Hook

```typescript
import { useGoogleAuth } from '@/contexts/GoogleAuthContext';

function MyComponent() {
  const { 
    user,
    isLoading,
    isSignedIn,
    signIn,
    signOut,
    refreshToken
  } = useGoogleAuth();

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

## 📚 Dependencies

```json
{
  "@capgo/capacitor-social-login": "^8.2.17",
  "@capacitor/core": "^8.0.1"
}
```

---

## 🔗 Related Documentation

- [Capgo Social Login Issues](https://github.com/Cap-go/capacitor-social-login/issues/199)
- [Google Identity Services](https://developers.google.com/identity/gsi/web)
- [Google Drive API](https://developers.google.com/drive/api/v3/about-sdk)
