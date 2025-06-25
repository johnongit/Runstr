# RUNSTR Level System Documentation

## 🎯 Overview
A level system integrated into the Nostr Stats page that gamifies the fitness experience by awarding experience points (XP) for qualifying workout records published to Nostr. The system provides visual recognition and progression tracking based on NIP-101e 1301 exercise records.

## 📍 Visual Placement & Layout
- **Location**: Top of the Nostr Stats page, above the workout record history
- **Position**: Header section that appears when user has qualifying workouts
- **Layout**: Circular progress ring design with username and activity class selector

### Layout Structure
```
┌─────────────────────────────────────────────────────────┐
│ 👤 Username [Runner ▾]              ⭕                 │
│                                    ( 12 )              │
│                                  850/1000 XP           │
│ Total Qualifying Workouts: 47 • Level 12               │
└─────────────────────────────────────────────────────────┘
│ [Existing workout record history below]                │
```

## 🎮 Level System Mechanics

### Experience Point (XP) Calculation
- **Qualifying Threshold**: 1+ mile distance requirement (any activity type)
- **Base XP**: 10 XP for any qualifying workout (1+ mile)
- **Distance Bonus**: +5 XP per additional mile beyond the first mile
- **Activity Weighting**: All activities (run, walk, cycle) have equal XP values
- **Formula**: `XP = 10 + (Math.floor(distanceInMiles - 1) * 5)`

### Level Progression Formula
- **Type**: Simple Linear Progression (Option A)
- **Level 1-10**: 100 XP per level (100, 200, 300, 400, 500, 600, 700, 800, 900, 1000)
- **Level 11+**: Add 50 XP per level increment (1150, 1350, 1600, 1900, 2250, etc.)
- **Formula**: 
  ```javascript
  function getXPRequiredForLevel(level) {
    if (level <= 10) {
      return level * 100;
    }
    const baseXP = 1000; // XP for level 10
    const levelsAbove10 = level - 10;
    return baseXP + (levelsAbove10 * 150) + (levelsAbove10 * (levelsAbove10 - 1) * 25);
  }
  ```

### Level Benefits
- **Current Phase**: Visual recognition only
- **Recognition Elements**:
  - Level number display in circular progress ring
  - Progress percentage and absolute XP numbers
  - Total qualifying workouts count
- **Future Considerations**: Badges, titles, leaderboard recognition, achievement unlocks

## 🏃‍♂️ Activity Class System

### Activity Classes
- **Runner**: Default for users with majority running workouts
- **Walker**: For users who primarily walk
- **Cycler**: For users who primarily cycle

### Class Selection
- **UI Element**: Dropdown selector next to username
- **Persistence**: Save user's preferred class in settings/localStorage
- **Automatic Detection**: Option to auto-suggest based on most frequent activity type
- **Override**: User can manually select any class regardless of actual activity distribution

### Class Benefits
- **Current Phase**: Visual identification only
- **Display**: Shows selected class next to username
- **Future Considerations**: Class-specific achievements, specialized leaderboards

## 📊 Data Integration & Performance

### Data Source Integration
- **Primary Hook**: Leverage existing `useNostrRunStats` hook
- **No Additional NDK**: Reuse existing Nostr event fetching infrastructure
- **Calculation Trigger**: Recalculate XP and level when stats page reloads
- **Performance**: Cache calculated values to avoid redundant calculations

### Data Flow
1. **Fetch Events**: Use existing `workoutEvents` from `useNostrRunStats`
2. **Filter Qualifying**: Filter for 1+ mile workouts during aggregation
3. **Calculate XP**: Process qualifying workouts for total XP
4. **Determine Level**: Calculate current level and progress from total XP
5. **Update Display**: Render level information in header component

### Data Structure
```javascript
const levelData = {
  currentLevel: 12,
  totalXP: 850,
  xpForCurrentLevel: 750,    // XP when current level started
  xpForNextLevel: 1000,      // XP needed for next level
  progressPercentage: 71.4,   // (850-750)/(1000-750) * 100
  qualifyingWorkouts: 47,
  selectedActivityClass: 'Runner'
}
```

## 🎨 Visual Design Specifications

### Circular Progress Ring
- **Design**: Circular progress indicator showing level progression
- **Center**: Current level number (large, bold text)
- **Ring**: Progress fill showing percentage to next level
- **Colors**: 
  - Progress fill: Primary brand color (purple/blue)
  - Background ring: Muted secondary color
  - Level number: High contrast text
- **Size**: Compact enough for mobile, prominent enough to be noticed

### Typography & Spacing
- **Username**: Prominent display, same size as current page headings
- **Level Number**: Large, bold font in center of progress ring
- **XP Display**: Smaller text showing absolute numbers
- **Activity Class**: Standard text size with dropdown indicator

### Responsive Behavior
- **Mobile**: Stack elements vertically if needed
- **Tablet/Desktop**: Horizontal layout as shown in structure
- **Accessibility**: Ensure adequate contrast ratios and touch targets

## 🔧 Implementation Strategy

### Phase 1: Core Level Calculation ✅ COMPLETE
- ✅ Extend `useNostrRunStats` hook to include level calculations
- ✅ Add XP filtering and calculation logic
- ✅ Implement level progression formula

### Phase 2: UI Components ✅ COMPLETE
- ✅ Create `LevelSystemHeader` component
- ✅ Implement circular progress ring component
- ✅ Add activity class selector dropdown

### Phase 3: Integration & Polish ✅ COMPLETE
- ✅ Integrate header into Nostr Stats page
- ✅ Add data persistence for activity class selection
- ✅ Implement responsive design and accessibility features

### Phase 4: Future Enhancements (Not Current Scope)
- Achievement system integration
- Level-up animations and notifications
- Enhanced level benefits and recognition

## 📏 Success Metrics & Validation

### User Experience Goals
- Clear visual indication of fitness progress and achievement
- Motivational element that encourages continued activity
- Simple, understandable progression system
- Non-intrusive integration with existing stats page

### Technical Validation
- No performance impact on stats page loading
- Accurate XP calculation from existing workout data
- Proper retroactive calculation for historical workouts
- Responsive design across all device sizes

## 🔄 Data Migration & Retroactive Calculation

### Historical Workout Processing
- **Scan Process**: Process all existing 1301 events on first calculation
- **Filtering**: Apply 1+ mile threshold to historical data
- **Performance**: Consider progressive loading for users with extensive history
- **Caching**: Store calculated totals to avoid recalculation

### XP Award Examples
- 1.2 mile run: 10 XP (base)
- 3.5 mile cycle: 10 + (2 * 5) = 20 XP
- 5.8 mile walk: 10 + (4 * 5) = 30 XP
- 0.8 mile jog: 0 XP (below threshold)

## 🚀 Future Expansion Possibilities

### Level System Enhancements
- Dynamic level benefits (unlockable features)
- Seasonal level resets or prestige systems
- Cross-activity level calculations
- Social level comparisons and leaderboards

### Activity Class Extensions
- Multiple class memberships
- Class-specific achievements and challenges
- Class-based community features
- Specialized metrics per activity type

### Integration Opportunities
- Team and challenge level bonuses
- Event participation XP multipliers
- Social interaction XP rewards
- Bitcoin/Lightning reward tier unlocks based on level

---

**Status**: ✅ IMPLEMENTED & READY FOR TESTING
**Priority**: Enhancement Feature - Fully Functional
**Dependencies**: ✅ Existing `useNostrRunStats` hook, Nostr Stats page infrastructure
**Estimated Complexity**: ✅ Medium (leveraged existing data fetching) - COMPLETE 