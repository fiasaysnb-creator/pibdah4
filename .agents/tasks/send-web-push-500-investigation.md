# send-web-push Edge Function — HTTP 500 Investigation

## 1. Summary (most likely root cause)

The `send-web-push` Edge Function is deployed and running (the browser receives a real HTTP 500 with a JSON body, not a relay/"function not found" error), and it is failing inside its own `try/catch`. The only code path in that function that produces a 500 — given that Supabase URL/service-role keys are auto-injected on the hosted platform — is the `SELECT` against the `push_subscriptions` table throwing (`if (dbError) throw dbError;`). There is **no SQL migration anywhere in the repo that creates the `push_subscriptions` table**, so the most likely root cause is that the table does not exist in the database (or was created ad-hoc in the dashboard with a schema missing a column the query references, e.g. `vendor_id` or `is_active`). PostgREST returns a `PGRST205` "Could not find the table …" (or a column-not-found) error, the function throws it, and the outer `catch` returns HTTP 500. A secondary, lower-likelihood cause is a module-load failure of `npm:web-push@3.6.7` on the Deno runtime; the two are distinguishable only by reading the function logs. VAPID key mismatch is **ruled out** as the cause of the 500 (it is caught per-subscription and never escapes to a 500).

## 2. What was inspected (file + line ranges)

- `supabase/functions/send-web-push/index.ts` — read fully (lines 1–168). Edge function source, VAPID init, request handling, the `push_subscriptions` SELECT, the per-subscription `sendNotification` loop, and the outer `catch`.
- `src/services/webPush.ts` — read fully (lines 1–293). Frontend caller; `dispatchWebPush` at lines 236–256 (the warning at line 250), `subscribeToPushNotifications` (113–205), `sendTestPushNotification` (264–293), `getVapidPublicKey` (8–12).
- `src/services/notifications.ts` — read fully (lines 1–90). `createNotification` inserts a row, then fires `dispatchWebPush` in a background `void` IIFE (lines 56–71).
- `.env` and `.env.example` — read fully. Checked which VAPID / Supabase vars are present; values not echoed.
- `supabase/.temp/linked-project.json` — read. Confirms hosted Supabase project ref `xqdmcggaixzitoaxcgyh` (name `venapictures2026`), matching the failing URL.
- `supabase/migrations/*.sql` — all 14 migration files enumerated; grepped for `push`, `subscription`, `CREATE TABLE`, `net.http`, `pg_net`, `http_post`, `functions/v1`. None reference `push_subscriptions`.
- `src/hooks/useAuxiliaryData.ts` (lines 120–195) — `addNotification` → `createNotificationRow`.
- `src/pages/auth/LoginPage.tsx` — read fully. Login flow; no push dispatch on login.
- `src/App.tsx` — grepped for login/notification/push effects; `handleLoginSuccess` is just an auth-state setter, no push on login.
- `src/init.ts` — read fully. Only registers the service worker; no push dispatch on load.
- `src/contexts/SimplifiedDataContext.tsx` — the realtime `notifications` subscription (line ~354) only invalidates the query cache; it does **not** dispatch push.
- Trigger call sites (grep): `PublicLeadForm.tsx:84`, `PublicBookingForm.tsx:676`, `PublicPackages.tsx:585`, `useClientPaymentOperations.ts:239` (`addNotification`), `WebPushNotificationPanel.tsx:138` (`sendTestPushNotification`).
- `src/types/index.ts` (lines 28–52) — `PushSubscriptionRecord` and `PushNotificationPayload` definitions (the expected table columns).
- `src/services/__tests__/webPush.test.ts` — read fully; tests do not exercise the edge function.

## 3. Findings — suspected causes

### 3.1 `push_subscriptions` table missing / column mismatch — CONFIRMED as the only realistic 500 path; CANNOT-VERIFY live DB state (read-only)
- The edge function's only 500-producing code path (excluding the auto-injected-creds case) is `supabase/functions/send-web-push/index.ts:94-95`:
  ```
  const { data: subscriptions, error: dbError } = await query;
  if (dbError) throw dbError;
  ```
  A thrown `dbError` is caught by the outer `catch` (`index.ts:162-168`) which returns HTTP 500 with `error.message`.
- There is **no migration** creating `push_subscriptions`. Grep of `supabase/migrations/*.sql` for `push|subscription|VAPID` returned no matches; the only `CREATE TABLE` statements in the repo are for `google_calendar_feed_tokens`, `ui_text_overrides`, and `bio_link_pages`. The table is referenced by code (`index.ts:70,134`; `webPush.ts:189,221`) but never defined in the repo.
- Therefore the table is either absent, or created ad-hoc in the Supabase dashboard with an incomplete schema. A missing table yields PostgREST `PGRST205` ("Could not find the table 'push_subscriptions' in the schema cache"); a missing column (e.g. `vendor_id`, `is_active`, `p256dh`, `auth`) yields a schema-cache/column error. Both make the SELECT throw → 500.
- Empty table is **not** the cause: `index.ts:97-104` returns 200 with `deliveredCount: 0` when the SELECT succeeds but returns no rows. So a 500 specifically means the SELECT itself errored.
- Cannot fully confirm the live DB state without querying it (read-only constraint); see §5 for how to confirm.

### 3.2 Missing Supabase URL / service-role key in edge-function env — RULED OUT (on hosted platform)
- `index.ts:53-61` returns 500 "Supabase credentials not configured in Edge Function" only if `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_ANON_KEY` are unset.
- `supabase/.temp/linked-project.json` confirms this is a **hosted** Supabase project (`xqdmcggaixzitoaxcgyh`). On hosted Supabase, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected into every edge function. This path is therefore unlikely. (It would apply only to a self-hosted/local setup where secrets were not provisioned.)

### 3.3 VAPID key mismatch / invalid VAPID — RULED OUT as the cause of the 500
- The frontend uses `VITE_VAPID_PUBLIC_KEY` (`.env`) which equals the hardcoded `DEFAULT_VAPID_PUBLIC_KEY` (`webPush.ts:4-6`).
- The edge function uses `Deno.env.get("VAPID_PRIVATE_KEY")` with a hardcoded fallback (`index.ts:15-18`) that matches the public key's companion value.
- Crucially, `webpush.setVapidDetails` is wrapped in a non-fatal `try/catch` at module load (`index.ts:21-26`) — a failure is only logged, it does not stop the server. And `webpush.sendNotification` is called per-subscription inside its own `try/catch` (`index.ts:121-143`); any VAPID/signature error increments `failedCount` and is **not** re-thrown. So a VAPID problem can never reach the outer `catch` and can never produce a 500. (It could still cause push *delivery* to fail, but that is a separate symptom, not this 500.)
- (Cannot cryptographically prove the public/private pair matches without running it, but it is irrelevant to the 500.)

### 3.4 Malformed payload / body shape — RULED OUT
- `index.ts:69` reads the body as `await req.json().catch(() => ({}))`; a non-JSON body becomes `{}`. Then `index.ts:71-78` returns **400** (not 500) when `vendor_id` is missing.
- The frontend sends `supabase.functions.invoke('send-web-push', { body: payload })` (`webPush.ts:247-249`) where `payload` is `PushNotificationPayload` = `{ vendor_id, title, message, url?, icon?, tag? }` (`types/index.ts:43-50`). The edge function destructures exactly those fields (`index.ts:71`). Shapes match.
- Payload-too-large is not a concern: the payload is a tiny JSON object.

### 3.5 Missing try/catch / exception escapes — RULED OUT as a defect (it is handled, but it is *why* we see 500)
- The function has a top-level `try/catch` (`index.ts:52, 162-168`). The per-subscription `sendNotification` is also individually wrapped (`index.ts:124-140`). There is no unwrapped throw except the deliberate `throw dbError` at `index.ts:95`. So the 500 is a *handled* error surfacing the `dbError` — consistent with finding 3.1.

### 3.6 Wrong Deno env access (`process.env` vs `Deno.env.get`) — RULED OUT
- The function uses `Deno.env.get(...)` correctly throughout (`index.ts:12, 16, 20, 55-57`). No `process.env` usage.

### 3.7 CORS / authorization — RULED OUT for the 500
- CORS headers are set (`index.ts:8-13`) and an `OPTIONS` preflight is handled (`index.ts:40-44`). CORS failures would manifest as browser CORS errors, not an HTTP 500 from the server.
- `verify_jwt`: a JWT/authorization failure on a Supabase edge function returns 401/403, not 500. The browser logs a `FunctionsHttpError` (function ran and returned non-2xx), confirming the request reached the function. (If `verify_jwt` were on and the JWT were missing/invalid, the error type would differ and the status would be 401/403.)

### 3.8 Module-load failure of `npm:web-push@3.6.7` on Deno — CANNOT-VERIFY (secondary)
- `index.ts:3` imports `webpush from "npm:web-push@3.6.7"`. If that module (or its transitive deps, e.g. the deprecated `request`) failed to load on the Supabase Deno runtime, the function could not boot and the platform would return 500 on every request. This is consistent with "always 500" and cannot be ruled out from source alone.
- Distinguishing evidence: a module-load failure produces an import/boot error in the platform logs and **no** `[send-web-push] Unhandled error:` line; a table/SELECT failure produces the `[send-web-push] Unhandled error:` log line with a PGRST message. See §5.

### 3.9 Login-time trigger — RULED OUT (the brief's hypothesis is not supported by code)
- The brief hypothesized the app dispatches a welcome/session push on login. `LoginPage.tsx` calls only `onLoginSuccess` (an auth-state setter); `App.tsx` and `init.ts` create no notifications and dispatch no push on login/mount. The realtime `notifications` subscription (`SimplifiedDataContext.tsx`) only invalidates the cache.
- `dispatchWebPush` is reachable only from `notifications.ts:64` (`createNotification`) and `webPush.ts:283` (`sendTestPushNotification`). `createNotification` is called from public form submissions and payment recording (`PublicLeadForm.tsx:84`, `PublicBookingForm.tsx:676`, `PublicPackages.tsx:585`, `useClientPaymentOperations.ts:239`) — not from login.
- Conclusion: the two 500s "right after login" are **not** an automatic login push. They come from a `createNotification` event (e.g. a payment/booking recorded in that session) or the manual "Test Push" button, coincidentally observed just after login. The root cause of the 500 is independent of the trigger.

### 3.10 (Security note, not the 500 cause) VAPID private key leaked to client bundle
- `.env` contains `VITE_VAPID_PRIVATE_KEY=...`. Any `VITE_`-prefixed var is shipped to the client bundle. Grep confirms `VITE_VAPID_PRIVATE_KEY` is **never read** by `src/` code (only the edge function reads `VAPID_PRIVATE_KEY` from its own Deno env). So the private key is exposed to every visitor's browser for no functional reason. `.env.example` correctly omits it. This is a separate hardening item, not the 500 cause.

## 4. Concrete fix recommendations (ordered by likelihood)

1. **(PRIMARY) Create the `push_subscriptions` table with the full expected schema.** Add a new migration, e.g. `supabase/migrations/<timestamp>_create_push_subscriptions.sql`, and apply it (run `supabase db push` or paste the SQL in the Supabase dashboard SQL editor). The schema must match what both the edge function (`index.ts:70-71, 86, 136`) and the frontend upsert (`webPush.ts:176-190`, `PushSubscriptionRecord` in `types/index.ts:29-42`) expect:
   - `id uuid primary key default gen_random_uuid()`
   - `vendor_id uuid not null` (or `text` if vendor ids are non-uuid; the frontend sends `profile.id` which is a uuid) — **required by the edge function filter**
   - `user_id uuid` (nullable; references `auth.users(id)` recommended)
   - `endpoint text not null` with a **unique constraint** (the frontend upserts with `onConflict: 'endpoint'`, which requires a unique constraint on `endpoint`)
   - `p256dh text not null`, `auth text not null`
   - `user_agent text`, `device_type text`
   - `is_active boolean not null default true`
   - `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`
   - Enable RLS and add policies (the edge function uses the service-role key which bypasses RLS, but the frontend upsert uses the user's session key and needs insert/update rights, and `subscribeToPushNotifications` must be allowed to write).
   - Why: without this table the edge function's SELECT throws → 500 on every dispatch. This is almost certainly the fix.

2. **Verify the diagnosis before/after the fix via the function logs (see §5).** Confirm the error message is `PGRST205`/table-related (not an import error), then confirm the function returns 200 after the table exists. This avoids fixing the wrong thing.

3. **(If logs show an import/boot error instead) resolve the `npm:web-push@3.6.7` load on Deno.** Pin a known-good version or vendor the dependency / use an import map. Only pursue this if §5 shows a module-load error rather than a PGRST error.

4. **(Hardening, not the 500 cause) Remove the hardcoded VAPID fallbacks and the leaked client key.**
   - Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` as edge-function **secrets** (`supabase secrets set ...` / dashboard) and remove the `|| "..."` fallbacks in `index.ts:11-20` so a missing secret fails loudly instead of silently using a committed key. (Note: the current fallback public key matches the frontend's default, so VAPID itself is not broken; this is about not committing/shipping secrets.)
   - Remove `VITE_VAPID_PRIVATE_KEY` from `.env` (it is unused by the client and leaks the private key to the browser bundle). Keep only `VITE_VAPID_PUBLIC_KEY` in client env, matching `.env.example`.

5. **(Optional resilience) Improve the edge function's error reporting.** In `index.ts:95`, distinguish a schema/table error (`dbError.code === 'PGRST205'`/`'42P01'`) from a transient error and return a clearer 500 body (e.g. `{ error: "push_subscriptions table not configured", code: dbError.code }`). This makes future misconfigurations self-diagnosing. Not required if recommendation 1 is applied.

## 5. How to retrieve the real 500 error body

The 500 response body is a JSON object `{ "error": "<message>" }` (from `index.ts:167`). The browser console only prints the generic `FunctionsHttpError: Edge Function returned a non-2xx status code` (`webPush.ts:250`) and discards the body. To read the actual message:

**A. Supabase dashboard logs (recommended).**
- Dashboard → Edge Functions → `send-web-push` → Logs.
- Trigger a dispatch (e.g. submit the public lead form, or use Settings → Test Push), then read the newest log lines:
  - If you see `[send-web-push] Unhandled error: { code: 'PGRST205', message: "Could not find the table 'push_subscriptions' in the schema cache" }` (or a `42P01`/column error) → **confirms finding 3.1** (table/column problem). This is the expected case.
  - If you see `[send-web-push] Unhandled error: { error: "Supabase credentials not configured in Edge Function" }` → that is finding 3.2 (unlikely on hosted).
  - If you see an import/boot error (e.g. `error: Module not found ... npm:web-push ...` or `TypeError` at load) and **no** `[send-web-push] Unhandled error:` line → that is finding 3.8 (module-load failure).

**B. `curl` reproduction (do NOT echo secrets here; substitute from your `.env` / dashboard).**
Use a dummy `vendor_id` so the request only tests the SELECT, not real delivery:
```bash
curl -i -X POST 'https://xqdmcggaixzitoaxcgyh.supabase.co/functions/v1/send-web-push' \
  -H 'apikey: <VITE_SUPABASE_ANON_KEY from .env>' \
  -H 'Authorization: Bearer <VITE_SUPABASE_ANON_KEY, or a logged-in user access token>' \
  -H 'Content-Type: application/json' \
  -d '{"vendor_id":"diagnostic-test","title":"t","message":"m"}'
```
Interpretation:
- `HTTP/1.1 200` with `deliveredCount: 0` → the table **exists** and the SELECT works; the 500 in production has a different trigger (re-test with a real `vendor_id` that has subscriptions, or check logs).
- `HTTP/1.1 500` with `{"error":"Could not find the table 'push_subscriptions' in the schema cache"}` → **confirms the table is missing** (finding 3.1). Apply recommendation 1.
- `HTTP/1.1 500` with `{"error":"Supabase credentials not configured in Edge Function"}` → finding 3.2 (provision edge-function secrets).
- `HTTP/1.1 500` with a non-JSON body or a Deno import error → finding 3.8 (module-load failure).
- `HTTP/1.1 401/403` → an auth/`verify_jwt` issue, not this 500 (would need a valid user JWT in `Authorization`).

**C. Surface the body in the browser (no extra tooling).** In `dispatchWebPush` (`webPush.ts:247-256`), the `error` is a `FunctionsHttpError`; read its response: `const body = await error.context?.json?.(); console.warn('[WebPush] body:', body);`. This prints the exact `{ error: "<message>" }` that the server returned. (Suggested for diagnosis only — do not leave secret-laden logging in production.)

## 6. Caveats (could not verify without running the function server-side)

- **Live DB state not verified.** I cannot query the database from this read-only investigation. The "table missing" conclusion is inference from the total absence of a `push_subscriptions` migration combined with the 500 originating at the SELECT. It is possible the table was created manually in the dashboard; in that case the 500 would instead come from a missing/misnamed column the query references (`vendor_id`, `is_active`, `p256dh`, `auth`). Either way, recommendation 1 (create/verify the full schema) resolves it. Use §5A or §5B to confirm which before applying the fix.
- **Module-load failure (3.8) cannot be ruled out from source.** If §5 logs show an import error rather than a PGRST error, recommendation 3 applies instead of recommendation 1.
- **VAPID keypair validity not cryptographically verified.** I confirmed the public key the browser uses and the private key the function uses are the same committed values, and that a VAPID fault cannot produce this 500 (per-subscription catch). I did not verify the two values are a mathematically matching pair; if they were not, pushes would silently fail to deliver (failedCount), but the function would still return 200, not 500.
- **The exact login-time trigger was not located in code.** No code path dispatches push on login; the two post-login 500s are most plausibly a `createNotification` event or a manual "Test Push" that happened to occur in that session, not an automatic session push.
- **Edge-function deployment/config not repo-tracked.** There is no `supabase/config.toml`, so `verify_jwt`, entrypoint, and secret injection are managed via the dashboard/CLI and could not be confirmed from the repo. The `FunctionsHttpError` (not a relay error) does confirm the function is deployed and reached.
