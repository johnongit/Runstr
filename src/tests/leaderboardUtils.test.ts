import { describe, it, expect, beforeEach } from 'vitest';
import { computeDailyWinners } from '../utils/leaderboardUtils';

// Mock run data structure
interface MockRun {
  pubkey: string;
  elapsedTime: number; // Time in seconds
  userName?: string;
  userPicture?: string;
  // Add other relevant fields if needed by the function
}

describe('Leaderboard Utilities', () => {
  
  describe('computeDailyWinners', () => {
    const optInPubkeys = new Set(['pk1', 'pk2', 'pk3', 'pk4', 'pk5']);
    
    const runsToday: MockRun[] = [
      { pubkey: 'pk1', elapsedTime: 1800, userName: 'Alice' }, // 30:00
      { pubkey: 'pk2', elapsedTime: 1750, userName: 'Bob' },   // 29:10
      { pubkey: 'pk3', elapsedTime: 1850, userName: 'Charlie' },// 30:50
      { pubkey: 'pk4', elapsedTime: 1700, userName: 'David' }, // 28:20
      { pubkey: 'pk1', elapsedTime: 1780 }, // Alice's faster run
      { pubkey: 'pk5', elapsedTime: 1900, userName: 'Eve' },   // 31:40 (opted in)
      { pubkey: 'pk6', elapsedTime: 1600, userName: 'Frank' }, // 26:40 (NOT opted in)
      { pubkey: 'pk2', elapsedTime: 1820 }, // Bob's slower run
      { pubkey: 'pk7', elapsedTime: 0 }, // Invalid run (opted in) - No pubkey in optInPubkeys
      { pubkey: 'pk4', elapsedTime: 1710 }, // David's slower run
    ];

    it('should return an empty array if no runs provided', () => {
      const winners = computeDailyWinners([], optInPubkeys);
      expect(winners).toEqual([]);
    });

    it('should return an empty array if no users opted in', () => {
      const winners = computeDailyWinners(runsToday, new Set());
      expect(winners).toEqual([]);
    });

    it('should correctly identify the top 3 winners based on fastest time', () => {
      const winners = computeDailyWinners(runsToday, optInPubkeys);
      expect(winners.length).toBe(3);
      
      // Expected order: David (1700), Bob (1750), Alice (1780)
      expect(winners[0].pubkey).toBe('pk4');
      expect(winners[0].rank).toBe(1);
      expect(winners[0].time).toBe(1700);
      expect(winners[0].name).toBe('David');

      expect(winners[1].pubkey).toBe('pk2');
      expect(winners[1].rank).toBe(2);
      expect(winners[1].time).toBe(1750);
      expect(winners[1].name).toBe('Bob');
      
      expect(winners[2].pubkey).toBe('pk1');
      expect(winners[2].rank).toBe(3);
      expect(winners[2].time).toBe(1780);
      expect(winners[2].name).toBe('Alice');
    });

    it('should ignore users who did not opt in', () => {
      const winners = computeDailyWinners(runsToday, optInPubkeys);
      // Frank (pk6) had the fastest time (1600) but wasn't opted in
      expect(winners.some(w => w.pubkey === 'pk6')).toBe(false);
    });

    it('should use the fastest time for users with multiple runs', () => {
       const winners = computeDailyWinners(runsToday, optInPubkeys);
       // Alice's fastest was 1780, Bob's 1750, David's 1700
       expect(winners.find(w => w.pubkey === 'pk1')?.time).toBe(1780);
       expect(winners.find(w => w.pubkey === 'pk2')?.time).toBe(1750);
       expect(winners.find(w => w.pubkey === 'pk4')?.time).toBe(1700);
    });
    
    it('should handle fewer than 3 eligible runners', () => {
        const fewRuns: MockRun[] = [
            { pubkey: 'pk1', elapsedTime: 1900, userName: 'Alice'}, // Opted in
            { pubkey: 'pk6', elapsedTime: 1800, userName: 'Frank'}  // Not opted in
        ];
        const winners = computeDailyWinners(fewRuns, optInPubkeys);
        expect(winners.length).toBe(1);
        expect(winners[0].pubkey).toBe('pk1');
        expect(winners[0].rank).toBe(1);
        expect(winners[0].time).toBe(1900);
    });

    it('should ignore runs with zero or invalid elapsedTime', () => {
         const runsWithInvalidTime: MockRun[] = [
            { pubkey: 'pk1', elapsedTime: 1800, userName: 'Alice' },
            { pubkey: 'pk2', elapsedTime: 0, userName: 'Bob' }, // Invalid
            { pubkey: 'pk3', elapsedTime: -100, userName: 'Charlie'} // Invalid - though function only checks > 0
        ];
        const winners = computeDailyWinners(runsWithInvalidTime, optInPubkeys);
        expect(winners.length).toBe(1);
        expect(winners[0].pubkey).toBe('pk1');
    });
    
    it('should use default names/pictures if not provided on run object', () => {
       const runsMissingNames: MockRun[] = [
            { pubkey: 'pk1', elapsedTime: 1700 }, // Fastest, no name
            { pubkey: 'pk2', elapsedTime: 1800, userName: 'Bob' }
       ];
       const winners = computeDailyWinners(runsMissingNames, optInPubkeys);
       expect(winners.length).toBe(2);
       expect(winners[0].pubkey).toBe('pk1');
       expect(winners[0].name).toBe('Anonymous Runner');
       expect(winners[0].picture).toBe('');
       expect(winners[1].pubkey).toBe('pk2');
       expect(winners[1].name).toBe('Bob');
    });

  });
}); 