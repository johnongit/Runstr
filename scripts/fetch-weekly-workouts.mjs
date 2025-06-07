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
// -------------------

const ndk = new NDK({
  explicitRelayUrls: RELAYS,
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function main() {
  console.log("Connecting to relays...");
  await ndk.connect();
  console.log(`Connected to ${RELAYS.length} relays.`);

  const since = Math.floor(Date.now() / 1000) - WEEK_IN_SECONDS;

  const filter = {
    kinds: [1301],
    '#s': [RUNSTR_SOURCE_TAG],
    since: since,
  };

  console.log("\nFetching workout notes from the last 7 days...");
  const events = await ndk.fetchEvents(filter);

  const startDate = new Date(since * 1000).toLocaleDateString();
  const endDate = new Date().toLocaleDateString();

  console.log(
    `\n✅ Found ${events.size} notes created from ${startDate} to ${endDate}.`
  );

  if (events.size === 0) {
    rl.close();
    return;
  }

  rl.question("\nPress Enter to show the list of notes...", () => {
    console.log("\n--- Weekly Workout Notes ---");
    const sortedEvents = Array.from(events).sort(
      (a, b) => a.created_at - b.created_at
    );

    for (const event of sortedEvents) {
      const npub = nip19.npubEncode(event.pubkey);
      const oneLineContent = event.content.replace(/\n/g, " | ");
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