# Implementation Guide: Team Feature Enhancements

This guide outlines the steps to implement key enhancements for the NIP101e Teams feature, focusing on improving user experience and adding core functionality without introducing unnecessary complexity.

---

### **Part 1: Foundational UX - Mobile-Friendly Notifications**

**Goal:** Replace disruptive, browser-style `alert()` pop-ups with a non-blocking "toast" notification system suitable for a mobile-wrapped application.

**Chosen Approach:** Integrate the `react-hot-toast` library. It is lightweight, has no native dependencies, and will not conflict with the Vite/Capacitor build process.

**Implementation Steps:**

1.  **Install Library:** Add `react-hot-toast` to the project dependencies.
2.  **Add Provider:** Place the `<Toaster />` component in the main application layout file to make it globally available.
3.  **Replace Alerts:**
    *   In `src/pages/TeamDetailPage.tsx`, replace `alert()` calls in `handleJoinTeam` with `toast.success('Successfully joined team!')` and `toast.error(err.message)`.
    *   In `src/components/teams/TeamChallengesTab.tsx`, replace `alert()` calls in `handleCreate` with `toast.success('Challenge published!')` and `toast.error('Error creating challenge')`.

---

### **Part 2: Team Engagement - Leaderboard & Stats**

**Goal:** Transform the static "Feed" tab into a dynamic and engaging leaderboard, and provide at-a-glance team statistics.

**Implementation Steps:**

1.  **Enhance Data Fetching:**
    *   In `src/services/nostr/NostrTeamsService.ts`, update `fetchTeamActivityFeed` to accept a date range (e.g., `since`, `until` timestamps) to efficiently fetch workout records for the current month.
2.  **Create Data Processing Hook:**
    *   Create a new hook `src/hooks/useTeamActivity.ts`. This hook will take a list of raw Kind 1301 workout events and process them to:
        *   Calculate the total distance run by the entire team for the current month.
        *   Generate a ranked list of members by their individual total distance for the month.
        *   It will need to parse the `distance` tag from the workout events.
3.  **Build UI Components:**
    *   **New Component: `src/components/teams/TeamStatsWidget.tsx`**: A simple component that uses `useTeamActivity` to display the total team distance.
    *   **New Component: `src/components/teams/LeaderboardTab.tsx`**: A new tab component that displays the ranked list of members. It will show Rank, Avatar, Name, and Total Distance.
4.  **Integrate into Team Page:**
    *   In `src/pages/TeamDetailPage.tsx`:
        *   Replace the `feed` tab with the new `leaderboard` tab, rendering the `LeaderboardTab` component.
        *   Add the `TeamStatsWidget` component near the top of the page, below the team description.

---

### **Part 3: Captain & Member Experience**

**Goal:** Improve team identity and provide captains with essential management tools.

**Implementation Steps:**

1.  **Captain's Pinned Message:**
    *   **Data Layer:** In `NostrTeamsService.ts`, add a helper `preparePinnedMessageUpdate(teamEvent, message)` that creates a new event template with a `["pinned_message", "<message>"]` tag.
    *   **UI:** In `TeamDetailPage.tsx`, add state to manage an "edit mode" for the pinned message.
        *   If `isCaptain`, show an "Edit" icon next to the pinned message display.
        *   Clicking "Edit" reveals an input field and a "Save" button. Saving publishes the updated team event.
    *   **Display:** Create a `PinnedMessage.tsx` component to be displayed at the top of the `LocalTeamChat.tsx` component. It will parse and render the `pinned_message` tag from the team event.
2.  **Richer Member List:**
    *   **Data Layer:** Create a new hook `src/hooks/useProfiles.ts` that takes an array of `pubkeys` and uses `ndk.fetchProfiles()` to efficiently fetch and cache profile data (name, avatar).
    *   **UI:** In the `Members` tab within `TeamDetailPage.tsx`, use this hook to retrieve profile information for the `combinedMembers` list.
    *   **Component:** Update the `DisplayName` component or the list item rendering to display the `picture` from the profile as an avatar next to the name.
3.  **Visual Challenge Status:**
    *   **Logic:** In `src/components/teams/TeamChallengesTab.tsx`, create a helper function `getChallengeStatus(challenge)` that compares the challenge's `start` and `end` timestamps with the current time. It will return `'Upcoming'`, `'Active'`, or `'Completed'`.
    *   **UI:** In the `map` function that renders the list of challenges, call this helper and use the result to conditionally apply CSS classes to a new badge element.
        *   `Upcoming`: Blue badge
        *   `Active`: Green badge
        *   `Completed`: Grey badge
---
