import { Event as NostrEvent, EventTemplate } from 'nostr-tools'; // Added EventTemplate
import { v4 as uuidv4 } from 'uuid';
import NDK, { NDKEvent, NDKFilter, NDKKind, NDKSubscriptionCacheUsage } from '@nostr-dev-kit/ndk'; // Import NDK

// Assume an NDK instance or similar service is available for actual Nostr operations
// e.g., ndk.publish(event), ndk.fetchEvents(filter)
// These would be passed in or accessed via a context/singleton.

export const KIND_FITNESS_TEAM = 33404; // Your NIP-101e Team Kind
export const KIND_WORKOUT_RECORD = 1301; // Define Kind 1301

// New Kinds for NIP-29 Chat and NIP-101e Activities
export const KIND_NIP29_GROUP_METADATA = 10009;
export const KIND_NIP29_CHAT_MESSAGE = 9; // Standard kind for NIP-29 chat messages
export const KIND_NIP101_TEAM_EVENT = 31012; // NIP-101e Team Event
export const KIND_NIP101_TEAM_CHALLENGE = 31013; // NIP-101e Team Challenge

export interface TeamData {
  name: string;
  description: string;
  isPublic: boolean;
  image?: string; // Optional: for team picture, also used in NIP-29 group
  // other fields like location, type can be added
}

// Using NostrEvent from nostr-tools as a base for typing
export interface NostrTeamEvent extends NostrEvent {
  // We can add parsed properties if needed, e.g., parsedName, parsedDescription
  // but the base structure is an Event.
}

export interface NostrWorkoutEvent extends NostrEvent {} // Basic type for workout events

/**
 * Prepares a new Fitness Team (Kind 33404) event.
 * The actual signing and publishing will be handled by the app's NDK/Nostr client instance.
 * The creator automatically becomes the captain and a member.
 */
export function prepareNewTeamEvent(teamData: TeamData, creatorPubkey: string): NostrTeamEvent | null {
  if (!creatorPubkey) {
    console.error("Creator pubkey is required to prepare a team event.");
    return null;
  }

  const teamUUID = uuidv4();

  const tags = [
    ["d", teamUUID],
    ["name", teamData.name],
    ["public", teamData.isPublic.toString()],
    ["captain", creatorPubkey],
    ["member", creatorPubkey], // Captain is the first member
    ["t", "team"],
    ["t", "running"], // Default type, can be made configurable
    ["type", "running_club"] // Default type
    // Add other optional tags like location if provided
  ];

  const event: NostrTeamEvent = {
    kind: KIND_FITNESS_TEAM as number,
    pubkey: creatorPubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags: tags,
    content: teamData.description, // Team description goes into content
    id: '', // ID will be set after signing
    sig: '', // Signature will be set after signing
  };

  // The event returned here is unsigned.
  // The calling code will need to pass this to the NDK or equivalent for signing and publishing.
  // e.g., const signedEvent = await ndk.signEvent(event);
  //       await ndk.publish(signedEvent);
  console.log("Prepared team creation event (unsigned):", event);
  return event;
}

/**
 * Prepares event templates for a new NIP-101e Fitness Team (Kind 33404) 
 * AND its associated NIP-29 Chat Group (Kind 10009).
 * The actual signing and publishing will be handled by the app's NDK/Nostr client instance.
 * The creator automatically becomes the captain and a member of the NIP-101e team.
 * @returns An object containing the teamEventTemplate and chatGroupEventTemplate, or null if error.
 */
export function prepareNip101eTeamAndChatGroupEvents(
  teamData: TeamData,
  creatorPubkey: string
): { teamEventTemplate: EventTemplate; chatGroupEventTemplate: EventTemplate } | null {
  if (!creatorPubkey) {
    console.error("Creator pubkey is required to prepare team and chat group events.");
    return null;
  }

  const teamUUID = uuidv4(); // This is the 'd' tag for the NIP-101e team
  const nip29GroupDUUID = `runstr-chat-${teamUUID}`; // 'd' tag for the NIP-29 chat group

  // 1. Prepare NIP-101e Team Event (Kind 33404)
  const teamTags = [
    ["d", teamUUID],
    ["name", teamData.name],
    ["public", teamData.isPublic.toString()],
    ["captain", creatorPubkey],
    ["member", creatorPubkey], // Captain is the first member
    ["t", "team"],
    ["t", "running"],
    ["type", "running_club"],
    // Reference to the NIP-29 chat group
    ["chat_group_ref", `${KIND_NIP29_GROUP_METADATA}:${creatorPubkey}:${nip29GroupDUUID}`],
  ];
  if (teamData.image) {
    teamTags.push(["image", teamData.image]);
  }

  const teamEventTemplate: EventTemplate = {
    kind: KIND_FITNESS_TEAM,
    created_at: Math.floor(Date.now() / 1000),
    tags: teamTags,
    content: teamData.description,
  };
  console.log("Prepared NIP-101e team creation event template (unsigned):", teamEventTemplate);

  // 2. Prepare NIP-29 Chat Group Metadata Event (Kind 10009)
  const chatGroupTags = [
    ["d", nip29GroupDUUID], // Unique identifier for the NIP-29 group
    ["name", `${teamData.name} Chat`], // Name for the chat group
    // Reference back to the NIP-101e team
    ["a", `${KIND_FITNESS_TEAM}:${creatorPubkey}:${teamUUID}`],
    ["t", "chat"], // General chat tag
    ["t", "runstr-team-chat"], // App-specific tag if needed
  ];
  if (teamData.image) {
    chatGroupTags.push(["picture", teamData.image]); // NIP-29 uses 'picture'
  }
  // NIP-29 groups often list initial members or admins. For simplicity,
  // we'll rely on the NIP-101e team's membership.
  // If needed, ["p", creatorPubkey, "admin"] could be added.

  const chatGroupEventTemplate: EventTemplate = {
    kind: KIND_NIP29_GROUP_METADATA,
    created_at: teamEventTemplate.created_at, // Use same timestamp or slightly after
    tags: chatGroupTags,
    content: `Chat for the Runstr team: ${teamData.name}. Associated NIP-101e team: ${KIND_FITNESS_TEAM}:${creatorPubkey}:${teamUUID}`,
  };
  console.log("Prepared NIP-29 chat group creation event template (unsigned):", chatGroupEventTemplate);
  
  return { teamEventTemplate, chatGroupEventTemplate };
}

// --- Updated NDK-based fetch functions ---

/**
 * Fetches all public Fitness Team (Kind 33404) events using NDK.
 */
export async function fetchPublicTeams(
  ndk: NDK // Pass NDK instance
): Promise<NostrTeamEvent[]> {
  if (!ndk) {
    console.warn("NDK instance not provided to fetchPublicTeams.");
    return [];
  }

  const filter: NDKFilter = {
    kinds: [KIND_FITNESS_TEAM as NDKKind], // Cast to NDKKind here
    // Limit can be adjusted based on expected number of teams or pagination strategy
    // limit: 50, 
  };
  
  try {
    console.log("Fetching public teams with filter:", filter);
    // NDK's fetchEvents by default tries to get the latest replaceable events if kind is replaceable.
    // However, Kind 33404 is a generic kind, not specifically defined as replaceable in NIP-01 for all relays.
    // For teams, we'd expect one event per d-tag + pubkey. Here we fetch broadly and then filter.
    const eventsSet = await ndk.fetchEvents(filter, { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST });
    
    const allTeamEvents: NostrTeamEvent[] = Array.from(eventsSet).map(ndkEvent => ndkEvent.rawEvent() as NostrTeamEvent);
    
    // Client-side filter for public teams and de-duplicate by unique team ID (captain + d-tag)
    const publicTeamsMap = new Map<string, NostrTeamEvent>();

    allTeamEvents.forEach(event => {
      if (isTeamPublic(event)) {
        const captain = getTeamCaptain(event); // Use pubkey as part of unique ID for the replaceable event
        const uuid = getTeamUUID(event);
        if (uuid) {
          const teamUniqueId = `${captain}:${uuid}`;
          const existingTeam = publicTeamsMap.get(teamUniqueId);
          if (!existingTeam || event.created_at > existingTeam.created_at) {
            publicTeamsMap.set(teamUniqueId, event);
          }
        }
      }
    });
    const uniquePublicTeams = Array.from(publicTeamsMap.values());
    console.log(`Fetched ${eventsSet.size} total team events, found ${uniquePublicTeams.length} unique public teams.`);
    return uniquePublicTeams;

  } catch (error) {
    console.error("Error fetching public teams with NDK:", error);
    return []; 
  }
}

/**
 * Fetches a specific Fitness Team (Kind 33404) event using NDK.
 * A team is uniquely identified by its kind, captain's pubkey, and d-tag (teamUUID).
 */
export async function fetchTeamById(
  ndk: NDK, // Pass NDK instance
  captainPubkey: string, 
  teamUUID: string
): Promise<NostrTeamEvent | null> {
  if (!ndk) {
    console.warn("NDK instance not provided to fetchTeamById.");
    return null;
  }
  if (!captainPubkey || !teamUUID) {
    console.warn("Captain pubkey or team UUID missing for fetchTeamById.");
    return null;
  }

  const filter: NDKFilter = {
    kinds: [KIND_FITNESS_TEAM as NDKKind], // Cast to NDKKind here
    authors: [captainPubkey],
    '#d': [teamUUID],
    limit: 1, // NDK should fetch the latest due to replaceable event semantics if kind is known by relays
              // or if not, it will get one based on limit, then we should sort by created_at.
  };

  try {
    console.log(`Fetching team by ID: captain=${captainPubkey}, uuid=${teamUUID}`, filter);
    // NDK usually handles fetching the latest version of a replaceable event.
    const eventsSet = await ndk.fetchEvents(filter, { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST });

    if (eventsSet.size > 0) {
      // NDK fetchEvents with limit 1 for a replaceable kind (identified by authors & #d) should give the latest.
      // If multiple are returned somehow, sort to be sure.
      const eventsArray = Array.from(eventsSet).map(ndkEvent => ndkEvent.rawEvent() as NostrTeamEvent);
      eventsArray.sort((a, b) => b.created_at - a.created_at);
      console.log("Fetched team event:", eventsArray[0]);
      return eventsArray[0];
    }
    console.log("No team event found for the given ID.");
    return null;
  } catch (error) {
    console.error("Error fetching team by ID with NDK:", error);
    return null;
  }
}

/**
 * Fetches all Fitness Team (Kind 33404) events where the given user_pubkey is listed as a member.
 */
export async function fetchUserMemberTeams(
  ndk: NDK,
  userPubkey: string
): Promise<NostrTeamEvent[]> {
  if (!ndk) {
    console.warn("NDK instance not provided to fetchUserMemberTeams.");
    return [];
  }
  if (!userPubkey) {
    console.warn("User pubkey not provided to fetchUserMemberTeams.");
    return [];
  }

  const filter: NDKFilter = {
    kinds: [KIND_FITNESS_TEAM as NDKKind],
    // NIP-51 based querying for a tag value containing the user's pubkey.
    // This queries for events where a #p tag (representing a pubkey, common for members) equals userPubkey.
    // However, NIP-101e uses `["member", "<pubkey>"]`. Standard relays might not index generic tags efficiently.
    // A more robust but potentially slower method is to fetch all teams and filter client-side,
    // or rely on relays that support more advanced NIP-01 generic tag queries if those become common.
    // For now, let's try a tag query that might work on some relays for the specific "member" tag format.
    // This is experimental for generic tags:
    // '#t_member': [userPubkey], // This is non-standard for generic tags.

    // The most reliable way is often to fetch candidate teams (e.g., all public, or by author if captain known)
    // and then filter client-side. Or, if NIP-51 (Lists) is used for team member lists by some clients,
    // that would be another angle. Given our strict NIP-101e approach, we'll filter client-side after a broader fetch.
    // Let's fetch all team kinds and then filter.
    // This could be inefficient for a large number of teams.
    // A better approach might be to fetch teams captained by the user, and teams they've interacted with.
  };

  try {
    console.log(`Fetching all teams to filter for user membership: ${userPubkey}`);
    // Fetch ALL Kind 33404 events. This can be a lot of data.
    // Consider narrowing this down if possible (e.g., by relays, or known team authors if your app has that context)
    const allTeamEventsSet = await ndk.fetchEvents(filter, { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST });
    const allTeamEvents: NostrTeamEvent[] = Array.from(allTeamEventsSet).map(e => e.rawEvent() as NostrTeamEvent);

    const memberTeams: NostrTeamEvent[] = [];
    const processedTeamIds = new Set<string>(); // To keep only the latest version of each team

    // Sort by created_at descending to process latest versions first
    allTeamEvents.sort((a, b) => b.created_at - a.created_at);

    for (const teamEvent of allTeamEvents) {
      const captain = getTeamCaptain(teamEvent);
      const uuid = getTeamUUID(teamEvent);
      if (!uuid) continue; 

      const teamUniqueId = `${captain}:${uuid}`;
      if (processedTeamIds.has(teamUniqueId)) {
        continue; // Already processed a newer version of this team
      }

      const members = getTeamMembers(teamEvent);
      if (members.includes(userPubkey)) {
        memberTeams.push(teamEvent);
      }
      processedTeamIds.add(teamUniqueId);
    }
    
    console.log(`Found ${memberTeams.length} teams where user ${userPubkey} is a member.`);
    return memberTeams;
  } catch (error) {
    console.error("Error fetching user member teams:", error);
    return [];
  }
}

/**
 * Fetches Kind 1301 workout records associated with a specific team.
 */
export async function fetchTeamActivityFeed(
  ndk: NDK,
  teamCaptainPubkey: string,
  teamUUID: string,
  limit: number = 20
): Promise<NostrWorkoutEvent[]> {
  if (!ndk) {
    console.warn("NDK instance not provided to fetchTeamActivityFeed.");
    return [];
  }
  if (!teamCaptainPubkey || !teamUUID) {
    console.warn("Team captain pubkey or UUID missing for fetchTeamActivityFeed.");
    return [];
  }

  const teamTagValue = `33404:${teamCaptainPubkey}:${teamUUID}`;

  const filter: NDKFilter = {
    kinds: [KIND_WORKOUT_RECORD as NDKKind],
    '#team': [teamTagValue], // Query for the specific team tag value
    limit: limit,
    // until: Math.floor(Date.now() / 1000), // Optional: to paginate or get latest
  };

  try {
    console.log(`Fetching team activity feed for team: ${teamTagValue}`, filter);
    const eventsSet = await ndk.fetchEvents(filter, { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST });
    
    const workoutEvents: NostrWorkoutEvent[] = Array.from(eventsSet)
      .map(ndkEvent => ndkEvent.rawEvent() as NostrWorkoutEvent)
      .sort((a, b) => b.created_at - a.created_at); // Sort by newest first
    
    console.log(`Fetched ${workoutEvents.length} workout events for the team feed.`);
    return workoutEvents;

  } catch (error) {
    console.error("Error fetching team activity feed with NDK:", error);
    return []; 
  }
}

// --- Helper functions to parse event data ---

export function getTeamName(teamEvent: NostrTeamEvent): string {
  const nameTag = teamEvent.tags.find(tag => tag[0] === 'name');
  return nameTag ? nameTag[1] : 'Unnamed Team';
}

export function getTeamDescription(teamEvent: NostrTeamEvent): string {
  return teamEvent.content || 'No description.';
}

export function getTeamCaptain(teamEvent: NostrTeamEvent): string {
  const captainTag = teamEvent.tags.find(tag => tag[0] === 'captain');
  return captainTag ? captainTag[1] : teamEvent.pubkey;
}

export function getTeamMembers(teamEvent: NostrTeamEvent): string[] {
  return teamEvent.tags.filter(tag => tag[0] === 'member').map(tag => tag[1]);
}

export function getTeamUUID(teamEvent: NostrTeamEvent): string | undefined {
    const dTag = teamEvent.tags.find(tag => tag[0] === 'd');
    return dTag ? dTag[1] : undefined;
}

export function getTeamChatGroupRef(teamEvent: NostrTeamEvent): string | null {
  const chatRefTag = teamEvent.tags.find(tag => tag[0] === 'chat_group_ref');
  return chatRefTag ? chatRefTag[1] : null;
}

export function isTeamPublic(teamEvent: NostrTeamEvent): boolean {
    const publicTag = teamEvent.tags.find(tag => tag[0] === 'public');
    return publicTag ? publicTag[1].toLowerCase() === 'true' : false; // Default to false if tag missing
}

/**
 * Prepares an updated (unsigned) team event with a new member added.
 * This is for a replaceable Kind 33404 event.
 * @param existingTeamEvent The latest known version of the team event.
 * @param newMemberPubkey The pubkey of the member to add.
 * @returns A new NostrEvent object (template) ready for signing, or null if inputs are invalid.
 */
export function addMemberToTeamEvent(
  existingTeamEvent: NostrTeamEvent,
  newMemberPubkey: string
): EventTemplate | null {
  if (!existingTeamEvent || !newMemberPubkey) {
    console.error("Invalid arguments for addMemberToTeamEvent");
    return null;
  }

  const currentMembers = getTeamMembers(existingTeamEvent);
  if (currentMembers.includes(newMemberPubkey)) {
    console.log("Member already exists in the team, no changes made.");
    // Optionally, could return the existing event if no change, but returning null 
    // or a specific status might be better to indicate no action needed.
    // For now, let's return a new template even if member exists, caller can decide.
    // Or, more strictly, indicate no change by returning the original or null.
    // Let's assume for now we always return a new template if an update is requested,
    // even if it means re-adding an existing member (though tags shouldn't duplicate exactly).
  }

  const newTags = existingTeamEvent.tags.filter(tag => tag[0] !== 'member'); // Remove old member tags
  const updatedMembers = Array.from(new Set([...currentMembers, newMemberPubkey])); // Add new member, ensure uniqueness
  updatedMembers.forEach(member => newTags.push(["member", member]));
  
  // Ensure 'd' tag is preserved and unique
  const dTag = existingTeamEvent.tags.find(tag => tag[0] === 'd');
  if (!dTag) {
      console.error("Cannot update team event: existing event is missing 'd' tag.");
      return null;
  }
  // Filter out old dTag if present in newTags from filtering step, then add the original one back
  const finalTags = newTags.filter(tag => tag[0] !== 'd');
  finalTags.unshift(dTag); // Ensure 'd' tag is primary for replaceable event id by author+d+kind

  const updatedEventTemplate: EventTemplate = {
    kind: KIND_FITNESS_TEAM as number,
    tags: finalTags,
    content: existingTeamEvent.content, // Content usually remains the same for member changes
    created_at: Math.floor(Date.now() / 1000), // New timestamp for replaceable event
    // pubkey will be set by the signer (captain)
  };

  return updatedEventTemplate;
}

/**
 * Prepares an updated (unsigned) team event with a member removed.
 * This is for a replaceable Kind 33404 event.
 * @param existingTeamEvent The latest known version of the team event.
 * @param memberToRemovePubkey The pubkey of the member to remove.
 * @returns A new NostrEvent object (template) ready for signing, or null if inputs are invalid.
 */
export function removeMemberFromTeamEvent(
  existingTeamEvent: NostrTeamEvent,
  memberToRemovePubkey: string
): EventTemplate | null {
  if (!existingTeamEvent || !memberToRemovePubkey) {
    console.error("Invalid arguments for removeMemberFromTeamEvent");
    return null;
  }

  const currentMembers = getTeamMembers(existingTeamEvent);
  if (!currentMembers.includes(memberToRemovePubkey)) {
    console.warn("Member to remove not found in the team.");
    // Return the original event or null to indicate no change was made / possible
    return null; 
  }

  const newTags = existingTeamEvent.tags.filter(tag => 
      !(tag[0] === 'member' && tag[1] === memberToRemovePubkey)
  );

  // Ensure 'd' tag is preserved if it was filtered out (it shouldn't be by above logic)
  const dTag = existingTeamEvent.tags.find(tag => tag[0] === 'd');
  if (!dTag) {
      console.error("Cannot update team event: existing event is missing 'd' tag.");
      return null;
  }
  if (!newTags.some(tag => tag[0] === 'd' && tag[1] === dTag[1])) {
      newTags.unshift(dTag);
  }

  const updatedEventTemplate: EventTemplate = {
    kind: KIND_FITNESS_TEAM as number,
    tags: newTags,
    content: existingTeamEvent.content,
    created_at: Math.floor(Date.now() / 1000),
  };

  return updatedEventTemplate;
}

// --- NIP-29 Chat Message Functions ---

/**
 * Prepares an unsigned NIP-29 chat message (Kind 9) event template.
 * @param chatGroupRef The 'a' tag reference of the NIP-29 group (e.g., "10009:pubkey:d_identifier").
 * @param messageContent The content of the chat message.
 * @param senderPubkey The pubkey of the user sending the message.
 * @returns An EventTemplate ready for signing, or null if inputs are invalid.
 */
export function prepareTeamChatMessage(
  chatGroupRef: string, // e.g., "10009:pubkey_of_kind10009:d_identifier_of_kind10009"
  messageContent: string,
  senderPubkey: string
): EventTemplate | null {
  if (!chatGroupRef || !messageContent || !senderPubkey) {
    console.error("Missing required parameters for prepareTeamChatMessage");
    return null;
  }

  const dTagValue = chatGroupRef.split(':')[2]; // Extract d from "KIND:PK:D"

  const tags = [
    ["a", chatGroupRef], // Main NIP-29 group reference
  ];
  if (dTagValue) {
     tags.push(["d", dTagValue]); // Some clients might look for the 'd' tag directly on kind 9
  }
  // For replies, an 'e' tag pointing to the replied message_id and 'p' tag to its author would be added.
  // For now, simple broadcast messages to the group.

  const eventTemplate: EventTemplate = {
    kind: KIND_NIP29_CHAT_MESSAGE,
    created_at: Math.floor(Date.now() / 1000),
    tags: tags,
    content: messageContent,
  };
  return eventTemplate;
}

/**
 * Subscribes to NIP-29 chat messages (Kind 9) for a specific team's chat group.
 * @param ndk NDK instance.
 * @param chatGroupRef The 'a' tag reference of the NIP-29 group (e.g., "10009:pubkey:d_identifier").
 * @param callback Function to call with each new chat message event.
 * @param limit Optional limit for initial fetch.
 * @param since Optional timestamp to fetch messages since.
 * @returns NDKSubscription instance, or null if error.
 */
export function subscribeToTeamChatMessages(
  ndk: NDK,
  chatGroupRef: string, // e.g., "10009:pubkey_of_kind10009:d_identifier_of_kind10009"
  callback: (event: NostrEvent) => void,
  limit: number = 50, // Number of past messages to load initially
  since?: number      // To load messages after a certain point (for pagination/updates)
) {
  if (!ndk || !chatGroupRef) {
    console.error("NDK instance or chatGroupRef missing for subscribeToTeamChatMessages");
    return null;
  }
  
  const filter: NDKFilter = {
    kinds: [KIND_NIP29_CHAT_MESSAGE as NDKKind],
    "#a": [chatGroupRef], // Filter by the NIP-29 group's 'a' tag
    limit: limit,
  };

  if (since) {
    // If 'since' is provided, we are likely fetching newer messages, so remove limit or set to a higher value
    // For real-time updates, 'limit' is usually small for the initial load, then 'since' is used.
    // NDK subscriptions will keep delivering new events that match after the initial fetch.
    // For fetching older messages, you'd use 'until' and decrement.
    // Here, 'since' is more for "load messages newer than this", which NDK handles with live updates.
    // NDK's default subscription behavior will fetch `limit` and then keep connection open for new ones.
    // If you want to load messages *after* a certain point without a limit on how many,
    // you might omit `limit` when `since` is present, or NDK might handle this fine.
    // For now, we'll keep `limit` for the initial load even with `since`.
    // filter.since = since; // NDK handles this automatically for ongoing subscriptions after initial limit
  }
  console.log("Subscribing to team chat messages with filter:", filter, chatGroupRef);

  const subscription = ndk.subscribe(filter, { closeOnEose: false, cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST });

  subscription.on('event', (ndkEvent: NDKEvent) => {
    // console.log("Raw chat event received:", ndkEvent.rawEvent());
    callback(ndkEvent.rawEvent() as NostrEvent);
  });

  subscription.on('eose', () => {
    console.log(`EOSE received for team chat messages: ${chatGroupRef}`);
  });
  
  // Call start() explicitly if not auto-starting (NDK usually auto-starts)
  // subscription.start(); 
  return subscription;
}

// --- NIP-101e Team Activity Functions (Events & Challenges) ---

export interface TeamActivityDetails {
  type: 'event' | 'challenge'; // KIND_NIP101_TEAM_EVENT or KIND_NIP101_TEAM_CHALLENGE
  name: string;
  description: string;
  startTime?: number; // Unix timestamp
  endTime?: number;   // Unix timestamp
  location?: string;  // For events
  rules?: string;     // For challenges
  // Add other fields as necessary, e.g., prize for challenge, specific metrics
}

/**
 * Prepares an unsigned NIP-101e team activity event (Kind 31012 for Event, 31013 for Challenge).
 * @param teamAIdentifier The 'a' tag of the NIP-101e team (e.g., "33404:captain_pubkey:team_uuid").
 * @param activityDetails Details of the activity.
 * @param creatorPubkey Pubkey of the user creating the activity.
 * @returns An EventTemplate ready for signing, or null if inputs are invalid.
 */
export function prepareTeamActivityEvent(
  teamAIdentifier: string, // e.g., "33404:captain_pubkey:team_uuid"
  activityDetails: TeamActivityDetails,
  creatorPubkey: string
): EventTemplate | null {
  if (!teamAIdentifier || !activityDetails || !creatorPubkey) {
    console.error("Missing required parameters for prepareTeamActivityEvent");
    return null;
  }

  const kind = activityDetails.type === 'event' ? KIND_NIP101_TEAM_EVENT : KIND_NIP101_TEAM_CHALLENGE;
  
  const tags: string[][] = [
    ["a", teamAIdentifier], // Link to the NIP-101e team
    ["name", activityDetails.name],
    ["description", activityDetails.description], // NIP-101e uses 'description' tag for this
  ];

  if (activityDetails.startTime) {
    tags.push(["start", activityDetails.startTime.toString()]); // NIP-101e 'start' tag
  }
  if (activityDetails.endTime) {
    tags.push(["end", activityDetails.endTime.toString()]); // NIP-101e 'end' tag
  }
  if (activityDetails.location && activityDetails.type === 'event') {
    tags.push(["location", activityDetails.location]);
  }
  if (activityDetails.rules && activityDetails.type === 'challenge') {
    // NIP-101e doesn't specify a 'rules' tag for challenges, might go in content or a custom tag.
    // For now, let's add it as a custom tag, or it can be part of the content.
    tags.push(["rules", activityDetails.rules]); // Or put in content
  }
  // Add other relevant tags based on NIP-101e spec for events/challenges.

  const eventTemplate: EventTemplate = {
    kind: kind,
    created_at: Math.floor(Date.now() / 1000),
    tags: tags,
    content: activityDetails.description, // Or JSON.stringify(activityDetails) if more complex
  };
  return eventTemplate;
}

/**
 * Subscribes to NIP-101e team activities (Kind 31012 Events, Kind 31013 Challenges).
 * @param ndk NDK instance.
 * @param teamAIdentifier The 'a' tag of the NIP-101e team (e.g., "33404:captain_pubkey:team_uuid").
 * @param callback Function to call with each new activity event.
 * @returns NDKSubscription instance, or null if error.
 */
export function subscribeToTeamActivities(
  ndk: NDK,
  teamAIdentifier: string, // e.g., "33404:captain_pubkey:team_uuid"
  callback: (event: NostrEvent) => void
) {
  if (!ndk || !teamAIdentifier) {
    console.error("NDK instance or teamAIdentifier missing for subscribeToTeamActivities");
    return null;
  }

  const filter: NDKFilter = {
    kinds: [KIND_NIP101_TEAM_EVENT as NDKKind, KIND_NIP101_TEAM_CHALLENGE as NDKKind],
    "#a": [teamAIdentifier], // Filter by the NIP-101e team's 'a' tag
    // limit: 20, // Optional: for initial fetch
  };
  console.log("Subscribing to team activities with filter:", filter);

  const subscription = ndk.subscribe(filter, { closeOnEose: false, cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST });

  subscription.on('event', (ndkEvent: NDKEvent) => {
    callback(ndkEvent.rawEvent() as NostrEvent);
  });

  subscription.on('eose', () => {
    console.log(`EOSE received for team activities: ${teamAIdentifier}`);
  });
  
  return subscription;
} 