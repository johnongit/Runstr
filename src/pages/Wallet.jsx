import { useState, useEffect, useRef } from 'react';
import { SimplePool } from 'nostr-tools';
import { signInWithNostr, publishToNostr, RELAYS } from '../utils/nostr';

export const Wallet = () => {
  const pool = useRef(new SimplePool());
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [newWalletName, setNewWalletName] = useState('');
  const [tokens, setTokens] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [sendAmount, setSendAmount] = useState('');
  const [recipientPubkey, setRecipientPubkey] = useState('');
  const mintUrl = 'https://legend.lnbits.com/cashu/api/v1/4gr9Xcmz3XEkUNwiBiQGoL';

  useEffect(() => {
    fetchWallets();

    // Add token and transaction subscriptions
    if (window.nostr && selectedWallet) {
      const currentPool = pool.current;
      const subs = currentPool.sub(RELAYS, [
        {
          kinds: [7375],
          '#a': [`37375:${window.nostr.getPublicKey()}:${selectedWallet.id}`]
        },
        {
          kinds: [7376],
          '#a': [`37375:${window.nostr.getPublicKey()}:${selectedWallet.id}`]
        }
      ]);

      subs.on('event', (event) => {
        if (event.kind === 7375) {
          handleTokenEvent(event);
        } else if (event.kind === 7376) {
          handleTransactionEvent(event);
        }
      });

      return () => {
        currentPool.close(RELAYS);
      };
    }
  }, [selectedWallet]);

  const fetchWallets = async () => {
    if (!window.nostr) {
      setLoading(false);
      return;
    }

    try {
      // Subscribe to kind 37375 events for wallet data
      const sub = window.nostr.subscribe([{
        kinds: [37375],
        authors: [await window.nostr.getPublicKey()]
      }]);

      sub.on('event', async (event) => {
        // Skip deleted wallets
        if (event.tags.some(tag => tag[0] === 'deleted')) return;

        const walletId = event.tags.find(tag => tag[0] === 'd')?.[1];
        if (!walletId) return;

        // Decrypt wallet content
        const decryptedContent = await window.nostr.nip04.decrypt(
          event.pubkey,
          event.content
        );
        
        const walletData = JSON.parse(decryptedContent);
        
        setWallets(prev => {
          const existing = prev.findIndex(w => w.id === walletId);
          if (existing >= 0) {
            prev[existing] = {
              id: walletId,
              name: walletData.find(d => d[0] === 'name')?.[1],
              balance: walletData.find(d => d[0] === 'balance')?.[1] || '0',
              createdAt: event.created_at
            };
            return [...prev];
          }
          return [...prev, {
            id: walletId,
            name: walletData.find(d => d[0] === 'name')?.[1],
            balance: walletData.find(d => d[0] === 'balance')?.[1] || '0',
            createdAt: event.created_at
          }];
        });
      });

      setLoading(false);
    } catch (error) {
      console.error('Error fetching wallets:', error);
      setLoading(false);
    }
  };

  const createWallet = async () => {
    if (!window.nostr) {
      signInWithNostr();
      return;
    }

    try {
      const walletId = Math.random().toString(36).substring(2, 15);
      const content = JSON.stringify([
        ['name', newWalletName],
        ['balance', '0', 'sat'],
        ['unit', 'sat']
      ]);

      const encryptedContent = await window.nostr.nip04.encrypt(
        await window.nostr.getPublicKey(),
        content
      );

      const event = {
        kind: 37375,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['d', walletId]],
        content: encryptedContent
      };

      await window.nostr.signEvent(event);
      setNewWalletName('');
    } catch (error) {
      console.error('Error creating wallet:', error);
    }
  };

  const handleTokenEvent = async (event) => {
    if (!event.tags.some(t => t[0] === 'a')) return;
    
    const decryptedContent = await window.nostr.nip04.decrypt(
      event.pubkey,
      event.content
    );
    
    const tokenData = JSON.parse(decryptedContent);
    setTokens(prev => [...prev, {
      id: event.id,
      mint: tokenData.mint,
      proofs: tokenData.proofs,
      amount: tokenData.proofs.reduce((sum, p) => sum + parseInt(p.amount), 0)
    }]);
  };

  const handleTransactionEvent = async (event) => {
    if (!event.tags.some(t => t[0] === 'a')) return;
    
    const decryptedContent = await window.nostr.nip04.decrypt(
      event.pubkey,
      event.content
    );
    
    const txData = JSON.parse(decryptedContent);
    setTransactions(prev => [...prev, {
      id: event.id,
      type: txData.find(t => t[0] === 'direction')[1],
      amount: parseInt(txData.find(t => t[0] === 'amount')[1]),
      timestamp: event.created_at
    }]);
  };

  const sendTokens = async () => {
    if (!selectedWallet || !sendAmount || !recipientPubkey) return;
    
    const amount = parseInt(sendAmount);
    const availableTokens = tokens.filter(t => !t.spent);
    const totalAvailable = availableTokens.reduce((sum, t) => sum + t.amount, 0);
    
    if (totalAvailable < amount) {
      alert('Insufficient funds');
      return;
    }

    try {
      // Create token transfer event
      const transferEvent = {
        kind: 7375,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['a', `37375:${await window.nostr.getPublicKey()}:${selectedWallet.id}`]],
        content: await window.nostr.nip04.encrypt(
          recipientPubkey,
          JSON.stringify({
            mint: mintUrl,
            proofs: availableTokens.slice(0, amount)
          })
        )
      };

      await publishToNostr(transferEvent);

      // Create transaction history event
      const historyEvent = {
        kind: 7376,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['a', `37375:${await window.nostr.getPublicKey()}:${selectedWallet.id}`]],
        content: await window.nostr.nip04.encrypt(
          await window.nostr.getPublicKey(),
          JSON.stringify([
            ['direction', 'out'],
            ['amount', amount.toString(), 'sat'],
            ['recipient', recipientPubkey]
          ])
        )
      };

      await publishToNostr(historyEvent);

      setSendAmount('');
      setRecipientPubkey('');
    } catch (error) {
      console.error('Error sending tokens:', error);
      alert('Failed to send tokens');
    }
  };

  return (
    <div className="wallet-container">
      <h2>Cashu Wallets</h2>
      
      {!window.nostr ? (
        <button onClick={signInWithNostr}>Connect Nostr to View Wallets</button>
      ) : (
        <>
          <div className="create-wallet">
            <input
              type="text"
              value={newWalletName}
              onChange={(e) => setNewWalletName(e.target.value)}
              placeholder="New wallet name"
            />
            <button onClick={createWallet}>Create Wallet</button>
          </div>

          {loading ? (
            <p>Loading wallets...</p>
          ) : wallets.length === 0 ? (
            <p>No wallets found. Create one to get started!</p>
          ) : (
            <div className="wallets-list">
              {wallets.map(wallet => (
                <div 
                  key={wallet.id} 
                  className="wallet-item"
                  onClick={() => setSelectedWallet(wallet)}
                >
                  <h3>{wallet.name}</h3>
                  <p>Balance: {wallet.balance} sats</p>
                </div>
              ))}
            </div>
          )}

          {selectedWallet && (
            <div className="wallet-details">
              <h3>{selectedWallet.name}</h3>
              <p>Balance: {tokens.reduce((sum, t) => sum + t.amount, 0)} sats</p>
              
              <div className="send-tokens">
                <h4>Send Tokens</h4>
                <input
                  type="number"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  placeholder="Amount (sats)"
                />
                <input
                  type="text"
                  value={recipientPubkey}
                  onChange={(e) => setRecipientPubkey(e.target.value)}
                  placeholder="Recipient pubkey"
                />
                <button onClick={sendTokens}>Send</button>
              </div>

              <div className="transaction-history">
                <h4>Transaction History</h4>
                {transactions.map(tx => (
                  <div key={tx.id} className="transaction-item">
                    <span>{tx.type === 'in' ? '↓' : '↑'}</span>
                    <span>{tx.amount} sats</span>
                    <span>{new Date(tx.timestamp * 1000).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}; 