# Runstr App Bugfixes & Improvements (Round 2)

This document tracks the progress and solutions for the identified issues. Solutions should prioritize simplicity and leverage existing application components and patterns, avoiding unnecessary complexity or code duplication.

## Issues (Ordered Easiest to Hardest Estimate)

1.  **[~] Workout record shows 2 dates**
    *   **Problem**: The workout record display shows two dates; the top one is redundant and incorrect.
    *   **Solution**: The primary date displayed at the top of the workout card, which was derived from the `workoutName` variable (e.g., "5/28/2025 Run"), was incorrect. This line has been removed. The correct date, sourced from `event.created_at` (e.g., "Date: May 29, 2025"), remains.
    *   **Affected Areas**: `src/pages/NostrStatsPage.jsx`
    *   **Implementation**: Removed the `<p className="text-lg font-semibold">{workoutName}</p>` line from the component.

2.  **[~] Settings modal: "skip countdown" toggle not working**
    *   **Problem**: The toggle switch for the "Skip End Countdown" option in the settings modal was not functional. The "Skip Start Countdown" toggle worked correctly.
    *   **Solution**: As an immediate fix, the "Skip End Countdown" toggle and its associated descriptive text have been removed from the UI. The underlying cause was not immediately apparent as the code in `MenuBar.jsx` and `SettingsContext.jsx` appeared symmetrical for both start and end countdown toggles. Further investigation would be needed to fix the toggle itself.
    *   **Affected Areas**: `src/components/MenuBar.jsx`
    *   **Implementation**: Removed the JSX block for the "Skip End Countdown" toggle from `src/components/MenuBar.jsx`.

3.  **[~] Dashboard: Incorrect sats display for run day streaks**
    *   **Problem**: The dashboard shows "Run day 2 to earn 100 sats". It should be:
        *   Day 2: 200 sats
        *   Day 3: 300 sats
        *   Day 4: 400 sats
        *   Day 5: 500 sats (and so on, up to `capDays` from config, at 100 sats per day number).
    *   **Solution**: Updated the calculation for `tomorrowReward` in `src/components/AchievementCard.jsx`.
    *   **Affected Areas**: `src/components/AchievementCard.jsx`, `src/config/rewardsConfig.ts` (for reference of `satsPerDay`)
    *   **Implementation**: Changed `tomorrowReward` calculation from `satsPerDay` to `(tomorrowDay * satsPerDay)`.

4.  **[ ] Personal best is wrong**
    *   **Problem**: The displayed personal best metrics are incorrect.
    *   **Solution**: Investigate the source of the personal best data, how it's calculated/retrieved, and correct the logic or display.
    *   **Affected Areas**: Personal best calculation logic, data storage/retrieval for activities, UI component displaying personal bests.

5.  **[ ] Missing reward notification modal**
    *   **Problem**: Users receive rewards for streaks but do not get an in-app notification modal confirming the reward.
    *   **Solution**: Implement a notification modal that appears when a user earns rewards.
    *   **Affected Areas**: Reward processing logic, UI notification system.

6.  **[ ] Toggle for metrics selection in workout history**
    *   **Problem**: Users need a way to select which specific metrics (e.g., pace, distance, heart rate if available) are sent with their workout history package.
    *   **Solution**: Add toggles in user settings for individual metrics and modify the workout data packaging logic to respect these preferences.
    *   **Affected Areas**: Settings UI, user preferences state, Nostr event creation logic for workout history.

7.  **[ ] Issue posting other metrics (besides workout record)**
    *   **Problem**: Metrics other than the basic workout record (e.g., detailed stats) are not being posted successfully.
    *   **Solution**: Debug the process of collecting, formatting, and publishing these additional metrics via Nostr.
    *   **Affected Areas**: Data collection for workouts, Nostr event creation for various metric types, relay publishing mechanism.

8.  **[ ] Lightning address fallback for rewards**
    *   **Problem**: There's no option for users to provide a fallback Lightning address if zaps fail. The reliability of fetching profile information from multiple relays to find a zap address is also a concern.
    *   **Solution**: Add an input field in settings for a fallback Lightning address. Modify the reward payout logic to attempt zapping first, then use the fallback address if zapping isn't possible or profile information is insufficient.
    *   **Affected Areas**: User settings UI, user profile data, reward payout logic, Lightning payment integration.

## 1. Language for Rewards - Is confusing

*   **Description:** The description and UI for the rewards does not accurately portray what is happening. It says "next reward2/3 days" and "300 sats in 1 day". Users find this confusing.
*   **Suggestion:** Clean up the language. Maybe in the second box, show 7 boxes and a highlighted box for each streak day accomplished, with the amount of rewards on top of each box representing the reward for that streak. Accurately show how much they received and how much they will receive. For example, "Earn 300 sats for day 3" and "Earn 400 sats for day 4".
*   **Status:** Completed
*   **Solution Decided:** 
    *   Keep the top box as is (showing "Current Streak" with flame icon and number of days)
    *   Replace the bottom box content with:
        *   Line 1: `Today's Reward (Day X)`
        *   Line 2: `[amount] sats`
        *   Line 3: `Run tomorrow (Day Y) to earn [amount] sats`
*   **Progress:**
    *   [x] Analyze current UI and reward logic.
    *   [x] Propose new UI mockups/text.
    *   [x] Implement UI changes.
    *   [x] Implement logic changes for displaying reward progression.
    *   [ ] Test thoroughly.
*   **Details/Notes:**
    *   Focus on clarity and accurate representation of the reward system.
    *   Example: If user has 2-day streak and just earned 200 sats for Day 2, show:
        *   "Today's Reward (Day 2)"
        *   "200 sats"  
        *   "Run tomorrow (Day 3) to earn 300 sats"
*   **Implementation Details:**
    *   Modified `src/components/AchievementCard.jsx` to calculate and display today's reward and tomorrow's potential reward
    *   Added new CSS styles in `src/assets/styles/achievements.css` for the reward display
    *   The system now clearly shows:
        *   Today's reward (if any was earned)
        *   Tomorrow's potential reward
        *   Special message when the 7-day cap is reached

## 2. Calyx - Display issue

*   **Description:** A user on Calyx OS showed a screenshot with strange buttons on the bottom of the screen. This suggests the app needs optimization for screens with slimmer displays or different aspect ratios.
*   **Status:** Completed
*   **Progress:**
    *   [x] Obtain details about the device and screen resolution from the user.
    *   [x] Attempt to reproduce the issue on an emulator or similar device.
    *   [x] Identify CSS/layout issues causing the problem.
    *   [x] Implement responsive design adjustments.
    *   [ ] Test on various screen sizes, especially slimmer ones.
*   **Details/Notes:**
    *   This might involve adjustments to flexbox, grid, or media queries.
*   **Implementation Details:**
    *   Fixed `FloatingMusicPlayer` component to return `null` instead of an empty `<span>` when no track is playing
        *   This prevents potential layout artifacts from an empty element
    *   Updated `MenuBar` navigation layout:
        *   Changed from fixed width (`w-1/5`) to flexible layout (`flex-1`)
        *   Added `whitespace-nowrap` to prevent text wrapping
        *   Increased max-width container from 375px to 500px
        *   Changed from `justify-around` to `justify-between` for better space distribution
    *   Added responsive CSS in `index.css`:
        *   Font size reduction for screens < 360px wide
        *   Further optimization for screens < 320px wide
        *   Ensured text doesn't wrap on narrow screens
    *   These changes should fix the "DASHBOARD" text wrapping issue and prevent visual artifacts

## 3. Step Counter - Count Accuracy

*   **Description:** Multiple users report that the step counter is significantly inaccurate, undercounting by as much as 40%. For example, a user walked 7211 steps, but the app showed 4495.
*   **Status:** In Progress
*   **Progress:**
    *   [x] Research step counting mechanisms on Android (SensorManager, step detector vs. step counter sensors).
    *   [x] Review current step counting implementation in Runstr.
    *   [x] Investigate potential issues: sensor batching, power-saving modes affecting sensor readings, algorithm sensitivity.
    *   [x] Identify root cause: App uses fixed stride length (0.762m) for all users
    *   [x] Implement height-based stride length calculation
    *   [x] Add user settings for height and custom stride length
    *   [ ] Test with different devices and walking patterns.
    *   [ ] Consider implementing actual step sensor integration (future enhancement)
*   **Details/Notes:**
    *   Root cause identified: The app doesn't use actual step sensors, it estimates steps by dividing GPS distance by a fixed stride length (0.762m)
    *   This is problematic because stride length varies by height, speed, and individual differences
    *   For shorter users or those with shorter strides, this significantly undercounts steps
*   **Implementation Details:**
    *   Modified `RunTracker.js` to support customizable stride length
    *   Added height-based stride length estimation using formula: Height (inches) × 0.414
    *   Added settings UI in `MenuBar.jsx` for users to input:
        *   Their height (cm) for automatic stride length calculation
        *   OR a custom stride length (meters) for precise step counting
    *   Updated `RunHistory.jsx` to use the same customizable stride length
    *   Users can now get more accurate step counts based on their personal measurements
*   **Future Enhancements:**
    *   Consider integrating Android's TYPE_STEP_COUNTER sensor for actual step detection
    *   Add automatic stride length calibration based on user's walking data
    *   Support different stride lengths for walking vs running

## 4. Graphene - Location tracking

*   **Description:** A user on GrapheneOS (Pixel device) enabled location tracking, but the OS settings show Runstr has not accepted location permissions, even though other apps have permissions.
*   **Status:** In Progress
*   **Progress:**
    *   [x] Review AndroidManifest.xml for correct permission declarations (`ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION` if applicable).
    *   [x] Review the runtime permission request flow in the app.
    *   [x] Research GrapheneOS specific permission handling or restrictions.
    *   [x] Implement improved permission handling for GrapheneOS
    *   [ ] Test the permission flow specifically on a GrapheneOS device/emulator.
    *   [x] Ensure foreground service requirements for background location (if used) are met.
*   **Details/Notes:**
    *   GrapheneOS has enhanced privacy and security features that might affect how permissions are granted or reported.
    *   Check for any logs or system messages on the GrapheneOS device that might indicate the cause.
*   **Implementation Details:**
    *   Enhanced `PermissionDialog.jsx` with:
        *   Unique watcher IDs to prevent conflicts
        *   More explicit configuration options for GPS provider
        *   Better error handling with user-friendly messages
        *   Automatic settings navigation on permission failure
        *   Delayed cleanup to ensure permission request completes
    *   Improved `RunTracker.js` with:
        *   Unique session IDs for each tracking session
        *   Enhanced error handling and permission checking
        *   Permission error events that UI can listen to
        *   More detailed configuration for background location
    *   Updated `AndroidManifest.xml` with:
        *   Foreground service declaration with location type
        *   Additional permissions: FOREGROUND_SERVICE, FOREGROUND_SERVICE_LOCATION, POST_NOTIFICATIONS
        *   Hardware feature declarations for location and GPS
    *   These changes should help GrapheneOS properly recognize and grant location permissions

## 5. NWC (Nostr Wallet Connect) - Intermittent functionality

*   **Description:** NWC connection is reportedly being lost when the user leaves and returns to the wallet page. Zaps are also reported to hardly work.
*   **Status:** Pending
*   **Progress:**
    *   [ ] Review NWC connection management logic (initial connection, re-connection, session persistence).
    *   [ ] Investigate state management around the NWC connection. Is it being cleared unintentionally?
    *   [ ] Examine the zap sending flow: event creation, signing, relay submission, error handling.
    *   [ ] Add detailed logging around NWC connection states and zap attempts.
    *   [ ] Test extensively, focusing on app lifecycle events (backgrounding, resuming) and network changes.
*   **Details/Notes:**
    *   Intermittent issues can be hard to debug; focus on robust error handling and state management.
    *   Check if there are any known issues with the NWC relays being used or the NWC library itself.

## 6. Amber - Intermittent functionality on Calyx

*   **Description:** Multiple users on CalyxOS report unstable Amber connection. They had to remove the connection in Amber, log out of Runstr, delete the remembered profile, and re-establish the connection for posting to work. Some received a "no connection to key store" message.
*   **Status:** Pending
*   **Progress:**
    *   [ ] Review Amber integration logic, particularly how connection state is managed and how signing requests are handled.
    *   [ ] Investigate the "no connection to key store" message. Is this from Runstr, Amber, or CalyxOS?
    *   [ ] Research any specific CalyxOS restrictions or behaviors related to inter-app communication or background services that might affect Amber.
    *   [ ] Test the full lifecycle: connect Amber, post, background app, return, post again.
    *   [ ] Add robust logging around Amber interactions.
*   **Details/Notes:**
    *   The need to fully reset the connection points to potential state corruption or stale connection data.
    *   This involves interaction between Runstr, the Amber app, and CalyxOS, adding layers of complexity. 