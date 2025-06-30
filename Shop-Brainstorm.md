# RUNSTR Shop Integration Brainstorm

## Project Overview

Integration of Nostr-native marketplace functionality into RUNSTR's teams section, allowing users to discover and purchase running-related products directly within the app. The primary focus is displaying listings from the RUNSTR team's shop on plebeian.market while maintaining full Nostr protocol compliance.

## Target Integration

**Primary Shop:** [RUNSTR Community Shop on Plebeian Market](https://plebeian.market/community/332401123238ec1318a6ef4497f113db37edcf2d562a34c584060ca1a6f9738d:runstr-a3pvnxv5zq)

## Research Areas

### 1. Nostr Marketplace Event Types & NIPs

**✅ CONFIRMED: NIP-15 Nostr Marketplace Standard**

Based on [Shopstr's implementation](https://github.com/shopstr-eng/shopstr) and [NIP-15 specification](https://github.com/nostr-protocol/nips/blob/master/15.md), we now have clarity:

**NIP-15 Event Structure:**
- **Kind 30017**: Product listings (standardized)
- **Kind 30018**: Shop/merchant profiles (standardized)  
- **Kind 0**: User metadata for seller verification
- **Kind 1**: Reviews and feedback
- **Kind 4**: Direct messages for order communication
- **Kind 7**: Reactions to products
- **Tags**: `d` (identifier), `price`, `currency`, `category`, `image`, `location`, etc.

**Shopstr Reference Implementation:**
- Supports NIP-15, NIP-99 (Classified Listings), NIP-85 (Reviews)
- Uses Lightning (NIP-57), Cashu (NIP-60), and Nutzaps (NIP-61)
- Implements Blossom Media (NIP-B7) for product images
- Full TypeScript/React implementation we can reference

**Standard Event Kinds Confirmed:**
- Kind 30017: Product listings with structured data
- Kind 30018: Shop profiles and metadata
- Kind 7: Product ratings/reactions
- Kind 1: Text reviews and feedback
- Custom tags for pricing, categories, shipping

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

### Primary Approach: NIP-15 Direct Implementation

**Shop Discovery by Npub:**
```javascript
// Query for shop profile (Kind 30018)
const shopFilter = {
  kinds: [30018],
  authors: [shopNpub],
  limit: 1
};

// Query for product listings (Kind 30017) 
const productsFilter = {
  kinds: [30017],
  authors: [shopNpub],
  limit: 20
};
```

**Team Shop Association Storage:**
```javascript
// Store team-shop associations in team metadata or custom event
const teamShopEvent = {
  kind: 30000, // Custom parameterized replaceable event
  tags: [
    ['d', 'associated-shops'],
    ['shop', shopNpub, 'team-endorsed'],
    ['shop', anotherShopNpub, 'captain-recommended']
  ]
};
```

**Multi-Source Integration:**
- **Primary**: NIP-15 compliant shops (any relay)
- **Enhanced**: Shopstr.store integration for UI patterns
- **Special**: Plebeian.market RUNSTR community shop
- **Curated**: Team captain approved shops

### Implementation Phases Refined

**Phase 1A: NIP-15 Shop Discovery**
- Implement npub → shop profile lookup
- Parse Kind 30018 shop metadata events
- Display shop verification and product count
- Add/remove shop associations for team captains

**Phase 1B: Product Listing Display**  
- Query Kind 30017 events for associated shops
- Parse product metadata (price, image, description)
- Create product grid using Shopstr patterns as reference

## UI/UX Integration Points

### Teams Section Enhancement

**Updated Tab Structure:**
- **My Teams** (existing)
- **Discover Teams** (existing) 
- **Team Shop** (new) - Shows marketplace listings associated with current team
- **Find Shops** (new) - Discover and add NIP-15 compliant shops by npub

### Team Captain Shop Management Workflow

**"Find Shop" Feature for Captains:**
1. **Shop Discovery Interface:**
   - Input field for pasting npub/nprofile 
   - "Find Shop" button to query NIP-15 events
   - Preview of shop profile (Kind 30018) before adding
   - List of products (Kind 30017) from that shop
   - Add/Remove shop association with team

2. **Shop Verification Process:**
   - Query relays for Kind 30018 (shop profile) events by pubkey
   - Validate shop has active product listings (Kind 30017)
   - Display shop metadata: name, description, verification status
   - Show sample products to confirm it's a legitimate shop

3. **Team Shop Association:**
   - Team captains can associate multiple shops with their team
   - Shops appear in "Team Shop" tab for all team members
   - Revenue sharing potential for team-endorsed shops
   - Shop recommendations based on team category (running gear, etc.)

**Enhanced Shop Tab Features:**
- Curated shops added by team captains
- Mix of team-specific recommendations and general marketplace
- Filter by "Team Endorsed" vs "General Marketplace"

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
- `ShopTab.jsx` - Main shop interface with team-curated listings
- `FindShopModal.jsx` - Npub input and shop discovery interface
- `ShopPreview.jsx` - Shop verification and preview before adding
- `ProductGrid.jsx` - NIP-15 product listing display
- `ProductCard.jsx` - Individual product component with NIP-15 metadata
- `ShopHeader.jsx` - Shop metadata display from Kind 30018 events
- `TeamShopManager.jsx` - Captain interface for managing associated shops
- `MarketplaceContext.jsx` - State management for shops and products

### New Utility Functions
- `fetchShopProfile()` - Query Kind 30018 shop metadata events
- `fetchShopProducts()` - Query Kind 30017 product listings by author
- `parseNIP15Product()` - Extract structured data from Kind 30017 events
- `validateShopNpub()` - Verify npub format and shop existence
- `associateShopWithTeam()` - Create team-shop association events
- `generateLightningInvoice()` - Create payment requests via NIP-15 specs
- `verifyNIP15Compliance()` - Check if shop follows NIP-15 standards

### Relay Configuration
- Add plebeian.market relay endpoints
- Configure marketplace-specific relay priorities
- Implement relay fallback strategies

## Team Captain Shop Management Permissions

### Permission Structure
- **Team Captains Only**: Can add/remove shops via "Find Shop" interface
- **Team Members**: Can view team-curated shops, browse products, make purchases
- **Shop Association**: Stored in team metadata, signed by team captain's key
- **Multi-Captain Teams**: Any captain can add shops, requires captain consensus to remove

### Captain Workflow
1. **Access Shop Management**: Special "Manage Shops" button visible only to captains
2. **Paste Npub**: Input field accepts npub/nprofile/hex formats
3. **Shop Verification**: Automatic NIP-15 compliance check and product count
4. **Preview & Add**: Review shop profile, sample products, then confirm association
5. **Team Notification**: Optional announcement to team about new shop addition

### User Experience Flow
```
Captain clicks "Find Shop" → Paste npub → Verify shop exists → 
Preview products → Add to team → Shop appears in team's shop tab
```

## Development Phases

### Phase 1A: NIP-15 Foundation
- [ ] Implement Kind 30018 (shop profile) and Kind 30017 (product) parsing
- [ ] Create shop discovery by npub functionality  
- [ ] Build shop verification and compliance checking
- [ ] Test with existing NIP-15 shops (Shopstr, others)

### Phase 1B: Team Integration  
- [ ] Add team captain permissions for shop management
- [ ] Create shop association storage mechanism
- [ ] Build "Find Shop" modal interface
- [ ] Implement team shop tab with curated listings

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

### NIP-15 Implementation Questions
1. **Event Querying**: Which relays should we prioritize for Kind 30017/30018 events?
2. **Image Handling**: How does NIP-B7 (Blossom Media) integration work for product images?
3. **Payment Integration**: How to implement NIP-57 (Lightning Zaps) for direct purchases?
4. **Inventory Management**: How do shops handle real-time inventory updates via Nostr?
5. **Shop Discovery**: Are there any NIP-15 shop directory services we can leverage?

### Technical Integration Questions  
6. **Team Association Storage**: Best practice for storing team-shop relationships?
7. **Captain Permissions**: How to verify team captain authority for shop management?
8. **Multi-Relay Strategy**: How to ensure shop data availability across relay networks?
9. **Offline Commerce**: How to handle order processing when shops are offline?
10. **Shopstr Integration**: Can we use their components/libraries as reference?

### Business & Legal Questions
11. **Revenue Sharing**: How to implement team commissions from shop sales?
12. **Dispute Resolution**: What mechanisms exist for purchase disputes in NIP-15?
13. **Compliance**: Legal considerations for facilitating marketplace transactions?
14. **Content Moderation**: How to handle inappropriate products in team shops?

## Related Documentation

- [Teams Implementation](./Teams_Implementation.md) - Existing team functionality
- [README-RUN-CLUB.md](./README-RUN-CLUB.md) - Current Nostr group integration
- [NIP60-Implementation-Plan.md](./NIP60-Implementation-Plan.md) - Wallet integration patterns
- [Shopstr Repository](https://github.com/shopstr-eng/shopstr) - Reference NIP-15 implementation
- [NIP-15 Specification](https://github.com/nostr-protocol/nips/blob/master/15.md) - Official marketplace standard 