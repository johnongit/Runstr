# Runstr – Known Bugs

_A living document for tracking outstanding issues before we implement fixes._

_Last updated: <!-- TODO: update date automatically if desired -->_

---

## Index

1. [Save workout to Nostr doesn't work from Dashboard](#bug-1-save-workout-to-nostr-doesnt-work-from-dashboard)
2. ["Choose Extras" popup leads to error screen when saving workout](#bug-2-choose-extras-popup-leads-to-error-screen-when-saving-workout)
3. [Distance inflates after returning from background](#bug-3-distance-inflates-after-returning-from-background)
4. [Dashboard mentions claiming rewards (rewards are auto-sent)](#bug-4-dashboard-mentions-claiming-rewards-rewards-are-auto-sent)
5. [Streaks not shown on Dashboard (only on Stats page)](#bug-5-streaks-not-shown-on-dashboard-only-on-stats-page)
6. [Rewards popup appears on Stats page despite auto-send](#bug-6-rewards-popup-appears-on-stats-page-despite-auto-send)
7. [Rewards were never actually sent](#bug-7-rewards-were-never-actually-sent)

---

## Bug 1 – Save workout to Nostr doesn't work from Dashboard

| Field | Details |
|-------|---------|
| **Status** | 🟠 Pending investigation |
| **Priority** | High |
| **Description** | Attempting to save a completed workout to Nostr from the Dashboard silently fails; no event is published. |
| **Steps to Reproduce** |
| 1. Complete a workout. <br>2. From the Dashboard, tap **Save to Nostr**. |
| **Expected Behavior** | Workout details are published to the user's configured Nostr relays. |
| **Actual Behavior** | No confirmation; checking relays shows no new event. |
| **Suspected Area(s)** | `services/wallet/`, NIP-29 publishing flow, Dashboard component action handler. |
| **Notes / Hypotheses** | Possibly missing Nostr context in Dashboard route or wrong event object built. |
| **Next Steps** | Confirm handler wiring; add logging; replicate in dev with relay inspector. |

---

## Bug 2 – "Choose Extras" popup leads to error screen when saving workout

| Field | Details |
|-------|---------|
| **Status** | 🟠 Pending investigation |
| **Priority** | Medium |
| **Description** | When attempting to save a workout, an unexpected **Choose Extras** modal appears. After interacting, the app navigates to a generic error screen. |
| **Steps to Reproduce** |
| 1. Complete a workout. <br>2. Tap **Save**. <br>3. Modal appears asking to choose extras. <br>4. Select any option → app errors. |
| **Expected Behavior** | Workout saves without extraneous modal; no crash. |
| **Actual Behavior** | Modal + crash. |
| **Suspected Area(s)** | Save workflow modal logic; error boundary. |
| **Notes / Hypotheses** | Possibly leftover flow from rewards selection; null reference after modal dismiss. |
| **Next Steps** | Trace navigation stack; check modal data dependencies. |

---

## Bug 3 – Distance inflates after returning from background

| Field | Details |
|-------|---------|
| **Status** | 🟠 Pending investigation |
| **Priority** | Critical (affects core tracking) |
| **Description** | While recording a run, if the app is backgrounded and later reopened, the distance jumps ahead—showing more miles than actually run. |
| **Steps to Reproduce** |
| 1. Start run tracking. <br>2. Press home button; keep running. <br>3. After a while, re-open app. |
| **Expected Behavior** | Distance accurately reflects GPS data collected during background period. |
| **Actual Behavior** | Distance overshoots significantly. |
| **Suspected Area(s)** | Background location listener, distance aggregation logic, state persistence on pause/resume. |
| **Notes / Hypotheses** | Possible duplicate GPS samples or missed reset of last coordinate. |
| **Next Steps** | Replicate with debugger; review timestamp filtering when merging background data. |

---

## Bug 4 – Dashboard mentions claiming rewards (rewards are auto-sent)

| Field | Details |
|-------|---------|
| **Status** | 🟠 Pending investigation |
| **Priority** | Low |
| **Description** | UI copy on Dashboard prompts users to "claim rewards", which is outdated—the app auto-sends rewards. |
| **Steps to Reproduce** | Open Dashboard after completing runs. |
| **Expected Behavior** | No claim-rewards prompts; maybe show confirmation of auto-sent reward. |
| **Actual Behavior** | Text instructs user to claim. |
| **Suspected Area(s)** | Dashboard component copy. |
| **Next Steps** | Update strings; verify design consensus. |

---

## Bug 5 – Streaks not shown on Dashboard (only on Stats page)

| Field | Details |
|-------|---------|
| **Status** | 🟠 Pending investigation |
| **Priority** | Medium |
| **Description** | User's current running streak is visible on Stats page but missing from Dashboard overview card. |
| **Expected Behavior** | Streak indicator should appear on Dashboard for quick glance. |
| **Actual Behavior** | No streak info. |
| **Suspected Area(s)** | Dashboard data selectors, streak context provider. |
| **Next Steps** | Check props flow; reuse Stats component logic. |

---

## Bug 6 – Rewards popup appears on Stats page despite auto-send

| Field | Details |
|-------|---------|
| **Status** | 🟠 Pending investigation |
| **Priority** | Low |
| **Description** | Upon opening Stats page, a popup instructs user to claim rewards—even after rewards are supposed to auto-send (especially since streak achieved). |
| **Steps to Reproduce** | Open Stats page after having an active streak. |
| **Expected Behavior** | No reward claim modal; maybe show toast of reward already delivered. |
| **Actual Behavior** | Modal appears repeatedly. |
| **Suspected Area(s)** | Stats page effect hook, reward notification flag persistence. |
| **Next Steps** | Inspect local storage / state flag controlling modal; ensure cleared post-send. |

---

## Bug 7 – Rewards were never actually sent

| Field | Details |
|-------|---------|
| **Status** | 🟠 Pending investigation |
| **Priority** | High |
| **Description** | Despite UI indicating rewards are automatic, no Lightning transaction or on-chain payment was executed. |
| **Steps to Reproduce** | Accumulate eligible reward criteria; monitor wallet. |
| **Expected Behavior** | Reward payment should be broadcast and confirmed. |
| **Actual Behavior** | No payment history. |
| **Suspected Area(s)** | Reward service, Lightning integration, background job trigger. |
| **Notes / Hypotheses** | Possibly blocked by failed save-to-Nostr flow; or a network callback mis-handled. |
| **Next Steps** | Check server logs; trace reward dispatch flow. |

---

### How to Use This Document

1. **Prioritize** – Use the priority tags to decide which bug to tackle first.
2. **Update Statuses** – Mark each bug as 🔴 _Blocked_, 🟠 _In-progress_, or 🟢 _Resolved_ as we work.
3. **Add Findings** – Append discoveries under **Notes / Hypotheses** as we debug.
4. **Link PRs / Commits** – Reference code fixes or PR numbers once implemented.

Feel free to expand each section with stack traces, screenshots, or additional context during the debugging process. 