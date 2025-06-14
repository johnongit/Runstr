import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  fetchTeamById,
  NostrTeamEvent,
  getTeamName,
  getTeamDescription,
  getTeamCaptain,
  getTeamMembers,
  isTeamPublic,
  getTeamUUID,
  fetchTeamActivityFeed,
  NostrWorkoutEvent,
  addMemberToTeamEvent,
  removeMemberFromTeamEvent,
  KIND_FITNESS_TEAM,
  subscribeToTeamChatMessages,
  prepareTeamChatMessage,
  subscribeToTeamActivities,
  prepareTeamActivityEvent,
  TeamActivityDetails, 
  KIND_NIP101_TEAM_EVENT,
  KIND_NIP101_TEAM_CHALLENGE,
  KIND_NIP101_TEAM_CHAT_MESSAGE,
  prepareTeamMembershipEvent,
  fetchTeamMemberships,
  KIND_TEAM_MEMBERSHIP,
  subscribeToTeamChallenges,
} from '../services/nostr/NostrTeamsService';
import { useNostr } from '../hooks/useNostr';
import { NDKEvent, NDKSubscription, NDKKind } from '@nostr-dev-kit/ndk';
import { Event as NostrEventBase } from 'nostr-tools';
import { createAndPublishEvent } from '../utils/nostr';
import { useAuth } from '../hooks/useAuth';
import LocalTeamChat from '../components/teams/LocalTeamChat';
import TeamChallengesTab from '../components/teams/TeamChallengesTab';
import { DisplayName } from '../components/shared/DisplayName';
import { useTeamRoles } from '../hooks/useTeamRoles';
import toast from 'react-hot-toast';
import ManageTeamModal from '../components/teams/ManageTeamModal';
import LeaderboardTab from '../components/teams/LeaderboardTab';
import TeamStatsWidget from '../components/teams/TeamStatsWidget';
import { useTeamActivity } from '../hooks/useTeamActivity';
import { setDefaultPostingTeamIdentifier } from '../utils/settingsManager';

// Define a type for the route parameters
interface TeamDetailParams extends Record<string, string | undefined> {
  captainPubkey: string;
  teamUUID: string;
}

// Helper to get a display name for a pubkey (placeholder)
const getPubkeyDisplayName = (pubkey: string) => {
    return `${pubkey.substring(0, 8)}...${pubkey.substring(pubkey.length - 4)}`;
};

// Helper to get workout title from tags
const getWorkoutTitle = (workoutEvent: NostrWorkoutEvent): string => {
    const titleTag = workoutEvent.tags.find(tag => tag[0] === 'title');
    return titleTag ? titleTag[1] : (workoutEvent.content.substring(0,50) || 'Workout');
};

const TeamDetailPage: React.FC = () => {
  const { captainPubkey, teamUUID } = useParams<TeamDetailParams>();
  const location = useLocation();
  const seededEvent = (location.state as any)?.teamEvent ?? null;
  const { ndk, ndkReady, publicKey: currentUserPubkey, canReadData, connectSigner } = useNostr();
  const { wallet } = useAuth();
  const navigate = useNavigate();

  const [team, setTeam] = useState<NostrTeamEvent | null>(seededEvent);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'challenges' | 'members' | 'leaderboard'>('chat');

  const [teamFeed, setTeamFeed] = useState<NostrWorkoutEvent[]>([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState<boolean>(false);

  // State for adding a new member (captain only)
  const [newMemberPubkey, setNewMemberPubkey] = useState<string>('');
  const [isAddingMember, setIsAddingMember] = useState<boolean>(false);
  const [addMemberError, setAddMemberError] = useState<string | null>(null);

  // State for Chat
  const [teamAIdentifierForChat, setTeamAIdentifierForChat] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<NostrEventBase[]>([]);
  const [newChatMessage, setNewChatMessage] = useState<string>('');
  const [isSendingChatMessage, setIsSendingChatMessage] = useState<boolean>(false);
  const [isLoadingChat, setIsLoadingChat] = useState<boolean>(false);
  const [chatSubscription, setChatSubscription] = useState<NDKSubscription | null>(null);

  // State for NIP-101e Team Activities (Events & Challenges)
  const [teamChallenges, setTeamChallenges] = useState<NostrEventBase[]>([]);
  const [isLoadingChallenges, setIsLoadingChallenges] = useState<boolean>(false);
  const [challengesSubscription, setChallengesSubscription] = useState<NDKSubscription | null>(null);
  
  const [challengeForm, setChallengeForm] = useState<{name:string;description:string;goalValue:number;goalUnit:'km'|'mi';startTimeString?:string;endTimeString?:string}>({
    name:'',description:'',goalValue:0,goalUnit:'km',startTimeString:'',endTimeString:''});
  const [isCreatingChallenge, setIsCreatingChallenge] = useState(false);

  const [isProcessingMembership, setIsProcessingMembership] = useState<string | null>(null);

  const [monthlyWorkouts, setMonthlyWorkouts] = useState<NostrWorkoutEvent[]>([]);
  const [isLoadingMonthlyWorkouts, setIsLoadingMonthlyWorkouts] = useState(false);

  const [showManageTeamModal, setShowManageTeamModal] = useState<boolean>(false);

  const loadTeamDetails = useCallback(async (forceRefetch = false) => {
    // Option A: Use canReadData for data fetching operations
    if (!captainPubkey || !teamUUID || !canReadData || !ndk) return;
    if (!forceRefetch) setIsLoading(true);
    setError(null);
    try {
      const fetchedTeam = await fetchTeamById(ndk, captainPubkey, teamUUID);
      if (fetchedTeam) {
        setTeam(fetchedTeam);
        // Set the NIP-101e team's 'a' identifier for chat and activities
        const teamId = getTeamUUID(fetchedTeam);
        const capt = getTeamCaptain(fetchedTeam);
        if (teamId && capt) {
          setTeamAIdentifierForChat(`${KIND_FITNESS_TEAM}:${capt}:${teamId}`);
        }
      } else {
        setError('Team not found or failed to load.');
        setTeam(null);
        setTeamAIdentifierForChat(null);
      }
    } catch (err) {
      console.error("Error fetching team details:", err);
      setError("Failed to load team details. Check console for more info.");
    } finally {
      if (!forceRefetch) setIsLoading(false);
    }
  }, [captainPubkey, teamUUID, ndk, canReadData]);

  // Fetch workouts for current calendar month when Leaderboard tab is active
  useEffect(() => {
    const fetchMonthly = async () => {
      if (activeTab !== 'leaderboard') return;
      // Option A: Use canReadData for data fetching operations
      if (!ndk || !canReadData || !captainPubkey || !teamUUID) return;
      const now = new Date();
      const since = new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000;
      setIsLoadingMonthlyWorkouts(true);
      try {
        const events = await fetchTeamActivityFeed(ndk, captainPubkey, teamUUID, 100, since);
        setMonthlyWorkouts(events);
      } catch (err) {
        console.error('Error fetching monthly workouts', err);
      } finally {
        setIsLoadingMonthlyWorkouts(false);
      }
    };
    fetchMonthly();
  }, [activeTab, ndk, canReadData, captainPubkey, teamUUID]);

  useEffect(() => {
    if (captainPubkey && teamUUID && canReadData && ndk) {
      loadTeamDetails();
    }
  }, [captainPubkey, teamUUID, canReadData, ndk, loadTeamDetails]);

  // Effect for Chat Subscription
  useEffect(() => {
    if (activeTab === 'chat' && teamAIdentifierForChat && ndk && ndkReady) {
      setIsLoadingChat(true);
      setChatMessages([]); 
      const sub = subscribeToTeamChatMessages(ndk, teamAIdentifierForChat, (newEvent) => {
        setChatMessages(prevMessages => {
          if (prevMessages.find(msg => msg.id === newEvent.id)) return prevMessages;
          return [...prevMessages, newEvent].sort((a, b) => a.created_at - b.created_at);
        });
      }, 50);
      if (sub) {
        setChatSubscription(sub);
      }
      setIsLoadingChat(false); 
      return () => {
        if (sub) sub.stop();
        setChatSubscription(null);
      };
    } else {
      if (chatSubscription) {
        chatSubscription.stop();
        setChatSubscription(null);
      }
    }
  }, [activeTab, teamAIdentifierForChat, ndk, ndkReady]);

  // Effect for Team Activities Subscription
  useEffect(() => {
    if (activeTab === 'challenges' && teamAIdentifierForChat && ndk && ndkReady) {
      setIsLoadingChallenges(true);
      setTeamChallenges([]);
      
      const setupChallengesSubscription = async () => {
        try {
          const sub = subscribeToTeamChallenges(ndk, teamAIdentifierForChat, (evt:any)=>{
              setTeamChallenges(prev=>{
                 if(prev.find(c=>c.id===evt.id)) return prev;
                 return [...prev,evt].sort((a,b)=>b.created_at - a.created_at);
              });
          });
          if(sub){setChallengesSubscription(sub);} 
          setIsLoadingChallenges(false);
        } catch (error) {
          console.error('Error setting up challenges subscription:', error);
          setIsLoadingChallenges(false);
        }
      };
      
      setupChallengesSubscription();
      
      return ()=>{ 
        if(challengesSubscription) {
          challengesSubscription.stop(); 
          setChallengesSubscription(null);
        }
      };
    } else {
      if(challengesSubscription){challengesSubscription.stop(); setChallengesSubscription(null);} 
    }
  },[activeTab,teamAIdentifierForChat,ndk,ndkReady]);

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
      setAddMemberError("Failed to prepare updated team event.");
      setIsAddingMember(false);
      return;
    }
    try {
      const eventToSign = new NDKEvent(ndk, { ...updatedEventTemplate, pubkey: currentUserPubkey });
      await eventToSign.sign(); 
      const publishedRelays = await eventToSign.publish();
      if (publishedRelays.size > 0) {
        setNewMemberPubkey(''); 
        toast.success('Member added successfully! Team data will refresh.');
        await loadTeamDetails(true); 
      } else {
        setAddMemberError("Failed to publish team update. Check relay connections.");
      }
    } catch (err: any) {
      setAddMemberError(err.message || "An unknown error occurred.");
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberToRemovePk: string) => {
    if (!ndk || !currentUserPubkey || !team) return;
    if (currentUserPubkey !== getTeamCaptain(team)) {
      toast.error("Only the team captain can remove members.");
      return;
    }
    if (memberToRemovePk === currentUserPubkey) {
      toast.error("Captain cannot remove themselves.");
      return;
    }
    setIsProcessingMembership(memberToRemovePk);
    const toastId = toast.loading('Removing member...');
    try {
      const updatedEventTemplate = removeMemberFromTeamEvent(team, memberToRemovePk);
      if (!updatedEventTemplate) {
        toast.error("Failed to prepare team update for removing member.", { id: toastId });
        setIsProcessingMembership(null);
        return;
      }
      const eventToSign = new NDKEvent(ndk, { ...updatedEventTemplate, pubkey: currentUserPubkey });
      await eventToSign.sign();
      const publishedRelays = await eventToSign.publish();
      if (publishedRelays.size > 0) {
        toast.success('Member removed successfully! Team data will refresh.', { id: toastId });
        await loadTeamDetails(true);
      } else {
        toast.error("Failed to publish team update for removing member.", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || "Error removing member.", { id: toastId });
    } finally {
      setIsProcessingMembership(null);
    }
  };

  const handleLeaveTeam = async () => {
    if (!ndk || !currentUserPubkey || !team) return;
    const teamCaptain = getTeamCaptain(team);
    if (currentUserPubkey === teamCaptain) {
      toast.error("Captains cannot leave the team using this option.");
      return;
    }
    toast.info(`To leave the team, please ask the captain (${getPubkeyDisplayName(teamCaptain)}) to remove you.`);
  };

  const handleJoinTeam = async () => {
    // Enhanced validation with detailed logging
    console.log('handleJoinTeam: Starting validation...', {
      ndkReady,
      ndk: !!ndk,
      currentUserPubkey: !!currentUserPubkey,
      teamAIdentifierForChat,
      team: !!team,
      teamName: team ? getTeamName(team) : 'unknown'
    });

    if (!ndkReady) {
      console.error('Join team failed: NDK not ready');
      toast.error('Connection not ready. Please wait a moment and try again.');
      return;
    }

    if (!ndk) {
      console.error('Join team failed: NDK instance missing');
      toast.error('Network connection missing. Please refresh the page.');
      return;
    }

    if (!currentUserPubkey) {
      console.log('handleJoinTeam: No pubkey yet – attempting to connect signer via Amber');
      try {
        const result = await connectSigner();
        if (result && result.pubkey) {
          currentUserPubkey = result.pubkey; // use the returned pubkey for this invocation
        } else {
          toast.error('Signer connection cancelled or failed.');
          return;
        }
      } catch (err) {
        console.error('handleJoinTeam: connectSigner threw', err);
        toast.error('Unable to connect signer.');
        return;
      }
    }

    if (!teamAIdentifierForChat) {
      console.error('Join team failed: Team identifier missing');
      toast.error('Team information incomplete. Please refresh the page and try again.');
      return;
    }

    if (!team) {
      console.error('Join team failed: Team data missing');
      toast.error('Team data not loaded. Please refresh the page.');
      return;
    }

    // Additional check: Ensure user isn't already a member
    if (isCurrentUserMember) {
      console.log('Join team skipped: User is already a member');
      toast.info('You are already a member of this team!');
      return;
    }

    // Add loading state for the join button
    setIsProcessingMembership('joining');
    const toastId = toast.loading('Joining team...');
    
    try {
      console.log('Starting team join process:', {
        teamAIdentifier: teamAIdentifierForChat,
        userPubkey: currentUserPubkey,
        teamName: getTeamName(team),
        teamUUID: getTeamUUID(team),
        captainPubkey: getTeamCaptain(team)
      });

      // Create membership event
      const membershipTemplate = prepareTeamMembershipEvent(
        teamAIdentifierForChat,
        currentUserPubkey
      );
      
      if (!membershipTemplate) {
        console.error('Failed to prepare membership event template');
        toast.error('Failed to prepare membership event.', { id: toastId });
        setIsProcessingMembership(null);
        return;
      }

      console.log('Membership event template created:', membershipTemplate);
      
      // Create NDK event and sign it
      const membershipEvent = new NDKEvent(ndk, membershipTemplate);
      
      console.log('Signing membership event...');
      await membershipEvent.sign();
      
      console.log('Membership event signed, publishing...');
      
      // Publish the event
      const publishedRelays = await membershipEvent.publish();
      
      if (publishedRelays.size === 0) {
        console.error('Failed to publish membership event to any relays');
        toast.error('Failed to publish membership event. Please check your connection and try again.', { id: toastId });
        setIsProcessingMembership(null);
        return;
      }

      console.log(`Membership event published successfully to ${publishedRelays.size} relays:`, Array.from(publishedRelays));
      
      toast.success('Successfully joined the team!', { id: toastId });
      
      // Set default posting team for future workout tagging
      if (captainPubkey && teamUUID) {
        setDefaultPostingTeamIdentifier(`${captainPubkey}:${teamUUID}`);
        console.log('Set default posting team:', `${captainPubkey}:${teamUUID}`);
      }

      // Enhanced refresh strategy with multiple attempts
      console.log('Refreshing team details after successful join...');
      
      // Immediate refresh
      await loadTeamDetails(true);

      // Additional refresh after delay to catch eventual consistency
      setTimeout(async () => {
        console.log('Second refresh after 2 seconds...');
        await loadTeamDetails(true);
        setIsProcessingMembership(null);
      }, 2000);

      // Final refresh after longer delay
      setTimeout(async () => {
        console.log('Final refresh after 5 seconds...');
        await loadTeamDetails(true);
        // Force re-evaluation of membership status
        setTeam(prevTeam => prevTeam ? { ...prevTeam } : null);
      }, 5000);

    } catch (err: any) {
      console.error('Error joining team:', err);
      const errorMessage = err?.message || 'Unknown error occurred while joining team';
      toast.error(`Failed to join team: ${errorMessage}`, { id: toastId });
      setIsProcessingMembership(null);
    }
  };

  if (isLoading && !team) {
    return <div className="p-4 text-white text-center">Loading team details...</div>;
  }

  if (!canReadData && !isLoading && !team) {
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
  const baseMembers = getTeamMembers(team);
  const teamIsPublic = isTeamPublic(team);
  const confirmedTeamUUID = getTeamUUID(team);

  // Derive role information using new hook
  const {
    members: combinedMembers,
    isCaptain: isCurrentUserCaptain,
    isMember: isCurrentUserMember,
  } = useTeamRoles(team, teamAIdentifierForChat);

  const renderTabs = () => {
    return (
      <div className="mb-8 border-b border-gray-700">
        <nav className="-mb-px flex space-x-6 sm:space-x-8 overflow-x-auto pb-px scrollbar-hide" aria-label="Tabs">
          {['chat', 'challenges', 'members', 'leaderboard'].map((tabName) => {
            let displayName = tabName;
            if (tabName === 'challenges') displayName = 'Team Challenges';
            else displayName = tabName.charAt(0).toUpperCase() + tabName.slice(1);

            return (
            <button
              key={tabName}
              onClick={() => setActiveTab(tabName as any)}
              className={`whitespace-nowrap py-4 px-3 sm:py-4 sm:px-4 border-b-2 font-medium text-sm sm:text-base min-w-0 flex-shrink-0
                ${activeTab === tabName 
                  ? 'border-blue-500 text-blue-400 bg-blue-500/10' 
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500 hover:bg-gray-700/50'}
                capitalize transition-all duration-150 rounded-t-lg`}
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
    if (!ndk || !ndkReady || !currentUserPubkey || !teamAIdentifierForChat || !newChatMessage.trim()) {
      toast.error("Cannot send message: Missing NDK, user, team identifier, or message content.");
      return;
    }
    setIsSendingChatMessage(true);
    const toastId = toast.loading('Sending message...');
    try {
      const chatMessageTemplate = prepareTeamChatMessage(teamAIdentifierForChat, newChatMessage, currentUserPubkey);
      if (!chatMessageTemplate) {
        toast.error("Failed to prepare chat message.", { id: toastId });
        setIsSendingChatMessage(false);
        return;
      }
      const ndkChatMessage = new NDKEvent(ndk, chatMessageTemplate);
      await ndkChatMessage.sign();
      const publishedRelays = await ndkChatMessage.publish();
      if (publishedRelays.size > 0) {
        setNewChatMessage('');
        toast.dismiss(toastId);
      } else {
        toast.error("Failed to send chat message to any relays.", { id: toastId });
      }
    } catch (err: any) {
      console.error("Error sending chat message:", err);
      toast.error(`Error sending message: ${err.message}`, { id: toastId });
    } finally {
      setIsSendingChatMessage(false);
    }
  };

  const renderChatTabContent = () => {
    if (!teamUUID) {
      return <div className="text-gray-400 p-4 text-center">Chat unavailable – missing team ID</div>;
    }
    return <LocalTeamChat teamId={teamUUID} userPubkey={currentUserPubkey} />;
  };

  const renderChallengesTabContent = () => {
    if(isLoadingChallenges&&teamChallenges.length===0)return <div className="text-gray-400 p-4 text-center">Loading challenges...</div>;
    if(!teamAIdentifierForChat)return <div className="text-gray-400 p-4 bg-gray-750 rounded-md">Challenges not available.</div>;

    return (
        <TeamChallengesTab 
           ndk={ndk as any}
           ndkReady={ndkReady}
           teamAIdentifier={teamAIdentifierForChat || ''}
           teamUUID={teamUUID || ''}
           captainPubkey={actualCaptain}
           currentUserPubkey={currentUserPubkey}
           isCaptain={isCurrentUserCaptain}
        />
    );
  };

  const renderCurrentTabContent = () => {
    if (!team && !isLoading) return <div className="p-4 text-white text-center">Team data could not be loaded.</div>;
    if (isLoading && !team) return <div className="p-4 text-white text-center">Loading team details...</div>;
    if (!team) return null; 

    switch (activeTab) {
      case 'chat': 
        return renderChatTabContent();
      case 'challenges': 
        return renderChallengesTabContent();
      case 'members':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-100">Members ({combinedMembers.length})</h3>
            {isCurrentUserCaptain && (
              <div className="p-4 sm:p-6 bg-gray-800 border border-gray-700 rounded-lg">
                <h4 className="text-lg font-semibold text-gray-200 mb-4">Add New Member (Captain Only)</h4>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input 
                    type="text"
                    value={newMemberPubkey}
                    onChange={(e) => setNewMemberPubkey(e.target.value)}
                    placeholder="Enter new member npub or hex pubkey"
                    className="flex-grow p-3 border border-gray-600 rounded-lg bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button 
                    onClick={handleAddMember}
                    disabled={isAddingMember || !newMemberPubkey.trim()}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                  >
                    {isAddingMember ? 'Adding...' : 'Add Member'}
                  </button>
                </div>
                {addMemberError && <p className="text-red-400 text-sm mt-3">{addMemberError}</p>}
              </div>
            )}
            {combinedMembers.length > 0 ? (
              <div className="space-y-3">
                {combinedMembers.map((memberPubkey, index) => (
                  <div key={index} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-gray-300 bg-gray-800 p-4 rounded-lg">
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <DisplayName pubkey={memberPubkey} />
                        {memberPubkey === actualCaptain && <span className="text-xs sm:text-sm text-yellow-400 font-medium px-2 py-1 bg-yellow-400/10 rounded-full">(Captain)</span>}
                        {memberPubkey === currentUserPubkey && !isCurrentUserCaptain && <span className="text-xs sm:text-sm text-green-400 font-medium px-2 py-1 bg-green-400/10 rounded-full">(You)</span>}
                    </div>
                    {isCurrentUserCaptain && memberPubkey !== currentUserPubkey && (
                        <button 
                            onClick={() => handleRemoveMember(memberPubkey)}
                            className="px-3 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                            Remove
                        </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-800/50 rounded-lg border border-gray-700">
                <p className="text-gray-400 mb-2">This team has no members yet.</p>
                {isCurrentUserCaptain && (
                  <p className="text-sm text-gray-500">Add the first member using the form above!</p>
                )}
              </div>
            )}
            {!isCurrentUserCaptain && isCurrentUserMember && (
                <button 
                    onClick={handleLeaveTeam}
                    className="px-6 py-3 text-sm bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg disabled:opacity-50 transition-colors"
                >
                   Request to Leave Team 
                </button>
            )}
          </div>
        );
      case 'leaderboard':
        if (isLoadingMonthlyWorkouts) {
          return <div className="text-gray-400 p-4 text-center">Loading leaderboard…</div>;
        }
        return (
          <div className="space-y-4">
            <LeaderboardTab workoutEvents={monthlyWorkouts} />
          </div>
        );
      default:
        return null;
    }
  };

  const renderJoinButton = () => {
      console.log('renderJoinButton: Evaluating join button visibility', {
        team: !!team,
        currentUserPubkey: !!currentUserPubkey,
        isCurrentUserCaptain,
        isCurrentUserMember,
        teamIsPublic,
        isProcessingMembership
      });

      if (!team || !currentUserPubkey) {
        console.log('renderJoinButton: Hidden - missing team or user pubkey');
        return null;
      }
      
      if (isCurrentUserCaptain) {
        console.log('renderJoinButton: Hidden - user is captain');
        return null;
      }
      
      if (isCurrentUserMember) {
        console.log('renderJoinButton: Hidden - user is already a member');
        return (
          <div className="mt-4 px-6 py-3 bg-gray-600 text-gray-300 rounded-lg text-center">
            ✅ You are a member of this team
          </div>
        );
      }
      
      if (!teamIsPublic) {
        console.log('renderJoinButton: Hidden - team is private');
        return <p className="text-sm text-gray-400 mt-4">This is a private team. Contact the captain to join.</p>; 
      }

      const isJoining = isProcessingMembership === 'joining';
      
      console.log('renderJoinButton: Showing join button', {
        teamName: getTeamName(team),
        teamAIdentifier: teamAIdentifierForChat,
        isJoining
      });
      
      return (
          <button 
            onClick={handleJoinTeam}
            disabled={isJoining}
            className={`mt-4 w-full sm:w-auto px-6 py-3 font-semibold rounded-lg transition-colors ${
              isJoining 
                ? 'bg-gray-600 text-gray-300 cursor-not-allowed' 
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
            title={`Join ${getTeamName(team)} (Captain: ${getPubkeyDisplayName(actualCaptain)})`}
          >
            {isJoining ? 'Joining...' : 'Join Team'}
          </button>
      );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto text-white">
      {/* Team Header - Enhanced spacing and layout */}
      <div className="mb-8 pb-6 border-b border-gray-700">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-blue-300 mb-2">{teamName}</h1>
            <p className="text-gray-300 leading-relaxed text-base sm:text-lg">{teamDescription}</p>
          </div>
          {isCurrentUserCaptain && (
            <button
              onClick={() => setShowManageTeamModal(true)}
              className="px-4 py-2 sm:px-6 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors whitespace-nowrap text-sm sm:text-base"
            >
              Manage Team
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm mb-6">
            <div className="flex flex-col">
              <span className="text-gray-500 text-xs uppercase tracking-wide">Captain</span>
              <DisplayName pubkey={actualCaptain} />
            </div>
            <div className="flex flex-col">
              <span className="text-gray-500 text-xs uppercase tracking-wide">Visibility</span>
              <span className={`${teamIsPublic ? "text-green-400" : "text-red-400"} font-medium`}>
                {teamIsPublic ? 'Public' : 'Private'}
              </span>
            </div>
        </div>
        
        {renderJoinButton()} 
      </div>

      {renderTabs()}
      <div className="mt-6">
        {renderCurrentTabContent()}
      </div>

      <div className="mt-12 pt-6 border-t border-gray-700 text-center">
        <Link to="/teams" className="text-blue-400 hover:text-blue-300 transition-colors duration-150 text-lg">
          &larr; Back to Teams List
        </Link>
      </div>

      {/* Manage Team Modal */}
      {showManageTeamModal && team && (
        <ManageTeamModal
          team={team}
          onClose={() => setShowManageTeamModal(false)}
          onTeamUpdated={() => {
            loadTeamDetails(true);
            setShowManageTeamModal(false);
          }}
        />
      )}
    </div>
  );
};

export default TeamDetailPage; 