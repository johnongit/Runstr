export interface StreakConfig {
  readonly satsPerDay: number;
  readonly capDays: number;
}

export interface LeaderboardConfig {
  readonly first: number;
  readonly second: number;
  readonly third: number;
}

export const REWARDS = {
  STREAK: {
    satsPerDay: 50,
    capDays: 7 // maximum days considered when calculating payout
  },
  DAILY_LEADERBOARD: {
    first: 100,
    second: 75,
    third: 25
  },
  EVENT_100K: {
    regFee: 5000,
    finishReward: 10000,
    startUtc: '2025-05-10T00:00:00Z', // Intentionally set in the future for testing
    endUtc: '2025-06-10T23:59:59Z',
    distanceKm: 100,
    nostrRelay: 'wss://relay.damus.io', // Example relay for event-specific notes
  }
} as const;

export interface EventConfig {
  readonly regFee: number;
  readonly finishReward: number;
  readonly startUtc: string;
  readonly endUtc: string;
  readonly distanceKm: number;
  readonly nostrRelay?: string; // Optional recommended relay for event posts
}

type ValueOf<T> = T[keyof T];
export type RewardKey = keyof typeof REWARDS;
// export type StreakConfig = typeof REWARDS["STREAK"]; // Now an interface
export type DailyLeaderboardConfig = typeof REWARDS["DAILY_LEADERBOARD"]; // Now an interface
export type Event100kConfig = typeof REWARDS["EVENT_100K"]; // Now an interface 