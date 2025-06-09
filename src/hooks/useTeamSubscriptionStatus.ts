import { useEffect, useState, useCallback } from 'react';
import { payLnurl } from '../utils/lnurlPay';
import { useAuth } from './useAuth';
import { useNostr } from './useNostr';
import {
  fetchSubscriptionReceipts,
  prepareTeamSubscriptionReceiptEvent,
} from '../services/nostr/NostrTeamsService';
import { createAndPublishEvent } from '../utils/nostr';

export type SubscriptionPhase = 'current' | 'overdue' | 'removed' | 'hidden' | 'none';

interface SubscriptionStatus {
  phase: SubscriptionPhase;
  nextDue?: number; // unix seconds
  renew: () => Promise<void>;
  isProcessing: boolean;
}

/**
 * Hook to derive subscription status for the current user in a given team.
 * Implements strict 30-/60-day grace rules.
 */
export function useTeamSubscriptionStatus(
  teamAIdentifier: string | null,
  payerPubkey: string | null,
  amountSats: number,
): SubscriptionStatus {
  const { ndk, ndkReady } = useNostr() as any;
  const { wallet } = useAuth();

  const [phase, setPhase] = useState<SubscriptionPhase>('none');
  const [nextDue, setNextDue] = useState<number | undefined>();
  const [isProcessing, setIsProcessing] = useState(false);

  const refreshStatus = useCallback(async () => {
    if (!ndkReady || !ndk || !teamAIdentifier || !payerPubkey) return;
    const receipts = await fetchSubscriptionReceipts(ndk, teamAIdentifier, payerPubkey, 20);
    if (!receipts.length) {
      setPhase('overdue'); // never paid -> overdue immediately until first payment
      return;
    }
    // sort by period_end descending
    const sorted = receipts.sort((a, b) => {
      const aEnd = Number(a.tags.find(t => t[0] === 'period_end')?.[1] || 0);
      const bEnd = Number(b.tags.find(t => t[0] === 'period_end')?.[1] || 0);
      return bEnd - aEnd;
    });
    const latest = sorted[0];
    const periodEnd = Number(latest.tags.find(t => t[0] === 'period_end')?.[1] || 0);
    setNextDue(periodEnd);
    const now = Math.floor(Date.now() / 1000);
    if (now <= periodEnd) setPhase('current');
    else if (now <= periodEnd + 60 * 60 * 24 * 30) setPhase('overdue');
    else if (now <= periodEnd + 60 * 60 * 24 * 60) setPhase('removed');
    else setPhase('hidden');
  }, [ndk, ndkReady, teamAIdentifier, payerPubkey]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const renew = useCallback(async () => {
    if (!wallet) throw new Error('Wallet not connected');
    if (!teamAIdentifier || !payerPubkey) throw new Error('Missing identifiers');
    setIsProcessing(true);
    const amount = amountSats;
    try {
      await payLnurl({
        lightning: 'runstr@geyser.fund',
        amount,
        wallet,
        comment: 'Runstr subscription renewal',
      });
      const start = Math.floor(Date.now() / 1000);
      const tmpl = prepareTeamSubscriptionReceiptEvent(teamAIdentifier, payerPubkey, amount, start);
      if (!tmpl) throw new Error('Failed to prepare receipt');
      await createAndPublishEvent(tmpl, null);
      await refreshStatus();
    } finally {
      setIsProcessing(false);
    }
  }, [wallet, teamAIdentifier, payerPubkey, amountSats, refreshStatus]);

  return { phase, nextDue, renew, isProcessing };
} 