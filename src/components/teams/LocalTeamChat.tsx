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
    <div style={{ display:'flex', flexDirection:'column', height:'400px', border:'1px solid #444', borderRadius:'6px' }}>
      <div style={{ flexGrow:1, overflowY:'auto', padding:'8px' }}>
        {messages.length === 0 && <p style={{ color:'#aaa', textAlign:'center' }}>No messages yet.</p>}
        {messages.map(msg => (
          <div key={msg.id} style={{ marginBottom:'6px' }}>
            <strong style={{ fontSize:'0.8rem' }}><DisplayName pubkey={msg.userId} /></strong>{' '}
            <span style={{ fontSize:'0.7rem', color:'#888' }}>{formatTs(msg.timestamp)}</span>
            <p style={{ margin:'2px 0', wordBreak:'break-word', whiteSpace:'pre-wrap' }}>{msg.content}</p>
          </div>
        ))}
        <div ref={listEndRef} />
      </div>
      {error && <p style={{ color:'salmon', fontSize:'0.8rem', padding:'4px' }}>{error}</p>}
      <form onSubmit={handleSend} style={{ display:'flex', borderTop:'1px solid #555' }}>
        <input
          type="text"
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          placeholder="Type a message…"
          style={{ flexGrow:1, border:'none', padding:'8px', background:'#222', color:'#fff' }}
        />
        <button type="submit" style={{ padding:'8px 12px', background:'#2563eb', color:'#fff', border:'none' }}>Send</button>
      </form>
    </div>
  );
};

export default LocalTeamChat; 