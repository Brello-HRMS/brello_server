# Push Notifications — Flutter Handoff Guide

This document is everything a Flutter developer needs to wire up FCM push notifications in the Brello mobile app. The server side is **already complete**. You only need to do the Firebase setup and the Flutter code changes described here.

---

## What's already done on the server

- `POST /api/v1/notifications/push-subscription` — stores an FCM token for a user
- `DELETE /api/v1/notifications/push-subscription` — removes a subscription
- `push_subscriptions` table: `(id, user_id, endpoint, p256dh, auth, platform, created_at)`
  - FCM tokens are stored in `endpoint`; `p256dh` and `auth` are null for mobile
  - `platform` is `'android'` or `'ios'`
- `PushNotificationService` on the server routes jobs by platform — `android`/`ios` goes through Firebase Admin SDK (FCM HTTP v1)
- Stale token cleanup: when FCM returns `messaging/registration-token-not-registered`, the server auto-deletes the row

**What you send:**
```json
POST /api/v1/notifications/push-subscription
Authorization: Bearer <jwt>
Content-Type: application/json

{ "endpoint": "<FCM_TOKEN>", "platform": "android" }
```
No `p256dh` or `auth` — server accepts partial body.

---

## Step 1 — Firebase project setup (manual, once)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Create a project** (name it `brello`)
2. In the new project: **Project Settings → Cloud Messaging** — confirm it's enabled
3. Add an **Android app**: use package name from `android/app/build.gradle` (`applicationId`)
4. Add an **iOS app**: use the bundle ID from Xcode

Do **not** manually download `google-services.json` or `GoogleService-Info.plist` — the FlutterFire CLI handles that.

---

## Step 2 — FlutterFire CLI setup

```bash
# Install once globally
dart pub global activate flutterfire_cli

# From brello_mobile/
flutterfire configure --project=<your-firebase-project-id>
```

This generates `lib/firebase_options.dart` and places `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) in the correct locations. Commit all three files.

---

## Step 3 — pubspec.yaml

Add to `dependencies` in `pubspec.yaml`:

```yaml
dependencies:
  # ... existing deps ...
  firebase_core: ^3.6.0
  firebase_messaging: ^15.1.0
  flutter_local_notifications: ^17.2.0
```

Then run:
```bash
flutter pub get
```

---

## Step 4 — Android native setup

In `android/build.gradle` (project-level), inside `buildscript > dependencies`:
```groovy
classpath 'com.google.gms:google-services:4.4.2'
```

In `android/app/build.gradle` (app-level), at the bottom:
```groovy
apply plugin: 'com.google.gms.google-services'
```

FCM requires a notification channel for Android 8+. Add this to `android/app/src/main/AndroidManifest.xml` inside `<application>`:
```xml
<meta-data
    android:name="com.google.firebase.messaging.default_notification_channel_id"
    android:value="brello_channel" />
```

---

## Step 5 — iOS native setup

1. Open `ios/Runner.xcworkspace` in Xcode
2. **Signing & Capabilities → + Capability → Push Notifications**
3. **Signing & Capabilities → + Capability → Background Modes → check Remote Notifications**
4. In `ios/Runner/Info.plist`, add:
```xml
<key>FirebaseAppDelegateProxyEnabled</key>
<false/>
```

You also need an APNs key or certificate uploaded to Firebase Console → Project Settings → Cloud Messaging → iOS app. Without this, iOS won't receive notifications.

---

## Step 6 — Add ApiEndpoints constant

In `lib/core/network/api_endpoints.dart`, add the push subscription endpoint:

```dart
class ApiEndpoints {
  static const String baseUrl = "https://api.brello.app";

  // Notifications
  static const String pushSubscription = "/api/v1/notifications/push-subscription";
}
```

---

## Step 7 — PushNotificationService

Create `lib/core/services/push_notification_service.dart`:

```dart
import 'dart:developer';
import 'dart:io';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:brello_mobile/core/network/api_endpoints.dart';
import 'package:brello_mobile/core/network/network_service.dart';

final FlutterLocalNotificationsPlugin localNotifications =
    FlutterLocalNotificationsPlugin();

const _androidChannel = AndroidNotificationChannel(
  'brello_channel',
  'Brello Notifications',
  description: 'Brello app notifications',
  importance: Importance.high,
);

/// Top-level background handler — must live outside any class.
/// Called when the app is terminated or in the background.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Firebase is already initialised by the time this runs on Android.
  // On iOS the system displays the notification automatically.
  log('[FCM] Background message: ${message.messageId}');
}

class PushNotificationService {
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;

  /// Call once after Firebase.initializeApp() and after the user is logged in.
  Future<void> initialize() async {
    await _initLocalNotifications();

    // Request permission (required on iOS and Android 13+)
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      log('[FCM] Permission denied — push notifications disabled');
      return;
    }

    // Register current token with Brello server
    final token = await _messaging.getToken();
    if (token != null) {
      await _registerToken(token);
    }

    // Re-register whenever Firebase rotates the token
    _messaging.onTokenRefresh.listen((newToken) async {
      await _registerToken(newToken);
    });

    // Foreground messages — show via flutter_local_notifications
    FirebaseMessaging.onMessage.listen(_showLocalNotification);

    // Background tap — app was in background, user tapped notification
    FirebaseMessaging.onMessageOpenedApp.listen(_handleNotificationTap);

    // Terminated tap — app was closed, user tapped notification to open it
    final initialMessage = await _messaging.getInitialMessage();
    if (initialMessage != null) {
      _handleNotificationTap(initialMessage);
    }
  }

  Future<void> _initLocalNotifications() async {
    // Create Android channel
    await localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(_androidChannel);

    await localNotifications.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(),
      ),
    );
  }

  Future<void> _registerToken(String token) async {
    final platform = Platform.isAndroid ? 'android' : 'ios';
    final networkService = NetworkService<Map<String, dynamic>>();

    final result = await networkService.post(
      ApiEndpoints.pushSubscription,
      data: {'endpoint': token, 'platform': platform},
      withAuth: true,
      parse: (data) => data as Map<String, dynamic>,
    );

    if (result.isSuccess) {
      log('[FCM] Token registered with Brello server (platform: $platform)');
    } else {
      log('[FCM] Token registration failed: ${result.message}');
    }
  }

  void _showLocalNotification(RemoteMessage message) {
    final notification = message.notification;
    if (notification == null) return;

    localNotifications.show(
      notification.hashCode,
      notification.title,
      notification.body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _androidChannel.id,
          _androidChannel.name,
          channelDescription: _androidChannel.description,
          icon: '@mipmap/ic_launcher',
        ),
        iOS: const DarwinNotificationDetails(
          sound: 'default',
          badgeNumber: 1,
        ),
      ),
      payload: message.data['url'],
    );
  }

  void _handleNotificationTap(RemoteMessage message) {
    final url = message.data['url'];
    if (url == null) return;

    // TODO: navigate using AppRouterConfig.router
    // Example: AppRouterConfig.router.push(url);
    log('[FCM] Notification tapped — navigate to: $url');
  }

  /// Call on logout to clean up. Token will auto-refresh on next login.
  Future<void> deleteToken() async {
    await _messaging.deleteToken();
    log('[FCM] Token deleted');
  }
}
```

---

## Step 8 — Wire into main.dart

The existing `main.dart` only needs three additions:
1. Firebase init (must be awaited before `runApp`)
2. Background handler registration
3. Service worker registration after login (see Step 9)

```dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:brello_mobile/core/services/push_notification_service.dart';
import 'firebase_options.dart'; // generated by flutterfire configure

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Firebase init — must be first
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  // Register the background handler before runApp
  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

  runApp(const MyApp());
}
```

The rest of `main.dart` (ScreenUtilInit, MultiBlocProvider, MaterialApp.router) stays unchanged.

---

## Step 9 — Call initialize() after login

`PushNotificationService.initialize()` requires a valid JWT (stored in SharedPreferences as `"token"` by the existing `NetworkService`). Call it after a successful login, not on app start.

The best place is in `AuthBloc`, after the login state transitions to authenticated:

```dart
// lib/features/auth/bloc/auth_bloc.dart

import 'package:brello_mobile/core/services/push_notification_service.dart';

// Inside the handler for a successful login event:
final pushService = PushNotificationService();
await pushService.initialize();
```

Or, if you prefer to keep it out of the bloc, call it from your post-login navigation callback in the router or a login success screen.

---

## Step 10 — Handle notification taps (routing)

In `_handleNotificationTap` above, the `url` field from `message.data` is populated by the server's notification metadata. Wire it to go_router:

```dart
void _handleNotificationTap(RemoteMessage message) {
  final url = message.data['url'];
  if (url == null || url.isEmpty) return;
  AppRouterConfig.router.push(url);
}
```

The server currently sets `url` via the `metadata` field of a notification job. If you need to support specific screens, coordinate with the server team on what `url` values to send (e.g. `/leaves/123`, `/payroll/april-2025`).

---

## Testing checklist

### Unit test — token registration
1. Log in to the app
2. Check server logs: you should see `FCM push sent to android token ...`  
   Or hit `GET /api/v1/notifications` as the user to confirm a row exists in `push_subscriptions` with your FCM token

### Foreground notification
1. App is open in the foreground
2. Trigger a notification from the server (or use Firebase Console → Cloud Messaging → Send test message → paste your FCM token)
3. OS notification should appear via `flutter_local_notifications`

### Background notification
1. App is backgrounded (not killed)
2. Trigger notification
3. OS notification appears from Firebase SDK directly (no flutter_local_notifications needed)
4. Tap it — `onMessageOpenedApp` fires, router navigates

### Terminated notification
1. Kill the app
2. Trigger notification
3. OS notification appears
4. Tap to open — `getInitialMessage()` fires, router navigates

### Stale token cleanup
1. Uninstall the app (token becomes stale)
2. Send a notification from the server targeting that user
3. Server logs should show: `Stale FCM token removed: ...`
4. Row is deleted from `push_subscriptions`

---

## Environment configuration

The server needs a Firebase service account to send FCM messages. Ask the backend team to:
1. Get the JSON from Firebase Console → Project Settings → Service Accounts → Generate new private key
2. Place it at `brello_server/certs/firebase-adminsdk.json` (gitignored)
3. Set `firebase.service_account_path: './certs/firebase-adminsdk.json'` in `dev.properties.yaml`
4. Restart the server — logs will confirm: `Firebase Admin initialised — FCM push enabled`

Until the service account is configured, the server silently skips FCM delivery (no crash, just a warning log).

---

## Gotchas

| Issue | Fix |
|---|---|
| iOS simulator doesn't receive push | Use a real device for push testing |
| Android 13+ — no notification shown | `requestPermission()` must be called; POST_NOTIFICATIONS permission required |
| Token not rotating | Firebase rotates tokens automatically; `onTokenRefresh` handles re-registration |
| App crashes on init | `Firebase.initializeApp()` must be awaited before any Firebase API call |
| `firebase_options.dart` missing | Run `flutterfire configure` again |
| Server returns 401 on registration | Token in SharedPreferences is expired — user needs to re-login |
| Server returns 400 on registration | Check that `endpoint` (token) is non-empty and `platform` is `'android'` or `'ios'` |

---

## Files to create / modify

| File | Action |
|---|---|
| `lib/firebase_options.dart` | Generated by `flutterfire configure` — commit this |
| `lib/core/services/push_notification_service.dart` | **New** (Step 7) |
| `lib/core/network/api_endpoints.dart` | Add `pushSubscription` constant (Step 6) |
| `lib/main.dart` | Add Firebase init + background handler (Step 8) |
| `lib/features/auth/bloc/auth_bloc.dart` | Call `pushService.initialize()` post-login (Step 9) |
| `android/build.gradle` | Add google-services classpath (Step 4) |
| `android/app/build.gradle` | Apply google-services plugin (Step 4) |
| `android/app/src/main/AndroidManifest.xml` | Add default notification channel meta-data (Step 4) |
| `pubspec.yaml` | Add firebase_core, firebase_messaging, flutter_local_notifications (Step 3) |
