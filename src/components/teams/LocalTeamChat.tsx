import React, { useEffect, useState, useRef } from 'react';
import teamsDataService from '../../services/TeamsDataService';
import { getUserPublicKey } from '../../utils/nostrClient';
import { DisplayName } from '../shared/DisplayName';

interface LocalTeamChatProps {
  teamId: string;
  /** Optional – pass current user pubkey if you already have it */
  userPubkey?: string | null;
}

/**
 * LocalTeamChat – lightweight chat component that stores messages in localStorage
 * via TeamsDataService.  No Nostr / relay dependency.  Intended as an MVP while
 * server-sync (Nostr) is still under construction.
 */
export const LocalTeamChat: React.FC<LocalTeamChatProps> = ({ teamId, userPubkey }) => {
  const [messages, setMessages] = useState<Array<{id:string;userId:string;content:string;timestamp:string}>>([]);
  const [newMessage, setNewMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const listEndRef = useRef<HTMLDivElement>(null);

  // Make sure TeamsDataService is initialised
  useEffect(() => {
    teamsDataService.initialize();
  }, []);

  // Initial load & listener
  useEffect(() => {
    const loadMsgs = () => {
      setMessages(teamsDataService.getTeamMessages(teamId));
    };
    loadMsgs();

    const listener = () => loadMsgs();
    teamsDataService.addListener('messages', listener);

    return () => {
      teamsDataService.removeListener('messages', listener);
    };
  }, [teamId]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const pubkey = userPubkey || (await getUserPublicKey());
      if (!pubkey) {
        setError('Unable to determine your user ID. Please connect Nostr.');
        return;
      }
      await teamsDataService.addTeamMessage(teamId, pubkey, newMessage.trim());
      setNewMessage('');
    } catch (err: any) {
      console.error('LocalTeamChat send error', err);
      setError(err.message || 'Failed to send message');
    }
  };

  const formatTs = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return '' }
  };

  return (
    <div className="flex flex-col h-96 border border-border-secondary rounded-lg bg-bg-secondary">
      <div className="flex-grow overflow-y-auto p-2">
        {messages.length === 0 && <p className="text-text-muted text-center">No messages yet.</p>}
        {messages.map(msg => (
          <div key={msg.id} className="mb-1.5">
            <strong className="text-xs text-text-primary"><DisplayName pubkey={msg.userId} /></strong>{' '}
            <span className="text-xs text-text-muted">{formatTs(msg.timestamp)}</span>
            <p className="my-0.5 text-text-primary break-words whitespace-pre-wrap">{msg.content}</p>
          </div>
        ))}
        <div ref={listEndRef} />
      </div>
      {error && <p className="text-error text-xs p-1">{error}</p>}
      <form onSubmit={handleSend} className="flex border-t border-border-secondary">
        <input
          type="text"
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          placeholder="Type a message…"
          className="flex-grow border-none p-2 bg-bg-tertiary text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button 
          type="submit" 
          className="px-3 py-2 bg-primary text-white border-none hover:bg-primary-hover transition-colors active:bg-white active:text-black focus:outline-none focus:ring-2 focus:ring-primary-hover"
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default LocalTeamChat; 