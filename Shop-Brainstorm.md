# RUNSTR Shop Integration Brainstorm

## Project Overview

Integration of Nostr-native marketplace functionality into RUNSTR's teams section, allowing users to discover and purchase running-related products directly within the app. The primary focus is displaying listings from the RUNSTR team's shop on plebeian.market while maintaining full Nostr protocol compliance.

## Target Integration

**Primary Shop:** [RUNSTR Community Shop on Plebeian Market](https://plebeian.market/community/332401123238ec1318a6ef4497f113db37edcf2d562a34c584060ca1a6f9738d:runstr-a3pvnxv5zq)

## Research Areas

### 1. Nostr Marketplace Event Types & NIPs

**Key Questions to Investigate:**
- What event kinds does plebeian.market use for product listings?
- Are there established NIPs for marketplace functionality?
- How are product catalogs structured in Nostr?
- What event kinds handle:
  - Product listings
  - Shop/merchant profiles
  - Purchase orders
  - Reviews/ratings
  - Inventory management

**Potential Event Kinds to Research:**
- Kind 30017: Product listings (if following emerging marketplace standards)
- Kind 30018: Shop/merchant profiles
- Custom kinds used by plebeian.market
- Community-specific event kinds

### 2. Plebeian Market Technical Analysis

**Investigation Priorities:**
- Network analysis of plebeian.market's Nostr events
- Relay endpoints used by plebeian.market
- Event structure and tagging conventions
- Authentication/payment flow integration
- API compatibility with external applications

**Shop Identifier Analysis:**
The URL contains: `332401123238ec1318a6ef4497f113db37edcf2d562a34c584060ca1a6f9738d:runstr-a3pvnxv5zq`
- First part appears to be a pubkey: `332401123238ec1318a6ef4497f113db37edcf2d562a34c584060ca1a6f9738d`
- Second part appears to be an identifier: `runstr-a3pvnxv5zq`
- This suggests an addressable event structure similar to NIP-29 groups

## Technical Implementation Strategies

### Option 1: Direct Event Querying
```
Query relays directly for marketplace events using:
- Filters based on shop pubkey
- Product listing event kinds
- Time-based sorting for recent listings
```

### Option 2: Plebeian Market API Integration
```
If plebeian.market exposes Nostr-compatible APIs:
- Fetch shop data via their relay infrastructure
- Parse and display in native RUNSTR UI
- Maintain Nostr event authenticity
```

### Option 3: Hybrid Approach
```
Combine direct Nostr queries with plebeian.market's 
infrastructure for optimal data retrieval and user experience
```

## UI/UX Integration Points

### Teams Section Enhancement

**New Tab Structure:**
- **My Teams** (existing)
- **Discover Teams** (existing) 
- **Team Shop** (new) - Shows marketplace listings for current team
- **Marketplace** (new) - General running gear marketplace

**Shop Tab Features:**
- Product grid with images, names, prices
- Filter by category (apparel, accessories, electronics, etc.)
- Sort by price, date, popularity
- Integration with existing RUNSTR wallet functionality
- Lightning payments via existing NWC integration

### Product Display Components

**Product Card Requirements:**
- Product image (from Nostr event or IPFS)
- Title and description
- Price in sats/BTC
- Seller reputation/verification
- Lightning payment integration
- Add to cart functionality

## Data Flow Architecture

### 1. Shop Discovery
```
Team → Shop Association → Product Listings
- Teams may have associated shop pubkeys
- Query for shop metadata events
- Fetch product listing events for shop
```

### 2. Product Fetching
```
Relay Query → Event Parsing → UI Rendering
- Filter events by shop pubkey and kind
- Parse product data from event content
- Render in responsive product grid
```

### 3. Purchase Flow
```
Product Selection → Lightning Invoice → Payment → Confirmation
- Generate payment request via seller's Lightning address
- Process payment through existing NWC infrastructure
- Provide purchase confirmation and delivery tracking
```

## Integration with Existing RUNSTR Features

### Wallet Integration
- Leverage existing NWC (Nostr Wallet Connect) implementation
- Integrate with current Bitcoin transaction history
- Use existing payment modal components

### Team Context
- Shop tabs could be team-specific
- Team captains could manage team shops
- Revenue sharing for team activities/events

### Achievement System
- Purchase-based achievements ("First Purchase", "Team Supporter")
- Integration with existing level system
- Rewards for supporting RUNSTR ecosystem

## Security & Trust Considerations

### Seller Verification
- Nostr identity verification through existing key infrastructure
- Reputation system based on transaction history
- Integration with existing RUNSTR user profiles

### Payment Security
- Lightning payment atomicity
- Escrow mechanisms for high-value items
- Dispute resolution protocols

### Data Integrity
- Event signature verification
- Content authenticity checks
- Anti-spam measures for product listings

## Technical Requirements

### New Components Needed
- `ShopTab.jsx` - Main shop interface
- `ProductGrid.jsx` - Product listing display
- `ProductCard.jsx` - Individual product component
- `ShopHeader.jsx` - Shop metadata display
- `MarketplaceContext.jsx` - State management

### New Utility Functions
- `fetchShopListings()` - Query marketplace events
- `parseProductEvent()` - Extract product data from Nostr events
- `generatePurchaseRequest()` - Create Lightning payment requests
- `verifySellerIdentity()` - Validate seller credentials

### Relay Configuration
- Add plebeian.market relay endpoints
- Configure marketplace-specific relay priorities
- Implement relay fallback strategies

## Development Phases

### Phase 1: Research & Discovery
- [ ] Analyze plebeian.market's Nostr event structure
- [ ] Identify marketplace event kinds and relay endpoints
- [ ] Test event querying and parsing
- [ ] Create proof-of-concept product display

### Phase 2: Basic Integration
- [ ] Add shop tab to teams section
- [ ] Implement basic product listing display
- [ ] Create product card components
- [ ] Test with RUNSTR team shop data

### Phase 3: Enhanced Features
- [ ] Add filtering and sorting capabilities
- [ ] Integrate Lightning payment flow
- [ ] Implement seller verification
- [ ] Add shopping cart functionality

### Phase 4: Advanced Features
- [ ] Purchase history integration
- [ ] Achievement system integration
- [ ] Team revenue sharing
- [ ] Advanced marketplace features

## Success Metrics

### User Engagement
- Shop tab usage frequency
- Product view rates
- Purchase conversion rates
- User feedback and ratings

### Technical Performance
- Event fetching speed
- UI responsiveness
- Payment success rates
- Error rates and handling

### Business Impact
- Revenue generated through marketplace
- Team engagement increase
- Ecosystem growth and adoption
- Partnership opportunities

## Risk Mitigation

### Technical Risks
- Marketplace event standard changes
- Relay availability and performance
- Payment processing failures
- Data synchronization issues

### Business Risks
- Low user adoption
- Competition from centralized marketplaces
- Regulatory compliance concerns
- Merchant acquisition challenges

## Next Steps

1. **Technical Investigation:** Analyze plebeian.market's Nostr implementation
2. **Event Kind Research:** Identify standard marketplace event types
3. **Relay Analysis:** Determine optimal relay configuration
4. **UI Mockups:** Design shop tab interface and user flows
5. **Proof of Concept:** Build minimal viable marketplace integration

## Questions for Further Research

1. What specific event kinds and relay endpoints does plebeian.market use?
2. How are product images and media handled (IPFS, direct URLs, etc.)?
3. What payment methods are supported beyond Lightning?
4. How does seller verification and reputation work?
5. Are there existing Nostr marketplace libraries or SDKs we can leverage?
6. How do we handle inventory updates and product availability?
7. What are the legal/regulatory considerations for marketplace integration?

## Related Documentation

- [Teams Implementation](./Teams_Implementation.md) - Existing team functionality
- [README-RUN-CLUB.md](./README-RUN-CLUB.md) - Current Nostr group integration
- [NIP60-Implementation-Plan.md](./NIP60-Implementation-Plan.md) - Wallet integration patterns 