import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// Use paths relative to project root
import { REWARDS } from '../config/rewardsConfig'; 
import { 
    getStreakData, 
    saveStreakData, 
    updateUserStreak, 
    calculateStreakReward, 
    updateLastRewardedDay, 
    resetStreakDataCompletely,
    StreakData
} from '../utils/streakUtils'; 

// --- Mock localStorage for Vitest --- 
const localStorageMock = (() => {
  let store: { [key: string]: string } = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

vi.stubGlobal('localStorage', localStorageMock);
// -------------------------------------

describe('Streak Rewards Utilities', () => {
    beforeEach(() => {
        localStorage.clear();
        resetStreakDataCompletely();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('getStreakData & saveStreakData', () => {
        it('should return default data if nothing in localStorage', () => {
            const data = getStreakData();
            expect(data).toEqual({ currentStreakDays: 0, lastRewardedDay: 0, lastRunDate: null });
        });

        it('should return saved data from localStorage', () => {
            const testData: StreakData = { currentStreakDays: 5, lastRewardedDay: 3, lastRunDate: '2023-10-05' };
            localStorage.setItem('runstrStreakData', JSON.stringify(testData));
            const data = getStreakData();
            expect(data).toEqual(testData);
        });

        it('should save data correctly to localStorage', () => {
            const testData: StreakData = { currentStreakDays: 2, lastRewardedDay: 1, lastRunDate: '2023-10-02' };
            saveStreakData(testData);
            const stored = localStorage.getItem('runstrStreakData');
            expect(stored).toEqual(JSON.stringify(testData));
        });
    });

    describe('updateUserStreak', () => {
        it('should start a new streak at 1 for the first run', () => {
            const today = new Date('2023-10-01T10:00:00Z');
            const data = updateUserStreak(today);
            expect(data.currentStreakDays).toBe(1);
            expect(data.lastRunDate).toBe('2023-10-01');
        });

        it('should increment streak for a run on a consecutive day', () => {
            saveStreakData({ currentStreakDays: 1, lastRewardedDay: 0, lastRunDate: '2023-10-01' });
            const today = new Date('2023-10-02T10:00:00Z');
            const data = updateUserStreak(today);
            expect(data.currentStreakDays).toBe(2);
            expect(data.lastRunDate).toBe('2023-10-02');
        });

        it('should not change streak for multiple runs on the same day', () => {
            saveStreakData({ currentStreakDays: 3, lastRewardedDay: 0, lastRunDate: '2023-10-03' });
            const today = new Date('2023-10-03T15:00:00Z'); // Later on the same day
            const data = updateUserStreak(today);
            expect(data.currentStreakDays).toBe(3);
            expect(data.lastRunDate).toBe('2023-10-03');
        });

        it('should reset streak to 1 if a day is missed', () => {
            saveStreakData({ currentStreakDays: 5, lastRewardedDay: 0, lastRunDate: '2023-10-01' });
            const today = new Date('2023-10-03T10:00:00Z'); // Missed Oct 2nd
            const data = updateUserStreak(today);
            expect(data.currentStreakDays).toBe(1);
            expect(data.lastRunDate).toBe('2023-10-03');
        });
        
        it('should reset streak if new run date is before last run date (e.g., manual entry or timezone)', () => {
            saveStreakData({ currentStreakDays: 5, lastRewardedDay: 0, lastRunDate: '2023-10-05' });
            const earlierRunDate = new Date('2023-10-03T10:00:00Z');
            const data = updateUserStreak(earlierRunDate);
            expect(data.currentStreakDays).toBe(1);
            expect(data.lastRunDate).toBe('2023-10-03');
        });

        it('should preserve lastRewardedDay when updating streak', () => {
            saveStreakData({ currentStreakDays: 2, lastRewardedDay: 1, lastRunDate: '2023-10-01' });
            const today = new Date('2023-10-02T10:00:00Z');
            const data = updateUserStreak(today);
            expect(data.currentStreakDays).toBe(3);
            expect(data.lastRewardedDay).toBe(1); // Should remain unchanged by updateUserStreak
            expect(data.lastRunDate).toBe('2023-10-02');
        });
    });

    describe('calculateStreakReward', () => {
        const { satsPerDay, capDays } = REWARDS.STREAK;

        it('should return 0 amount if no current streak', () => {
            const data: StreakData = { currentStreakDays: 0, lastRewardedDay: 0, lastRunDate: null };
            const reward = calculateStreakReward(data);
            expect(reward.amountToReward).toBe(0);
            expect(reward.effectiveDaysForReward).toBe(0);
        });

        it('should calculate reward for 1-day streak, never rewarded', () => {
            const data: StreakData = { currentStreakDays: 1, lastRewardedDay: 0, lastRunDate: '2023-10-01' };
            const reward = calculateStreakReward(data);
            expect(reward.amountToReward).toBe(1 * satsPerDay);
            expect(reward.effectiveDaysForReward).toBe(1);
        });

        it('should calculate reward for 3-day streak, last rewarded for day 1', () => {
            const data: StreakData = { currentStreakDays: 3, lastRewardedDay: 1, lastRunDate: '2023-10-03' };
            const reward = calculateStreakReward(data);
            // Should reward for day 2 and 3 (3 - 1 = 2 days)
            expect(reward.amountToReward).toBe(2 * satsPerDay);
            expect(reward.effectiveDaysForReward).toBe(3);
        });

        it('should cap effectiveDaysForReward at capDays (e.g., 7 days)', () => {
            const data: StreakData = { currentStreakDays: 10, lastRewardedDay: 0, lastRunDate: '2023-10-10' };
            const reward = calculateStreakReward(data);
            expect(reward.effectiveDaysForReward).toBe(capDays);
            expect(reward.amountToReward).toBe(capDays * satsPerDay);
        });

        it('should calculate reward up to capDays if streak is long and partially rewarded', () => {
            const data: StreakData = { currentStreakDays: 10, lastRewardedDay: 3, lastRunDate: '2023-10-10' };
            const reward = calculateStreakReward(data);
            // Effective days = 7. Rewarded for days 4, 5, 6, 7 (7 - 3 = 4 days)
            expect(reward.effectiveDaysForReward).toBe(capDays);
            expect(reward.amountToReward).toBe((capDays - 3) * satsPerDay);
        });

        it('should return 0 if already rewarded for current effective (capped) streak', () => {
            const data: StreakData = { currentStreakDays: capDays, lastRewardedDay: capDays, lastRunDate: '2023-10-07' };
            const reward = calculateStreakReward(data);
            expect(reward.amountToReward).toBe(0);
            expect(reward.effectiveDaysForReward).toBe(capDays);
        });
        
        it('should return 0 if already rewarded for current effective streak (below cap)', () => {
            const data: StreakData = { currentStreakDays: 3, lastRewardedDay: 3, lastRunDate: '2023-10-03' };
            const reward = calculateStreakReward(data);
            expect(reward.amountToReward).toBe(0);
            expect(reward.effectiveDaysForReward).toBe(3);
        });

        it('should return 0 if current streak is less than or equal to lastRewardedDay (even if cap not met)', () => {
            const data: StreakData = { currentStreakDays: 2, lastRewardedDay: 3, lastRunDate: '2023-10-02' };
            const reward = calculateStreakReward(data);
            expect(reward.amountToReward).toBe(0);
            expect(reward.effectiveDaysForReward).toBe(2);
        });
        
         it('should return 0 if streak is 8 days, cap is 7, and last rewarded for day 7', () => {
            const data: StreakData = { currentStreakDays: 8, lastRewardedDay: capDays, lastRunDate: '2023-10-08' };
            const reward = calculateStreakReward(data);
            expect(reward.effectiveDaysForReward).toBe(capDays);
            expect(reward.amountToReward).toBe(0);
        });
    });

    describe('updateLastRewardedDay', () => {
        it('should update lastRewardedDay in localStorage', () => {
            saveStreakData({ currentStreakDays: 5, lastRewardedDay: 2, lastRunDate: '2023-10-05' });
            updateLastRewardedDay(5);
            const data = getStreakData();
            expect(data.lastRewardedDay).toBe(5);
        });

        it('should not decrease lastRewardedDay', () => {
            saveStreakData({ currentStreakDays: 5, lastRewardedDay: 4, lastRunDate: '2023-10-05' });
            updateLastRewardedDay(3); // Attempt to reward for an earlier day
            const data = getStreakData();
            expect(data.lastRewardedDay).toBe(4);
        });
    });
    
    describe('resetStreakDataCompletely', () => {
        it('should reset all streak data to initial values', () => {
            saveStreakData({ currentStreakDays: 10, lastRewardedDay: 7, lastRunDate: '2023-10-10' });
            const resetData = resetStreakDataCompletely();
            expect(resetData).toEqual({ currentStreakDays: 0, lastRewardedDay: 0, lastRunDate: null });
            const storedData = getStreakData();
            expect(storedData).toEqual({ currentStreakDays: 0, lastRewardedDay: 0, lastRunDate: null });
        });
    });
}); 