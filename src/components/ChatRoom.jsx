import { useState, useEffect, useRef, useContext } from 'react';
import PropTypes from 'prop-types';
import { NostrContext, ndkReadyPromise } from '../contexts/NostrContext.jsx';
import {
  fetchGroupMessages,
  subscribeToGroupMessages,
  sendGroupMessage,
} from '../utils/ndkGroups.js';
import { ensureRelays } from '../utils/relays.js';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { ndk } from '../contexts/NostrContext.jsx'; // Import ndk for NDKEvent instantiation
import { useProfileCache } from '../hooks/useProfileCache.js'; // Import the new hook

/**
 * ChatRoom – standalone component responsible for displaying and sending
 * NIP-29 chat messages for a given groupId (the `d` tag identifier).
 *
 * While NDK is still initialising or relays are not connected the component
 * shows an inline "Connecting …" notice but the surrounding UI remains
 * visible so navigation feels instant.
 */
export const ChatRoom = ({ groupId, naddrString, publicKey, relayHints: passedRelayHints }) => {
  console.log(`ChatRoom: Render (Phase 4). GroupId: ${groupId}, Naddr: ${naddrString ? naddrString.substring(0,15) : 'none'}, PassedRelayHints:`, passedRelayHints);
  // Use new context values. 'ndk' instance is not directly used here anymore.
  const { ndkReady, relayCount, ndkError: ndkInitError } = useContext(NostrContext);
  const { fetchProfiles } = useProfileCache(); // Use the new hook

  const [messages, setMessages] = useState([]);
  const [messageAuthorProfiles, setMessageAuthorProfiles] = useState(new Map());
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingChat, setIsLoadingChat] = useState(true); // Renamed from isLoadingInitialMessages
  const [error, setError] = useState(null);

  const chatEndRef = useRef(null);
  const subscriptionRef = useRef(null);

  // PHASE 7: Load messages from localStorage on initial mount or when groupId changes
  useEffect(() => {
    if (groupId) {
      // console.log(`[ChatRoom] Attempting to load messages from localStorage for groupId: ${groupId}`);
      const cacheKey = `chatMessages_${groupId}`;
      const storedMessagesJson = localStorage.getItem(cacheKey);
      if (storedMessagesJson) {
        try {
          const rawEvents = JSON.parse(storedMessagesJson);
          if (Array.isArray(rawEvents) && rawEvents.length > 0) {
            const ndkMessages = rawEvents.map(rawEv => {
              // Ensure we have NDKEvent instances as the component expects
              if (rawEv instanceof NDKEvent) return rawEv;
              const ndkEventInstance = new NDKEvent(ndk); // Use imported ndk
              Object.assign(ndkEventInstance, rawEv); // Copy properties
              // Ensure essential properties like id, sig are there if NDKEvent constructor doesn't auto-map them from rawEv
              ndkEventInstance.id = rawEv.id;
              ndkEventInstance.sig = rawEv.sig; 
              // Other NDKEvent specific initializations if needed based on rawEv structure
              return ndkEventInstance;
            });
            // console.log(`[ChatRoom] Loaded ${ndkMessages.length} messages from localStorage.`);
            setMessages(ndkMessages.sort((a, b) => a.created_at - b.created_at)); // Sort oldest first
            setIsLoadingChat(false); // Show cached messages immediately
          }
        } catch (e) {
          console.warn(`[ChatRoom] Failed to parse stored messages for groupId ${groupId}:`, e);
          localStorage.removeItem(cacheKey); // Clear corrupted cache
        }
      }
    }
  }, [groupId]); // Only re-run if groupId changes

  // Load initial messages and subscribe - REFACTORED FOR PHASE 5
  useEffect(() => {
    if (!groupId) {
      console.log("ChatRoom: useEffect - no groupId, cannot load/subscribe.");
      setIsLoadingChat(false);
      setMessages([]);
      setError(null);
      return;
    }

    console.log(`ChatRoom: useEffect - GroupId: ${groupId}, NDKReady: ${ndkReady}, RelayCount: ${relayCount}, RelayHints: ${JSON.stringify(passedRelayHints)}`);
    
    let isActive = true;
    setIsLoadingChat(true);
    setError(null);

    const loadAndSubscribe = async () => {
      if (!isActive) return;

      try {
        console.log(`[ChatRoom] Phase 1 (useEffect): Ensuring relays for group ${groupId}:`, passedRelayHints);
        await ensureRelays(passedRelayHints || []); 
        
        // Optional brief pause might still be useful after adding relays
        await new Promise(resolve => setTimeout(resolve, 100)); 
        if (!isActive) return;

        // console.log(`[ChatRoom] Phase 2 (useEffect): Fetching initial messages for group ${groupId}`);
        console.log(`ChatRoom: Fetching initial messages for group ${groupId}`);
        const initialMessages = await fetchGroupMessages(groupId, { relays: passedRelayHints || [], limit: 50 });
        if (!isActive) return;

        console.log(`ChatRoom: Fetched ${initialMessages.length} initial messages.`);
        // Merge with existing (possibly from cache) and sort, ensuring NDKEvent instances
        setMessages(prevMessages => {
          const messageMap = new Map();
          // Add existing messages (ensuring they are NDKEvent instances or converted)
          prevMessages.forEach(msg => {
            const key = msg.id || msg.tempId; // Ensure key exists
            if (key) messageMap.set(key, msg instanceof NDKEvent ? msg : new NDKEvent(ndk, msg));
          });
          // Add new/fetched messages (fetchGroupMessages returns NDKEvent instances)
          initialMessages.forEach(msg => {
            const key = msg.id || msg.tempId;
            if (key) messageMap.set(key, msg);
          });
          return Array.from(messageMap.values()).sort((a, b) => a.created_at - b.created_at); // Sort oldest first
        });
        setIsLoadingChat(false);

        let subSinceTimestamp = Math.floor(Date.now() / 1000) - 3600; // Default: last hour
        if (messages.length > 0 && messages[messages.length - 1]?.created_at) { // Check last message for oldest first
             // messages[messages.length - 1] is the newest due to sorting
            subSinceTimestamp = messages[messages.length - 1].created_at; 
        }
        
        const sub = await subscribeToGroupMessages(
          groupId,
          (newEvent) => {
            if (!isActive) return;
            setMessages(prevMessages => {
              if (prevMessages.some((m) => m.id === newEvent.id)) return prevMessages;
              // Add new event and re-sort
              return [...prevMessages, newEvent].sort((a, b) => a.created_at - b.created_at); // Sort oldest first
            });
          },
          { relays: passedRelayHints || [], since: subSinceTimestamp }
        );
        
        if (isActive) {
            subscriptionRef.current = sub;
        }

      } catch (err) {
        if (!isActive) return;
        console.error(`ChatRoom: Error loading messages or subscribing for group ${groupId}:`, err);
        setError(err.message || 'Failed to load chat.');
        setIsLoadingChat(false);
      }
    };

    loadAndSubscribe();

    return () => {
      isActive = false;
      console.log(`ChatRoom: Cleaning up subscription for group ${groupId}`);
      if (subscriptionRef.current && typeof subscriptionRef.current.unsub === 'function') {
        subscriptionRef.current.unsub();
      }
      subscriptionRef.current = null;
    };
  }, [groupId, JSON.stringify(passedRelayHints)]); 

  // PHASE 7: Save messages to localStorage when they change
  useEffect(() => {
    if (groupId && messages.length > 0) {
      // console.log(`[ChatRoom] Saving ${messages.length} messages to localStorage for groupId: ${groupId}`);
      const cacheKey = `chatMessages_${groupId}`;
      try {
        // Store only raw event data to keep localStorage clean and avoid circular refs
        const rawEventsToStore = messages.slice(0, 50).map(msg => {
            return msg instanceof NDKEvent ? msg.rawEvent() : msg; // Assumes msg might already be raw if from a failed NDKEvent creation
        });
        localStorage.setItem(cacheKey, JSON.stringify(rawEventsToStore));
      } catch (e) {
        console.error(`[ChatRoom] Failed to save messages to localStorage for groupId ${groupId}:`, e);
      }
    }
  }, [messages, groupId]); // Re-run if messages or groupId change

  // Effect to fetch author profiles for messages
  useEffect(() => {
    // Define an async function inside the effect to use await
    const fetchAndSetProfiles = async () => {
        console.log('[ChatRoom] Profile fetch effect triggered. Checking NDK readiness via promise...');
        
        // Wait for NDK initialization (including signer) to complete
        const isNdkActuallyReady = await ndkReadyPromise;
        console.log(`[ChatRoom] ndkReadyPromise resolved with: ${isNdkActuallyReady}`);

        // === GUARD CLAUSE ===
        // Only proceed if NDK is ready AND there are messages
        if (!isNdkActuallyReady || messages.length === 0) {
          console.log(`[ChatRoom] Skipping profile fetch. NDK Ready (from promise): ${isNdkActuallyReady}, Messages Count: ${messages.length}`);
          return;
        }
        // ====================

        const pubkeysToProcess = Array.from(
          new Set(messages.map(msg => {
            // Handle both NDKEvent and raw event structures for pubkey
            return msg instanceof NDKEvent ? msg.pubkey : msg.pubkey;
          }))
        ).filter(pubkey => pubkey && !messageAuthorProfiles.has(pubkey)); // Only fetch if not already in local state

        if (pubkeysToProcess.length === 0) {
          // console.log('[ChatRoom] No new profiles to fetch based on local state.');
          return;
        }

        console.log('[ChatRoom] Requesting profiles for pubkeys from useProfileCache:', pubkeysToProcess);

        try {
          const fetchedProfileData = await fetchProfiles(pubkeysToProcess);
          console.log('[ChatRoom] Received profiles from useProfileCache:', fetchedProfileData);

          if (fetchedProfileData.size > 0) {
            setMessageAuthorProfiles(prevProfiles => {
              const newProfiles = new Map(prevProfiles);
              let profilesActuallyAddedOrUpdated = false;
              fetchedProfileData.forEach((profile, pubkey) => {
                // Update if new or if content differs (though useProfileCache aims to return consistent objects)
                if (!newProfiles.has(pubkey) || JSON.stringify(newProfiles.get(pubkey)) !== JSON.stringify(profile)) {
                  newProfiles.set(pubkey, profile);
                  profilesActuallyAddedOrUpdated = true;
                }
              });

              if (profilesActuallyAddedOrUpdated) {
                console.log('[ChatRoom] Updating local messageAuthorProfiles state.');
                return newProfiles;
              }
              return prevProfiles; 
            });
          }
        } catch (err) {
          console.error("[ChatRoom] Error calling fetchProfiles from useProfileCache:", err);
        }
    }; // End of updateAuthorProfiles

    // Call the inner async function
    fetchAndSetProfiles();

    // Dependencies: messages (to get new pubkeys), fetchProfiles (stable from hook)
    // ndkReady removed because we now await the promise inside.
  }, [messages, fetchProfiles]); 

  useEffect(() => {
    if (naddrString) loadPinnedMessages();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [naddrString]); // Reload pinned if naddr changes

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); // Enabled for oldest-first display
  }, [messages]);

  const storageKey = naddrString ? `pinnedMessages_${naddrString}` : null;
  const loadPinnedMessages = () => {
    if (!storageKey) return;
    const json = localStorage.getItem(storageKey);
    setPinnedMessages(json ? JSON.parse(json) : []);
  };
  const pinMessage = (evt) => {
    if (!storageKey) return;
    const raw = evt instanceof NDKEvent ? evt.rawEvent() : evt;
    if (pinnedMessages.some((p) => p.id === raw.id)) return;
    const updated = [...pinnedMessages, raw];
    setPinnedMessages(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };
  const unpinMessage = (id) => {
    if (!storageKey) return;
    const updated = pinnedMessages.filter((p) => p.id !== id);
    setPinnedMessages(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };
  const togglePinMessage = (raw) => {
    if (pinnedMessages.some((p) => p.id === raw.id)) unpinMessage(raw.id);
    else pinMessage(raw);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!publicKey) { setError('Connect your Nostr key to send messages'); return; }
    if (!groupId) { setError('Group ID not available to send message.'); return; }
    if (!messageText.trim()) return;
    setIsSending(true); setError(null);
    try {
      // Pass relayHints to sendGroupMessage if it supports it, or ensure relays are active via ensureRelays
      await ensureRelays(passedRelayHints); // Ensure relays are active before sending
      const sentEvent = await sendGroupMessage(groupId, messageText.trim());
      if (sentEvent) {
        setMessageText('');
        // Optionally, add the sent message to state optimistically if not handled by subscription quickly enough
      } else {
        throw new Error('Failed to send message event.');
      }
    } catch (err) {
      console.error('ChatRoom: error sending message', err);
      setError(err.message || 'Failed to send');
    } finally {
      setIsSending(false);
    }
  };

  const formatTs = (ts) => new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (ndkInitError) return <p className="error-message">Error initializing Nostr: {ndkInitError}</p>;
  
  const showConnectingMessage = isLoadingChat || (ndkReady === false && messages.length === 0 && !error && !ndkInitError);

  return (
    <div 
      className="chat-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100% - 40px)', // Example: Adjust as needed, assuming some padding/margin from parent
        maxHeight: '70vh', // Example: Or a max height
        border: '1px solid #444', // Added for visibility during debug
        padding: '10px',
        boxSizing: 'border-box'
      }}
    >
      {error && <p className="error-message">Chat Error: {error}</p>}
      
      {ndkInitError && !error && <p className="error-message">Nostr Connection Error: {ndkInitError}</p>}
      
      {isLoadingChat && <p className="info-message">Loading messages...</p>}
      
      {!isLoadingChat && showConnectingMessage && messages.length === 0 && 
        <p className="info-message">Connecting to Nostr network for chat... (NDK Ready: {String(ndkReady)}, Relays: {relayCount})</p>
      }
      
      {!isLoadingChat && !showConnectingMessage && messages.length === 0 && !error && !ndkInitError &&
        <p>No messages yet. Start the conversation!</p>
      }

      <div 
        className="message-list"
        style={{
          flexGrow: 1, 
          overflowY: 'auto', 
          marginBottom: '10px',
          paddingRight: '5px' // For scrollbar visibility
        }}
      >
        {messages.map((evt) => {
          // Ensure evt is an NDKEvent instance or has a rawEvent method
          const raw = evt instanceof NDKEvent ? evt.rawEvent() : (evt.rawEvent ? evt.rawEvent() : evt);
          
          // Fallback if raw or raw.pubkey is somehow undefined
          if (!raw || !raw.pubkey) {
            console.warn("Message object or pubkey is undefined, skipping rendering:", evt);
            return null; 
          }

          const authorProfile = messageAuthorProfiles.get(raw.pubkey);
          const displayName = authorProfile?.name || `${raw.pubkey.substring(0, 8)}…`;
          const avatarUrl = authorProfile?.picture;
          
          return (
            <div key={raw.id || JSON.stringify(raw)} className="message-item"> {/* Added fallback key for safety */}
              {avatarUrl && (
                <img
                  src={avatarUrl}
                  alt={`${displayName}'s avatar`}
                  className="message-avatar"
                  onError={(e) => { e.target.style.display = 'none'; }} // Hide if error, or use default: e.target.src = '/default-avatar.svg';
                  loading="lazy"
                  width="40"
                  height="40"
                  style={{ borderRadius: '50%', marginRight: '10px', flexShrink: 0 }}
                />
              )}
              <div className="message-main-area">
                <p><strong>{displayName}:</strong> {raw.content}</p>
                <span className="timestamp">{formatTs(raw.created_at)}</span>
              </div>
              <button className="pin-button" onClick={() => togglePinMessage(raw)}>
                {pinnedMessages.some((p) => p.id === raw.id) ? 'Unpin' : 'Pin'}
              </button>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      {publicKey ? (
        <form 
          onSubmit={handleSend} 
          className="message-input-form"
          style={{ display: 'flex', marginTop: 'auto' }} // Ensure it's at the bottom
        >
          <input 
            type="text" 
            value={messageText} 
            onChange={(e) => setMessageText(e.target.value)} 
            placeholder="Type your message…" 
            disabled={isSending || !groupId} 
            style={{ flexGrow: 1, marginRight: '5px' }}
          />
          <button type="submit" disabled={isSending || !groupId}>
            {isSending ? 'Sending…' : 'Send'}
          </button>
        </form>
      ) : (
        <p className="info-message">Connect your Nostr key to send messages.</p>
      )}
    </div>
  );
};

ChatRoom.propTypes = {
  groupId: PropTypes.string.isRequired,
  naddrString: PropTypes.string, // naddr for pinning context
  publicKey: PropTypes.string,   // Logged-in user's public key
  passedRelayHints: PropTypes.arrayOf(PropTypes.string) // Relay hints passed from parent
};

export default ChatRoom; 