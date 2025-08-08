# NetworkIQ Profile History Implementation Plan

## Overview
Implement a comprehensive profile history tracking system for the NetworkIQ Chrome extension that provides users with detailed analytics on their LinkedIn networking activities.

## Goals
- Track all scored profiles locally using IndexedDB
- Provide detailed analytics and insights
- Enable data export and visualization
- Maintain privacy by keeping data local
- Integrate with existing caching system

## Architecture

### Data Storage Layer

#### IndexedDB Schema
```javascript
// Database: NetworkIQHistory
// Version: 1

// Store: profiles
{
  id: string,              // Auto-generated UUID
  url: string,             // LinkedIn profile URL (indexed)
  name: string,            // Profile name
  title: string,           // Current job title
  company: string,         // Current company
  location: string,        // Location
  imageUrl: string,        // Profile picture URL
  score: number,           // NetworkIQ score (0-100)
  tier: string,            // high/medium/low
  matches: array,          // Array of match objects
  insights: array,         // AI-generated insights
  hiddenConnections: array,// Non-obvious connections
  recommendation: string,   // AI recommendation
  message: string,         // Generated message
  timestamp: Date,         // When scored (indexed)
  userId: string,          // User who scored it
  searchElements: string,  // Hash of search elements used
  source: string,          // 'individual' or 'batch'
  connectionStatus: string,// 'none', 'pending', 'connected'
  notes: string,           // User notes
  tags: array              // User-defined tags
}

// Store: dailyStats
{
  date: string,            // YYYY-MM-DD format (indexed)
  profilesScored: number,  // Total profiles scored
  messagesGenerated: number,// Messages generated
  connectionsInitiated: number,// Connection requests sent
  highTierCount: number,   // High tier profiles found
  mediumTierCount: number, // Medium tier profiles
  lowTierCount: number,    // Low tier profiles
  averageScore: number,    // Average score for the day
  topMatches: array        // Top 5 profiles of the day
}

// Store: weeklyStats
{
  weekStart: string,       // YYYY-MM-DD of week start (indexed)
  weekEnd: string,         // YYYY-MM-DD of week end
  totalProfiles: number,   // Total profiles scored
  totalMessages: number,   // Total messages generated
  totalConnections: number,// Total connections initiated
  averageScore: number,    // Weekly average score
  tierDistribution: object,// {high: %, medium: %, low: %}
  topIndustries: array,    // Top industries encountered
  topCompanies: array,     // Top companies encountered
  topLocations: array      // Top locations encountered
}

// Store: searchHistory
{
  id: string,              // Auto-generated UUID
  timestamp: Date,         // When search was performed
  searchUrl: string,       // LinkedIn search URL
  profileCount: number,    // Number of profiles analyzed
  averageScore: number,    // Average score of batch
  filters: object,         // Applied filters
  searchElements: string   // Hash of search elements used
}
```

### Service Layer

#### HistoryService Class
```javascript
class HistoryService {
  // Core methods
  async init()
  async addProfile(profileData, scoreData)
  async updateProfile(profileId, updates)
  async getProfile(profileId)
  async getProfiles(filters, pagination)
  async deleteProfile(profileId)
  async deleteAllProfiles()
  
  // Statistics methods
  async updateDailyStats(profileData)
  async updateWeeklyStats()
  async getDailyStats(date)
  async getWeeklyStats(weekStart)
  async getStatsSummary(dateRange)
  
  // Search methods
  async addSearchHistory(searchData)
  async getSearchHistory(limit)
  
  // Analytics methods
  async getTopProfiles(limit, dateRange)
  async getScoreDistribution(dateRange)
  async getConnectionFunnel()
  async getTrendAnalysis(metric, period)
  
  // Export methods
  async exportToCSV(filters)
  async exportToJSON(filters)
  async generateReport(dateRange)
}
```

### UI Components

#### History Page Structure
```
history.html
├── Header
│   ├── NetworkIQ Logo
│   ├── Date Range Selector
│   └── Export Button
├── Summary Cards
│   ├── Total Profiles Scored
│   ├── Average Score
│   ├── Messages Generated
│   └── Connections Made
├── Charts Section
│   ├── Score Distribution (Pie/Donut)
│   ├── Daily Activity (Line Chart)
│   ├── Tier Breakdown (Bar Chart)
│   └── Top Matches (List)
├── Profiles Table
│   ├── Search/Filter Bar
│   ├── Column Headers (sortable)
│   │   ├── Name
│   │   ├── Score
│   │   ├── Company
│   │   ├── Date
│   │   └── Actions
│   ├── Profile Rows
│   └── Pagination
└── Footer
    └── Storage Info
```

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
- [ ] Create IndexedDB schema and migrations
- [ ] Implement HistoryService class
- [ ] Add profile tracking to ui.js
- [ ] Create basic history.html page
- [ ] Wire up data flow

### Phase 2: Statistics & Analytics (Week 2)
- [ ] Implement daily/weekly stats aggregation
- [ ] Add real-time stats updates
- [ ] Create analytics calculations
- [ ] Build trend analysis
- [ ] Add performance optimizations

### Phase 3: UI & Visualization (Week 3)
- [ ] Design and style history page
- [ ] Integrate Chart.js for visualizations
- [ ] Implement sortable/filterable table
- [ ] Add search functionality
- [ ] Create responsive layout

### Phase 4: Advanced Features (Week 4)
- [ ] Add export functionality (CSV/JSON)
- [ ] Implement data backup/restore
- [ ] Add profile comparison tool
- [ ] Create custom reports
- [ ] Add bulk operations

### Phase 5: Integration & Polish (Week 5)
- [ ] Integrate with existing cache system
- [ ] Add data sync with backend (optional)
- [ ] Implement data retention policies
- [ ] Add user preferences
- [ ] Performance testing & optimization

## Technical Considerations

### Performance
- Use indexes for frequently queried fields
- Implement pagination for large datasets
- Use virtual scrolling for long lists
- Cache computed statistics
- Batch database operations

### Privacy & Security
- All data stored locally in browser
- No automatic cloud sync
- User controls data export
- Implement data encryption (optional)
- Clear data on extension uninstall

### Browser Compatibility
- Test IndexedDB quota limits
- Handle storage exceptions
- Provide fallback for older browsers
- Monitor storage usage
- Implement data cleanup

### Integration Points
- Hook into existing scoring flow
- Reuse profile parser data
- Share with cache system
- Sync with popup stats
- Export to backend (optional)

## File Structure
```
extension/
├── history/
│   ├── history.html
│   ├── history.css
│   ├── history.js
│   └── charts.js
├── services/
│   ├── historyService.js
│   ├── statsService.js
│   └── exportService.js
├── content/
│   └── ui.js (modified)
└── manifest.json (updated)
```

## API Design

### Message Passing
```javascript
// From content script to background
chrome.runtime.sendMessage({
  action: 'saveProfileHistory',
  profile: profileData,
  score: scoreData
});

// From history page to background
chrome.runtime.sendMessage({
  action: 'getProfileHistory',
  filters: { dateRange, tier, minScore },
  pagination: { page, limit }
});
```

### Storage Events
```javascript
// Listen for profile updates
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (changes.profileHistory) {
    updateUIWithNewProfile(changes.profileHistory.newValue);
  }
});
```

## Testing Strategy

### Unit Tests
- HistoryService methods
- Statistics calculations
- Data transformations
- Export formats

### Integration Tests
- IndexedDB operations
- Message passing
- UI updates
- Performance benchmarks

### User Acceptance Tests
- Profile tracking accuracy
- Statistics correctness
- UI responsiveness
- Export functionality

## Metrics for Success
- All scored profiles tracked accurately
- Statistics update in real-time
- Page loads in < 1 second
- Handles 10,000+ profiles smoothly
- Export works for large datasets
- Zero data loss scenarios

## Potential Enhancements
- AI-powered insights on networking patterns
- Predictive scoring based on history
- Network graph visualization
- Integration with calendar for follow-ups
- Automated weekly reports
- Team/enterprise features

## Dependencies
- IndexedDB API
- Chart.js (for visualizations)
- DOMPurify (for security)
- Papa Parse (for CSV export)
- date-fns (for date handling)

## Risks & Mitigations
| Risk | Impact | Mitigation |
|------|---------|------------|
| IndexedDB quota exceeded | High | Implement data rotation, compression |
| Performance degradation | Medium | Use indexes, pagination, virtualization |
| Data loss | High | Regular backups, transaction management |
| Browser compatibility | Low | Feature detection, polyfills |
| Complex UI state | Medium | State management library (optional) |

## Timeline
- **Week 1**: Core infrastructure and basic tracking
- **Week 2**: Statistics and analytics implementation
- **Week 3**: UI development and visualization
- **Week 4**: Advanced features and export
- **Week 5**: Integration, testing, and polish

## Estimated Effort
- Total: 120-160 hours
- Development: 80-100 hours
- Testing: 20-30 hours
- Documentation: 10-15 hours
- Polish & optimization: 10-15 hours

## Success Criteria
- [ ] All profiles tracked with complete data
- [ ] Statistics accurate and real-time
- [ ] UI responsive and intuitive
- [ ] Export functionality works reliably
- [ ] Performance meets benchmarks
- [ ] Zero critical bugs in production
- [ ] Positive user feedback on feature