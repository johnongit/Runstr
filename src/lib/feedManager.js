// feedManager.js – centralises run feed subscription & cache
// Lightweight singleton so the subscription survives route changes.

import { awaitNDKReady, ndk } from './ndkSingleton';
import { NDKRelaySet } from '@nostr-dev-kit/ndk';
import { getFastestRelays } from '../utils/feedFetcher';
import { fetchRunningPosts, loadSupplementaryData, processPostsWithData } from '../utils/nostr';
import { mergeProcessedPosts, lightweightProcessPosts } from '../utils/feedProcessor';

// Local cache object (lives for lifetime of JS context)
const cache = {
  posts: [],
  lastFetched: 0,
};

// Internal listeners for React hooks
const listeners = new Set();

const notify = () => {
  listeners.forEach((cb) => cb(cache.posts));
};

let started = false;
let sub = null;

// Persist / restore helpers (localStorage for now; easy to swap to Capacitor Storage)
const STORAGE_KEY = 'runstr_feed_cache_v1';

const saveCache = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache.posts.slice(0, 100)));
  } catch (_) {}
};

const loadCache = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) cache.posts = arr;
    }
  } catch (_) {}
};

loadCache();

export const getFeed = () => cache.posts;

export const subscribeFeed = (cb) => {
  if (typeof cb === 'function') {
    listeners.add(cb);
    // Push current value immediately
    cb(cache.posts);
    return () => listeners.delete(cb);
  }
  return () => {};
};

export const startFeed = async () => {
  if (started) return;
  started = true;

  // Ensure NDK ready
  const ready = await awaitNDKReady();
  if (!ready) {
    console.warn('[feedManager] NDK not ready; cannot start feed.');
    return;
  }

  // Initial fetch (quick then enriched)
  try {
    const initialLimit = 30;
    const raw = await fetchRunningPosts(initialLimit);
    const quickPosts = lightweightProcessPosts(raw);
    cache.posts = quickPosts;
    notify();

    // Enrich
    const supp = await loadSupplementaryData(raw);
    const full = await processPostsWithData(raw, supp);
    cache.posts = mergeProcessedPosts(quickPosts, full);
    cache.lastFetched = Date.now();
    saveCache();
    notify();
  } catch (err) {
    console.warn('[feedManager] initial fetch failed', err);
  }

  // Live subscription (kind 1, hashtag runstr)
  try {
    const relays = getFastestRelays(3);
    const relaySet = NDKRelaySet.fromRelayUrls(relays, ndk);
    sub = ndk.subscribe({ kinds: [1], '#t': ['runstr'], limit: 0, since: Math.floor(Date.now() / 1000) }, { closeOnEose: false, relaySet });

    sub.on('event', async (evt) => {
      try {
        // Prevent duplicates
        if (cache.posts.some((p) => p.id === evt.id)) return;

        const quick = lightweightProcessPosts([evt])[0];
        cache.posts = [quick, ...cache.posts].sort((a, b) => b.created_at - a.created_at).slice(0, 100);
        notify();

        // Enrich this single post in background
        const supp = await loadSupplementaryData([evt]);
        const fullArr = await processPostsWithData([evt], supp);
        if (fullArr.length) {
          const full = fullArr[0];
          cache.posts = cache.posts.map((p) => (p.id === full.id ? full : p));
          saveCache();
          notify();
        }
      } catch (e) {
        console.warn('[feedManager] live event handling failed', e);
      }
    });
  } catch (err) {
    console.warn('[feedManager] live subscription failed', err);
  }
};

export const stopFeed = () => {
  if (sub) sub.stop();
  started = false;
}; 