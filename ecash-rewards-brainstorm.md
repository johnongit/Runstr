# Ecash Rewards Implementation - Brainstorm

## 🎯 Vision Statement

Transform RUNSTR's existing Lightning-based rewards system into an ecash-powered incentive mechanism that rewards users with NIP60 cashu tokens for activities like daily runs (1301 notes), streaks, and social engagement.

---

## 📋 Current State Analysis

### Existing Rewards System (Lightning-based)
- **Streak Rewards**: 100 sats/day linear model, 7-day cap
- **Daily Leaderboard**: 100/75/25 sats for top 3
- **NIP101 Post Rewards**: 5 sats per qualifying post
- **100k Challenge**: Event-specific rewards (5000 reg, 10000 finish)
- **Payout Method**: Lightning via NWC/zaps through `rewardsPayoutService`

### NIP60 Infrastructure (Already Built)
- ✅ Full NDKCashuWallet integration
- ✅ Real token operations (mint/receive)
- ✅ Social integration (DMs + nutzaps)
- ✅ Transaction history and UI
- ✅ Multiple mint support

---

## 🚀 Implementation Options

### Option A: Pre-Funded Token Pools (Your Concept)

**How it Works:**
```javascript
const RUNSTR_REWARD_POOLS = {
  dailyActivity: {
    available: 5000, // 5000 sats worth
    distributed: 0,
    tokens: [
      "cashuA1B2C3...", // 50 sat token
      "cashuD4E5F6...", // 50 sat token
      "cashuG7H8I9...", // 100 sat token
      // Pre-minted tokens ready for distribution
    ]
  },
  weeklyStreaks: {
    available: 10000,
    distributed: 0,
    tokens: ["cashu..."] // Larger denomination tokens
  },
  socialEngagement: {
    available: 2000,
    distributed: 0,
    tokens: ["cashu..."] // Small tokens for likes/comments
  }
}
```

**Pros:**
- ✅ No real-time minting required
- ✅ Predictable liquidity management
- ✅ Instant reward distribution
- ✅ Works offline/with poor connectivity
- ✅ No dependency on mint availability

**Cons:**
- ❌ Requires periodic pool refilling
- ❌ Fixed denominations might not match exact reward amounts
- ❌ Storage/security considerations for tokens in app
- ❌ App updates needed to refill pools

### Option B: Real-Time Minting

**How it Works:**
```javascript
async function sendEcashReward(userPubkey, amount, rewardType) {
  const userWallet = await getUserNIP60Wallet(userPubkey);
  if (!userWallet.connected) {
    // Fallback: Store pending reward, notify user to connect wallet
    return storePendingReward(userPubkey, amount, rewardType);
  }
  
  const tokens = await runstrRewardWallet.mintTokens(amount);
  return await userWallet.receiveTokens(tokens);
}
```

**Pros:**
- ✅ Exact reward amounts
- ✅ No pre-funding limitations
- ✅ Dynamic reward scaling
- ✅ Real-time liquidity

**Cons:**
- ❌ Requires RUNSTR wallet with sufficient balance
- ❌ Dependent on mint availability
- ❌ Network connectivity required
- ❌ More complex error handling

### Option C: Hybrid Approach

**How it Works:**
1. **Primary**: Use pre-funded pools for common rewards (50, 100, 500 sats)
2. **Fallback**: Real-time minting for unusual amounts or when pools empty
3. **Notification**: Alert users about pending rewards if wallet disconnected

**Pros:**
- ✅ Best of both worlds
- ✅ Graceful degradation
- ✅ Flexibility for edge cases

**Cons:**
- ❌ More complex implementation
- ❌ Multiple code paths to maintain

---

## 🎯 Reward Type Mapping

### Direct Replacements (Same Logic, Ecash Payout)

| Current Reward | Amount | Trigger | Ecash Implementation |
|----------------|--------|---------|---------------------|
| **Streak Day** | 100 sats | Daily run completion | Pool token or mint 100 sats |
| **Leaderboard** | 100/75/25 sats | Daily top 3 | Pool tokens or exact minting |
| **NIP101 Post** | 5 sats | Qualifying social post | Small denomination pool tokens |
| **Event Finish** | 10000 sats | Challenge completion | Large denomination or real-time mint |

### New Ecash-Specific Opportunities

| New Reward | Amount | Trigger | Rationale |
|------------|--------|---------|-----------|
| **Wallet Connection** | 10 sats | First NIP60 wallet setup | Onboarding incentive |
| **Token Sharing** | 5 sats | Sending tokens to another user | Social engagement |
| **Mint Diversity** | 25 sats | Using 3+ different mints | Decentralization incentive |
| **Weekly Activity** | 500 sats | 5+ runs in a week | Consistency bonus |

---

## 🤔 Key Questions to Refine Your Approach

### Architecture Decisions

1. **Pool Management**: How often should you refill token pools? Monthly app updates? Dynamic based on usage?

2. **Denomination Strategy**: What token sizes make sense?
   - Micro (1, 5, 10 sats) for frequent small rewards?
   - Standard (50, 100, 500 sats) for main rewards?
   - Large (1000+ sats) for special events?

3. **Mint Selection**: Should RUNSTR rewards come from a specific mint? Multiple mints for redundancy?

4. **User Experience**: How do users know they have pending rewards? Push notifications? In-app indicators?

### Security & Abuse Prevention

5. **Token Storage**: Where do you store pre-funded tokens securely? Encrypted in app bundle? External secure storage?

6. **Activity Validation**: How do you prevent reward farming?
   - GPS validation for runs?
   - Time-based limits?
   - Social verification (witnesses)?

7. **Double-Spending**: How do you ensure tokens aren't distributed multiple times? Database tracking? Blockchain verification?

### Operational Considerations

8. **Liquidity Management**: What happens when pools run empty? Automatic refill? Manual intervention?

9. **Analytics**: How do you track reward distribution vs. user engagement? ROI measurement?

10. **Fallback Strategy**: What if ecash systems fail? Revert to Lightning? Store pending rewards?

### User Adoption

11. **Migration Path**: How do existing Lightning users transition? Gradual rollout? Opt-in period?

12. **Education**: How do you explain ecash benefits vs. Lightning to users? Privacy? Speed? Offline capability?

---

## 🛠️ Implementation Phases

### Phase 1: Proof of Concept (Week 1-2)
- [ ] Implement pre-funded pool structure
- [ ] Adapt one reward type (streak rewards) to use ecash
- [ ] Basic token distribution logic
- [ ] Simple UI notifications for rewards

### Phase 2: Core Features (Week 3-4)
- [ ] All existing reward types converted
- [ ] Pool management system
- [ ] Activity validation enhancements
- [ ] User wallet connection verification

### Phase 3: Enhancement (Week 5-6)
- [ ] New ecash-specific reward types
- [ ] Advanced pool strategies (auto-refill)
- [ ] Analytics and monitoring
- [ ] Migration tools for existing users

### Phase 4: Production Polish (Week 7-8)
- [ ] Security audits
- [ ] Performance optimization
- [ ] Comprehensive error handling
- [ ] User education materials

---

## 💡 Creative Extensions

### Social Gamification
- **Token Gifting**: Users can gift earned tokens to others
- **Streak Sharing**: Share streak achievements with bonus tokens
- **Team Challenges**: Pool rewards for team activities

### Advanced Features
- **Reward Multipliers**: 2x rewards during special events
- **Achievement NFTs**: Unlock special cashu tokens for milestones
- **Merchant Integration**: Spend earned tokens at partner businesses

### Technical Innovations
- **Cross-App Rewards**: Earn tokens in RUNSTR, spend in other NIP60 apps
- **Automated Savings**: Auto-save percentage of earned tokens
- **Reward Subscriptions**: Predictable token income for consistent users

---

## 📊 Success Metrics

### User Engagement
- Daily active users with connected wallets
- Average tokens earned per user per week
- Reward claim rate (distributed vs. earned)

### Technical Performance
- Token distribution success rate
- Average distribution time
- Pool depletion frequency

### Economic Sustainability
- Cost per active user (token pools + infrastructure)
- User retention correlation with reward frequency
- Revenue generation from increased engagement

---

## 🔄 Next Steps

1. **Validate Assumptions**: Test pre-funded pool concept with small user group
2. **Choose Primary Approach**: Decide between Options A, B, or C based on your priorities
3. **Design Token Economics**: Determine optimal reward amounts and pool sizes
4. **Plan Migration**: Strategy for transitioning existing Lightning users
5. **Build MVP**: Start with one reward type as proof of concept

---

*What resonates most with your vision? Which questions feel most critical to answer first?* 