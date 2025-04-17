# RUNSTR Run Club Feature

The Run Club feature is a new addition to RUNSTR that enables users to participate in two popular running groups on Nostr: "Messi Run Club" and "#RUNSTR".

## Features

- **Join Run Clubs**: Connect with two popular running groups on the Nostr network.
- **Real-time Chat**: Communicate with other runners in real-time using Nostr's decentralized messaging.
- **Pin Messages**: Pin important messages for quick reference.
- **Coming Soon**: Events and challenges features are planned for future updates.

## Technical Implementation

The Run Club feature is built using the [NIP-29 Groups Protocol](https://github.com/nostr-protocol/nips/blob/master/29.md) on the Nostr network. This provides a decentralized, censorship-resistant platform for runners to connect without relying on a central server.

### Key Components

1. **Group Metadata (Kind 30080/30081)**: Groups are identified using their `naddr` identifier which contains kind, pubkey, and identifier information.
2. **Group Messages (Kind 84)**: Messages within Run Clubs are published as Kind 84 events, tagged with the appropriate group identifier.
3. **Direct Relay Communication**: The app communicates directly with Nostr relays without any bridge or synchronization layer.
4. **Local Message Pinning**: Users can pin important messages locally.
5. **Real-time Updates**: The application subscribes to channel messages in real-time using Nostr relays.

### Compliance with NIP-29

Our implementation follows the NIP-29 specification:

- Uses proper format for group identifiers (kind:pubkey:identifier)
- Messages are tagged with the group identifier using 'a' tags
- Messages are properly signed using the user's Nostr key
- Group metadata is parsed from the appropriate events

## Getting Started

To start using the Run Club feature:

1. Navigate to the "RUN CLUB" section in the main menu
2. You'll see two running clubs: "Messi Run Club" and "#RUNSTR"
3. Click on a club to join the chat
4. You'll need a Nostr key to participate (connect in Settings if you haven't already)

### Message Features

- Regular messages appear in chronological order
- Hover over any message to reveal the "Pin" option
- Pinned messages appear at the top of the chat for quick reference

## Future Enhancements

- Ability to share run data directly in the chat
- Integration with Nostr zaps for tipping great running advice
- Group run scheduling and coordination
- Run Club challenges and competitions

## Feedback

This feature is in active development. If you have any feedback or suggestions, please reach out to the RUNSTR team. 