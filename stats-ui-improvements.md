# RUNSTR UI Improvements & Cleanup

## Overview
Comprehensive UI improvements focusing on consistency, functionality, and user experience across all pages.

## Quick Wins (Easiest Tasks - 15-30 mins each)

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

## Medium Complexity Tasks (30-60 mins each)

### 6. Default Stats Navigation to Nostr
- [ ] **Route Logic Update**: Make "Stats" navigation default to NostrStatsPage
- [ ] **Settings Integration**: Add toggle for "Use Local Stats" in settings  
- [ ] **Conditional Routing**: When toggle enabled, route to RunHistory instead

### 7. Dynamic Blossom Playlist Naming
- [ ] **Server Detection**: Identify which Blossom server is being used
- [ ] **Dynamic Labels**: Show "Blossom.Band Playlist", "Satellite.Earth Playlist", "Primal.Band Playlist"
- [ ] **Remove Duplicate Text**: Fix "Blossom Music Library" appearing twice

### 8. Blossom Image Placeholders
- [ ] **Replace Broken Images**: Use pink flower placeholders instead of broken album art
- [ ] **Implementation Choice**: Individual flowers OR one big bouquet image?

## Complex Tasks (1-2+ hours each)

### 9. Team Challenge Management
- [ ] **Add Delete Functionality**: Allow team captains to delete challenges
- [ ] **Add Edit Functionality**: Allow challenge modification after creation
- [ ] **UI Integration**: Add management buttons to team challenges section

### 10. Global Color Scheme Standardization
- [ ] **Assess Current Architecture**: Check if global theming exists
- [ ] **Implement Standard Palette**: Black primary, White text, Purple accents
- [ ] **Apply Consistently**: Teams, Music, Stats, Feed, Dashboard pages

**Current Inconsistencies:**
- Teams: Blue theme
- Music: Purple theme  
- Stats: Black theme
- Feed: White theme
- Dashboard: Mixed colors

**Target Scheme:**
- Primary: Black
- Text: White
- Accents: Purple

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