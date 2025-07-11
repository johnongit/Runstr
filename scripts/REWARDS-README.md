# RUNSTR Weekly Rewards & Newsletter Scripts

This directory contains scripts for calculating weekly rewards, tracking level achievements, and generating newsletters for RUNSTR's weekly Friday workflow.

## 🏃‍♂️ Scripts Overview

### 1. Weekly Rewards Calculator (`calculate-weekly-rewards.js`)
- **Purpose**: Calculates Bitcoin rewards for users based on their weekly workout activity
- **Output**: Formatted report with payment list and detailed breakdown
- **Reward System**: 
  - Streak multipliers (1 run = 20 sats, 2 runs = 40 sats, etc.)
  - Level bonuses (Level 1: +50 base, Level 2: +5 per streak day)

### 2. Level Achievements Tracker (`calculate-level-achievements.js`)
- **Purpose**: Tracks user level progression based on XP from workout records
- **Output**: Weekly level-up achievements with NPUBs and progression details
- **XP System**: 10 XP base + 5 XP per additional mile (1+ mile qualifying threshold)

### 3. Newsletter Generator (`generate-newsletter.js`)
- **Purpose**: Creates formatted weekly newsletter template
- **Output**: Complete newsletter with stats, achievements, and project updates
- **Features**: Auto-generates week numbers, date ranges, and formatted content

## 🚀 Quick Start

### Windows Users (Recommended)
Simply double-click the batch files in the project root:

- `calculate-rewards.bat` - Run weekly rewards calculation
- `calculate-levels.bat` - Run level achievements calculation  
- `generate-newsletter.bat` - Generate weekly newsletter
- `friday-workflow.bat` - **Run all three scripts in sequence**

### Command Line Usage
```bash
# Install dependencies first
cd scripts
npm install

# Run individual scripts
node calculate-weekly-rewards.js
node calculate-level-achievements.js
node generate-newsletter.js

# Or use npm scripts
npm run rewards
npm run levels
npm run newsletter
```

## 📊 Data Sources

### Event Filtering
Scripts query kind:1301 events from these relays:
- `wss://relay.damus.io`
- `wss://nos.lol`
- `wss://relay.nostr.band`

### RUNSTR Event Identification
Events are identified as RUNSTR workouts if they contain:
- `client` tag with "RUNSTR" or "runstr"
- `source` tag with "RUNSTR" or "runstr"

## 💰 Reward Calculation Details

### New Reward System (as of current implementation)
- **1 run**: 20 sats
- **2 runs**: 40 sats (total 60 sats)
- **3 runs**: 60 sats (total 120 sats)
- **4 runs**: 80 sats (total 200 sats)
- **5 runs**: 100 sats (total 300 sats)
- **6 runs**: 120 sats (total 420 sats)
- **7 runs**: 140 sats (total 560 sats)

### Level Bonuses
- **Level 1**: +50 sats weekly base reward (if at least 1 workout)
- **Level 2**: +5 sats per streak day

## 🏆 Level System Details

### XP Calculation
- **Base XP**: 10 XP for any workout ≥1 mile
- **Distance Bonus**: +5 XP per additional mile
- **Formula**: `XP = 10 + (Math.floor(additionalMiles) * 5)`

### Level Progression
- **Levels 1-10**: 100 XP per level (100, 200, 300, ..., 1000)
- **Level 11+**: Complex formula with increasing requirements

## 📝 Friday Workflow

### Recommended Process
1. **Run `friday-workflow.bat`** (or individual scripts)
2. **Review rewards breakdown** for accuracy
3. **Copy payment list** from rewards output
4. **Process manual zaps** to each npub
5. **Post level achievements** on social media
6. **Use newsletter content** for weekly update
7. **Keep output records** for tracking

### Sample Output Structure
```
🏃 RUNSTR WEEKLY REWARDS CALCULATION
📅 Period: [date range]
👥 Total users: X
💸 Total payout: X sats

💰 PAYMENT LIST (copy-paste ready):
npub1abc...: 550 sats
npub1def...: 300 sats
...

🏆 WEEKLY LEVEL ACHIEVEMENTS  
🎖️ npub1abc...: Level 3 → 5 (+2)
🎖️ npub1def...: Level 1 → 2 (+1)
...
```

## 🔧 Configuration

### Customizing Rewards
Edit `REWARD_CONFIG` in `calculate-weekly-rewards.js`:
```javascript
const REWARD_CONFIG = {
  STREAK_MULTIPLIERS: {
    1: 20,   // Modify reward amounts
    2: 40,
    // ...
  },
  LEVEL_BONUSES: {
    1: 50,   // Modify level bonuses
    2: 5,
  }
};
```

### Customizing Relays
Edit `RELAYS` array in any script:
```javascript
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  // Add/remove relays as needed
];
```

## 📁 Data Persistence

### Level Tracking
- **File**: `level-tracking-data.json`
- **Purpose**: Stores previous level data to calculate weekly progressions
- **Auto-generated**: Created automatically after first run

### Newsletter Output
- **File**: `newsletter-week-[number].txt`
- **Purpose**: Saved newsletter content for each week
- **Location**: `scripts/` directory

## 🔍 Troubleshooting

### Common Issues
1. **No events found**: Check relay connectivity and date range
2. **Missing dependencies**: Run `npm install` in scripts directory
3. **Permission errors**: Ensure write permissions for data files
4. **Timeout errors**: Increase `FETCH_TIMEOUT_MS` in scripts

### Debug Information
All scripts include colored console output with:
- ✅ Success indicators
- ⚠ Warning messages  
- ❌ Error messages
- 🔄 Progress indicators

## 🤝 Contributing

To modify or enhance these scripts:
1. Test with small datasets first
2. Maintain backward compatibility for data files
3. Update this README with any changes
4. Follow existing code style and patterns

## 📞 Support

For issues or questions about these scripts:
- Check console output for error messages
- Review Nostr event data for completeness
- Verify relay connectivity and response times
- Ensure all dependencies are installed

---

**Last Updated**: Created for RUNSTR Season 1 weekly rewards implementation
**Version**: 1.0.0
**Dependencies**: nostr-tools, ws 