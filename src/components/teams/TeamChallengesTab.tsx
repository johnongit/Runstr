import React, { useEffect, useState } from 'react';
import NDK, { NDKEvent } from '@nostr-dev-kit/ndk';
import { v4 as uuidv4 } from 'uuid';
import {
  ChallengeDetails,
  prepareTeamChallengeEvent,
  subscribeToTeamChallenges,
  NostrEvent,
} from '../../services/nostr/NostrTeamsService';
import { NDKEvent as NostrNDKEvent } from '@nostr-dev-kit/ndk';

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

  // Load participation list
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem(localKey(teamUUID)) || '[]');
    if (Array.isArray(stored)) setParticipating(stored);
  }, [teamUUID]);

  // Subscribe to challenges
  useEffect(() => {
    if (!ndkReady || !teamAIdentifier) return;
    const sub = subscribeToTeamChallenges(ndk, teamAIdentifier, evt => {
      setChallenges(prev => {
        if (prev.find(c => c.id === evt.id)) return prev;
        return [...prev, parseChallenge(evt)].sort((a, b) => b.start - a.start);
      });
    });
    setLoading(false);
    return () => sub && sub.stop();
  }, [ndkReady, teamAIdentifier, ndk]);

  const toggleParticipation = (uuid: string) => {
    const newSet = participating.includes(uuid) ? participating.filter(u => u !== uuid) : [...participating, uuid];
    setParticipating(newSet);
    localStorage.setItem(localKey(teamUUID), JSON.stringify(newSet));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCaptain || !currentUserPubkey) return;
    const details: ChallengeDetails = {
      name: form.name,
      description: form.description,
      goal: { goalType: 'distance_total', value: form.goalValue, unit: form.goalUnit },
      startTime: form.start ? Math.floor(new Date(form.start).getTime() / 1000) : undefined,
      endTime: form.end ? Math.floor(new Date(form.end).getTime() / 1000) : undefined,
    };
    const tmpl = prepareTeamChallengeEvent(teamAIdentifier, details, currentUserPubkey);
    if (!tmpl) return alert('Failed to build challenge event');
    try {
      const ndkEvt = new NDKEvent(ndk, tmpl as any);
      await ndkEvt.sign();
      const res = await ndkEvt.publish();
      if (res.size > 0) {
        alert('Challenge published');
        setShowModal(false);
        setForm({ name: '', description: '', goalValue: 0, goalUnit: 'km', start: '', end: '' });
      } else alert('Publish failed');
    } catch (err) {
      console.error(err);
      alert('Error creating challenge');
    }
  };

  return (
    <div className="px-2">
      {loading && <p className="text-gray-400">Loading…</p>}
      {!loading && challenges.length === 0 && <p className="text-gray-400">No challenges yet.</p>}
      {!loading && challenges.map(ch => (
        <div key={ch.id} className="border border-gray-700 rounded-md p-3 mb-3">
          <h4 className="font-semibold text-gray-100 mb-1">{ch.name}</h4>
          <p className="text-sm text-gray-300 mb-2">Goal: {ch.goalValue} {ch.goalUnit}</p>
          {ch.start && <p className="text-xs text-gray-400">{new Date(ch.start * 1000).toLocaleDateString()} – {ch.end ? new Date(ch.end * 1000).toLocaleDateString() : '∞'}</p>}
          <button onClick={() => toggleParticipation(ch.uuid)} className="mt-2 px-3 py-1 text-sm rounded-md border border-blue-500 text-blue-400 hover:bg-blue-600/20">
            {participating.includes(ch.uuid) ? 'Leave Challenge' : 'Participate'}
          </button>
        </div>
      ))}
      {isCaptain && (
        <>
          <button onClick={() => setShowModal(true)} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md">Create Challenge</button>
          {showModal && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
              <div className="bg-gray-800 p-5 rounded-lg w-full max-w-md text-white">
                <h3 className="text-lg font-semibold mb-3">New Challenge</h3>
                <form onSubmit={handleCreate} className="space-y-3">
                  <div>
                    <label className="block text-sm mb-1">Name</label>
                    <input name="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className="w-full p-2 bg-gray-700 border border-gray-600 rounded" />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Description</label>
                    <textarea name="description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required className="w-full p-2 bg-gray-700 border border-gray-600 rounded" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="block text-sm mb-1">Goal Value</label><input type="number" value={form.goalValue} onChange={e => setForm({ ...form, goalValue: Number(e.target.value) })} className="w-full p-2 bg-gray-700 border border-gray-600 rounded" /></div>
                    <div><label className="block text-sm mb-1">Unit</label><select value={form.goalUnit} onChange={e => setForm({ ...form, goalUnit: e.target.value as 'km'|'mi' })} className="w-full p-2 bg-gray-700 border border-gray-600 rounded"><option value="km">km</option><option value="mi">mi</option></select></div>
                  </div>
                  <div><label className="block text-sm mb-1">Start (optional)</label><input type="datetime-local" value={form.start} onChange={e => setForm({ ...form, start: e.target.value })} className="w-full p-2 bg-gray-700 border border-gray-600 rounded" /></div>
                  <div><label className="block text-sm mb-1">End (optional)</label><input type="datetime-local" value={form.end} onChange={e => setForm({ ...form, end: e.target.value })} className="w-full p-2 bg-gray-700 border border-gray-600 rounded" /></div>
                  <div className="flex justify-end space-x-3 pt-2"><button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-600 rounded">Cancel</button><button type="submit" className="px-4 py-2 bg-blue-600 rounded">Create</button></div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TeamChallengesTab; 