import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'; // Added useNavigate, useLocation
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
  // Updated imports for NIP-101e native chat
  // getTeamChatGroupRef, // REMOVED
  subscribeToTeamChatMessages, // Will now use teamAIdentifier
  prepareTeamChatMessage,      // Will now use teamAIdentifier
  subscribeToTeamActivities,
  prepareTeamActivityEvent,
  TeamActivityDetails, 
  KIND_NIP101_TEAM_EVENT,
  KIND_NIP101_TEAM_CHALLENGE,
  KIND_NIP101_TEAM_CHAT_MESSAGE, // Added for the new chat message kind
  prepareTeamMembershipEvent,
  fetchTeamMemberships,
  KIND_TEAM_MEMBERSHIP,
  prepareTeamSubscriptionReceiptEvent,
} from '../services/nostr/NostrTeamsService'; // Corrected path
import { useNostr } from '../hooks/useNostr'; // Corrected path
import { NDKEvent, NDKSubscription, NDKKind } from '@nostr-dev-kit/ndk';
import { Event as NostrEventBase } from 'nostr-tools';
import { createAndPublishEvent } from '../utils/nostr';
import { useAuth } from '../hooks/useAuth';
import LocalTeamChat from '../components/teams/LocalTeamChat';
import TeamChallengesTab from '../components/teams/TeamChallengesTab';
import { useTeamSubscriptionStatus } from '../hooks/useTeamSubscriptionStatus';
import SubscriptionBanner from '../components/teams/SubscriptionBanner';
import PaymentModal from '../components/payments/PaymentModal';
import { DisplayName } from '../components/shared/DisplayName';
import { useTeamRoles } from '../hooks/useTeamRoles';
import toast from 'react-hot-toast';
import LeaderboardTab from '../components/teams/LeaderboardTab';
import TeamStatsWidget from '../components/teams/TeamStatsWidget';
import { useTeamActivity } from '../hooks/useTeamActivity';

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
  const location = useLocation();
  const seededEvent = (location.state as any)?.teamEvent ?? null;
  const { ndk, ndkReady, publicKey: currentUserPubkey } = useNostr(); // Get NDK from your context
  const { wallet } = useAuth();
  const navigate = useNavigate(); // For redirecting if team is deleted by captain leaving

  const [team, setTeam] = useState<NostrTeamEvent | null>(seededEvent);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'challenges' | 'members' | 'leaderboard' | 'feed'>('chat');

  const [teamFeed, setTeamFeed] = useState<NostrWorkoutEvent[]>([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState<boolean>(false);

  // State for adding a new member (captain only)
  const [newMemberPubkey, setNewMemberPubkey] = useState<string>('');
  const [isAddingMember, setIsAddingMember] = useState<boolean>(false);
  const [addMemberError, setAddMemberError] = useState<string | null>(null);

  // State for Chat - chatGroupRef is no longer needed
  // const [chatGroupRef, setChatGroupRef] = useState<string | null>(null); // REMOVED
  const [teamAIdentifierForChat, setTeamAIdentifierForChat] = useState<string | null>(null); // Added: e.g. "33404:captain:uuid"
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

  // Payment modal state
  const [paymentInvoice, setPaymentInvoice] = useState<string>('');
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Determine pay amount based on whether current user is the captain (URL param heuristic)
  const isCaptainByParam = currentUserPubkey && captainPubkey && currentUserPubkey === captainPubkey;
  const payAmount = isCaptainByParam ? 10000 : 2000;
  const { phase: subscriptionPhase, nextDue, renew: renewSubscription, isProcessing: isRenewProcessing } = useTeamSubscriptionStatus(
    teamAIdentifierForChat,
    currentUserPubkey || null,
    payAmount,
  );

  const [isProcessingMembership, setIsProcessingMembership] = useState<string | null>(null);

  const [monthlyWorkouts, setMonthlyWorkouts] = useState<NostrWorkoutEvent[]>([]);
  const [isLoadingMonthlyWorkouts, setIsLoadingMonthlyWorkouts] = useState(false);

  const loadTeamDetails = useCallback(async (forceRefetch = false) => {
    if (!captainPubkey || !teamUUID || !ndkReady || !ndk) return;
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
        setTeamAIdentifierForChat(null); // Clear if team not found
      }
    } catch (err) {
      console.error("Error fetching team details:", err);
      setError("Failed to load team details. Check console for more info.");
    } finally {
      if (!forceRefetch) setIsLoading(false);
    }
  }, [captainPubkey, teamUUID, ndk, ndkReady]);

  // Fetch workouts for current calendar month when Leaderboard tab is active
  useEffect(() => {
    const fetchMonthly = async () => {
      if (activeTab !== 'leaderboard') return;
      if (!ndk || !ndkReady || !captainPubkey || !teamUUID) return;
      const now = new Date();
      const since = new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000; // first day of month, in seconds
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
  }, [activeTab, ndk, ndkReady, captainPubkey, teamUUID]);

  useEffect(() => {
    if (captainPubkey && teamUUID && ndkReady && ndk) {
      loadTeamDetails();
    }
  }, [captainPubkey, teamUUID, ndkReady, ndk, loadTeamDetails]);

  // Effect for Chat Subscription (uses teamAIdentifierForChat)
  useEffect(() => {
    if (activeTab === 'chat' && teamAIdentifierForChat && ndk && ndkReady) {
      setIsLoadingChat(true);
      setChatMessages([]); 
      // Subscribe using the team's direct 'a' identifier and the new chat message kind
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

  // Effect for Team Activities Subscription (uses teamAIdentifierForChat)
  useEffect(() => {
    if (activeTab === 'challenges' && teamAIdentifierForChat && ndk && ndkReady) {
      setIsLoadingChallenges(true);
      setTeamChallenges([]);
      const { subscribeToTeamChallenges } = require('../services/nostr/NostrTeamsService');
      const sub = subscribeToTeamChallenges(ndk, teamAIdentifierForChat, (evt:any)=>{
          setTeamChallenges(prev=>{
             if(prev.find(c=>c.id===evt.id)) return prev;
             return [...prev,evt].sort((a,b)=>b.created_at - a.created_at);
          });
      });
      if(sub){setChallengesSubscription(sub);} 
      setIsLoadingChallenges(false);
      return ()=>{ if(sub) sub.stop(); setChallengesSubscription(null); };
    } else {
      if(challengesSubscription){challengesSubscription.stop(); setChallengesSubscription(null);} }
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
    if (!ndkReady || !ndk || !currentUserPubkey || !teamAIdentifierForChat) return;
    const toastId = toast.loading('Joining team...');
    try {
      const membershipTemplate = prepareTeamMembershipEvent(
        teamAIdentifierForChat,
        currentUserPubkey
      );
      if (!membershipTemplate) {
        toast.error('Failed to prepare membership event.', { id: toastId });
        return;
      }
      await createAndPublishEvent(membershipTemplate, null);
      toast.success('Successfully joined the team!', { id: toastId });
      await loadTeamDetails(true);
    } catch (err: any) {
      toast.error(err?.message || 'Error joining team', { id: toastId });
    }
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
      <div className="mb-4 border-b border-gray-700">
        <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto pb-px" aria-label="Tabs">
          {['chat', 'challenges', 'members', 'leaderboard'].map((tabName) => {
            let displayName = tabName;
            if (tabName === 'challenges') displayName = 'Team Challenges';
            else displayName = tabName.charAt(0).toUpperCase() + tabName.slice(1);

            return (
            <button
              key={tabName}
              onClick={() => setActiveTab(tabName as any)}
              className={`whitespace-nowrap py-3 px-2 sm:py-4 sm:px-3 border-b-2 font-medium text-sm 
                ${activeTab === tabName 
                  ? 'border-blue-500 text-blue-400' 
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'}
                capitalize transition-colors duration-150`}
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

  // Updated handleCreateTeamActivity to use teamAIdentifierForChat (which is the team's 'a' tag)
  const handleCreateChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!ndk||!ndkReady||!currentUserPubkey||!teamAIdentifierForChat){
        toast.error('Cannot create challenge: missing requirements');
        return;
    }
    const { prepareTeamChallengeEvent } = require('../services/nostr/NostrTeamsService');
    const details={
        name:challengeForm.name,
        description:challengeForm.description,
        goal:{goalType:'distance_total',value:challengeForm.goalValue,unit:challengeForm.goalUnit},
        startTime:challengeForm.startTimeString?Math.floor(new Date(challengeForm.startTimeString).getTime()/1000):undefined,
        endTime:challengeForm.endTimeString?Math.floor(new Date(challengeForm.endTimeString).getTime()/1000):undefined
    };
    setIsCreatingChallenge(true);
    const toastId = toast.loading('Creating challenge...');
    const tmpl=prepareTeamChallengeEvent(teamAIdentifierForChat,details,currentUserPubkey);
    if(!tmpl){toast.error('Failed to prepare challenge', { id: toastId });setIsCreatingChallenge(false);return;}
    try{
       const ev=new NDKEvent(ndk,tmpl); await ev.sign(); const relays=await ev.publish();
       if(relays.size>0){toast.success('Challenge created!', { id: toastId }); setChallengeForm({name:'',description:'',goalValue:0,goalUnit:'km',startTimeString:'',endTimeString:''});}
       else toast.error('Failed to publish challenge', { id: toastId });
    }catch(err:any){console.error('create challenge err',err);toast.error(err.message||'Error', { id: toastId });}
    finally{setIsCreatingChallenge(false);}    
  };
  
  const handleChallengeFormChange=(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>)=>{
     const {name,value}=e.target; setChallengeForm(prev=>({...prev,[name]:name==='goalValue'?Number(value):value}));
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
          <div>
            <h3 className="text-xl font-semibold mb-3 text-gray-100">Members ({combinedMembers.length})</h3>
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
            {combinedMembers.length > 0 ? (
              <ul className="space-y-2">
                {combinedMembers.map((memberPubkey, index) => (
                  <li key={index} className="flex items-center justify-between text-gray-300 bg-gray-750 p-2 rounded-md font-mono text-xs">
                    <span className="truncate hover:text-clip">
                        <DisplayName pubkey={memberPubkey} />
                        {memberPubkey === actualCaptain && <span className="ml-2 text-xs text-yellow-400">(Captain)</span>}
                        {memberPubkey === currentUserPubkey && !isCurrentUserCaptain && <span className="ml-2 text-xs text-green-400">(You)</span>}
                    </span>
                    {isCurrentUserCaptain && memberPubkey !== currentUserPubkey && (
                        <button 
                            onClick={() => handleRemoveMember(memberPubkey)}
                            className="ml-3 px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50"
                        >
                            Remove
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
                    className="mt-4 px-4 py-2 text-sm bg-yellow-600 hover:bg-yellow-700 text-white rounded disabled:opacity-50"
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
        const { rankedMembers, totalTeamDistance } = useTeamActivity(monthlyWorkouts);
        return (
          <>
            <TeamStatsWidget totalDistance={totalTeamDistance} />
            <LeaderboardTab workoutEvents={monthlyWorkouts} />
          </>
        );
      default:
        return null;
    }
  };

  const renderJoinButton = () => {
      if (!team || !currentUserPubkey) return null;
      if (isCurrentUserCaptain || isCurrentUserMember) return null; 
      if (!teamIsPublic) return <p className="text-sm text-gray-400 mt-4">This is a private team. Contact the captain to join.</p>; 
      return (
          <button 
            onClick={handleJoinTeam}
            className="mt-4 w-full sm:w-auto px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md transition-colors"
            title={`Captain: ${actualCaptain}`}
          >
            Join Team
          </button>
      );
  }

  return (
    <div className="p-4 max-w-3xl mx-auto text-white">
      {/* Subscription banner */}
      <SubscriptionBanner
        phase={subscriptionPhase}
        amount={payAmount}
        nextDue={nextDue}
        onRenew={renewSubscription}
        isProcessing={isRenewProcessing}
      />
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

      {/* Payment Modal */}
      <PaymentModal
        open={paymentModalOpen}
        invoice={paymentInvoice}
        amount={2000}
        onClose={() => setPaymentModalOpen(false)}
        onPaid={handleJoinTeam}
        paymentError={paymentError}
      />

      <div className="mt-8 pt-4 border-t border-gray-700 text-center">
        <Link to="/teams" className="text-blue-400 hover:text-blue-300 transition-colors duration-150">
          &larr; Back to Teams List
        </Link>
      </div>
    </div>
  );
};

export default TeamDetailPage; 