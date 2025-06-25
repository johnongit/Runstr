import NDK from "@nostr-dev-kit/ndk";
import { nip19 } from "nostr-tools";
import readline from "readline";

// --- Configuration ---
// Add the relays your app publishes to. The more relays you have, the more comprehensive the result.
const RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.primal.net",
  "wss://relay.nostr.band",
];
const RUNSTR_SOURCE_TAG = "RUNSTR";
const WEEK_IN_SECONDS = 7 * 24 * 60 * 60;
const FETCH_TIMEOUT_MS = 12000; // 12-second safety timeout
// -------------------

const ndk = new NDK({
  explicitRelayUrls: RELAYS,
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// helper to fetch events via subscribe with timeout
async function fetchWeeklyWorkoutEvents(ndkInstance, sinceTimestamp) {
  return new Promise((resolve) => {
    const collected = new Map();

    const sub = ndkInstance.subscribe(
      {
        kinds: [1301],
        since: sinceTimestamp,
      },
      { closeOnEose: false }
    );

    const done = () => {
      try { sub.stop(); } catch (_) {}
      resolve(new Set(collected.values()));
    };

    // Safety timeout
    const timeoutId = setTimeout(done, FETCH_TIMEOUT_MS);

    sub.on("event", (ev) => {
      collected.set(ev.id, ev);
    });

    sub.on("eose", () => {
      clearTimeout(timeoutId);
      done();
    });
  });
}

async function main() {
  console.log("Connecting to relays...");
  await ndk.connect();
  console.log(`Connected to ${RELAYS.length} relays.`);

  const since = Math.floor(Date.now() / 1000) - WEEK_IN_SECONDS;

  console.log("\nFetching workout notes from the last 7 days… (client-side filter: source/client = RUNSTR)");
  let events = await fetchWeeklyWorkoutEvents(ndk, since);

  // Client-side filter for RUNSTR tags
  events = new Set(
    Array.from(events).filter((ev) =>
      ev.tags.some(
        (t) =>
          (t[0] === "source" && t[1]?.toUpperCase() === RUNSTR_SOURCE_TAG) ||
          (t[0] === "client" && t[1]?.toLowerCase() === "runstr")
      )
    )
  );

  const startDate = new Date(since * 1000).toLocaleDateString();
  const endDate = new Date().toLocaleDateString();

  console.log(`\n✅ Found ${events.size} notes created from ${startDate} to ${endDate}.`);

  if (events.size === 0) {
    rl.close();
    return;
  }

  rl.question("\nPress Enter to show the list of notes…", () => {
    console.log("\n--- Weekly Workout Notes ---");
    const sortedEvents = Array.from(events).sort((a, b) => a.created_at - b.created_at);

    for (const event of sortedEvents) {
      const npub = nip19.npubEncode(event.pubkey);
      const oneLineContent = (event.content || "").replace(/\n/g, " | ");
      console.log(`- ${npub}: ${oneLineContent}`);
    }
    console.log("--- End of List ---\n");
    rl.close();
  });
}

main().catch((e) => {
  console.error("An error occurred:", e);
  process.exit(1);
}); 