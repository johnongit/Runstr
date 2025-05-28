# Bug Fixes (Batch 2)

This document tracks the progress of fixing a series of identified bugs. We will address them in order of estimated complexity, from easiest to hardest.

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
*   **Status:** Pending
*   **Progress:**
    *   [ ] Obtain details about the device and screen resolution from the user.
    *   [ ] Attempt to reproduce the issue on an emulator or similar device.
    *   [ ] Identify CSS/layout issues causing the problem.
    *   [ ] Implement responsive design adjustments.
    *   [ ] Test on various screen sizes, especially slimmer ones.
*   **Details/Notes:**
    *   This might involve adjustments to flexbox, grid, or media queries.

## 3. Step Counter - Count Accuracy

*   **Description:** Multiple users report that the step counter is significantly inaccurate, undercounting by as much as 40%. For example, a user walked 7211 steps, but the app showed 4495.
*   **Status:** Pending
*   **Progress:**
    *   [ ] Research step counting mechanisms on Android (SensorManager, step detector vs. step counter sensors).
    *   [ ] Review current step counting implementation in Runstr.
    *   [ ] Investigate potential issues: sensor batching, power-saving modes affecting sensor readings, algorithm sensitivity.
    *   [ ] Test with different devices and walking patterns.
    *   [ ] Calibrate or adjust the algorithm if necessary.
*   **Details/Notes:**
    *   Consider if platform-specific (Graphene, Calyx) power management or sensor access restrictions play a role.
    *   This could be an algorithmic issue or related to how sensor data is processed.

## 4. Graphene - Location tracking

*   **Description:** A user on GrapheneOS (Pixel device) enabled location tracking, but the OS settings show Runstr has not accepted location permissions, even though other apps have permissions.
*   **Status:** Pending
*   **Progress:**
    *   [ ] Review AndroidManifest.xml for correct permission declarations (`ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION` if applicable).
    *   [ ] Review the runtime permission request flow in the app.
    *   [ ] Research GrapheneOS specific permission handling or restrictions.
    *   [ ] Test the permission flow specifically on a GrapheneOS device/emulator.
    *   [ ] Ensure foreground service requirements for background location (if used) are met.
*   **Details/Notes:**
    *   GrapheneOS has enhanced privacy and security features that might affect how permissions are granted or reported.
    *   Check for any logs or system messages on the GrapheneOS device that might indicate the cause.

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