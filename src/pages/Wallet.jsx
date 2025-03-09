import { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { SimplePool } from 'nostr-tools';
import { publishToNostr, RELAYS } from '../utils/nostr';
import { NostrContext } from '../contexts/NostrContext';

export const Wallet = () => {
  const pool = useRef(new SimplePool());
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [sendAmount, setSendAmount] = useState('');
  const [recipientPubkey, setRecipientPubkey] = useState('');
  const [balance, setBalance] = useState(0);
  const [receiveToken, setReceiveToken] = useState('');
  const { defaultZapAmount, updateDefaultZapAmount } = useContext(NostrContext);
  const [zapAmountInput, setZapAmountInput] = useState(defaultZapAmount.toString());
  const mintUrl =
    'https://legend.lnbits.com/cashu/api/v1/4gr9Xcmz3XEkUNwiBiQGoL';

  // Set the zapAmountInput whenever defaultZapAmount changes
  useEffect(() => {
    setZapAmountInput(defaultZapAmount.toString());
  }, [defaultZapAmount]);

  const handleUpdateZapAmount = () => {
    if (zapAmountInput && parseInt(zapAmountInput, 10) > 0) {
      updateDefaultZapAmount(parseInt(zapAmountInput, 10));
    }
  };

  const initializeWallet = useCallback(async () => {
    try {
      const pubkey = await window.nostr.getPublicKey();

      const handleTokenEvent = (data) => {
        setTransactions((prev) => [
          ...prev,
          {
            id: Date.now(),
            type: 'in',
            amount: data.amount || 0,
            timestamp: Math.floor(Date.now() / 1000)
          }
        ]);
        setBalance((prev) => prev + (data.amount || 0));
      };

      const handleTransactionEvent = (data) => {
        setTransactions((prev) => [
          ...prev,
          {
            id: Date.now(),
            type: 'out',
            amount: data.amount || 0,
            timestamp: Math.floor(Date.now() / 1000)
          }
        ]);
        setBalance((prev) => prev - (data.amount || 0));
      };

      const sub = pool.current.sub(RELAYS, [
        {
          kinds: [7375, 7376],
          authors: [pubkey]
        }
      ]);

      const handleWalletEvent = async (event) => {
        try {
          const decryptedContent = await window.nostr.nip04.decrypt(
            event.pubkey,
            event.content
          );

          const data = JSON.parse(decryptedContent);

          if (event.kind === 7375) {
            handleTokenEvent(data);
          } else if (event.kind === 7376) {
            handleTransactionEvent(data);
          }
        } catch (error) {
          console.error('Error handling wallet event:', error);
        }
      };

      sub.on('event', handleWalletEvent);
      setLoading(false);
    } catch (error) {
      console.error('Error initializing wallet:', error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!window.nostr) {
      setLoading(false);
      return;
    }

    const currentPool = pool.current;
    initializeWallet();

    return () => {
      currentPool.close(RELAYS);
    };
  }, [initializeWallet]);

  const handleReceiveToken = async () => {
    if (!receiveToken) return;

    try {
      const event = {
        kind: 7375,
        created_at: Math.floor(Date.now() / 1000),
        content: await window.nostr.nip04.encrypt(
          await window.nostr.getPublicKey(),
          JSON.stringify({
            token: receiveToken,
            mint: mintUrl
          })
        ),
        tags: []
      };

      await publishToNostr(event);
      setReceiveToken('');
    } catch (error) {
      console.error('Error receiving token:', error);
      alert('Failed to receive token');
    }
  };

  const sendTokens = async () => {
    if (!sendAmount || !recipientPubkey) return;

    try {
      const amount = parseInt(sendAmount);
      const event = {
        kind: 7375,
        created_at: Math.floor(Date.now() / 1000),
        content: await window.nostr.nip04.encrypt(
          recipientPubkey,
          JSON.stringify({
            amount,
            mint: mintUrl
          })
        ),
        tags: []
      };

      await publishToNostr(event);
      setSendAmount('');
      setRecipientPubkey('');
    } catch (error) {
      console.error('Error sending tokens:', error);
      alert('Failed to send tokens');
    }
  };

  return (
    <div className="wallet-container">
      <h2>Cashu Wallet</h2>

      {!window.nostr ? (
        <button>Connect Nostr to Access Wallet</button>
      ) : loading ? (
        <p>Loading wallet...</p>
      ) : (
        <>
          <div className="balance-section">
            <h3>Balance: {balance} sats</h3>
          </div>

          <div className="receive-section">
            <h3>Receive</h3>
            <input
              type="text"
              value={receiveToken}
              onChange={(e) => setReceiveToken(e.target.value)}
              placeholder="Paste Cashu token"
            />
            <button onClick={handleReceiveToken} disabled={!receiveToken}>
              Receive
            </button>
          </div>

          <div className="send-section">
            <h3>Send</h3>
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
              placeholder="Recipient npub"
            />
            <button
              onClick={sendTokens}
              disabled={!sendAmount || !recipientPubkey}
            >
              Send
            </button>
          </div>

          <div className="zap-settings-section">
            <h3>Zap Settings</h3>
            <div className="zap-amount-setting">
              <label htmlFor="defaultZapAmount">Default Zap Amount (sats):</label>
              <input
                id="defaultZapAmount"
                type="number"
                min="1"
                value={zapAmountInput}
                onChange={(e) => setZapAmountInput(e.target.value)}
                placeholder="Default zap amount in sats"
              />
              <button 
                onClick={handleUpdateZapAmount} 
                disabled={!zapAmountInput || parseInt(zapAmountInput, 10) <= 0}
              >
                Save
              </button>
            </div>
            <p className="current-setting">Current default: {defaultZapAmount} sats</p>
          </div>

          <div className="transaction-history">
            <h3>Transaction History</h3>
            {transactions.map((tx) => (
              <div key={tx.id} className="transaction-item">
                <span>{tx.type === 'in' ? '↓' : '↑'}</span>
                <span>{tx.amount} sats</span>
                <span>{new Date(tx.timestamp * 1000).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
