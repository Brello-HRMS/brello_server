# Feature 7 — Mobile Push Notifications (FCM)

> Phase 7 of the notification build plan. Extends the existing Web Push infrastructure to cover Android and iOS devices using Firebase Cloud Messaging (FCM) via the `firebase-admin` SDK.

---

## Context

Phase 6 shipped Web Push for browsers (VAPID + Web Push Protocol via `web-push` npm package). The `push_subscriptions` table already has a `platform` column (`'web' | 'android' | 'ios'`) that anticipated this extension. The Flutter mobile app (`brello_mobile/`) is a skeleton — it needs FCM wired on both the server and client sides.

**Key difference: Web Push vs FCM**

| | Web Push (Phase 6) | FCM (Phase 7) |
|---|---|---|
| Transport | W3C Web Push Protocol | Google FCM HTTP v1 |
| Credential | VAPID key pair | Firebase service account JSON |
| Subscription object | `{ endpoint, keys: { p256dh, auth } }` | FCM token (plain string) |
| Stored as | `endpoint` + `p256dh` + `auth` | `endpoint` only (p256dh/auth null) |
| Server library | `web-push` npm package | `firebase-admin` SDK |
| Platforms | Browser (Chrome, Firefox, Edge) | Android, iOS |

---

## Architecture

```
Flutter App (Android / iOS)
    │
    1. Firebase.initializeApp()
    2. FirebaseMessaging.instance.getToken() → FCM token
    3. POST /notifications/push-subscription { endpoint: fcmToken, platform: 'android' }
    │
NestJS Server
    │
    4. PushNotificationService.send()
    │    ├── platform === 'web'  → webpush.sendNotification()  [Phase 6]
    │    └── platform === 'android' | 'ios' → admin.messaging().send({ token: sub.endpoint })
    │
Google FCM
    │
    5. Delivers to device OS → Firebase SDK in Flutter → onMessage / showNotification
```

---

## Prerequisites (manual setup — before running any code)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → create a Firebase project
2. Enable **Cloud Messaging** in Firebase console → Project Settings → Cloud Messaging
3. **Server credentials**: Project Settings → Service Accounts → Generate new private key → download JSON → place at `brello_server/certs/firebase-adminsdk.json` (gitignored)
4. **Flutter app**: Install the FlutterFire CLI and run `flutterfire configure` — this is the recommended approach as of 2026. It auto-generates `lib/firebase_options.dart` and handles both `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) automatically:

```bash
# Install FlutterFire CLI (once)
dart pub global activate flutterfire_cli

# From brello_mobile/
flutterfire configure --project=<your-firebase-project-id>
```

This generates `lib/firebase_options.dart` which is used for initialization. Do NOT manually place platform JSON files — let the CLI manage them.

---

## Server changes (`brello_server`)

### 1. Install firebase-admin

```bash
npm install firebase-admin
```

### 2. Schema — make p256dh and auth nullable

FCM subscriptions have no encryption keys. The `p256dh` and `auth` columns must be nullable.

**`entities/push-subscription.entity.ts`:**
```typescript
@Column({ type: 'varchar', length: 255, nullable: true })
p256dh: string | null;

@Column({ type: 'varchar', length: 255, nullable: true })
auth: string | null;
```

**DB migration required** (TypeORM):
```bash
npm run typeorm migration:generate -- -n MakePushSubKeysNullable
npm run typeorm migration:run
```

### 3. DTO — make p256dh and auth optional

**`dto/subscribe-push.dto.ts`:**
```typescript
@IsString()
@IsOptional()
p256dh?: string;

@IsString()
@IsOptional()
auth?: string;
```

### 4. Config — add Firebase service account path

**`sample.properties.yaml`** and **`dev.properties.yaml`**:
```yaml
firebase:
  service_account_path: ''  # path to firebase-adminsdk.json, e.g. './certs/firebase-adminsdk.json'
```

### 5. PushNotificationService — FCM routing

**`services/push-notification.service.ts`:**

```typescript
import * as admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

// In constructor:
const serviceAccountPath = this.configService.get<string>('firebase.service_account_path');
if (serviceAccountPath && !admin.apps.length) {
  const serviceAccount = JSON.parse(readFileSync(join(process.cwd(), serviceAccountPath), 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

// In send():
if (sub.platform === 'web') {
  // existing webpush.sendNotification() path
} else {
  try {
    await admin.messaging().send({
      token: sub.endpoint,           // FCM token stored as endpoint
      notification: { title: dto.title, body: dto.message },
      data: flattenToStringRecord(dto.metadata ?? {}),
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    });
  } catch (err: any) {
    const staleErrors = [
      'messaging/registration-token-not-registered',
      'messaging/invalid-registration-token',
    ];
    if (staleErrors.includes(err.errorInfo?.code)) {
      await this.pushSubRepo.deleteByEndpoint(sub.endpoint);
    } else {
      throw err; // re-throw for BullMQ retry
    }
  }
}
```

`flattenToStringRecord()` — FCM `data` payload must be `Record<string, string>`. Helper:
```typescript
function flattenToStringRecord(obj: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])
  );
}
```

---

## Flutter app changes (`brello_mobile`)

> **These changes require the Firebase project credentials to be in place first.**

### 1. pubspec.yaml dependencies

```yaml
dependencies:
  flutter:
    sdk: flutter
  firebase_core: ^3.0.0
  firebase_messaging: ^15.0.0
  flutter_local_notifications: ^17.0.0
  http: ^1.2.0
```

### 2. Android setup

Add to `android/build.gradle` (project level):
```groovy
classpath 'com.google.gms:google-services:4.4.0'
```

Add to `android/app/build.gradle` (app level):
```groovy
apply plugin: 'com.google.gms.google-services'
```

### 3. iOS setup

Add to `ios/Runner/Info.plist`:
```xml
<key>FirebaseAppDelegateProxyEnabled</key>
<false/>
```

Enable Background Modes → Remote Notifications in Xcode capabilities.

### 4. main.dart

```dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'firebase_options.dart'; // generated by flutterfire configure

// Top-level background handler — must be outside any class
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  // Background messages: system shows OS notification automatically
}

final FlutterLocalNotificationsPlugin localNotifications = FlutterLocalNotificationsPlugin();

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  // Background handler registration
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

  // Local notifications init (for foreground display on Android)
  await localNotifications.initialize(
    const InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      iOS: DarwinInitializationSettings(),
    ),
  );

  runApp(const BrelloApp());
}
```

### 5. Push notification service (Dart)

`lib/services/push_notification_service.dart`:
```dart
import 'dart:convert';
import 'dart:io';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;

class PushNotificationService {
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;

  Future<void> initialize(String jwt) async {
    // Request permission (required on iOS and Android 13+)
    final settings = await _messaging.requestPermission();
    if (settings.authorizationStatus == AuthorizationStatus.denied) return;

    // Register FCM token with server
    final token = await _messaging.getToken();
    if (token != null) await _registerToken(token, jwt);

    // Handle token refresh
    _messaging.onTokenRefresh.listen((newToken) => _registerToken(newToken, jwt));

    // Foreground messages
    FirebaseMessaging.onMessage.listen(_showLocalNotification);

    // Background tap (app in background)
    FirebaseMessaging.onMessageOpenedApp.listen(_handleMessageTap);

    // Terminated state tap
    final initial = await _messaging.getInitialMessage();
    if (initial != null) _handleMessageTap(initial);
  }

  Future<void> _registerToken(String token, String jwt) async {
    final platform = Platform.isAndroid ? 'android' : 'ios';
    await http.post(
      Uri.parse('$baseUrl/notifications/push-subscription'),
      headers: {
        'Authorization': 'Bearer $jwt',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({ 'endpoint': token, 'platform': platform }),
    );
  }

  void _showLocalNotification(RemoteMessage message) {
    final n = message.notification;
    if (n == null) return;
    localNotifications.show(
      0,
      n.title,
      n.body,
      const NotificationDetails(
        android: AndroidNotificationDetails('brello_channel', 'Brello'),
        iOS: DarwinNotificationDetails(),
      ),
    );
  }

  void _handleMessageTap(RemoteMessage message) {
    final url = message.data['url'];
    if (url != null) {
      // Navigate using your app's router
    }
  }
}
```

---

## Token Hygiene

| Error | Action |
|---|---|
| FCM: `messaging/registration-token-not-registered` | Delete from `push_subscriptions` |
| FCM: `messaging/invalid-registration-token` | Delete from `push_subscriptions` |
| Web Push: HTTP 410 Gone | Delete from `push_subscriptions` (already done in Phase 6) |
| Web Push: HTTP 404 | Delete from `push_subscriptions` (already done in Phase 6) |

---

## Done When

- [ ] `POST /notifications/push-subscription` with `{ endpoint: "fcm-token", platform: "android" }` (no p256dh/auth) returns `{ id }` without 400 error
- [ ] Flutter app initialises Firebase, requests permission, POSTs FCM token to server on first launch
- [ ] A push job queued in BullMQ with `type: PUSH` for a user with an android/ios subscription delivers via FCM
- [ ] OS notification appears on device when Brello app is in background or terminated
- [ ] Tapping OS notification opens Brello (or navigates to relevant route)
- [ ] Revoking/expiring FCM token → stale entry automatically removed from `push_subscriptions`
- [ ] Web push (browser) still works unchanged — `platform: 'web'` still routes through `webpush.sendNotification()`
