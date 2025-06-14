# NIP60 Ecash Wallet Implementation - Brainstorm

## Understanding the Transition: NWC → NIP60 Ecash

### Current State Analysis
- **NWC Integration**: Lightning-based wallet connection via nostr+walletconnect URLs
- **Payment Flow**: NWC → Lightning invoices → Lightning Network settlement
- **Zap System**: Traditional Lightning zaps with 9734 events
- **Rewards System**: Pays Lightning to resolved lightning addresses
- **UI Pattern**: Connection string input → Connect → Payment functions

### NIP60 Ecash Target State
- **Ecash Integration**: Cashu token-based wallet stored in Nostr events
- **Payment Flow**: Cashu mint → Ecash tokens → Private transfers
- **Zap System**: Nutzaps (NIP61) using ecash tokens instead of Lightning
- **Rewards System**: Distribute ecash tokens directly
- **UI Pattern**: Mint selection → Token management → Spending interface

---

## Key Questions & Considerations

### 1. **Transition Strategy**
**Question**: Do you want to replace NWC entirely or offer both options?

**Options**:
- **A. Complete Replacement**: Remove NWC, go full ecash
  - *Pros*: Simpler codebase, clear direction, privacy-first
  - *Cons*: Users lose Lightning connectivity, smaller ecosystem initially
  
- **B. Dual Wallet System**: Offer both NWC and ecash wallets
  - *Pros*: User choice, gradual migration, broader compatibility
  - *Cons*: More complex UI, dual payment logic, maintenance overhead
  
- **C. Hybrid Approach**: Ecash primary, Lightning fallback
  - *Pros*: Best of both worlds, smooth UX
  - *Cons*: Complex implementation, potential user confusion

### 2. **Cashu Mint Selection & Management**
**Question**: How should users interact with Cashu mints?

**Considerations**:
- **Trust Model**: Users must trust mint operators (vs trustless Lightning)
- **Mint Discovery**: How do users find/select reputable mints?
- **Multi-Mint Strategy**: Support multiple mints for redundancy?
- **Default Mint**: Should RUNSTR recommend/operate a default mint?

**Options**:
- **A. Single Trusted Mint**: RUNSTR partners with one reliable mint
- **B. User-Selected Mints**: Users paste mint URLs (like current NWC flow)
- **C. Curated Mint List**: RUNSTR maintains a list of recommended mints
- **D. Mint Discovery Protocol**: Implement automatic mint discovery

### 3. **Token Storage & State Management**
**Question**: How should ecash tokens be stored and managed?

**Current**: NWC handles all wallet state externally
**Ecash**: App must manage token storage, proofs, and spending

**Storage Options**:
- **A. Nostr Events (NIP60)**: Store encrypted tokens in kind:37375 events
  - *Pros*: Follows standard, sync across devices, backup via relays
  - *Cons*: Relay dependency, encryption complexity, size limits
  
- **B. Local Storage**: Keep tokens in localStorage like current transaction history
  - *Pros*: Simple implementation, fast access
  - *Cons*: No sync, lost if app data cleared, no backup
  
- **C. Hybrid**: Critical tokens in Nostr, cache in localStorage
  - *Pros*: Best performance + backup
  - *Cons*: Sync complexity, potential inconsistencies

### 4. **Rewards System Integration**
**Question**: How should the rewards system adapt to ecash?

**Current Flow**: Calculate reward → Resolve Lightning address → Send Lightning payment
**Ecash Options**:

- **A. Direct Token Distribution**: Mint tokens directly to user's ecash wallet
  - *Pros*: Instant, private, no Lightning dependency
  - *Cons*: Requires RUNSTR to hold mint tokens, liquidity management
  
- **B. Reward Vouchers**: Issue redeemable vouchers that users can claim
  - *Pros*: Simple for RUNSTR, user controls when to claim
  - *Cons*: Extra step for users, voucher management complexity
  
- **C. Hybrid Rewards**: Let users choose Lightning or ecash rewards
  - *Pros*: Maximum flexibility
  - *Cons*: Dual implementation, UI complexity

### 5. **Zap System Evolution**
**Question**: How should zapping work with ecash?

**Options**:
- **A. Pure Nutzaps (NIP61)**: Replace Lightning zaps with ecash token transfers
- **B. Zap Conversion**: Convert ecash to Lightning for zapping
- **C. Dual Zap Types**: Support both Lightning and ecash zaps

---

## Implementation Approaches

### Approach 1: **Simple Replacement** (Recommended for MVP)
```
Current:     [NWC] → [Lightning] → [Zaps/Rewards]
New:         [Cashu] → [Ecash] → [Nutzaps/Rewards]
```

**Characteristics**:
- Replace NWCWalletConnector with CashuWalletConnector
- Replace Lightning payment logic with ecash spending
- Update rewards system to distribute tokens
- Modify zap system to use NIP61 nutzaps

**Pros**: Clean, focused, privacy-first
**Cons**: Breaking change, smaller ecosystem initially

### Approach 2: **Gradual Migration**
```
Phase 1:     [NWC] + [Cashu] (dual wallet UI)
Phase 2:     [Cashu] primary, [NWC] optional
Phase 3:     [Cashu] only
```

**Characteristics**:
- Add ecash wallet alongside existing NWC
- Let users gradually migrate funds/usage
- Maintain both payment paths during transition
- Eventually deprecate NWC

**Pros**: Smooth user experience, no forced migration
**Cons**: Complex implementation, longer development time

### Approach 3: **Hybrid Architecture**
```
Wallet Layer:    [Unified Wallet Interface]
             ↙                        ↘
     [Cashu Backend]              [NWC Backend]
```

**Characteristics**:
- Abstract wallet interface in UI
- Runtime switching between backends
- Automatic fallback mechanisms
- Unified transaction history

**Pros**: Maximum flexibility, robust
**Cons**: High complexity, potential confusion

---

## Technical Implementation Questions

### 1. **Cashu Library Integration**
- Which Cashu library to use? (cashu-ts, cashu-js, or custom?)
- How to handle async token operations in React?
- Error handling for mint communication failures?

### 2. **NIP60 Event Management**
- How to handle event encryption/decryption?
- Relay selection for wallet events?
- Conflict resolution for concurrent token operations?

### 3. **UI/UX Patterns**
- How to show token balances vs Lightning balances?
- Visual indicators for ecash vs Lightning transactions?
- Mint status/health indicators?
- Token expiry warnings?

### 4. **Security Considerations**
- Key management for NIP60 encryption?
- Secure token storage patterns?
- Protection against double-spending?
- Backup/recovery mechanisms?

---

## Recommendations

### For **Simple Start** (MVP):
1. **Choose Approach 1**: Complete replacement for focused development
2. **Single Mint Strategy**: Partner with one reliable mint initially
3. **Local + Nostr Storage**: Store tokens in both for performance + backup
4. **Replace Current Flows**: Modify existing components rather than rebuilding

### For **Production Ready**:
1. **Choose Approach 2**: Gradual migration for user adoption
2. **Curated Mint List**: Offer 3-5 trusted mint options
3. **Comprehensive Error Handling**: Robust fallback mechanisms
4. **User Education**: Clear documentation on ecash vs Lightning tradeoffs

### Next Steps:
1. **Clarify Your Priorities**: Privacy vs compatibility vs simplicity?
2. **Choose Mint Strategy**: Will you run a mint or partner with existing ones?
3. **Define Success Metrics**: What makes this transition successful?
4. **Prototype Key Flows**: Token storage, spending, and rewards distribution

---

## Questions for You:

1. **What's driving this transition?** Privacy, sovereignty, or technical benefits?
2. **How important is maintaining Lightning compatibility** for your users?
3. **Are you willing to run/operate a Cashu mint** or prefer to use existing ones?
4. **What's your timeline?** MVP in weeks or comprehensive solution over months?
5. **How tech-savvy are your users?** Will they understand ecash concepts?
6. **Should rewards still be "real Bitcoin"** or is ecash sufficient for the rewards system?

*Let me know your thoughts on these questions and I can help you dive deeper into the specific areas that matter most for your app!* 