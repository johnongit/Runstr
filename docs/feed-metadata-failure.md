# RUNSTR Feed — Metadata-Loading Failure Log

A chronological record of every change, test, and discovery we made while trying to restore **author avatars & display-names** in the Run Feed.

---

## 1 · 16 May 2025 — First Round of Ideas

| Step | Change / Test | Goal | Result | Observation |
|------|---------------|------|--------|-------------|
|1-a|Increase profile-query timeout from **6 s ➜ 15 s** in `loadSupplementaryData()`|Give slow relays more time|❌ No visible avatars|Relay query still returns `0` profile events|
|1-b|Remove _fastest-relay_ restriction (query **all** relays) in same function|Catch profiles that only live on slower relays|❌ Still empty|NDK pool connects, but returns nothing for kind 0|
|1-c|Mark posts without a profile as `{ name:"Loading…", needsProfile:true }`|Allow later enrichment|❌ UI still blank|Logic ok, but enrichment never happens|
|1-d|Broaden live profile subscription in `useRunFeed.js` to all relays|Fetch missing profiles in background|❌ Blank|Subscription receives **0** events|
|1-e|Stop proxying avatar URLs through images.weserv (direct fetch)|Eliminate 403/429 image blocks|🔶 Pictures load **when** URL already known, but names still missing|

## 2 · 17 May 2025 — Aggregator Fallback Path

| Step | Change / Test | Goal | Result | Observation |
|------|---------------|------|--------|-------------|
|2-a|Add `profileAggregator.js` → `nostr.band` `/v0/profiles` endpoint|HTTP fallback if relays fail|❌ Desktop OK, mobile blank|Initial bug: query param used **`pubkey`** not `pubkeys`|
|2-b|Fix query param, add support for new `{profiles:{…}}` JSON shape|Parse modern payload|❌ Mobile still blank|Mobile WebView CORS blocks request|
|2-c|Add retry via **allorigins.win** CORS proxy|Bypass Cloudflare CORS|✅ Avatars + names show **on desktop**, but intermittent on Android|
|2-d|Add selective proxy for `http://` avatar pics (mixed-content)|Ensure images render over HTTPS|✅ Images no longer blocked|

## 3 · 18 May 2025 — Mobile-Specific Work

| Step | Change / Test | Goal | Result | Observation |
|------|---------------|------|--------|-------------|
|3-a|Append `relay.nostr.band/all` + two high-uptime relays to `relays.js`|Better profile coverage|🔶 More events overall, but metadata still missing|
|3-b|Guard JSON parse in aggregator: bail if `Content-Type` ≠ `application/json`|Skip Cloudflare 403/HTML|🔶 Reduced errors, but still gaps in avatars|
|3-c|Add chunking (20 pubkeys/request) + removed `slice(0,100)` cap|Avoid over-long URLs mobile proxies drop|🔶 Success rate improved, but **not 100 %**|

## 4 · 19 May 2025 — Remaining Pain-Points

* **Mobile WebView (Graphene / Android)** often receives `403 Cloudflare browser-check` from nostr.band even through allorigins. Some devices stall on that response, leaving `needsProfile:true` forever.
* The relay-query path still returns `0` kind-0 events for many authors → root cause unknown (likely relay selection or connection timing).
* React only re-renders when profile map fills; if enrichment arrives after component unmount, UI never updates.

---

## Missteps & Lessons Learned

1. **Timeout vs Relay Coverage** – Extending timeouts without expanding relay set gives no benefit; inverse also true.
2. **CORS on Mobile ≠ Desktop** – Cloudflare challenges are device-class dependent. Desktop dev-tools hid this until we inspected network in a WebView.
3. **Hard-coded request caps (`slice(0,100)`)** silently discarded missing authors when feed length >100.
4. **Error Path Masking** – `res.json()` on a 403 HTML response throws, but we swallowed the error and returned an empty map → looked like "no data" instead of "blocked".
5. **Proxy Behaviour** – images.weserv solves mixed-content but not rate-limits; using it conditionally is necessary.

---

## Next-Step Ideas (Not Implemented Yet)

1. **Use `wss://relay.nostr.band/all` for a one-shot kind-0 profile query at app launch**, store result in IndexedDB; reduces per-session HTTP look-ups.
2. **Switch HTTP fallback to `https://r.jyx.ai/profiles`** (public CORS-enabled mirror of nostr.band).
3. **Emit an event when `needsProfile` remains true after N seconds**, allow UI to retry or show placeholder explicitly.
4. **Investigate NDK `await ndkReadyPromise` race on mobile;** pool may report ready before WS handshake completes.

---

*Last updated: 19 May 2025* 