import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom'; // Added useNavigate
import {
  fetchTeamById,
  NostrTeamEvent,
  getTeamName,
  getTeamDescription,
  getTeamCaptain,
  getTeamMembers,
  isTeamPublic,
  getTeamUUID, // Added for completeness, though already in params
  fetchTeamActivityFeed, // Import new function
  NostrWorkoutEvent,      // Import type for workout events
  addMemberToTeamEvent, // Import new function
  removeMemberFromTeamEvent, // Import new function
  KIND_FITNESS_TEAM,
  // New imports for chat and NIP-101e activities
  getTeamChatGroupRef,
  subscribeToTeamChatMessages,
  prepareTeamChatMessage,
  subscribeToTeamActivities,
  prepareTeamActivityEvent,
  TeamActivityDetails, // Interface for activity creation form
  KIND_NIP101_TEAM_EVENT,
  KIND_NIP101_TEAM_CHALLENGE,
  KIND_NIP29_CHAT_MESSAGE, // For typing chat messages
} from '../services/nostr/NostrTeamsService'; // Corrected path
import { useNostr } from '../hooks/useNostr'; // Corrected path
import { NDKEvent, NDKSubscription, NDKKind } from '@nostr-dev-kit/ndk'; // For NDK operations, added NDKSubscription and NDKKind
import { Event as NostrEventBase } from 'nostr-tools'; // For typing Nostr events from subscriptions

// Define a type for the route parameters
interface TeamDetailParams extends Record<string, string | undefined> {
  captainPubkey: string;
  teamUUID: string;
}

// Helper to get a display name for a pubkey (placeholder)
const getPubkeyDisplayName = (pubkey: string) => {
    // const { profile } = useUserProfile(pubkey); // Future: use a hook to get profile
    // return profile?.displayName || profile?.name || `${pubkey.substring(0, 8)}...`;
    return `${pubkey.substring(0, 8)}...${pubkey.substring(pubkey.length - 4)}`;
};

// Helper to get workout title from tags
const getWorkoutTitle = (workoutEvent: NostrWorkoutEvent): string => {
    const titleTag = workoutEvent.tags.find(tag => tag[0] === 'title');
    return titleTag ? titleTag[1] : (workoutEvent.content.substring(0,50) || 'Workout');
};

const TeamDetailPage: React.FC = () => {
  const { captainPubkey, teamUUID } = useParams<TeamDetailParams>();
  const { ndk, ndkReady, publicKey: currentUserPubkey } = useNostr(); // Get NDK from your context
  const navigate = useNavigate(); // For redirecting if team is deleted by captain leaving

  const [team, setTeam] = useState<NostrTeamEvent | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'activities' | 'members' | 'feed'>('chat'); // Changed default tab

  const [teamFeed, setTeamFeed] = useState<NostrWorkoutEvent[]>([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState<boolean>(false);

  // State for adding a new member (captain only)
  const [newMemberPubkey, setNewMemberPubkey] = useState<string>('');
  const [isAddingMember, setIsAddingMember] = useState<boolean>(false);
  const [addMemberError, setAddMemberError] = useState<string | null>(null);

  const [isProcessingMembership, setIsProcessingMembership] = useState<string | null>(null); // Stores pubkey of member being processed or 'self' for leaving
  const [membershipError, setMembershipError] = useState<string | null>(null);

  // State for Chat
  const [chatGroupRef, setChatGroupRef] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<NostrEventBase[]>([]);
  const [newChatMessage, setNewChatMessage] = useState<string>('');
  const [isSendingChatMessage, setIsSendingChatMessage] = useState<boolean>(false);
  const [isLoadingChat, setIsLoadingChat] = useState<boolean>(false);
  const [chatSubscription, setChatSubscription] = useState<NDKSubscription | null>(null);

  // State for NIP-101e Team Activities (Events & Challenges)
  const [teamActivities, setTeamActivities] = useState<NostrEventBase[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState<boolean>(false);
  const [activitiesSubscription, setActivitiesSubscription] = useState<NDKSubscription | null>(null);
  // TODO: Add state for new activity form if implementing inline

  const loadTeamDetails = useCallback(async (forceRefetch = false) => {
    if (!captainPubkey || !teamUUID || !ndkReady || !ndk) return;
    if (!forceRefetch) setIsLoading(true);
    setError(null);
    setMembershipError(null); // Clear errors on load
    try {
      const fetchedTeam = await fetchTeamById(ndk, captainPubkey, teamUUID);
      if (fetchedTeam) {
        setTeam(fetchedTeam);
        // Extract chatGroupRef after team is fetched
        const ref = getTeamChatGroupRef(fetchedTeam);
        setChatGroupRef(ref);
        if (!ref) {
          console.warn("Team does not have a chat_group_ref tag.");
        }
      } else {
        setError('Team not found or failed to load.');
        setTeam(null); // Clear team if not found
        setChatGroupRef(null); // Clear ref if team not found
      }
    } catch (err) {
      console.error("Error fetching team details:", err);
      setError("Failed to load team details. Check console for more info.");
    } finally {
      if (!forceRefetch) setIsLoading(false);
    }
  }, [captainPubkey, teamUUID, ndk, ndkReady]);

  const loadTeamFeed = useCallback(async () => {
    if (!ndk || !ndkReady || !team || !captainPubkey || !teamUUID) return;
    setIsLoadingFeed(true);
    try {
      const feedEvents = await fetchTeamActivityFeed(ndk, captainPubkey, teamUUID, 25); // Fetch 25 items for feed
      setTeamFeed(feedEvents);
    } catch (err) {
      console.error("Error fetching team activity feed:", err);
      // setError("Failed to load team activity feed."); // Optional: Set a specific feed error
    } finally {
      setIsLoadingFeed(false);
    }
  }, [ndk, ndkReady, team, captainPubkey, teamUUID]); // Add team as dependency to refetch if team changes

  useEffect(() => {
    if (captainPubkey && teamUUID && ndkReady && ndk) {
      loadTeamDetails();
    }
  }, [captainPubkey, teamUUID, ndkReady, ndk, loadTeamDetails]);

  useEffect(() => {
    if (activeTab === 'feed' && team) {
      loadTeamFeed();
    }
    // Cleanup subscriptions when tab changes or component unmounts
    // return () => {
    //   if (chatSubscription) chatSubscription.stop();
    //   if (activitiesSubscription) activitiesSubscription.stop();
    // };
  }, [activeTab, team, loadTeamFeed]); // Removed subscriptions from here, handle in specific effect hooks

  // Effect for Chat Subscription
  useEffect(() => {
    if (activeTab === 'chat' && chatGroupRef && ndk && ndkReady) {
      setIsLoadingChat(true);
      setChatMessages([]); // Clear previous messages
      const sub = subscribeToTeamChatMessages(ndk, chatGroupRef, (newEvent) => {
        setChatMessages(prevMessages => {
          // Avoid duplicates and sort by created_at
          if (prevMessages.find(msg => msg.id === newEvent.id)) return prevMessages;
          return [...prevMessages, newEvent].sort((a, b) => a.created_at - b.created_at);
        });
      }, 50); // Load initial 50 messages
      if (sub) {
        setChatSubscription(sub);
        // NDK usually auto-starts, but if not:
        // sub.start(); 
        // console.log("Chat subscription started for:", chatGroupRef);
      }
      setIsLoadingChat(false); // Initial load might be quick, subscription handles ongoing
      return () => {
        if (sub) {
          // console.log("Stopping chat subscription for:", chatGroupRef);
          sub.stop();
        }
        setChatSubscription(null);
      };
    } else {
      if (chatSubscription) {
        // console.log("Stopping chat subscription due to condition change for:", chatGroupRef);
        chatSubscription.stop();
        setChatSubscription(null);
      }
    }
  }, [activeTab, chatGroupRef, ndk, ndkReady]);

  // Effect for Team Activities Subscription
  useEffect(() => {
    if (activeTab === 'activities' && team && ndk && ndkReady) {
      const teamCaptain = getTeamCaptain(team);
      const teamId = getTeamUUID(team);
      if (!teamCaptain || !teamId) return;
      const teamAIdentifier = `${KIND_FITNESS_TEAM}:${teamCaptain}:${teamId}`;

      setIsLoadingActivities(true);
      setTeamActivities([]); // Clear previous activities
      const sub = subscribeToTeamActivities(ndk, teamAIdentifier, (newEvent) => {
        setTeamActivities(prevActivities => {
          if (prevActivities.find(act => act.id === newEvent.id)) return prevActivities;
          return [...prevActivities, newEvent].sort((a, b) => b.created_at - a.created_at); // Newest first
        });
      });
      if (sub) {
        setActivitiesSubscription(sub);
        // sub.start();
        // console.log("Activities subscription started for:", teamAIdentifier);
      }
      setIsLoadingActivities(false);
      return () => {
        if (sub) {
          // console.log("Stopping activities subscription for:", teamAIdentifier);
          sub.stop();
        }
        setActivitiesSubscription(null);
      };
    } else {
      if (activitiesSubscription) {
        // console.log("Stopping activities subscription due to condition change");
        activitiesSubscription.stop();
        setActivitiesSubscription(null);
      }
    }
  }, [activeTab, team, ndk, ndkReady]);

  const handleAddMember = async () => {
    if (!ndk || !currentUserPubkey || !team || !newMemberPubkey.trim()) {
      setAddMemberError("Missing NDK, captain pubkey, team data, or new member pubkey.");
      return;
    }
    if (currentUserPubkey !== getTeamCaptain(team)) {
        setAddMemberError("Only the team captain can add members.");
        return;
    }

    setIsAddingMember(true);
    setAddMemberError(null);

    const updatedEventTemplate = addMemberToTeamEvent(team, newMemberPubkey.trim());

    if (!updatedEventTemplate) {
      setAddMemberError("Failed to prepare updated team event (member might already exist or original event invalid).");
      setIsAddingMember(false);
      return;
    }

    try {
      // The template needs pubkey for NDKEvent constructor if it's to be signed by current user
      const eventToSign = new NDKEvent(ndk, { ...updatedEventTemplate, pubkey: currentUserPubkey });
      await eventToSign.sign(); // Sign with captain's (current user) key
      const publishedRelays = await eventToSign.publish();

      if (publishedRelays.size > 0) {
        console.log("Team updated (member added):");
        setNewMemberPubkey(''); // Clear input
        // Optimistically update UI or refetch team details for consistency
        // Forcing a refetch is simpler for now
        alert('Member added successfully! Team data will refresh.');
        await loadTeamDetails(true); // Force refetch
      } else {
        setAddMemberError("Failed to publish team update. Check relay connections.");
      }
    } catch (err: any) {
      console.error("Error adding member:", err);
      setAddMemberError(err.message || "An unknown error occurred while adding member.");
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberToRemovePk: string) => {
    if (!ndk || !currentUserPubkey || !team ) return;
    if (currentUserPubkey !== getTeamCaptain(team)) {
        setMembershipError("Only the team captain can remove members.");
        return;
    }
    if (memberToRemovePk === currentUserPubkey) {
        setMembershipError("Captain cannot remove themselves. To delete team, (future feature: use delete team option).");
        // Or, if captain leaving means deleting the team (as it's replaceable by d+author):
        // if (window.confirm("Are you sure you want to leave and effectively delete this team? This action might be irreversible if you are the only captain.")) {
        //   // Proceed to delete/invalidate the team event - complex, handle later
        // }
        return;
    }

    setIsProcessingMembership(memberToRemovePk);
    setMembershipError(null);

    const updatedEventTemplate = removeMemberFromTeamEvent(team, memberToRemovePk);
    if (!updatedEventTemplate) {
        setMembershipError("Failed to prepare team update for removing member (member might not exist or event invalid).");
        setIsProcessingMembership(null);
        return;
    }

    try {
        const eventToSign = new NDKEvent(ndk, { ...updatedEventTemplate, pubkey: currentUserPubkey });
        await eventToSign.sign();
        const publishedRelays = await eventToSign.publish();

        if (publishedRelays.size > 0) {
            alert('Member removed successfully! Team data will refresh.');
            await loadTeamDetails(true); // Refresh team details
        } else {
            setMembershipError("Failed to publish team update for removing member.");
        }
    } catch (err: any) {
        setMembershipError(err.message || "Error removing member.");
    } finally {
        setIsProcessingMembership(null);
    }
  };

  const handleLeaveTeam = async () => {
    if (!ndk || !currentUserPubkey || !team) return;
    const teamCaptain = getTeamCaptain(team);

    if (currentUserPubkey === teamCaptain) {
        alert("Captains cannot leave the team using this option. Consider transferring captaincy or deleting the team (future features).");
        // Or if captain leaving implies deleting the team event (since it's replaceable and identified by author+d)
        // if (window.confirm("As the captain, leaving will effectively delete this team event. Are you sure?")) {
        //   // Call a function to publish an empty/archived version of the Kind 33404 event or a Kind 5 deletion event.
        //   // This is complex, for future: for now, captain cannot "leave" via this button.
        //   // For now, we just prevent it.
        //   console.log("Captain tried to leave. Future: Implement team deletion or captain transfer.");
        // }
        return;
    }

    // For non-captains, leaving means the captain needs to remove them.
    // For this phase, we simulate this by directly calling removeMember logic IF the current user is the one leaving
    // In a more robust system, this would be a request to the captain.
    // However, for simplicity, if a user clicks "Leave", and they are NOT captain, we allow them to trigger their own removal event if they could somehow sign it.
    // But NIP-101e is captain-managed. So, this button should ideally just inform them to ask the captain.
    alert(`To leave the team, please ask the captain (${getPubkeyDisplayName(teamCaptain)}) to remove you. (Functionality for captain to remove members will be added).`);
    // If we wanted a user to signal they've left (client-side interpretation):
    // They could publish a Kind 334XX (e.g. Team Left Signal) event tagging the team.
    // Clients would then filter them out from member lists.
  };

  if (isLoading && !team) {
    return <div className="p-4 text-white text-center">Loading team details...</div>;
  }

  if (!ndkReady && !isLoading && !team) {
      return <div className="p-4 text-white text-center">Connecting to Nostr... <br/> If this persists, please check your relay connections.</div>;
  }

  if (error && !team) {
    return <div className="p-4 bg-red-800 text-white rounded-md text-center">Error: {error}</div>;
  }

  if (!team) {
    return <div className="p-4 text-white text-center">Team not found or an error occurred.</div>;
  }

  // Re-extract details from the fetched team event to ensure consistency
  const teamName = getTeamName(team);
  const teamDescription = getTeamDescription(team);
  const actualCaptain = getTeamCaptain(team);
  const members = getTeamMembers(team);
  const teamIsPublic = isTeamPublic(team);
  const confirmedTeamUUID = getTeamUUID(team);

  const isCurrentUserCaptain = currentUserPubkey === actualCaptain;
  const isCurrentUserMember = members.includes(currentUserPubkey || ' ');

  const renderTabs = () => {
    return (
      <div className="mb-4 border-b border-gray-700">
        <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto pb-px" aria-label="Tabs">
          {['chat', 'activities', 'members', 'feed'].map((tabName) => {
            let displayName = tabName;
            if (tabName === 'activities') displayName = 'Team Activities';
            else displayName = tabName.charAt(0).toUpperCase() + tabName.slice(1);

            return (
            <button
              key={tabName}
              onClick={() => setActiveTab(tabName as any)}
              className={`whitespace-nowrap py-3 px-2 sm:py-4 sm:px-3 border-b-2 font-medium text-sm 
                ${activeTab === tabName 
                  ? 'border-blue-500 text-blue-400' 
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'}
                transition-colors duration-150`}
            >
              {displayName}
            </button>
            );
          })}
        </nav>
      </div>
    );
  };

  const handleSendChatMessage = async () => {
    if (!ndk || !ndkReady || !currentUserPubkey || !chatGroupRef || !newChatMessage.trim()) {
      alert("Cannot send message: Missing NDK, user, chat group reference, or message content.");
      return;
    }
    setIsSendingChatMessage(true);
    try {
      const chatMessageTemplate = prepareTeamChatMessage(chatGroupRef, newChatMessage, currentUserPubkey);
      if (!chatMessageTemplate) {
        alert("Failed to prepare chat message.");
        setIsSendingChatMessage(false);
        return;
      }
      const ndkChatMessage = new NDKEvent(ndk, chatMessageTemplate);
      await ndkChatMessage.sign();
      const publishedRelays = await ndkChatMessage.publish();
      if (publishedRelays.size > 0) {
        setNewChatMessage(''); // Clear input on success
        // Message will appear via subscription
      } else {
        alert("Failed to send chat message to any relays.");
      }
    } catch (err: any) {
      console.error("Error sending chat message:", err);
      alert(`Error sending message: ${err.message}`);
    } finally {
      setIsSendingChatMessage(false);
    }
  };

  // TODO: Implement handleCreateTeamActivity function
  const handleCreateTeamActivity = async (activityDetails: TeamActivityDetails) => {
    if (!ndk || !ndkReady || !currentUserPubkey || !team) {
        alert("Cannot create activity: Missing NDK, user, or team data.");
        return;
    }
    const teamCaptain = getTeamCaptain(team);
    const teamId = getTeamUUID(team);
    if (!teamCaptain || !teamId) {
        alert("Team captain or ID missing.");
        return;
    }
    const teamAIdentifier = `${KIND_FITNESS_TEAM}:${teamCaptain}:${teamId}`;

    // Add loading state for activity creation if needed
    console.log("Creating team activity:", activityDetails, "for team:", teamAIdentifier);
    const activityTemplate = prepareTeamActivityEvent(teamAIdentifier, activityDetails, currentUserPubkey);
    if (!activityTemplate) {
        alert("Failed to prepare team activity event.");
        return;
    }
    try {
        const ndkActivityEvent = new NDKEvent(ndk, activityTemplate);
        await ndkActivityEvent.sign();
        const publishedRelays = await ndkActivityEvent.publish();
        if (publishedRelays.size > 0) {
            alert("Team activity created successfully!");
            // Activity will appear via subscription. Optionally clear form.
        } else {
            alert("Failed to publish team activity to any relays.");
        }
    } catch (err: any) {
        console.error("Error creating team activity:", err);
        alert(`Error creating activity: ${err.message}`);
    }
  };

  const renderChatTabContent = () => {
    if (isLoadingChat && chatMessages.length === 0) return <div className="text-gray-400 p-4 text-center">Loading chat...</div>;
    if (!chatGroupRef) return <div className="text-gray-400 p-4 bg-gray-750 rounded-md">Chat is not available for this team (missing chat_group_ref).</div>;
    
    return (
      <div className="flex flex-col h-[500px]"> {/* Example fixed height for chat area */}
        <div className="flex-grow overflow-y-auto p-4 space-y-3 bg-gray-800 rounded-t-md">
          {chatMessages.length === 0 && <p className="text-gray-400 text-center">No messages yet. Start the conversation!</p>}
          {chatMessages.map(msg => (
            <div key={msg.id} className={`flex ${msg.pubkey === currentUserPubkey ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`p-3 rounded-lg max-w-xs lg:max-w-md break-words 
                  ${msg.pubkey === currentUserPubkey 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 text-gray-200'}`}
              >
                <p className="text-xs font-semibold mb-0.5">
                  {getPubkeyDisplayName(msg.pubkey)}
                  {msg.pubkey === getTeamCaptain(team || {} as NostrTeamEvent) && <span className="text-yellow-300 text-xs ml-1">(C)</span>} 
                </p>
                <p className="text-sm">{msg.content}</p>
                <p className="text-xxs text-gray-400 mt-1 text-right opacity-75">
                  {new Date(msg.created_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-gray-700 bg-gray-800 rounded-b-md">
          <div className="flex items-center space-x-2">
            <input 
              type="text"
              value={newChatMessage}
              onChange={(e) => setNewChatMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !isSendingChatMessage && handleSendChatMessage()}
              placeholder="Type your message..."
              className="flex-grow p-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500"
              disabled={isSendingChatMessage}
            />
            <button 
              onClick={handleSendChatMessage}
              disabled={isSendingChatMessage || !newChatMessage.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md disabled:opacity-50 transition-colors"
            >
              {isSendingChatMessage ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderActivitiesTabContent = () => {
    // Basic placeholder for now - a real implementation would have a form to create new activities
    // and a list to display them, distinguishing events/challenges.
    if (isLoadingActivities && teamActivities.length === 0) return <div className="text-gray-400 p-4 text-center">Loading team activities...</div>;
    
    // Example form for creating a new activity (can be moved to a separate component)
    const ActivityCreationForm = () => {
        const [type, setType] = useState<'event' | 'challenge'>('event');
        const [name, setName] = useState('');
        const [description, setDescription] = useState('');
        const [startTime, setStartTime] = useState('');
        const [location, setLocation] = useState(''); // For events
        const [rules, setRules] = useState('');     // For challenges

        const submitActivity = (e: React.FormEvent) => {
            e.preventDefault();
            const details: TeamActivityDetails = {
                type,
                name,
                description,
                startTime: startTime ? Math.floor(new Date(startTime).getTime() / 1000) : undefined,
                location: type === 'event' ? location : undefined,
                rules: type === 'challenge' ? rules : undefined,
            };
            handleCreateTeamActivity(details);
            // Clear form optionally
            setName(''); setDescription(''); setStartTime(''); setLocation(''); setRules('');
        };

        return (
            <form onSubmit={submitActivity} className="p-4 bg-gray-750 rounded-lg mb-6 space-y-3">
                <h4 className="text-lg font-semibold text-gray-100">Create New Team Activity</h4>
                <div>
                    <label className="block text-sm font-medium text-gray-300">Type</label>
                    <select value={type} onChange={e => setType(e.target.value as any)} className="mt-1 block w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white">
                        <option value="event">Event (e.g., Group Run)</option>
                        <option value="challenge">Challenge (e.g., Monthly Mileage)</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300">Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300">Description</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} required rows={3} className="mt-1 block w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white"></textarea>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300">Start Time (Optional)</label>
                    <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} className="mt-1 block w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white" />
                </div>
                {type === 'event' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-300">Location (for Event)</label>
                        <input type="text" value={location} onChange={e => setLocation(e.target.value)} className="mt-1 block w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white" />
                    </div>
                )}
                {type === 'challenge' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-300">Rules (for Challenge)</label>
                        <textarea value={rules} onChange={e => setRules(e.target.value)} rows={2} className="mt-1 block w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white"></textarea>
                    </div>
                )}
                <button type="submit" className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md">Create Activity</button>
            </form>
        );
    };

    return (
        <div>
            <ActivityCreationForm />
            <h3 className="text-xl font-semibold mb-3 text-gray-100">Scheduled Activities & Challenges</h3>
            {teamActivities.length === 0 && <p className="text-gray-400 p-4 bg-gray-750 rounded-md">No activities scheduled for this team yet.</p>}
            <div className="space-y-4">
                {teamActivities.map(act => {
                    const actName = act.tags.find(t => t[0] === 'name')?.[1] || 'Unnamed Activity';
                    const actDesc = act.tags.find(t => t[0] === 'description')?.[1] || act.content || 'No description.';
                    const actStart = act.tags.find(t => t[0] === 'start')?.[1];
                    const actLocation = act.tags.find(t => t[0] === 'location')?.[1];
                    const isChallenge = act.kind === KIND_NIP101_TEAM_CHALLENGE;

                    return (
                        <div key={act.id} className="p-4 bg-gray-750 rounded-lg shadow">
                            <div className="flex justify-between items-start">
                                <h4 className="text-lg font-semibold text-blue-300 mb-1">{actName} <span className="text-xs font-normal text-gray-400">({isChallenge ? 'Challenge' : 'Event'})</span></h4>
                                <p className="text-xs text-gray-500">By: {getPubkeyDisplayName(act.pubkey)}</p>
                            </div>
                            <p className="text-sm text-gray-300 whitespace-pre-wrap mb-2">{actDesc}</p>
                            {actStart && <p className="text-xs text-gray-400">Start: {new Date(parseInt(actStart) * 1000).toLocaleString()}</p>}
                            {actLocation && <p className="text-xs text-gray-400">Location: {actLocation}</p>}
                            {/* TODO: Display more details like rules for challenges, end time etc. */}
                        </div>
                    );
                })}
            </div>
        </div>
    );
  };

  const renderCurrentTabContent = () => {
    switch (activeTab) {
      case 'chat':
        return renderChatTabContent();
      case 'activities':
        return renderActivitiesTabContent(); // Replaces old 'events' and 'challenges' placeholders
      case 'members':
        return (
          <div>
            <h3 className="text-xl font-semibold mb-3 text-gray-100">Members ({members.length})</h3>
            
            {isCurrentUserCaptain && (
              <div className="my-4 p-3 bg-gray-750 border border-gray-700 rounded-md">
                <h4 className="text-md font-semibold text-gray-200 mb-2">Add New Member (Captain Only)</h4>
                <div className="flex items-center space-x-2">
                  <input 
                    type="text"
                    value={newMemberPubkey}
                    onChange={(e) => setNewMemberPubkey(e.target.value)}
                    placeholder="Enter new member npub or hex pubkey"
                    className="flex-grow p-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button 
                    onClick={handleAddMember}
                    disabled={isAddingMember || !newMemberPubkey.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isAddingMember ? 'Adding...' : 'Add Member'}
                  </button>
                </div>
                {addMemberError && <p className="text-red-400 text-xs mt-2">{addMemberError}</p>}
              </div>
            )}

            {membershipError && <p className="text-red-400 text-sm my-3 p-2 bg-red-900/30 rounded-md">Error: {membershipError}</p>}

            {members.length > 0 ? (
              <ul className="space-y-2">
                {members.map((memberPubkey, index) => (
                  <li key={index} className="flex items-center justify-between text-gray-300 bg-gray-750 p-2 rounded-md font-mono text-xs">
                    <span className="truncate hover:text-clip">
                        {getPubkeyDisplayName(memberPubkey)}
                        {memberPubkey === actualCaptain && <span className="ml-2 text-xs text-yellow-400">(Captain)</span>}
                        {memberPubkey === currentUserPubkey && !isCurrentUserCaptain && <span className="ml-2 text-xs text-green-400">(You)</span>}
                    </span>
                    {isCurrentUserCaptain && memberPubkey !== currentUserPubkey && (
                        <button 
                            onClick={() => handleRemoveMember(memberPubkey)}
                            disabled={isProcessingMembership === memberPubkey}
                            className="ml-3 px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50"
                        >
                            {isProcessingMembership === memberPubkey ? 'Removing...' : 'Remove'}
                        </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400">This team has no members yet.</p>
            )}
            {!isCurrentUserCaptain && isCurrentUserMember && (
                <button 
                    onClick={handleLeaveTeam}
                    disabled={isProcessingMembership === 'self'} // Example, if we had direct leave
                    className="mt-4 px-4 py-2 text-sm bg-yellow-600 hover:bg-yellow-700 text-white rounded disabled:opacity-50"
                >
                   {isProcessingMembership === 'self' ? 'Processing...' : 'Request to Leave Team'} 
                </button>
            )}
          </div>
        );
      case 'feed':
        if (isLoadingFeed) return <div className="text-gray-400 p-4 text-center">Loading team feed...</div>;
        if (teamFeed.length === 0) return <div className="text-gray-400 p-4 bg-gray-750 rounded-md">No activity in this team's feed yet.</div>;
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold mb-3 text-gray-100">Team Activity Feed</h3>
            {teamFeed.map(workoutEvent => (
              <div key={workoutEvent.id} className="p-4 bg-gray-750 rounded-lg shadow">
                <p className="text-xs text-gray-400 mb-1">
                  <strong>{getPubkeyDisplayName(workoutEvent.pubkey)}</strong> 
                  <span className="mx-1">|</span>
                  {new Date(workoutEvent.created_at * 1000).toLocaleDateString()} {new Date(workoutEvent.created_at * 1000).toLocaleTimeString()}
                </p>
                <h4 className="text-md font-semibold text-blue-300 mb-1">{getWorkoutTitle(workoutEvent)}</h4>
                {workoutEvent.content && workoutEvent.content !== getWorkoutTitle(workoutEvent) &&
                    <p className="text-sm text-gray-300 whitespace-pre-wrap">{workoutEvent.content}</p>
                }
                {/* TODO: Display more workout details from tags if needed */}
              </div>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  const renderJoinButton = () => {
      if (!team || !currentUserPubkey) return null;
      if (isCurrentUserCaptain || isCurrentUserMember) return null; // Already in team or is captain
      if (!teamIsPublic) return <p className="text-sm text-gray-400 mt-4">This is a private team. Contact the captain to join.</p>; // Private team

      // For public teams, non-members see a join request button
      // TODO: Implement actual join request logic (e.g., DM to captain, or specific event kind)
      return (
          <button 
            // onClick={handleRequestToJoin} // Future implementation
            onClick={() => alert(`To join, please contact the captain: ${getPubkeyDisplayName(actualCaptain)} (npub... or hex)`)}
            className="mt-4 w-full sm:w-auto px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md transition-colors"
            title={`Captain: ${actualCaptain}`}
          >
            Request to Join Team
          </button>
      );
  }

  return (
    <div className="p-4 max-w-3xl mx-auto text-white">
      <div className="mb-6 pb-4 border-b border-gray-700">
        <h1 className="text-3xl font-bold mb-1 text-blue-300">{teamName}</h1>
        <p className="text-gray-300 mb-3 leading-relaxed">{teamDescription}</p>
        <div className="text-xs text-gray-500 space-y-0.5">
            <p>Captain: <span className="font-mono text-gray-400">{getPubkeyDisplayName(actualCaptain)}</span></p>
            <p>Team ID: <span className="font-mono text-gray-400">{confirmedTeamUUID || teamUUID}</span></p>
            <p>Visibility: <span className={teamIsPublic ? "text-green-400" : "text-red-400"}>{teamIsPublic ? 'Public' : 'Private'}</span></p>
        </div>
        {renderJoinButton()} 
      </div>

      {renderTabs()}
      <div className="mt-4">
        {renderCurrentTabContent()}
      </div>

      <div className="mt-8 pt-4 border-t border-gray-700 text-center">
        <Link to="/teams" className="text-blue-400 hover:text-blue-300 transition-colors duration-150">
          &larr; Back to Teams List
        </Link>
      </div>
    </div>
  );
};

export default TeamDetailPage; 