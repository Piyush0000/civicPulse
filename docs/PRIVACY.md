# Privacy & security design

## Data flow

1. **Collection:** only what the citizen sends: text or voice, optional location, and the channel identifier
   (chat id or phone number).
2. **Pseudonymisation:** the channel identifier becomes `HMAC-SHA256(channel:id, PSEUDONYM_HMAC_SECRET)`. The clear id is
   stored only when a reply channel is needed, encrypted with AES-256-GCM (`reporter_contacts`), and deleted on `STOP`.
3. **Redaction:** regex (phones, emails, Aadhaar, CPF, SA ID, SNILS, Chinese resident ID) runs **before** text leaves the
   server for translation or LLM calls; the LLM then returns person names, which are replaced with `[NAME]`.
4. **Storage:** the dashboard shows only redacted text. Raw text is kept in `raw_messages` for re-processing and expires with
   retention.
5. **Retention:** audio is deleted after `RAW_AUDIO_RETENTION_DAYS` (30); text is expired after `REQUEST_TEXT_RETENTION_DAYS`
   (730). The job runs every 12 h or via `POST /api/v1/admin/retention`.
6. **Publication:** public maps and exports are aggregated to H3 res 7 and suppressed below k = 5 distinct reporters.
   The anonymous live stream carries only category, language, channel and a res-7 cell.

## Controls

- RBAC: policymakers decide, analysts correct data, admins manage. Every action is appended to the hash-chained ledger.
- There is no search by reporter and no per-person view anywhere in the product.
- Webhook secret (Telegram) and API key (IVR) checks; per-IP rate limits on public endpoints and login.
- httpOnly, SameSite=Lax session cookies (JWT HS256, 12 h); bcrypt password hashes.
- Security headers: nosniff, frame-options, referrer-policy, permissions-policy (mic and geolocation limited to self).

## Known limitations (pilot)

- The rate limiter is per instance (in-memory). Use a shared store for multi-instance deployments.
- The federation signature uses a shared HMAC demo key; production should use per-country asymmetric keys.
- The offline queue on the web form stores text and transcript locally until sync; audio is not queued offline.
