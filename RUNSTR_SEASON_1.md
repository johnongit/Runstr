# RUNSTR SEASON 1 - Implementation Plan

## Overview
Transform RUNSTR 500 into RUNSTR SEASON 1 - a paid 3-month distance competition where users pay 10k sats for a season pass. Only paying participants appear in feeds and leaderboards.

### Core Requirements
- Rename RUNSTR 500 to RUNSTR SEASON 1
- Remove distance percentage (competition shows who runs furthest distance in 3 months)
- Season Pass button that generates payment invoice
- Payment success adds user to participants list
- Feeds and Leaderboards only show 1301 notes from npubs on participants list

---

## Phase 1: Rebrand to Season 1 
**Goal**: Update all text and remove percentage logic (zero risk changes)

### Changes:
- **Replace all "RUNSTR 500" → "RUNSTR SEASON 1"** in:
  - `src/components/LeagueMap.jsx`
  - All documentation files
- **Remove percentage calculations** from LeagueMap component
- **Add season configuration** to `src/config/rewardsConfig.ts`:
  ```typescript
  SEASON_1: {
    passPrice: 10000,
    startUtc: '2025-02-01T00:00:00Z',
    endUtc: '2025-05-01T23:59:59Z',
    title: 'RUNSTR SEASON 1'
  }
  ```

---

## Phase 2: Season Pass Service & Participant List
**Goal**: Create basic participant tracking (no payment yet)

### Create:
- **`src/services/seasonPassService.ts`** with:
  ```typescript
  - isParticipant(pubkey): boolean
  - addParticipant(pubkey): void
  - getParticipants(): string[]
  - removeParticipant(pubkey): void
  ```
- **Local storage key**: `seasonPassParticipants` (array of pubkeys)
- **Manual participant management** (for testing/admin use)

---

## Phase 3: NWC Payment Integration
**Goal**: Add payment button that generates invoices and auto-adds participants

### Changes:
- **Update LeagueMap banner** to show "Season Pass" button
- **Create payment modal** that:
  - Generates invoice using existing `RUNSTR_REWARD_NWC_URI` via `makeInvoiceWithNwc`
  - Shows QR code + copy button for invoice
  - Monitors payment events for automatic verification
  - Calls `seasonPassService.addParticipant()` on payment success
- **Reuse existing NWC infrastructure** (no new payment code)

---

## Phase 4: Feed & Leaderboard Filtering
**Goal**: Only show content from season pass participants

### Changes:
- **Update `src/hooks/useRunFeed.js`**:
  - Add participant filter: `posts.filter(post => participants.includes(post.pubkey))`
  - Maintain existing activity mode filtering
- **Update `src/utils/leaderboardUtils.js`**:
  - Filter runs by participants before calculations
  - Keep existing leaderboard logic intact
- **No changes to existing feed infrastructure** (just add filtering layer)

---

## Implementation Strategy

**Each phase is independent and non-breaking**:
- Phase 1: Pure text changes, no functional impact
- Phase 2: Adds new service, doesn't modify existing code  
- Phase 3: Adds payment modal, doesn't change existing flows
- Phase 4: Adds filtering layer, doesn't break existing feeds

**Low Risk Approach**:
- Reuse existing NWC wallet (`RUNSTR_REWARD_NWC_URI`)
- Reuse existing invoice generation methods
- Add filtering on top of existing feed/leaderboard logic
- No database changes, just localStorage for participant list

**Simple Storage**:
```javascript
localStorage.setItem('seasonPassParticipants', JSON.stringify([pubkey1, pubkey2, ...]))
```

## Files to be Modified/Created

### Phase 1:
- `src/components/LeagueMap.jsx` (text updates, remove percentages)
- `src/config/rewardsConfig.ts` (add SEASON_1 config)
- Documentation files (text updates)

### Phase 2:
- `src/services/seasonPassService.ts` (new file)

### Phase 3:
- `src/components/LeagueMap.jsx` (add Season Pass button)
- `src/components/modals/SeasonPassPaymentModal.jsx` (new file)
- `src/services/seasonPassService.ts` (add payment integration)

### Phase 4:
- `src/hooks/useRunFeed.js` (add participant filtering)
- `src/utils/leaderboardUtils.js` (add participant filtering)

This plan gets the job done with minimal code changes and zero risk of breaking existing functionality. 