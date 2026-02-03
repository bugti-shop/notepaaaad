# Android Setup Guide for Npd

**Package Name:** `nota.npd.com`

This guide provides complete Android native code including:
- Full MainActivity.java with Google Sign-In and Widget support
- Complete AndroidManifest.xml with all permissions
- Required string resources

---

## Complete AndroidManifest.xml

**File:** `android/app/src/main/AndroidManifest.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="nota.npd.com">

    <!-- ==================== PERMISSIONS ==================== -->
    
    <!-- Internet & Network -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    
    <!-- Push & Local Notifications -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
    <uses-permission android:name="android.permission.USE_EXACT_ALARM" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    
    <!-- Location (for location-based reminders) -->
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
    
    <!-- Microphone (for voice notes) -->
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    
    <!-- Camera (for scanning/photos) -->
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
    
    <!-- Storage -->
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29" />
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
    <uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />
    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
    
    <!-- Biometric (for app lock) -->
    <uses-permission android:name="android.permission.USE_BIOMETRIC" />
    <uses-permission android:name="android.permission.USE_FINGERPRINT" />

    <!-- ==================== APPLICATION ==================== -->
    
    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme"
        android:usesCleartextTraffic="true"
        android:networkSecurityConfig="@xml/network_security_config">
        
        <!-- ==================== MAIN ACTIVITY ==================== -->
        
        <activity
            android:name=".MainActivity"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
            android:exported="true"
            android:launchMode="singleTask"
            android:theme="@style/AppTheme.NoActionBarLaunch"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="nota.npd.com" />
            </intent-filter>
        </activity>
        
        <!-- ==================== NOTIFICATIONS ==================== -->
        
        <!-- Boot Receiver for rescheduling notifications -->
        <receiver 
            android:name="com.capacitorjs.plugins.localnotifications.LocalNotificationRestoreReceiver"
            android:exported="false">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
            </intent-filter>
        </receiver>
        
        <!-- Firebase Messaging Service (if using push notifications) -->
        <service
            android:name="com.google.firebase.messaging.FirebaseMessagingService"
            android:exported="false">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>
        
        <!-- ==================== LOCATION SERVICE ==================== -->
        
        <service
            android:name="com.transistorsoft.locationmanager.service.LocationService"
            android:foregroundServiceType="location"
            android:exported="false" />
        
        <!-- ==================== WIDGETS ==================== -->
        
        <!-- Notes Widget -->
        <receiver
            android:name=".widgets.SpecificNoteWidget"
            android:exported="true">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
                <action android:name="nota.npd.com.WIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/specific_note_widget_info" />
        </receiver>
        
        <!-- Section Tasks Widget -->
        <receiver
            android:name=".widgets.SectionTasksWidget"
            android:exported="true">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
                <action android:name="nota.npd.com.WIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/section_tasks_widget_info" />
        </receiver>
        
        <!-- Widget Service for Section Tasks ListView -->
        <service
            android:name=".widgets.SectionTasksWidgetService"
            android:permission="android.permission.BIND_REMOTEVIEWS"
            android:exported="false" />
            
    </application>

</manifest>
```

---

## Complete MainActivity.java

**File:** `android/app/src/main/java/nota/npd/com/MainActivity.java`

```java
package nota.npd.com;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;

import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;

import nota.npd.com.widgets.SpecificNoteWidget;
import nota.npd.com.widgets.SectionTasksWidget;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {
    
    private static final String TAG = "MainActivity";
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Log.d(TAG, "onCreate: App started");
        
        // Handle intent if app was opened from widget
        handleWidgetIntent(getIntent());
    }
    
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        Log.d(TAG, "onNewIntent: Received new intent");
        handleWidgetIntent(intent);
    }
    
    /**
     * Handle intents from widgets
     */
    private void handleWidgetIntent(Intent intent) {
        if (intent == null) return;
        
        String action = intent.getStringExtra("action");
        String route = intent.getStringExtra("route");
        String noteId = intent.getStringExtra("noteId");
        String sectionId = intent.getStringExtra("sectionId");
        String taskId = intent.getStringExtra("taskId");
        
        Log.d(TAG, "handleWidgetIntent: action=" + action + ", route=" + route);
        
        // You can use JavaScript bridge to navigate to specific routes
        // This will be handled by Capacitor WebView
        if (action != null || route != null) {
            // Store intent data for WebView to read
            getIntent().putExtras(intent);
        }
    }
    
    /**
     * CRITICAL: Handle Google Sign-In result
     * This ensures the SocialLogin plugin receives the result in release builds
     */
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        Log.d(TAG, "onActivityResult: requestCode=" + requestCode + ", resultCode=" + resultCode);
        
        boolean handled = false;
        
        // Handle Google Sign-In result BEFORE calling super
        if (requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN && 
            requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) {
            Log.d(TAG, "Handling Google Sign-In result");
            
            PluginHandle pluginHandle = getBridge().getPlugin("SocialLogin");
            if (pluginHandle != null) {
                SocialLoginPlugin plugin = (SocialLoginPlugin) pluginHandle.getInstance();
                if (plugin != null) {
                    plugin.handleGoogleLoginIntent(requestCode, data);
                    handled = true;
                    Log.d(TAG, "Google Sign-In result forwarded to plugin");
                } else {
                    Log.e(TAG, "SocialLoginPlugin instance is null");
                }
            } else {
                Log.e(TAG, "SocialLogin plugin handle not found");
            }
        }
        
        // Always call super to ensure Capacitor processes other results
        super.onActivityResult(requestCode, resultCode, data);
        
        if (!handled) {
            Log.d(TAG, "Result not handled by SocialLogin, passed to Capacitor");
        }
    }
    
    /**
     * Required by ModifiedMainActivityForSocialLoginPlugin interface
     * Confirms that MainActivity has been properly modified for Social Login plugin
     */
    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {
        // This method confirms modification for Social Login plugin
    }
    
    /**
     * Refresh all home screen widgets
     * Call this from JavaScript when data changes
     */
    public void refreshWidgets() {
        Log.d(TAG, "Refreshing all widgets");
        
        Intent updateIntent = new Intent("nota.npd.com.WIDGET_UPDATE");
        sendBroadcast(updateIntent);
        
        // Also trigger AppWidgetManager update
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(this);
        
        // Update Notes Widget
        ComponentName noteWidgetProvider = new ComponentName(this, SpecificNoteWidget.class);
        int[] noteWidgetIds = appWidgetManager.getAppWidgetIds(noteWidgetProvider);
        if (noteWidgetIds.length > 0) {
            Intent intent = new Intent(this, SpecificNoteWidget.class);
            intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, noteWidgetIds);
            sendBroadcast(intent);
        }
        
        // Update Section Tasks Widget
        ComponentName sectionWidgetProvider = new ComponentName(this, SectionTasksWidget.class);
        int[] sectionWidgetIds = appWidgetManager.getAppWidgetIds(sectionWidgetProvider);
        if (sectionWidgetIds.length > 0) {
            Intent intent = new Intent(this, SectionTasksWidget.class);
            intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, sectionWidgetIds);
            sendBroadcast(intent);
        }
    }
    
    @Override
    protected void onResume() {
        super.onResume();
        Log.d(TAG, "onResume: App resumed");
    }
    
    @Override
    protected void onPause() {
        super.onPause();
        Log.d(TAG, "onPause: App paused, refreshing widgets");
        // Refresh widgets when app goes to background
        refreshWidgets();
    }
}
```

---

## strings.xml

**File:** `android/app/src/main/res/values/strings.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Npd</string>
    <string name="title_activity_main">Npd</string>
    <string name="package_name">nota.npd.com</string>
    <string name="custom_url_scheme">nota.npd.com</string>
    
    <!-- Google Sign-In -->
    <string name="server_client_id">52777395492-vnlk2hkr3pv15dtpgp2m51p7418vll90.apps.googleusercontent.com</string>
    
    <!-- Widget Descriptions -->
    <string name="widget_note_description">Display any note on your home screen</string>
    <string name="widget_section_description">Show all tasks from a section</string>
</resources>
```

---

## Network Security Config

**File:** `android/app/src/main/res/xml/network_security_config.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">localhost</domain>
        <domain includeSubdomains="true">10.0.2.2</domain>
    </domain-config>
</network-security-config>
```

---

## Google Cloud Console Setup

You need **TWO** OAuth client IDs:

### 1. Web Client ID (already have)
- `52777395492-vnlk2hkr3pv15dtpgp2m51p7418vll90.apps.googleusercontent.com`
- Type: Web application
- Used in: `capacitor.config.ts` and `strings.xml`

### 2. Android Client ID (create this)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to APIs & Services → Credentials
3. Click "Create Credentials" → "OAuth client ID"
4. Application type: **Android**
5. Package name: `nota.npd.com`
6. SHA-1 certificate fingerprint:

```bash
# For debug keystore
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android

# Or use Gradle
cd android
./gradlew signingReport
```

---

## Build Steps

```bash
# 1. Install dependencies
npm install

# 2. Add Android platform (if not already)
npx cap add android

# 3. Sync project
npx cap sync android

# 4. Open in Android Studio
npx cap open android

# Or run directly
npx cap run android
```

---

## Permissions Explained

| Permission | Purpose |
|------------|---------|
| `INTERNET` | Network access |
| `POST_NOTIFICATIONS` | Show notifications (Android 13+) |
| `SCHEDULE_EXACT_ALARM` | Precise notification timing |
| `ACCESS_FINE_LOCATION` | GPS for location reminders |
| `ACCESS_BACKGROUND_LOCATION` | Background location tracking |
| `RECORD_AUDIO` | Voice notes recording |
| `CAMERA` | Photo capture |
| `USE_BIOMETRIC` | App lock with fingerprint |
| `VIBRATE` | Haptic feedback |

---

## Troubleshooting

### Google Sign-In shows browser instead of native picker
- Ensure `MainActivity.java` implements `ModifiedMainActivityForSocialLoginPlugin`
- Verify both Web and Android OAuth client IDs exist in Google Cloud Console
- Check SHA-1 fingerprint matches your signing key

### Widgets not updating
- Ensure widgets are registered in AndroidManifest.xml
- Check that `SectionTasksWidgetService` has `BIND_REMOTEVIEWS` permission
- Verify SharedPreferences key names match between app and widgets

### Notifications not showing
- Grant `POST_NOTIFICATIONS` permission in Settings
- Disable battery optimization for the app
- Check notification channel settings

### Location not working in background
- Grant "Allow all the time" location permission
- Disable battery saver or add app to exceptions
- Check manufacturer-specific restrictions (Xiaomi, Huawei, Samsung)
