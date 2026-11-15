# Phase 0 Device Environment Proofs Checklist

This checklist documents the five mandatory real-device environment proofs required to validate the cookie-based session authentication model and native networking stack across both Android and iOS devices on a live HTTPS staging backend.

## Test Environment Prerequisites
- Real Android physical device (Android 14 / 15 / API 35/36)
- Real iOS physical device (iOS 17 / 18)
- Live staging backend served over valid HTTPS with TLS termination
- Staging operator credentials with Administrator or Owner role

---

## The Five Real-Device Proofs

### Test 1: Immediate Force-Quit & Session Restore (Android CookieManager Flush Timing)
- **Goal:** Verify that the native cookie jar flushes the `session` cookie to persistent disk storage immediately upon login, surviving an instant process termination.
- **Steps:**
  1. Open app on the physical device.
  2. Enter valid operator email and password; tap "Sign In as Operator".
  3. As soon as the Dashboard overview begins rendering (login succeeded), immediately force-quit the application via the OS app switcher / task manager.
  4. Relaunch the application from the home screen.
  5. Observe the cold-start sequence.
- **Pass Criteria:** Cold start calls `GET /auth/session`, returns HTTP 200, restores operator state, and transitions directly to Dashboard without requesting credentials.
- **Known Risk:** If Android fails with 401, Android `CookieManager` flush timing is delayed. If confirmed on a physical device, stop and report immediately.

### Test 2: 24-Hour Sliding Session Persistence
- **Goal:** Verify that the session cookie slides forward upon activity and remains valid across ≥ 24 hours of standard usage.
- **Steps:**
  1. Sign in to the app on the device.
  2. Use the application periodically (e.g. view Dashboard, navigate to Jobs).
  3. Leave the app in the background and resume after 4 hours, 12 hours, and 24 hours.
  4. Perform a pull-to-refresh on the Dashboard.
- **Pass Criteria:** Requests continue returning HTTP 200 with no unexpected 401 unauthorized session expiry while actively sliding within 24h.

### Test 3: Explicit Logout & Cookie Clearing
- **Goal:** Verify that logging out invalidates both server-side session state and removes the client cookie.
- **Steps:**
  1. Navigate to Settings or More tab.
  2. Tap "Sign Out" and confirm in the dialog.
  3. Observe transition to Login screen and success toast.
  4. Force-quit and relaunch the app.
- **Pass Criteria:** Cold start calls `GET /auth/session` and receives HTTP 401. App remains on Login screen; cached operator hint is cleared.

### Test 4: Realtime SSE Stream Cookie Authentication
- **Goal:** Verify that `react-native-sse` passes the native session cookie when establishing the SSE connection to `${API_BASE_URL}/notifications/stream`.
- **Steps:**
  1. Sign in to the app.
  2. Navigate to the Alerts tab.
  3. Monitor device logs or network inspect for connection to `/notifications/stream`.
  4. Trigger a notification (e.g., run a job or trigger an event on the backend).
- **Pass Criteria:** SSE stream establishes successfully, receives the `connect` event, and live alerts trigger without falling back to 30s polling.

### Test 5: Network Transition (Wi-Fi ↔ Cellular Handover)
- **Goal:** Verify that moving between network interfaces does not invalidate or drop the session cookie.
- **Steps:**
  1. Connect device to Wi-Fi; sign in to the application.
  2. Disable Wi-Fi on device to force switch to Cellular (4G/5G).
  3. Perform a pull-to-refresh on Dashboard and navigate to Queue.
  4. Re-enable Wi-Fi.
  5. Trigger an action (e.g. retry job or approve queue item).
- **Pass Criteria:** Network requests succeed seamlessly across interface transitions without losing session authentication.

---

## Human QA Results Table

| Test ID | Test Description | Target Platform | Execution Date | Tester | Result (PASS / FAIL) | Observations & Evidence |
|---|---|---|---|---|---|---|
| P0-1A | Immediate Force-Quit Flush | Android Physical Device | | | [ ] PASS  [ ] FAIL | |
| P0-1B | Immediate Force-Quit Flush | iOS Physical Device | | | [ ] PASS  [ ] FAIL | |
| P0-2A | 24-Hour Sliding Session | Android Physical Device | | | [ ] PASS  [ ] FAIL | |
| P0-2B | 24-Hour Sliding Session | iOS Physical Device | | | [ ] PASS  [ ] FAIL | |
| P0-3A | Explicit Logout Clears Cookie | Android Physical Device | | | [ ] PASS  [ ] FAIL | |
| P0-3B | Explicit Logout Clears Cookie | iOS Physical Device | | | [ ] PASS  [ ] FAIL | |
| P0-4A | SSE Stream Cookie Auth | Android Physical Device | | | [ ] PASS  [ ] FAIL | |
| P0-4B | SSE Stream Cookie Auth | iOS Physical Device | | | [ ] PASS  [ ] FAIL | |
| P0-5A | Wi-Fi ↔ Cellular Handover | Android Physical Device | | | [ ] PASS  [ ] FAIL | |
| P0-5B | Wi-Fi ↔ Cellular Handover | iOS Physical Device | | | [ ] PASS  [ ] FAIL | |

---

## Stop-Condition Escalation Procedure
If Test P0-1A fails on real Android hardware:
1. Document the exact device model, Android OS version, and logcat output.
2. Escalate as an architectural stop condition: Android requires an explicit `CookieManager.getInstance().flush()` native bridge before process termination or manual `Set-Cookie` header injection.
3. Do not introduce speculative native workarounds until confirmed by human testing.
