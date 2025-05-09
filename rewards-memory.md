# Rewards System Knowledge Base (Simplified Implementation)

## 1. Overview

This document describes the **simplified** rewards system implemented in Runstr, focusing on the current logic for Streak Rewards, Daily Leaderboard Rewards, and the specific "100k May-June Challenge" event. Payouts are managed via the consolidated `rewardsPayoutService`.

## 2. Streak Rewards (Linear Model)

Streak rewards incentivize consecutive days of activity with a simple, linear payout.

### Configuration & Storage
*   **Configuration**: Defined in `src/config/rewardsConfig.ts` under `REWARDS.STREAK`.
    *   `satsPerDay`: Amount rewarded for each day added to the streak (e.g., 50 sats).
    *   `capDays`: Maximum streak length eligible for daily reward accumulation (e.g., 7 days). Rewards stop accruing per day *after* this cap is reached, though the visual streak count may continue.
*   **LocalStorage**:
    *   `runstrStreakData`: Stores a single JSON object with the current streak state (`{ currentStreakDays: number, lastRewardedDay: number, lastRunDate: string | null }`).

### Eligibility & Tracking
*   **`src/utils/streakUtils.ts`**: Contains the core logic.
    *   `getStreakData()`: Retrieves the current streak state from localStorage.
    *   `updateUserStreak(newRunDateObject)`: Updates `currentStreakDays` and `lastRunDate` based on the new run's date. Resets streak to 1 if a day is missed. Preserves `lastRewardedDay`.
    *   `calculateStreakReward(streakData)`: Calculates the *pending* reward amount based on the difference between the current effective streak days (capped at `capDays`) and the `lastRewardedDay`. Returns `{ amountToReward, effectiveDaysForReward, message }`.
    *   `updateLastRewardedDay(rewardedDayNum)`: Called *after* a successful payout to update `lastRewardedDay` in localStorage to the streak day number just paid out for.

### Payout Process (via Scheduler)
1.  **Scheduler Trigger**: The `startRewardScheduler` function (called in `App.jsx`) sets up a periodic check (via `setInterval` in `src/services/scheduler.ts`).
2.  **Daily Check**: `checkStreakRewards` runs daily (or more frequently for demo).
3.  **Calculation**: Calls `calculateStreakReward` using current `getStreakData`.
4.  **Payout**: If `amountToReward > 0`:
    *   Retrieves the user's `pubkey` from localStorage.
    *   Calls `rewardsPayoutService.sendStreakReward(pubkey, amount, effectiveDays)`.
5.  **Update State**: If payout is successful (`result.success`), calls `updateLastRewardedDay(effectiveDaysForReward)` to prevent duplicate payouts for the same streak days.

## 3. Daily Leaderboard Rewards (Fastest Time, Opt-In)

Rewards the top 3 fastest run times each day among users who have opted in.

### Configuration & Opt-In
*   **Rewards**: Defined in `src/config/rewardsConfig.ts` under `REWARDS.DAILY_LEADERBOARD` (e.g., `{ first: 100, second: 75, third: 25 }`).
*   **Opt-In**:
    *   Managed via `SettingsContext` and the toggle in `Settings.jsx`.
    *   The boolean `leaderboardOptIn` flag is stored within the `settings` object in localStorage.
    *   The scheduler reads this via `getLeaderboardOptInStatusFromStorage()` in `src/services/scheduler.ts`.

### Winner Calculation & Payout (via Scheduler)
1.  **Scheduler Trigger**: Same interval as streak checks (`src/services/scheduler.ts`).
2.  **Daily Check**: `checkLeaderboardRewards` runs daily.
3.  **Data Fetching**:
    *   Calls `runDataService.getRunsByDate(yesterdayISO)` to get all runs from the previous day.
    *   Calls `getOptedInUsers()` (currently a placeholder in `scheduler.ts` that only includes the current user if opted-in, needs proper implementation for multi-user).
4.  **Winner Calculation**: `computeDailyWinners(runsYesterday, optInPubkeys)` (in `src/utils/leaderboardUtils.js`) filters runs by opted-in users, finds the fastest run per user, sorts them, and returns the top 3.
5.  **Payout**: If winners are found:
    *   Iterates through the top 3 winners.
    *   Calls `rewardsPayoutService.sendLeaderboardReward(winner.pubkey, amount, rank, yesterdayISO)` for each winner.

## 4. 100km Challenge Event (May 10 - June 10)

A specific event requiring registration and rewarding finishers.

### Configuration & Storage
*   **Configuration**: Defined in `src/config/rewardsConfig.ts` under `REWARDS.EVENT_100K`.
    *   Includes `regFee`, `finishReward`, `startUtc`, `endUtc`, `distanceKm`, `nostrRelay`.
*   **LocalStorage**:
    *   `eventProgress_EVENT_100K`: Stores a single JSON object (`EventProgressData`) with registration status, dates, total distance, finish status, user pubkey, and transaction IDs (`{ userPubkey, registered, registrationDate, registrationTxId, totalKm, finished, finishDate, payoutTxId }`).

### Core Logic (`src/services/event100kService.ts`)
*   **`register(userPubkey)`**:
    *   Checks if already registered or if outside event dates.
    *   Calls `rewardsPayoutService.sendEventTransaction` to process the `regFee`.
    *   Saves initial `EventProgressData` to localStorage.
    *   Publishes a Nostr event (kind `31000`) using `createAndPublishEvent`.
*   **`addDistance(distanceKm)`**:
    *   Called by `RunDataService.saveRun` *after* a run is saved.
    *   Checks if user is registered and event is active.
    *   Checks if run occurred *after* registration date.
    *   Increments `totalKm` in localStorage.
    *   If `totalKm` >= `config.distanceKm` and not already finished:
        *   Sets `finished = true` and `finishDate`.
        *   Publishes a Nostr event (kind `31001`) using `createAndPublishEvent`.
    *   Saves updated progress to localStorage.
*   **`processEventPayouts()`**:
    *   Called by the scheduler (`checkEventPayouts` in `src/services/scheduler.ts`) *after* the `eventEndUtc`.
    *   Retrieves event progress from localStorage (placeholder for multi-user fetch).
    *   Checks if the user `finished` and `payoutTxId` is not set.
    *   Calls `rewardsPayoutService.sendEventTransaction` to process the `finishReward`.
    *   Updates `payoutTxId` in localStorage on success.

## 5. Rewards Payout Service & Transaction Management

Consolidated service for handling all reward/fee transactions.

### Key Files
*   **`src/config/rewardsConfig.ts`**: Defines reward amounts, caps, event details.
*   **`src/services/rewardsPayoutService.ts`**:
    *   High-level service providing methods like `sendStreakReward`, `sendLeaderboardReward`, `sendEventTransaction`.
    *   Contains `DEMO_MODE` flag for simulating payouts.
    *   Routes different reward types to `transactionService.processReward` with appropriate parameters.
*   **`src/services/transactionService.js`**:
    *   Manages the lifecycle of individual transactions.
    *   Defines `TRANSACTION_TYPES` (now includes `EVENT_REGISTRATION_FEE`, `EVENT_PAYOUT`).
    *   `recordTransaction`, `updateTransaction`: Internal state management (likely in memory or simple storage, not detailed).
    *   `processReward(...)`: Generic function handling the interaction with the low-level Bitcoin service (`bitvoraService`). Records pending state, calls `bitvoraService.sendReward`, updates state to `COMPLETED` or `FAILED`.
*   **`src/services/bitvoraService.js`** (Assumed): Low-level client for the actual Bitvora API interaction (implementation not shown).
*   **`src/services/scheduler.ts`**: Contains the timer logic (`setInterval`) that periodically calls check functions (`checkStreakRewards`, `checkLeaderboardRewards`, `checkEventPayouts`).

### Data Flow (Example: Streak Reward via Scheduler)
1.  Scheduler (`scheduler.ts`) interval triggers `checkStreakRewards`.
2.  `checkStreakRewards` calls `getStreakData` and `calculateStreakReward` (`streakUtils.ts`).
3.  If reward > 0, calls `rewardsPayoutService.sendStreakReward`.
4.  `rewardsPayoutService` calls `transactionService.processReward` with type `STREAK_REWARD`.
5.  `transactionService`:
    a.  Records transaction internally (status: `PENDING`).
    b.  Calls `bitvoraService.sendReward` (actual API call).
    c.  Receives response.
    d.  Updates internal transaction record (status: `COMPLETED` or `FAILED`).
6.  Result propagates back to `rewardsPayoutService`.
7.  Result propagates back to `checkStreakRewards`.
8.  If successful, `checkStreakRewards` calls `updateLastRewardedDay` (`streakUtils.ts`) to update localStorage state.

## 6. Key Files & Hooks Summary (Updated)

*   **Configuration**: `src/config/rewardsConfig.ts`
*   **Streak Logic**: `src/utils/streakUtils.ts`, `src/hooks/useStreakRewards.ts` (UI display)
*   **Leaderboard Logic**: `src/utils/leaderboardUtils.js` (winner calc), `src/hooks/useLeaderboard.ts` (UI display, state)
*   **100k Event Logic**: `src/services/event100kService.ts`
*   **Payout Service**: `src/services/rewardsPayoutService.ts` (facade)
*   **Transaction Service**: `src/services/transactionService.js` (lifecycle)
*   **Bitcoin Client**: `src/services/bitvoraService.js` (assumed API client)
*   **Scheduler**: `src/services/scheduler.ts` (timer & checks)
*   **Settings Integration**: `src/contexts/SettingsContext.jsx`, `src/pages/Settings.jsx` (leaderboard opt-in)
*   **App Integration**: `src/App.jsx` (scheduler start/stop)

## 7. Current State & Potential Areas for Review/Improvement

*   **Leaderboard Multi-User**: The scheduler's `getOptedInUsers` currently only considers the logged-in user due to localStorage limitations. A real implementation requires a backend or P2P mechanism to fetch all opted-in users for correct daily winner calculation.
*   **Scheduler Reliability**: The web-based `setInterval` in `scheduler.ts` is not suitable for a production mobile app. Needs replacement with platform-specific background task APIs (Capacitor Background Task or similar).
*   **Error Handling & Retries**: Payout failures in the scheduler are logged but lack robust retry mechanisms or user notifications.
*   **Event Run Validation**: `event100kService.addDistance` currently relies on the *current system time* when called, not the run's actual timestamp, for checking against event/registration dates. This should ideally use the run's timestamp passed from `RunDataService`.
*   **Transaction Service Storage**: `transactionService.js` doesn't specify how it stores the transaction history (pending, completed, failed). Assumed to be in-memory or simple storage; might need persistent storage.
*   **RUNSTR Pubkey for Fees**: The event registration fee logic notes the need for a configured RUNSTR pubkey to receive fees, which isn't implemented yet.
*   **Test Coverage**: Unit tests for the scheduler logic itself (using fake timers) are still needed.
*   **Nostr Event Kinds**: Custom kinds `31000` and `31001` are used for event registration/finish. These are experimental; long-term use might warrant discussion or alignment with emerging standards if any exist. 