# User Profile & Settings Transformation Brainstorm

## 🎯 Core Vision
Transform the current settings modal into a comprehensive user profile screen that gamifies the fitness experience while maintaining all existing functionality in a more organized, engaging way.

## 🎮 Level System (NIP-1301 Based)

### Experience Point Mechanics
- **Base XP**: Earn XP for each qualifying workout record published to Nostr
- **Qualifying Threshold**: **1 mile or above** distance requirement
- **Retroactive Calculation**: Scan existing workout records and award XP for past qualifying workouts (1+ mile)
- **XP Values** (suggestions):
  - Base workout (1+ mile): 10 XP
  - Distance bonuses: +1 XP per mile/2km
  - Duration bonuses: +1 XP per 10 minutes
  - Personal record bonuses: +50 XP

### Level Progression
- **Level Benefits** (Initial):
  - Recognition and status display
  - Level badges and titles
  - Leaderboard recognition
  - *Future additions*: Achievement unlocks, merch discounts, extra rewards

## 🏆 Achievement System

### Achievement Categories
- **Distance Milestones**: 10 miles, 50 miles, 100 miles, marathon distance, etc.
- **Consistency Rewards**: Weekly streaks, monthly streaks, perfect weeks
- **Event Participation**: First event, event completions, event wins
- **Challenge Victories**: Challenge wins, challenge participations
- **Social Engagement**: First Nostr post, community interactions
- **Personal Records**: Speed improvements, distance PRs, endurance PRs

### Goal Setting System
- **User Customizable Goals**: Allow users to create their own goals with:
  - Goal type selection (distance, frequency, speed, custom)
  - Target value and timeframe
  - Progress tracking and completion status
- **Goal Examples**:
  - "Run X miles this month"
  - "Run X times per week"
  - "Achieve sub-X pace"
  - "Complete next 5K race"
  - Custom user-defined targets

## 📱 Enhanced Settings Modal Structure

### Profile Header Section (New)
- **User Display Name** (from Nostr profile)
- **Current Level & XP Progress Bar**
- **Profile Avatar** (from Nostr or default)
- **Quick Stats**: Total runs, total distance, current streak

### Collapsible Content Sections

#### 🎮 Level & Achievements (New Section)
- Current level and XP progress display
- Recent achievements (last 3-5)
- Achievement progress indicators
- Next level requirements preview

#### 🎯 Goals & Notifications (New Section)  
- Active goals with progress bars
- Add new goal interface
- Notification preferences:
  - Challenge invites
  - Event announcements
  - Achievement unlocks
  - Goal reminders
  - Reward notifications

#### ⚙️ Settings (Reorganized Existing)
**Core Preferences**:
- Distance unit (Miles/KM)
- Activity mode selection
- Workout record customization
- Workout record encryption toggle

**Data & Publishing**:
- Local vs Nostr stats preference
- Auto-post workouts to Nostr
- Workout extras publishing (calories/intensity)
- Health data encryption

**Connections & Services**:
- Wallet connection
- Relay selection dropdown
- Mint selection dropdown  
- Blossom server selection

**App Behavior**:
- Start countdown toggle
- Stop countdown toggle
- Auto-save runs
- Show notifications
- Leaderboard participation
- Bitcoin rewards toggle

**Removed Settings** (as requested):
- Lightning fallback
- Device step counter

## 🎨 Visual Design Considerations

### Navigation Changes
- **Icon Update**: Change settings gear icon to user profile icon (user circle, avatar, or person icon)
- **Button Placement**: Consider if this should remain a modal or become a full page

### Information Hierarchy
1. **Primary**: User identity, level, current achievements
2. **Secondary**: Goals progress, recent activity
3. **Tertiary**: Settings and preferences

### Responsive Layout
- **Mobile**: Tabbed interface or collapsible sections
- **Tablet**: Side-by-side layout possible
- **Accessibility**: Ensure all interactive elements meet standards

## 🛠️ Implementation Approach

### ✅ Chosen: Enhanced Modal (Option A)
**Why this approach:**
- **Low Risk**: Builds on existing settings modal infrastructure
- **Incremental**: Can be implemented progressively without breaking existing functionality
- **Familiar UX**: Users already know how to access settings
- **Technical Simplicity**: Reuses existing modal patterns and styling

**Implementation Details:**
- **Icon Change**: Update settings gear icon to user profile icon (user circle/avatar)
- **Modal Expansion**: Increase modal size to accommodate new profile header
- **Layout Structure**: Profile info header + collapsible sections below
- **Existing Profile.jsx**: Remains separate for fitness metrics (age, weight, etc.)

### Alternative Options (Not Chosen)
- **Option B**: Full Page Navigation - *Too disruptive for initial implementation*
- **Option C**: Drawer/Sidebar - *More complex UX pattern*
- **Option D**: Dashboard Layout - *Over-engineered for current needs*
- **Option E**: Hybrid Approach - *Adds complexity without clear benefit*

## 🔄 Migration Strategy

### Phase 1: Data Structure
- Extend user profile schema to include level/XP data
- Create achievement tracking system
- Set up goal management

### Phase 2: UI Transformation
- Update settings modal/page layout
- Implement level system visualization
- Add achievement displays

### Phase 3: Gamification Logic
- Implement XP calculation from workout records
- Set up retroactive XP assignment
- Create achievement triggering system

### Phase 4: Polish & Enhancement
- Fine-tune visual design
- Add animations and feedback
- Optimize user experience

## ❓ Decisions Made ✅

1. **Integration with Existing Profile**: ✅ Keep Profile.jsx separate, enhance settings modal only
2. **XP Calculation**: ✅ 1 mile or above distance threshold for qualifying workouts
3. **Level Benefits**: ✅ Recognition only initially (badges, titles, leaderboard status)
4. **Navigation Pattern**: ✅ Enhanced modal approach (Option A)
5. **Goal Types**: ✅ User customizable goals with flexible types and timeframes

## ❓ Still To Define

1. **Achievement Definitions**: Complete list of achievements and their requirements
2. **XP Values**: Finalize exact XP amounts for base workouts, distance bonuses, etc.
3. **Level Thresholds**: How much XP needed for each level?
4. **Notification System**: How detailed should notification preferences be?
5. **Collapsible Section Design**: Which sections should be expanded by default?
6. **Modal Size**: How much larger should the enhanced modal be?

## 🎯 Success Metrics

- **User Engagement**: Increased time spent in profile/settings area
- **Goal Completion**: Users setting and achieving more goals
- **Workout Consistency**: Improved workout frequency due to gamification
- **Feature Discovery**: Better awareness of app capabilities through organized settings
- **Social Engagement**: More users sharing achievements and progress

---

*This brainstorm document should be refined based on team feedback and user research insights.* 