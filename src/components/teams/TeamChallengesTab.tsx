import React, { useEffect, useState } from 'react';
import NDK, { NDKEvent, NDKSubscription } from '@nostr-dev-kit/ndk';
import { v4 as uuidv4 } from 'uuid';
import { useNavigate } from 'react-router-dom';
import {
  prepareTeamChallengeEvent,
  subscribeToTeamChallenges,
} from '../../services/nostr/NostrTeamsService';
import type { ChallengeDetails } from '../../services/nostr/NostrTeamsService';
import { useNostr } from '../../hooks/useNostr';
import { Event as NostrEvent } from 'nostr-tools';
import toast from 'react-hot-toast';
import { cacheChallengeNames } from '../../services/nameResolver';

interface TeamChallengesTabProps {
  ndk: NDK;
  ndkReady: boolean;
  teamAIdentifier: string;
  teamUUID: string;
  captainPubkey: string;
  currentUserPubkey: string | null;
  isCaptain: boolean;
}



const parseChallenge = (evt: NostrEvent) => {
  const tag = (k: string) => evt.tags.find(t => t[0] === k)?.[1];
  const name = tag('name') || 'Unnamed Challenge';
  const description = tag('description') || evt.content;
  const goalValTag = evt.tags.find(t => t[0] === 'goal_value');
  const goalValue = goalValTag ? goalValTag[1] : undefined;
  const goalUnit = goalValTag ? goalValTag[2] : undefined;
  const uuid = tag('d') || uuidv4();
  const start = Number(tag('start')) || undefined;
  const end = Number(tag('end')) || undefined;
  return { id: evt.id, uuid, name, description, goalValue, goalUnit, start, end, raw: evt };
};

const TeamChallengesTab: React.FC<TeamChallengesTabProps> = ({
  ndk,
  ndkReady,
  teamAIdentifier,
  teamUUID,
  captainPubkey,
  currentUserPubkey,
  isCaptain,
}) => {
  const navigate = useNavigate();
  const [challenges, setChallenges] = useState<Array<ReturnType<typeof parseChallenge>>>([]);
  const [loading, setLoading] = useState(true);
  const [activeChallenges, setActiveChallenges] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<ReturnType<typeof parseChallenge> | null>(null);
  const [form, setForm] = useState<{ name: string; description: string; goalValue: number; goalUnit: 'km' | 'mi'; start: string; end: string }>({
    name: '',
    description: '',
    goalValue: 0,
    goalUnit: 'km',
    start: '',
    end: '',
  });

  const { connectSigner } = (useNostr() as any);

  // Load active challenge preferences (challenges to tag future workouts with)
  useEffect(() => {
    const activeKey = `runstr:activeChallenges:${teamUUID}`;
    const stored = JSON.parse(localStorage.getItem(activeKey) || '[]');
    if (Array.isArray(stored)) setActiveChallenges(stored);
  }, [teamUUID]);

  // Subscribe to challenges
  useEffect(() => {
    if (!ndkReady || !teamAIdentifier) return;
    let sub: NDKSubscription | null = null;
    try {
      sub = subscribeToTeamChallenges(ndk, teamAIdentifier, (evt: NostrEvent) => {
        setChallenges(prev => {
          if (prev.find(c => c.id === evt.id)) return prev;
          const parsedChallenge = parseChallenge(evt);
          
          // Cache challenge name for future name resolution
          cacheChallengeNames(parsedChallenge.uuid, teamUUID, parsedChallenge.name);
          
          return [...prev, parsedChallenge].sort((a, b) => (b.start || 0) - (a.start || 0));
        });
      });
    } catch (e) {
      console.error("Error subscribing to team challenges", e);
    }
    setLoading(false);
    return () => {
      if (sub) sub.stop();
    };
  }, [ndkReady, teamAIdentifier, ndk]);

  // Auto-connect signer for captains on mount if pubkey is missing
  useEffect(() => {
    if (isCaptain && !currentUserPubkey) {
      connectSigner().catch((err: any) => console.warn('Auto connectSigner failed:', err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCaptain, currentUserPubkey]);

  const toggleChallengeParticipation = (uuid: string) => {
    const newSet = activeChallenges.includes(uuid) ? activeChallenges.filter(u => u !== uuid) : [...activeChallenges, uuid];
    setActiveChallenges(newSet);
    const activeKey = `runstr:activeChallenges:${teamUUID}`;
    localStorage.setItem(activeKey, JSON.stringify(newSet));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCaptain) {
      toast.error('Only team captains can create challenges.');
      return;
    }

    let finalPubkey = currentUserPubkey;
    if (!finalPubkey) {
      const signerResult = await connectSigner();
      finalPubkey = signerResult?.pubkey || null;
      if (!finalPubkey) {
        toast.error('A signer is required to create a challenge.');
        return;
      }
    }

    const details: ChallengeDetails = {
      name: form.name,
      description: form.description,
      goal: { goalType: 'distance_total', value: form.goalValue, unit: form.goalUnit },
      startTime: form.start ? Math.floor(new Date(form.start).getTime() / 1000) : undefined,
      endTime: form.end ? Math.floor(new Date(form.end).getTime() / 1000) : undefined,
    };

    const toastId = toast.loading(editingChallenge ? 'Updating challenge...' : 'Publishing challenge...');
    const tmpl = prepareTeamChallengeEvent(teamAIdentifier, details, finalPubkey);
    if (!tmpl) {
      toast.error('Failed to build challenge event', { id: toastId });
      return;
    }
    try {
      const ndkEvt = new NDKEvent(ndk, tmpl as any);
      await ndkEvt.sign();
      const res = await ndkEvt.publish();
      if (res.size > 0) {
        toast.success(editingChallenge ? 'Challenge updated!' : 'Challenge published!', { id: toastId });
        handleCloseModal();
      } else {
        toast.error('Publish failed. No relays accepted the event.', { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error(editingChallenge ? 'Error updating challenge.' : 'Error creating challenge.', { id: toastId });
    }
  };

  const handleEditChallenge = (challenge: ReturnType<typeof parseChallenge>) => {
    setEditingChallenge(challenge);
    setForm({
      name: challenge.name,
      description: challenge.description,
      goalValue: Number(challenge.goalValue) || 0,
      goalUnit: (challenge.goalUnit as 'km' | 'mi') || 'km',
      start: challenge.start ? new Date(challenge.start * 1000).toISOString().slice(0, 16) : '',
      end: challenge.end ? new Date(challenge.end * 1000).toISOString().slice(0, 16) : '',
    });
    setShowModal(true);
  };

  const handleDeleteChallenge = async (challenge: ReturnType<typeof parseChallenge>) => {
    if (!isCaptain) {
      toast.error('Only team captains can delete challenges.');
      return;
    }

    if (!confirm(`Are you sure you want to delete "${challenge.name}"? This action cannot be undone.`)) {
      return;
    }

    let finalPubkey = currentUserPubkey;
    if (!finalPubkey) {
      const signerResult = await connectSigner();
      finalPubkey = signerResult?.pubkey || null;
      if (!finalPubkey) {
        toast.error('A signer is required to delete a challenge.');
        return;
      }
    }

    const toastId = toast.loading('Deleting challenge...');
    try {
      // Create a deletion event (kind 5) to mark the challenge as deleted
      const deletionEvent = {
        kind: 5,
        content: `Challenge "${challenge.name}" has been deleted`,
        tags: [
          ['e', challenge.id], // Reference to the challenge event
          ['k', '33405'] // Kind of event being deleted (team challenge)
        ],
        created_at: Math.floor(Date.now() / 1000)
      };

      const ndkEvt = new NDKEvent(ndk, deletionEvent as any);
      await ndkEvt.sign();
      const res = await ndkEvt.publish();
      if (res.size > 0) {
        toast.success('Challenge deleted!', { id: toastId });
        // Remove from local state
        setChallenges(prev => prev.filter(c => c.id !== challenge.id));
        // Remove from active challenges if user was participating
        if (activeChallenges.includes(challenge.uuid)) {
          const newActiveChallenges = activeChallenges.filter(u => u !== challenge.uuid);
          setActiveChallenges(newActiveChallenges);
          const activeKey = `runstr:activeChallenges:${teamUUID}`;
          localStorage.setItem(activeKey, JSON.stringify(newActiveChallenges));
        }
      } else {
        toast.error('Delete failed. No relays accepted the event.', { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error('Error deleting challenge.', { id: toastId });
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingChallenge(null);
    setForm({ name: '', description: '', goalValue: 0, goalUnit: 'km', start: '', end: '' });
  };

  return (
    <div className="space-y-6">
      {/* Captain Challenge Creation Section */}
      {isCaptain && (
        <div className="bg-bg-secondary border border-border-secondary rounded-lg p-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div>
              <h3 className="text-lg font-semibold text-primary">Captain Controls</h3>
              <p className="text-sm text-text-muted">Create challenges to motivate your team members</p>
            </div>
            <button 
              onClick={() => setShowModal(true)} 
              className="px-6 py-3 bg-primary hover:bg-primary-hover text-white font-semibold rounded-lg transition-colors whitespace-nowrap border border-border-secondary"
            >
              + Create Challenge
            </button>
          </div>
        </div>
      )}

      {/* Challenges List */}
      <div>
        <h4 className="text-xl font-semibold text-text-primary mb-4">
          Challenges {!loading && `(${challenges.length})`}
        </h4>
        
        {loading && (
          <div className="text-center py-8">
            <p className="text-text-muted">Loading challenges...</p>
          </div>
        )}
        
        {!loading && challenges.length === 0 && (
          <div className="text-center py-8 bg-bg-secondary rounded-lg border border-border-secondary">
            <p className="text-text-muted mb-2">No challenges available.</p>
            {isCaptain && (
              <p className="text-sm text-text-muted">Create the first challenge to get your team motivated!</p>
            )}
          </div>
        )}
        
        {!loading && challenges.length > 0 && (
          <div className="space-y-4">
            {challenges.map(ch => (
              <div key={ch.id} className="border border-border-secondary rounded-lg p-4 bg-bg-secondary">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-3">
                  <button 
                    onClick={() => navigate(`/challenge/${captainPubkey}/${ch.uuid}`)}
                    className="text-left font-semibold text-text-primary text-lg hover:text-primary transition-colors cursor-pointer"
                  >
                    {ch.name}
                  </button>
                  {ch.goalValue && (
                    <span className="px-3 py-1 bg-primary text-white text-sm rounded-full whitespace-nowrap">
                      Goal: {ch.goalValue} {ch.goalUnit}
                    </span>
                  )}
                </div>
                
                {ch.description && (
                  <p className="text-text-secondary mb-3">{ch.description}</p>
                )}
                
                {ch.start && (
                  <p className="text-sm text-text-muted mb-4">
                    📅 {new Date(ch.start * 1000).toLocaleDateString()} – {ch.end ? new Date(ch.end * 1000).toLocaleDateString() : 'No end date'}
                  </p>
                )}
                
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => toggleChallengeParticipation(ch.uuid)} 
                    className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
                      activeChallenges.includes(ch.uuid) 
                        ? 'bg-error hover:bg-error text-white border border-border-secondary' 
                        : 'border border-primary text-primary hover:bg-primary-light'
                    }`}
                  >
                    {activeChallenges.includes(ch.uuid) ? '✓ Stop Tagging' : '+ Tag Future Workouts'}
                  </button>
                  
                  {/* Captain Controls */}
                  {isCaptain && (
                    <>
                      <button 
                        onClick={() => handleEditChallenge(ch)}
                        className="px-4 py-2 text-sm rounded-lg font-medium border border-warning text-warning hover:bg-warning-light transition-colors"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDeleteChallenge(ch)}
                        className="px-4 py-2 text-sm rounded-lg font-medium border border-error text-error hover:bg-error-light transition-colors"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Challenge Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-secondary p-6 rounded-lg w-full max-w-lg text-text-primary max-h-[90vh] overflow-y-auto border border-border-secondary">
            <h3 className="text-xl font-semibold mb-4 text-primary">
              {editingChallenge ? 'Edit Challenge' : 'Create New Challenge'}
            </h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-text-primary">Challenge Name</label>
                <input 
                  name="name" 
                  value={form.name} 
                  onChange={e => setForm({ ...form, name: e.target.value })} 
                  required 
                  placeholder="e.g., 5K Challenge"
                  className="w-full p-3 bg-bg-tertiary border border-border-secondary rounded-lg focus:ring-primary focus:border-primary text-text-primary placeholder-text-muted" 
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2 text-text-primary">Description</label>
                <textarea 
                  name="description" 
                  value={form.description} 
                  onChange={e => setForm({ ...form, description: e.target.value })} 
                  required 
                  rows={3}
                  placeholder="Describe the challenge goals and rules..."
                  className="w-full p-3 bg-bg-tertiary border border-border-secondary rounded-lg focus:ring-primary focus:border-primary text-text-primary placeholder-text-muted" 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-text-primary">Goal Distance</label>
                  <input 
                    type="number" 
                    value={form.goalValue} 
                    onChange={e => setForm({ ...form, goalValue: Number(e.target.value) })} 
                    min="0"
                    step="0.1"
                    placeholder="5.0"
                    className="w-full p-3 bg-bg-tertiary border border-border-secondary rounded-lg focus:ring-primary focus:border-primary text-text-primary placeholder-text-muted" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-text-primary">Unit</label>
                  <select 
                    value={form.goalUnit} 
                    onChange={e => setForm({ ...form, goalUnit: e.target.value as 'km' | 'mi' })} 
                    className="w-full p-3 bg-bg-tertiary border border-border-secondary rounded-lg focus:ring-primary focus:border-primary text-text-primary"
                  >
                    <option value="km">Kilometers</option>
                    <option value="mi">Miles</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2 text-text-primary">Start Date (Optional)</label>
                <input 
                  type="datetime-local" 
                  value={form.start} 
                  onChange={e => setForm({ ...form, start: e.target.value })} 
                  className="w-full p-3 bg-bg-tertiary border border-border-secondary rounded-lg focus:ring-primary focus:border-primary text-text-primary" 
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2 text-text-primary">End Date (Optional)</label>
                <input 
                  type="datetime-local" 
                  value={form.end} 
                  onChange={e => setForm({ ...form, end: e.target.value })} 
                  className="w-full p-3 bg-bg-tertiary border border-border-secondary rounded-lg focus:ring-primary focus:border-primary text-text-primary" 
                />
              </div>
              
              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={handleCloseModal} 
                  className="px-6 py-2 border border-border-secondary rounded-lg text-text-secondary hover:bg-bg-tertiary transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2 bg-primary hover:bg-primary-hover text-white font-semibold rounded-lg transition-colors border border-border-secondary"
                >
                  {editingChallenge ? 'Update Challenge' : 'Create Challenge'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamChallengesTab; 