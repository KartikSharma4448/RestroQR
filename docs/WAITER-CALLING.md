# Table Waiter Requests

## Flow

Customer scans a valid table QR and taps Call waiter without login, email or OTP.
The request is persisted before a best-effort push to the restaurant owner's app.
The owner app shows a full-screen table alert on any authenticated screen and
loops the Android alarm tone until OK is pressed. When the app is in the
background or closed, a native foreground service rings the same looping alarm
with vibration and posts a full-screen alert; opening the app hands over to the
in-app alert. OK silences immediately
and closes the request in one step; no Acknowledge/Resolve controls remain.
On save failure the screen offers OK retry without restarting the bell. Multiple
table calls are handled oldest-first, one OK per call. Notification taps use the
existing Orders navigation. Customer status and the global owner alert poll every
ten seconds while visible/active. There is no separate waiter
account, staff assignment, guaranteed arrival time or automatic payment action.

## Rollout and Safety

- Backend migration 023 and `WAITER_CALLING_ENABLED=true` enable the API and
  table-menu button. New owner APK needs the matching Dart compile-time flag.
  Defaults remain off for production; no production deployment is implied.
- Only current table tokens for active owners/restaurants in multi-table mode
  work. Revoked/rotated QR tokens fail. Single/browse-only menus have no button.
- Table-row lock and partial unique index keep one active call per table.
  Repeated requests reuse it and do not send another push. After resolution,
  wait one minute before a new request. Global API rate limits also apply.
- Owner reads/updates are authenticated and restaurant-scoped. Current UI uses
  pending -> resolved (one OK). Legacy acknowledged requests are still readable
  and closeable for compatibility. Conflicting transitions require refresh.
- Public status is scoped to the QR table and does not expose customer/order
  details or other tables' calls. Responses are not cached.
- A QR proves possession, not physical presence; a copied QR can be used remotely.
  Rotating compromised table QR tokens and service-side limits mitigate abuse.
- Push failure does not erase the request. Owner panel polling is the fallback.
  Android notification permissions, connectivity and battery/force-stop policy
  can prevent background delivery. Actual device acceptance is still required.
- Background alarm: the server sends a data-only, high-priority push with a
  two-minute TTL (no `notification` block, which would make Android show a quiet
  system notification and skip the app). `WaiterMessagingService` receives it and
  starts `WaiterAlarmService`, a media-playback foreground service that loops the
  alarm tone (alarm audio stream) and vibrates. It stops when the owner opens the
  app (the in-app alert takes over), or after two minutes. If the owner minimizes
  the app while it is ringing, the service continues.
- The app declares `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `USE_FULL_SCREEN_INTENT`,
  `VIBRATE` and `POST_NOTIFICATIONS`. The activity only shows over the lock screen
  when launched from the alarm. On Android 14 and later the owner may need to allow
  full-screen notifications for the app in system settings.
- The alarm uses the alarm volume, which the owner can silence. Do Not Disturb
  rules still apply. Aggressive battery managers (some Xiaomi, Oppo, Vivo and
  Samsung phones) may stop a background app; set battery use to Unrestricted.
  Force-stopped apps receive no push at all.
- Older owner app builds do not understand the data-only push and show nothing in
  the background, so deploy the backend and the new owner app together.
  Android restriction reference: https://developer.android.com/about/versions/14/behavior-changes-14
- Active owner list is bounded to the oldest 100 requests. Define data retention
  for resolved history and expand pagination before large-table deployments.

## Verification

Isolated PostgreSQL checks cover concurrent duplicate calls, cooldown, scoped
updates, QR rotation/disabled entities, HTTP owner authentication and push failure.
Browser tests cover request/legacy acknowledgement/closed states, refresh, errors,
cooldown and mobile layout. Flutter tests cover looping sound commands, one OK,
silent network retry, foreground/background/logout cleanup and small screens.
Providers remain mocked in automated tests; do not claim live background delivery
until the user confirms a real local phone test. The native background alarm
service has been compiled and its manifest merge checked, but it has not been
tested on a physical phone yet. No email is sent for waiter calls.
