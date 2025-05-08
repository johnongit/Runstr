import { SimplePool } from 'nostr-tools';

// Polyfill `SimplePool.list` for nostr-tools v2 where the helper was removed.
// The shim opens a temporary subscription with `closeOnEose` semantics and
// resolves once EOSE is received or the optional timeout is reached.
if (SimplePool && typeof SimplePool.prototype.list !== 'function') {
  // eslint-disable-next-line no-param-reassign
  SimplePool.prototype.list = async function list(relays, filters, opts = {}) {
    const { timeout = 10000 } = opts;

    return new Promise((resolve) => {
      const collected = [];

      const sub = this.subscribe(
        relays,
        filters,
        {
          onevent(evt) {
            collected.push(evt);
          },
          oneose() {
            try {
              sub.close();
            } catch {
              // ignore
            }
            resolve(collected);
          },
        },
      );

      // Fallback safety timeout
      if (timeout > 0) {
        setTimeout(() => {
          try {
            sub.close();
          } catch {
            // ignore
          }
          resolve(collected);
        }, timeout);
      }
    });
  };

  // eslint-disable-next-line no-console
  console.info('[nostr-polyfill] SimplePool.list shim applied');
} 