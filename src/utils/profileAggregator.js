export const fetchProfilesFromAggregator = async (pubkeys = []) => {
  if (!pubkeys || pubkeys.length === 0) return new Map();

  try {
    // According to nostr.band docs the plural `pubkeys` param is required.
    // Fall back to old param if the request fails, but prefer the correct one.
    let url = `https://api.nostr.band/v0/profiles?pubkeys=${pubkeys.join(',')}`;
    let res;
    try {
      res = await fetch(url);
      // If the endpoint returns 404/400 it might be because we used the wrong
      // parameter name – retry once with the legacy singular form for safety.
      if (!res.ok) {
        console.warn('[profileAggregator] plural param failed, retrying with singular', res.status);
        url = `https://api.nostr.band/v0/profiles?pubkey=${pubkeys.join(',')}`;
        res = await fetch(url);
      }
    } catch (fetchErr) {
      console.warn('[profileAggregator] initial fetch failed', fetchErr);
      // network-level failure, bail out
      return new Map();
    }

    if (!res.ok) {
      console.warn('[profileAggregator] HTTP request failed after retries', res.status);
      return new Map();
    }

    const data = await res.json();

    // --- adapt to both the old array shape *and* the new `{ profiles: { pk: metadata } }` shape ---
    let profilesArr;
    if (Array.isArray(data)) {
      profilesArr = data; // legacy shape
    } else if (data && typeof data === 'object' && data.profiles && typeof data.profiles === 'object') {
      profilesArr = Object.entries(data.profiles).map(([pk, meta]) => ({ pubkey: pk, profile: meta }));
    } else {
      console.warn('[profileAggregator] unexpected payload shape', data);
      return new Map();
    }

    if (!profilesArr || profilesArr.length === 0) {
      console.warn('[profileAggregator] empty payload for', pubkeys.length, 'pubkeys');
      return new Map();
    }

    const map = new Map();
    profilesArr.forEach((item) => {
      if (!item || !item.pubkey) return;
      const p = item.profile || item.metadata || {};
      map.set(item.pubkey, {
        name: p.name || p.display_name || 'Anonymous Runner',
        picture: typeof p.picture === 'string' ? p.picture : undefined,
        lud16: p.lud16,
        lud06: p.lud06,
      });
    });

    return map;
  } catch (err) {
    console.warn('[profileAggregator] HTTP request failed', err);
    return new Map();
  }
}; 