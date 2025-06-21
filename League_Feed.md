# RUNSTR League Feed Implementation

## 🎯 Feature Overview

Transform the existing Feed tab into a "League" tab that displays a visual map at the top showing user and bot progress through a fictional course outline, with the existing 1301 workout feed displayed below.

### Core Vision
- **Tab Rename**: Feed → League
- **Visual Map**: Course outline (Virginia-state-like shape) showing progress dots
- **Position Tracking**: All runs count toward cumulative distance progress
- **Bot Competition**: 5-10 scripted bots with different movement patterns
- **Design**: Black/white minimalism matching existing RUNSTR aesthetic
- **Feed Integration**: Unchanged 1301 feed below the map

---

## 📋 Implementation Status

### ✅ Completed
- [x] Initial planning and design decisions
- [x] Tab rename implementation (FEED → LEAGUE)
- [x] Basic map component structure  
- [x] League page integration with existing feed
- [x] Virginia-state-like course outline design
- [x] Position calculation system with real 1301 data
- [x] User position visualization on course map
- [x] Error handling and loading states

### 🚧 In Progress
- [ ] None currently

### ⏳ Planned
- [ ] Bot system implementation
- [ ] UI integration and styling polish

---

## 🗺️ Technical Specifications

### Map Design
- **Style**: Course outline resembling a geographic boundary (Virginia-state-like)
- **Dimensions**: 300-400px wide, 200-250px tall
- **Colors**: Black/white minimalism matching RUNSTR theme
- **Elements**: Course outline, progress dots for users/bots, territory markers
- **Total Distance**: 1000 miles for round numbers

### Position Calculation
- **Method**: Cumulative distance from ALL runs (no threshold)
- **Source**: Kind 1301 workout records
- **Formula**: `position = (totalDistance / 1000) * courseLength`
- **Updates**: Real-time for user, daily for bots
- **Storage**: Local state with caching

### Bot System
- **Count**: 5-10 scripted bots
- **Personalities**: Different movement patterns (consistent, weekend warrior, etc.)
- **Movement**: Daily updates, scripted patterns
- **Storage**: Local component state (no Nostr events)
- **Reset**: Acceptable on app restart

---

## 🏗️ Implementation Plan

### Phase 1: Foundation (Week 1)
**Goal**: Basic structure and tab rename

#### Task 1.1: Tab Rename ✅
- **Files**: `src/components/MenuBar.jsx`
- **Changes**: "Feed" → "League" 
- **Time**: 30 minutes
- **Status**: Complete - Tab now shows "LEAGUE" in bottom navigation

#### Task 1.2: League Page Structure ✅
- **Files**: Modified `src/pages/RunClub.jsx`
- **Structure**:
  ```jsx
  <div className="league-page">
    <LeagueMap />
    <div className="league-feed">
      {/* Existing 1301 feed */}
    </div>
  </div>
  ```
- **Time**: 2 hours
- **Status**: Complete - League map integrated above existing feed

#### Task 1.3: Basic LeagueMap Component ✅
- **File**: `src/components/LeagueMap.jsx`
- **Features**: Container, basic styling, placeholder content
- **Time**: 2 hours
- **Status**: Complete - Basic component with placeholder course outline

### Phase 2: Map Implementation (Week 1-2)
**Goal**: Functional map with course outline and position tracking

#### Task 2.1: Course Outline Design ✅
- **Implementation**: SVG path for course outline
- **Shape**: Virginia-state-like outline with geographic features
- **Responsive**: Mobile-first design
- **Colors**: Black outline on white/transparent background
- **Time**: 4 hours
- **Status**: Complete - Detailed Virginia-inspired course with eastern peninsula and western panhandle features

#### Task 2.2: Position Calculation Hook ✅
- **File**: `src/hooks/useLeaguePosition.js`
- **Features**:
  - Fetch user's 1301 records ✅
  - Calculate cumulative distance (ALL runs) ✅
  - Convert to map position percentage ✅
  - Cache results for performance ✅
- **Returns**: `{ totalDistance, mapPosition, qualifyingRuns }` ✅
- **Time**: 4 hours
- **Status**: Complete - Comprehensive hook with caching, error handling, and real-time data

#### Task 2.3: User Position Visualization ✅
- **Features**: Dot on course outline representing user position ✅
- **Styling**: Distinctive color/style for user vs bots ✅
- **Labels**: Distance/position info display ✅
- **Time**: 3 hours
- **Status**: Complete - Dynamic user positioning with completion states and progress tracking

### Phase 3: Bot System (Week 2)
**Goal**: Add bot competitors with scripted movement

#### Task 3.1: Bot Data Structure ⏳
- **File**: `src/components/LeagueMap.jsx` (local state)
- **Bot Personalities**:
  ```javascript
  const BOT_PROFILES = [
    { id: 'consistent_carl', dailyMiles: 3, variance: 0.1 },
    { id: 'weekend_warrior', weeklyPattern: [0,0,0,0,0,8,12] },
    { id: 'speed_demon', dailyMiles: 5, variance: 0.3 },
    { id: 'marathon_mike', weeklyPattern: [3,5,3,5,3,0,15] },
    { id: 'steady_sally', dailyMiles: 4, variance: 0.05 }
  ];
  ```
- **Time**: 3 hours

#### Task 3.2: Bot Movement Logic ⏳
- **Features**:
  - Daily movement updates
  - Realistic progression patterns
  - Randomization within personality constraints
  - Position persistence in localStorage
- **Time**: 4 hours

#### Task 3.3: Bot Visualization ⏳
- **Features**: Different colored dots for each bot
- **Labels**: Bot names and current distance
- **Styling**: Consistent with RUNSTR design
- **Time**: 2 hours

### Phase 4: Polish & Integration (Week 3)
**Goal**: Finalize styling and optimize performance

#### Task 4.1: Responsive Design ⏳
- **Mobile optimization**: Touch-friendly, proper sizing
- **Tablet support**: Utilize larger screen space
- **Performance**: Smooth scrolling between map and feed
- **Time**: 4 hours

#### Task 4.2: Feed Integration Testing ⏳
- **Verify**: Map updates when new 1301 records appear in feed
- **Performance**: Ensure smooth feed scrolling with map header
- **Styling**: Seamless transition between map and feed sections
- **Time**: 3 hours

#### Task 4.3: Final Polish ⏳
- **Typography**: Match existing RUNSTR fonts and sizes
- **Colors**: Ensure black/white consistency
- **Animations**: Subtle position update animations
- **Loading states**: Proper loading indicators
- **Time**: 4 hours

---

## 🎨 Design Specifications

### Map Component Layout
```
┌─────────────────────────────────────────────────────────┐
│ RUNSTR LEAGUE                                           │
│                                                         │
│     🗺️ Course Outline Shape                            │
│        ●You                                             │
│     ●Bot1    ●Bot2                                      │
│           ●Bot3                                         │
│                                                         │
│ Your Progress: 247 miles • Position: #3 of 12          │
└─────────────────────────────────────────────────────────┘
```

### Visual Elements
- **Course Outline**: Black SVG path on white background
- **User Dot**: Distinctive color (RUNSTR primary color)
- **Bot Dots**: Smaller, muted colors
- **Progress Text**: Clean typography matching app theme
- **Territory Markers**: Optional checkpoint indicators

### Mobile Considerations
- **Height**: 200-250px fixed height
- **Touch Targets**: Adequate spacing for finger taps
- **Text Size**: Readable on small screens
- **Performance**: Smooth scrolling, efficient rendering

---

## 🔧 Technical Architecture

### Component Structure
```
LeaguePage/
├── LeagueMap/
│   ├── CourseOutline (SVG)
│   ├── UserPosition
│   ├── BotPositions[]
│   └── ProgressInfo
└── LeagueFeed/
    └── [Existing 1301 feed components]
```

### Data Flow
1. **User Position**: `useLeaguePosition` hook fetches 1301 records
2. **Bot Positions**: Local state with daily update logic
3. **Map Rendering**: SVG-based course with positioned dots
4. **Feed Integration**: Existing feed components unchanged

### Performance Optimizations
- **Caching**: User total distance cached until new 1301 record
- **Bot Updates**: Only daily recalculation
- **Rendering**: Use React.memo for static components
- **Loading**: Progressive loading of map then feed

---

## 🧪 Testing Plan

### Phase 1 Testing
- [ ] Tab rename displays correctly
- [ ] Basic map component renders
- [ ] Page structure maintains existing functionality

### Phase 2 Testing
- [ ] User position calculates correctly from 1301 records
- [ ] Map displays user position accurately
- [ ] Course outline renders properly on all screen sizes

### Phase 3 Testing
- [ ] Bots move according to their personalities
- [ ] Bot positions persist between app sessions
- [ ] Multiple bots display without overlap issues

### Phase 4 Testing
- [ ] Mobile responsiveness across devices
- [ ] Performance with large numbers of 1301 records
- [ ] Integration with existing feed functionality

---

## 🚀 Future Enhancements

### Phase 5: Interactive Features (Future)
- [ ] Tap bot/user dots for detailed info
- [ ] Territory-based scoring system
- [ ] Challenge other users directly from map

### Phase 6: Advanced Features (Future)
- [ ] Seasonal course changes
- [ ] Team-based league competitions
- [ ] Reward integration for milestones

### Phase 7: Social Features (Future)
- [ ] Share league position achievements
- [ ] League leaderboards
- [ ] Community challenges

---

## 📝 Development Notes

### Key Design Decisions
- **Course Shape**: Virginia-state-like outline for visual interest
- **All Runs Count**: No distance threshold for inclusive participation
- **Local Bot Storage**: Simple implementation, acceptable reset behavior
- **Daily Bot Updates**: Balanced between engagement and performance

### Potential Challenges
- **SVG Responsiveness**: Ensure course outline scales properly
- **Position Overlap**: Handle multiple users/bots at same position
- **Performance**: Large number of 1301 records could slow position calculation
- **Bot Realism**: Balance between predictable and realistic movement

### Success Metrics
- **Engagement**: Time spent on League tab vs old Feed tab
- **Retention**: User return rate to check league progress
- **Performance**: Page load times remain under 2 seconds
- **Adoption**: Percentage of users who check league map regularly

---

## 📞 Open Questions & Decisions Needed

### Design Questions
- [ ] Exact course outline shape preference?
- [ ] Color scheme for different bot types?
- [ ] Territory marker placement and styling?

### Technical Questions
- [ ] Maximum number of 1301 records to process for position?
- [ ] Bot name generation strategy?
- [ ] Position tie-breaking logic?

### UX Questions
- [ ] Map interaction feedback (haptic, visual)?
- [ ] Information density on mobile screens?
- [ ] Loading state design during position calculation?

---

*Last Updated: January 2025*
*Status: Planning Phase* 