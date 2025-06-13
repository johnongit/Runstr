import React, { useEffect, useState } from 'react';
import NDK, { NDKEvent, NDKSubscription } from '@nostr-dev-kit/ndk';
import { v4 as uuidv4 } from 'uuid';
import {
  prepareTeamChallengeEvent,
  subscribeToTeamChallenges,
} from '../../services/nostr/NostrTeamsService';
import type { ChallengeDetails } from '../../services/nostr/NostrTeamsService';
import { useNostr } from '../../hooks/useNostr';
import { Event as NostrEvent } from 'nostr-tools';
import toast from 'react-hot-toast';

interface TeamChallengesTabProps {
  ndk: NDK;
  ndkReady: boolean;
  teamAIdentifier: string;
  teamUUID: string;
  captainPubkey: string;
  currentUserPubkey: string | null;
  isCaptain: boolean;
}

const localKey = (teamUUID: string) => `runstr:challengeParticipation:${teamUUID}`;

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
  const [challenges, setChallenges] = useState<Array<ReturnType<typeof parseChallenge>>>([]);
  const [loading, setLoading] = useState(true);
  const [participating, setParticipating] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<{ name: string; description: string; goalValue: number; goalUnit: 'km' | 'mi'; start: string; end: string }>({
    name: '',
    description: '',
    goalValue: 0,
    goalUnit: 'km',
    start: '',
    end: '',
  });

  const { connectSigner } = (useNostr() as any);

  // Load participation list
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem(localKey(teamUUID)) || '[]');
    if (Array.isArray(stored)) setParticipating(stored);
  }, [teamUUID]);

  // Subscribe to challenges
  useEffect(() => {
    if (!ndkReady || !teamAIdentifier) return;
    let sub: NDKSubscription | null = null;
    try {
      sub = subscribeToTeamChallenges(ndk, teamAIdentifier, (evt: NostrEvent) => {
        setChallenges(prev => {
          if (prev.find(c => c.id === evt.id)) return prev;
          return [...prev, parseChallenge(evt)].sort((a, b) => (b.start || 0) - (a.start || 0));
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

  const toggleParticipation = (uuid: string) => {
    const newSet = participating.includes(uuid) ? participating.filter(u => u !== uuid) : [...participating, uuid];
    setParticipating(newSet);
    localStorage.setItem(localKey(teamUUID), JSON.stringify(newSet));
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

    const toastId = toast.loading('Publishing challenge...');
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
        toast.success('Challenge published!', { id: toastId });
        setShowModal(false);
        setForm({ name: '', description: '', goalValue: 0, goalUnit: 'km', start: '', end: '' });
      } else {
        toast.error('Publish failed. No relays accepted the event.', { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error('Error creating challenge.', { id: toastId });
    }
  };

  return (
    <div className="space-y-6">
      {/* Captain Challenge Creation Section */}
      {isCaptain && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div>
              <h3 className="text-lg font-semibold text-blue-300">Captain Controls</h3>
              <p className="text-sm text-gray-400">Create challenges to motivate your team members</p>
            </div>
            <button 
              onClick={() => setShowModal(true)} 
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors whitespace-nowrap"
            >
              + Create Challenge
            </button>
          </div>
        </div>
      )}

      {/* Challenges List */}
      <div>
        <h4 className="text-xl font-semibold text-gray-100 mb-4">
          Team Challenges {!loading && `(${challenges.length})`}
        </h4>
        
        {loading && (
          <div className="text-center py-8">
            <p className="text-gray-400">Loading challenges...</p>
          </div>
        )}
        
        {!loading && challenges.length === 0 && (
          <div className="text-center py-8 bg-gray-800 rounded-lg border border-gray-700">
            <p className="text-gray-400 mb-2">No challenges available.</p>
            {isCaptain && (
              <p className="text-sm text-gray-500">Create the first challenge to get your team motivated!</p>
            )}
          </div>
        )}
        
        {!loading && challenges.length > 0 && (
          <div className="space-y-4">
            {challenges.map(ch => (
              <div key={ch.id} className="border border-gray-700 rounded-lg p-4 bg-gray-800">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-3">
                  <h4 className="font-semibold text-gray-100 text-lg">{ch.name}</h4>
                  {ch.goalValue && (
                    <span className="px-3 py-1 bg-blue-600 text-white text-sm rounded-full whitespace-nowrap">
                      Goal: {ch.goalValue} {ch.goalUnit}
                    </span>
                  )}
                </div>
                
                {ch.description && (
                  <p className="text-gray-300 mb-3">{ch.description}</p>
                )}
                
                {ch.start && (
                  <p className="text-sm text-gray-400 mb-4">
                    📅 {new Date(ch.start * 1000).toLocaleDateString()} – {ch.end ? new Date(ch.end * 1000).toLocaleDateString() : 'No end date'}
                  </p>
                )}
                
                <button 
                  onClick={() => toggleParticipation(ch.uuid)} 
                  className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
                    participating.includes(ch.uuid) 
                      ? 'bg-red-600 hover:bg-red-700 text-white' 
                      : 'border border-blue-500 text-blue-400 hover:bg-blue-600/20'
                  }`}
                >
                  {participating.includes(ch.uuid) ? '✓ Leave Challenge' : '+ Participate'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Challenge Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-6 rounded-lg w-full max-w-lg text-white max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4 text-blue-300">Create New Challenge</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Challenge Name</label>
                <input 
                  name="name" 
                  value={form.name} 
                  onChange={e => setForm({ ...form, name: e.target.value })} 
                  required 
                  placeholder="e.g., 5K Challenge"
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500" 
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea 
                  name="description" 
                  value={form.description} 
                  onChange={e => setForm({ ...form, description: e.target.value })} 
                  required 
                  rows={3}
                  placeholder="Describe the challenge goals and rules..."
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500" 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Goal Distance</label>
                  <input 
                    type="number" 
                    value={form.goalValue} 
                    onChange={e => setForm({ ...form, goalValue: Number(e.target.value) })} 
                    min="0"
                    step="0.1"
                    placeholder="5.0"
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Unit</label>
                  <select 
                    value={form.goalUnit} 
                    onChange={e => setForm({ ...form, goalUnit: e.target.value as 'km' | 'mi' })} 
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="km">Kilometers</option>
                    <option value="mi">Miles</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Start Date (Optional)</label>
                <input 
                  type="datetime-local" 
                  value={form.start} 
                  onChange={e => setForm({ ...form, start: e.target.value })} 
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500" 
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">End Date (Optional)</label>
                <input 
                  type="datetime-local" 
                  value={form.end} 
                  onChange={e => setForm({ ...form, end: e.target.value })} 
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500" 
                />
              </div>
              
              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="px-6 py-2 border border-gray-600 rounded-lg text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                >
                  Create Challenge
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