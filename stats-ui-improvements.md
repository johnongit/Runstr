# RUNSTR UI Improvements & Cleanup - Phase 2

## Overview
Comprehensive UI improvements focusing on consistency, functionality, and user experience across all pages.

## ✅ PHASE 1 COMPLETE - Previous Quick Wins (8/8)

### 1. Remove About Us Page ✅ COMPLETE
- [x] **Remove from Settings Modal**: Delete About Us option from settings → wallet section
- [x] **Remove Route**: Clean up any navigation references
- [x] **Delete Component**: Remove About page component entirely

### 2. Hide Debug UI in Music Tab ✅ COMPLETE
- [x] **Identify Debug Elements**: Find debug interface in music tab
- [x] **Complete Removal**: Hide debug UI entirely (no toggle needed)

### 3. Hide Update Profile Button ✅ COMPLETE
- [x] **Remove from RunHistory**: Hide "Update Profile" button from stats interface
- [x] **Verify Layout**: Ensure removal doesn't break page layout

### 4. Teams Page Text Cleanup ✅ COMPLETE
- [x] **Remove NIP-101e Text**: Remove "Nostr Teams (NIP-101e)" wording
- [x] **Hide Refresh Button**: Remove refresh button from teams interface

### 5. Stats Header Text Update ✅ COMPLETE
- [x] **Change Header**: "Your Nostr Stats" → "Nostr Workout Stats"

### 6. Default Stats Navigation to Nostr ✅ COMPLETE
- [x] **Route Logic Update**: Make "Stats" navigation default to NostrStatsPage
- [x] **Settings Integration**: Add toggle for "Use Local Stats" in settings  
- [x] **Conditional Routing**: When toggle enabled, route to RunHistory instead

### 7. Dynamic Blossom Playlist Naming ✅ COMPLETE
- [x] **Server Detection**: Identify which Blossom server is being used
- [x] **Dynamic Labels**: Show "Blossom.Band Playlist", "Satellite.Earth Playlist", "Primal.Band Playlist"
- [x] **Remove Duplicate Text**: Fix "Blossom Music Library" appearing twice

### 8. Blossom Image Placeholders ✅ COMPLETE
- [x] **Replace Broken Images**: Use pink flower placeholders instead of broken album art
- [x] **Implementation Choice**: One big bouquet image selected (Option B)

---

## 🟢 PHASE 2 - NEW QUICK WINS (15-30 mins each) ✅ COMPLETE

### 9. Fix Blossom Music Labeling ✅ COMPLETE
- [x] **Fix Header Display**: Top shows "Blossom Library", bottom shows server-specific name
- [x] **Current Issue**: "Blossom.Band Playlist" appears twice  
- [x] **Target**: "Blossom Library" + "Blossom.Band Playlist" beneath

### 10. Remove 1301 Card 3-Dot Menu ✅ COMPLETE
- [x] **Hide Non-Functional Menu**: Remove 3-dot menu from workout record cards
- [x] **Clean UI**: Remove dead UI element that serves no purpose

### 11. Update Blossom Server Dropdown ✅ COMPLETE
- [x] **Curate Server List**: Change to verified working servers only
- [x] **New Options**: Blossom.Band, Blossom.Primal, CDN.Satellite.Earth, Custom
- [x] **Remove**: Non-working or unclear server options

---

## 🟡 PHASE 3 - MEDIUM TASKS (30-60 mins each)  

### 12. Music Player Purple/Black Theme
- [ ] **Update Control Colors**: Purple/black instead of blue/white
- [ ] **Apply To**: Main player controls and mini player
- [ ] **Consistency**: Match dashboard color scheme

### 13. Add Team/Challenge to 1301 Cards
- [ ] **Conditional Display**: Show team/challenge only if user is member
- [ ] **Card Sections**: Add "Team: RUNSTR", "Challenge: Morning 5k" sections
- [ ] **Member Check**: Hide if user not part of team/challenge

### 14. 1301 Cards Dark Theme Redesign
- [ ] **Theme Update**: Dark cards with light text (readable)
- [ ] **Purple/Black**: Apply consistent color scheme
- [ ] **Remove Time**: Hide time of day from cards

---

## 🟠 PHASE 4 - MODERATE TASKS (1-2 hours each)

### 15. Teams/Feed Purple Theme Overhaul
- [ ] **Consistent Colors**: Purple/black with fading gradients
- [ ] **Replace Blue**: Convert blue buttons/text to purple theme
- [ ] **Apply To**: Teams pages, Feed tab, Team detail pages

### 16. Enhanced Mini Music Player
- [ ] **Visual Improvements**: Enhanced styling and controls
- [ ] **Theme Consistency**: Black/purple color scheme
- [ ] **UX Polish**: Better visual hierarchy and interactions

### 17. Fix Blossom Server Endpoints
- [ ] **Test Endpoints**: Verify cdn.satellite.earth and blossom.primal.net
- [ ] **Debug Issues**: Investigate why satellite/primal stopped working
- [ ] **Endpoint Correction**: Use correct URLs from GitHub analysis

---

## 🔴 PHASE 5 - COMPLEX TASKS (2-4+ hours each)

### 18. Team Creation Payment System
- [ ] **5k Creation Fee**: Implement initial team creation payment
- [ ] **30-Day Reminder**: Alert system for monthly 5k payment
- [ ] **NWC Integration**: Check wallet setup, trigger zaps to RUNSTR
- [ ] **Payment Flow**: Modal → Pay button → 5k zap → Allow team creation
- [ ] **Graceful Failure**: No action if payment fails

---

## Current Implementation Status
- **Completed**: 11 tasks (Phase 1: 8 tasks + Phase 2: 3 tasks)
- **Ready for**: Phase 3 Medium Tasks (Tasks 12-14)
- **Next Up**: Music player theming and 1301 card improvements

## Architecture Notes

### Endpoint Analysis (GitHub Research)
- **Primal**: `https://blossom.primal.net/` ✅ Working
- **Satellite**: `https://cdn.satellite.earth/` (CDN focus, should work)
- **Blossom.Band**: `https://blossom.band/` ✅ Working

### Payment System Design
- **Creation**: 5k sats one-time
- **Maintenance**: 5k sats every 30 days (reminder modal)
- **Destination**: Same as wallet donations
- **Failure**: Graceful degradation (no penalties)

## Architecture Decisions Needed

### Blossom Images Strategy
**Option A**: Individual pink flower placeholders for each "album"
**Option B**: One large bouquet image covering all four placeholder spots
- *Which approach would you prefer?*

### Global Theming Approach  
**Option A**: Implement global design system/theme variables
**Option B**: Page-by-page color updates if global theming is complex
- *Need to assess current CSS architecture first*

## Implementation Strategy

### Phase 1: Quick Wins (Start Here)
Focus on simple removals and text changes that provide immediate improvement with minimal risk.

### Phase 2: Functional Updates  
Implement navigation changes and dynamic content features.

### Phase 3: Complex Features
Add team management functionality and assess global theming approach.

## Key Files to Investigate

### For Quick Assessment:
- `src/pages/Music.jsx` - Debug UI location
- `src/pages/Settings.jsx` - About Us page location  
- `src/pages/RunHistory.jsx` - Update Profile button
- `src/pages/TeamsPage.jsx` - NIP-101e text and refresh button
- `src/pages/NostrStatsPage.jsx` - Header text

### For Architecture Decisions:
- CSS/styling structure for global theming assessment
- Blossom music implementation for image placeholder strategy
- Team challenges components for management functionality

## Next Steps

**Before Starting Implementation:**
1. **Architecture Assessment**: Check current CSS structure for global theming feasibility
2. **File Location Confirmation**: Identify exact components for each change
3. **Blossom Strategy Decision**: Choose between individual flowers vs bouquet approach

**Recommended Starting Order:**
1. Text changes and removals (Tasks 1-5)
2. Navigation routing updates (Task 6) 
3. Blossom improvements (Tasks 7-8)
4. Complex functionality (Tasks 9-10)

## Questions for Clarification

1. **Blossom Images**: Individual pink flowers or one large bouquet?
2. **Global Theming**: Should we assess feasibility first or go page-by-page?
3. **Implementation Priority**: Any specific tasks you'd like to tackle first?

## Success Metrics
- [ ] All debug elements hidden from production
- [ ] Consistent color scheme across all pages  
- [ ] Improved user experience for stats navigation
- [ ] Enhanced team management capabilities
- [ ] Clean, professional UI throughout the app 