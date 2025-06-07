# Manual Rewards System - Brainstorm

This document outlines the brainstorming process for creating a script-based, manual payout system for RUNSTR rewards.

## 1. Core Objectives

- **Control**: Manually verify and send all reward payments.
- **Simplicity**: Use simple, runnable scripts to calculate payouts.
- **Targeted Rewards**: Focus on weekly user streaks and monthly team captain bonuses.
- **Scalability**: Solution should be manageable for the current user base (~50-100 users).

## 2. Proposed Reward Structures

### A. Weekly Streak Rewards

- **Frequency**: Weekly.
- **Trigger**: User activity (`kind:1301` records).
- **Logic**: 50 sats per workout within the week.
  - 1 run: 50 sats
  - 2 runs: 100 sats
  - 3 runs: 150 sats
  - ...and so on.
- **Output**: A list of npubs and corresponding sat amounts.
- **Action**: Manually zap each user on the list.

### B. Monthly Team Captain Rewards

- **Frequency**: Monthly.
- **Trigger**: Team size.
- **Logic**: 1,000 sats per member in the captain's team.
- **Output**: A list of captain npubs and corresponding sat amounts.
- **Action**: Manually zap each captain on the list.

---

## 3. Brainstorming & Implementation Questions

Here we can explore the technical and operational details.

### Weekly Streak Script - Key Questions

1.  **Data Source**: How will the script reliably fetch all `kind:1301` events for a given week?
    *   Querying multiple public relays? (Can be slow/incomplete)
    *   Running a dedicated RUNSTR relay that all users are encouraged to use?
    *   Using a Nostr indexing service API?

2.  **Time Period**: How do we define a "week"?
    *   Monday to Sunday UTC?
    *   A rolling 7-day period from when the script is run? (e.g., last 168 hours)
    *   A fixed "reward week" like Sunday 00:00 UTC to Saturday 23:59 UTC?

3.  **State Management**: How does the script prevent double-paying for the same activities?
    *   Should it store a log of the last processed timestamp or event ID?
    *   If we define a fixed week, the script just needs the start/end timestamps as input. E.g., `npm run calculate-rewards --start="2024-08-05" --end="2024-08-11"`.

4.  **User Identity**: The script will get pubkeys from events. How does it get the `npub` for easy manual zapping? (This is a simple conversion, the script should handle it).

### Monthly Captain Payout - Key Questions

1.  **Data Source**: How do we get an accurate member count for each team?
    *   From your `Teams_Implementation.md`, it seems team data is a `kind:33404` event. Does this event contain a list of member pubkeys that we can count?
    *   If so, the script needs to fetch the latest `kind:33404` for each team, get the captain's pubkey, and count the members.

2.  **Manual vs. Scripted**: You mentioned this could be manual.
    *   **Pro-Manual**: If you only have a few teams, you can just look at the dashboard.
    *   **Pro-Script**: A script automates the counting and prevents errors. It can also generate a clean payout list just like the streak script. A script seems better for consistency.

### General & Operational Questions

1.  **Tooling**: What language should the script be written in?
    *   JavaScript/TypeScript seems like a good fit, given the existing codebase. We could use libraries like `nostr-tools`. It could live in the `scripts/` directory.

2.  **User Communication**: How will users know they've been paid and why?
    *   The manual zap can include a memo, like "Your RUNSTR weekly streak reward!".
    *   Should the app have a UI to show reward history, even if payments are external? This could add complexity.

3.  **Future-Proofing**: How can we design this to be semi-automated in the future?
    *   The script could output a CSV or JSON file.
    *   In the future, another script could *consume* this file and use a service like Alby's API or an NWC connection to send the payments automatically, once you are comfortable with the logic. This provides a clear path from manual to automated.

## 4. Next Steps & Recommendations

1.  **Refine the Logic**: Let's finalize the rules for "weekly" periods and how team membership is counted.
2.  **Outline Script Structure**: Once the logic is clear, the next step would be to outline the structure of a `calculate-weekly-rewards.ts` script.
3.  **Implement Script**: Begin coding the script based on the decided-upon logic and structure. 