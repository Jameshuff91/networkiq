/**
 * NetworkIQ UI Injector
 * Adds score badges and UI elements to LinkedIn
 */

// Log to confirm script is loaded
console.log('NetworkIQ: UI script loaded, initializing...');

class NetworkIQUI {
  constructor() {
    this.parser = new LinkedInParser();
    this.scorer = new NetworkScorer();
    this.currentProfile = null;
    this.userTier = 'free'; // Will be loaded from storage
    this.dailyUsage = 0;
    this.init();
  }

  async init() {
    // Load user settings and tier
    await this.loadUserSettings();
    
    // Listen for URL changes (LinkedIn is a SPA)
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        // Increase delay for search pages to load
        const delay = url.includes('/search/') ? 2000 : 1000;
        setTimeout(() => this.onPageChange(), delay);
      }
    }).observe(document, { subtree: true, childList: true });

    // Initial load with delay for search pages
    const initialDelay = location.href.includes('/search/') ? 2000 : 500;
    setTimeout(() => this.onPageChange(), initialDelay);
  }

  async loadUserSettings() {
    return new Promise((resolve) => {
      // Check both local (for test mode) and sync storage
      chrome.storage.local.get(['testMode', 'user'], (localData) => {
        if (localData.testMode) {
          // Test mode - use mock data
          this.userTier = 'pro';
          this.testMode = true;
          this.scorer.userBackground = {
            search_elements: [
              { text: 'MIT', weight: 30, type: 'education' },
              { text: 'Google', weight: 25, type: 'company' },
              { text: 'Facebook', weight: 25, type: 'company' },
              { text: 'machine learning', weight: 15, type: 'skill' }
            ]
          };
          this.dailyUsage = 0;
          console.log('NetworkIQ: Running in test mode');
          resolve();
        } else {
          // Normal mode - get from sync storage
          chrome.storage.sync.get(['userTier', 'userBackground', 'dailyUsage'], (data) => {
            this.userTier = data.userTier || 'free';
            if (data.userBackground) {
              this.scorer.userBackground = data.userBackground;
            }
            this.dailyUsage = data.dailyUsage || 0;
            resolve();
          });
        }
      });
    });
  }

  onPageChange() {
    const url = window.location.href;
    console.log('NetworkIQ: Page changed to:', url);
    
    if (LinkedInParser.isProfilePage()) {
      console.log('NetworkIQ: Detected profile page');
      this.injectProfileScore();
    } else if (LinkedInParser.isSearchPage()) {
      console.log('NetworkIQ: Detected search page - starting batch scoring');
      this.injectSearchScores();
    } else {
      console.log('NetworkIQ: Not a profile or search page');
    }
  }

  async injectProfileScore() {
    try {
      // Skip daily limit check in test mode
      if (!this.testMode && this.userTier === 'free' && this.dailyUsage >= 10) {
        this.showUpgradePrompt();
        return;
      }

      // Parse profile
      console.log('NetworkIQ: Parsing profile...');
      const profile = this.parser.parse();
      if (!profile) {
        console.log('NetworkIQ: Could not parse profile');
        return;
      }

      // Calculate score
      console.log('NetworkIQ: Calculating score...');
      const scoreData = this.scorer.calculateScore(profile);
      this.currentProfile = { profile, scoreData };

      // Create and inject UI
      console.log('NetworkIQ: Creating UI elements...');
      this.createScoreBadge(scoreData);
      this.createMessageBox(profile, scoreData);
      this.createFloatingWidget(scoreData);

      // Track usage (skip in test mode)
      if (!this.testMode && this.userTier === 'free') {
        this.dailyUsage++;
        chrome.storage.sync.set({ dailyUsage: this.dailyUsage });
      }

      // Send analytics (skip in test mode)
      if (!this.testMode) {
        this.trackEvent('profile_scored', {
          score: scoreData.score,
          tier: scoreData.tier
        });
      }
      
      console.log('NetworkIQ: Profile scored successfully', scoreData);
    } catch (error) {
      console.error('NetworkIQ: Error scoring profile:', error);
      // Don't let errors crash the page
    }
  }

  createScoreBadge(scoreData) {
    // Remove existing badge
    const existing = document.querySelector('.networkiq-score-badge');
    if (existing) existing.remove();

    // Create badge HTML
    const badge = document.createElement('div');
    badge.className = 'networkiq-score-badge';
    badge.innerHTML = `
      <div class="niq-score niq-tier-${scoreData.tier}">
        <div class="niq-score-number">${scoreData.score}</div>
        <div class="niq-score-label">NetworkIQ</div>
      </div>
      <div class="niq-connections">
        ${(scoreData.connections || scoreData.matches || []).map(c => `<span class="niq-chip">${c}</span>`).join('')}
      </div>
    `;

    // Find injection point (near name)
    const nameElement = document.querySelector('h1.text-heading-xlarge');
    if (nameElement) {
      nameElement.parentElement.appendChild(badge);
    }
  }

  createMessageBox(profile, scoreData) {
    // Remove existing sidebar
    const existing = document.querySelector('.networkiq-sidebar');
    if (existing) existing.remove();

    // Generate message
    const message = this.scorer.generateMessage(profile, scoreData);

    // Create sidebar container
    const sidebar = document.createElement('div');
    sidebar.className = 'networkiq-sidebar';
    sidebar.innerHTML = `
      <div class="niq-sidebar-header">
        <div class="niq-sidebar-title">
          <h3>NetworkIQ Assistant</h3>
          <button class="niq-sidebar-toggle" id="niq-toggle-sidebar">_</button>
        </div>
        <div class="niq-score-display">
          <span class="niq-score-large niq-tier-${scoreData.tier}">${scoreData.score}</span>
          <span class="niq-score-label">${scoreData.tier.toUpperCase()} MATCH</span>
        </div>
      </div>
      
      <div class="niq-sidebar-content">
        <div class="niq-section">
          <h4>💡 Connection Insights</h4>
          <div class="niq-insights">
            ${(scoreData.matches || []).slice(0, 3).map(match => 
              `<div class="niq-insight-chip">✓ ${match}</div>`
            ).join('') || '<div class="niq-insight-chip">No direct matches found</div>'}
          </div>
        </div>

        <div class="niq-section">
          <h4>📝 Personalized Message</h4>
          <textarea class="niq-message-text" id="niq-message-textarea">${message}</textarea>
          <div class="niq-message-actions">
            <button class="niq-btn niq-btn-primary" id="niq-copy-message">
              📋 Copy
            </button>
            <button class="niq-btn niq-btn-secondary" id="niq-regenerate">
              🔄 Regenerate
            </button>
            <button class="niq-btn niq-btn-connect" id="niq-connect">
              ➤ Send
            </button>
          </div>
        </div>

        <div class="niq-section niq-score-details">
          <h4>📊 Score Breakdown</h4>
          <div class="niq-breakdown-items">
            ${Object.entries(scoreData.breakdown || {})
              .filter(([_, value]) => value > 0)
              .map(([key, value]) => `
                <div class="niq-breakdown-item">
                  <span class="niq-breakdown-label">${this.formatLabel(key)}</span>
                  <span class="niq-breakdown-value">+${value}</span>
                </div>
              `).join('') || '<div class="niq-breakdown-item">Base score applied</div>'}
          </div>
        </div>

        <div class="niq-section niq-tips">
          <h4>💬 Connection Tips</h4>
          <ul>
            ${this.getConnectionTips(scoreData.tier).map(tip => 
              `<li>${tip}</li>`
            ).join('')}
          </ul>
        </div>
      </div>

      <div class="niq-sidebar-footer">
        <div class="niq-usage-info">
          ${this.testMode ? 'TEST MODE' : 
            this.userTier === 'free' ? 
              `${10 - this.dailyUsage} scores left today` : 
              'PRO Account'}
        </div>
      </div>
    `;

    // Add to page
    document.body.appendChild(sidebar);

    // Make the textarea editable
    const textarea = sidebar.querySelector('#niq-message-textarea');
    textarea.removeAttribute('readonly');

    // Attach event listeners
    this.attachMessageBoxListeners(textarea.value);

    // Add toggle functionality
    document.getElementById('niq-toggle-sidebar')?.addEventListener('click', () => {
      sidebar.classList.toggle('niq-sidebar-minimized');
      const toggleBtn = document.getElementById('niq-toggle-sidebar');
      toggleBtn.textContent = sidebar.classList.contains('niq-sidebar-minimized') ? '□' : '_';
    });

    // Update message variable when user edits
    textarea.addEventListener('input', (e) => {
      this.currentMessage = e.target.value;
    });
  }

  getConnectionTips(tier) {
    if (tier === 'high') {
      return [
        'Mention your shared background early',
        'Reference specific mutual interests',
        'Keep the message concise and personal'
      ];
    } else if (tier === 'medium') {
      return [
        'Find a unique angle to stand out',
        'Show genuine interest in their work',
        'Suggest a specific way to add value'
      ];
    } else {
      return [
        'Research their recent activity first',
        'Find a mutual connection if possible',
        'Be clear about why you want to connect'
      ];
    }
  }

  createFloatingWidget(scoreData) {
    // Remove existing widget
    const existing = document.querySelector('.networkiq-widget');
    if (existing) existing.remove();

    // Create floating widget
    const widget = document.createElement('div');
    widget.className = 'networkiq-widget';
    widget.innerHTML = `
      <div class="niq-widget-score niq-tier-${scoreData.tier}">
        ${scoreData.score}
      </div>
      <div class="niq-widget-label">NetworkIQ</div>
      <div class="niq-widget-usage">
        ${this.testMode ? 'TEST' : this.userTier === 'free' ? `${10 - this.dailyUsage} left` : 'PRO'}
      </div>
    `;

    document.body.appendChild(widget);

    // Make widget clickable to toggle sidebar
    widget.addEventListener('click', () => {
      const sidebar = document.querySelector('.networkiq-sidebar');
      if (sidebar) {
        sidebar.classList.toggle('niq-sidebar-minimized');
        const toggleBtn = document.getElementById('niq-toggle-sidebar');
        if (toggleBtn) {
          toggleBtn.textContent = sidebar.classList.contains('niq-sidebar-minimized') ? '□' : '_';
        }
      }
    });
  }

  attachMessageBoxListeners(message) {
    // Copy message
    document.getElementById('niq-copy-message')?.addEventListener('click', () => {
      navigator.clipboard.writeText(message);
      this.showToast('Message copied to clipboard!');
      this.trackEvent('message_copied');
    });

    // Regenerate message (Pro feature)
    document.getElementById('niq-regenerate')?.addEventListener('click', async () => {
      if (this.userTier === 'free') {
        this.showUpgradePrompt('Regenerate messages with AI');
        return;
      }
      await this.regenerateMessage();
    });

    // Connect now
    document.getElementById('niq-connect')?.addEventListener('click', () => {
      const connectBtn = document.querySelector('button[aria-label*="Connect"]');
      if (connectBtn) {
        connectBtn.click();
        setTimeout(() => {
          // Try to find and fill the message field
          const messageField = document.querySelector('textarea[name="message"]');
          if (messageField) {
            messageField.value = message;
            messageField.dispatchEvent(new Event('input', { bubbles: true }));
            this.trackEvent('connection_initiated');
          }
        }, 1000);
      }
    });
  }

  async regenerateMessage() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'generateMessage',
        profile: this.currentProfile.profile,
        scoreData: this.currentProfile.scoreData
      });

      if (response.success) {
        const textarea = document.querySelector('.niq-message-text');
        if (textarea) {
          textarea.value = response.message;
          this.showToast('New message generated!');
          this.trackEvent('message_regenerated');
        }
      }
    } catch (error) {
      console.error('Failed to regenerate message:', error);
      this.showToast('Failed to generate message. Please try again.');
    }
  }

  async injectSearchScores() {
    // Enhanced batch scoring for search results
    console.log('NetworkIQ: Starting batch scoring for search results...');
    console.log('NetworkIQ: Current URL:', window.location.href);
    
    // Debug: Check what elements exist on the page
    const debugSelectors = [
      '.entity-result__item',
      '[data-view-name="search-entity-result-universal-template"]',
      '.reusable-search__result-container',
      'a[href*="/in/"]'
    ];
    
    debugSelectors.forEach(selector => {
      const count = document.querySelectorAll(selector).length;
      if (count > 0) {
        console.log(`NetworkIQ: Found ${count} elements with selector: ${selector}`);
      }
    });
    
    // Get all profiles from search results
    const profiles = LinkedInParser.getSearchResultProfiles();
    console.log(`NetworkIQ: Parser found ${profiles.length} profiles`);
    
    if (profiles.length === 0) {
      console.log('NetworkIQ: No profiles found on search page');
      // Try alternative approach - just look for profile links
      const profileLinks = document.querySelectorAll('a[href*="/in/"]');
      console.log(`NetworkIQ: Found ${profileLinks.length} profile links on page`);
      return;
    }
    
    console.log(`NetworkIQ: Found ${profiles.length} profiles to score`);
    
    // Create summary bar if not exists
    this.createSummaryBar();
    
    // Score all profiles
    const scoredProfiles = [];
    let highScoreCount = 0;
    let mediumScoreCount = 0;
    let lowScoreCount = 0;
    
    profiles.forEach(profile => {
      // Calculate comprehensive score using resume data
      const scoreData = this.scorer.calculateScore({
        name: profile.name,
        title: profile.title,
        company: profile.company,
        location: profile.location,
        text: profile.fullText || `${profile.name} ${profile.title} ${profile.company} ${profile.location} ${profile.summary}`.toLowerCase(),
        about: profile.summary || ''
      });
      
      // Store scored profile
      scoredProfiles.push({
        ...profile,
        score: scoreData.score,
        tier: scoreData.tier,
        matches: scoreData.matches
      });
      
      // Count by tier
      if (scoreData.tier === 'high') highScoreCount++;
      else if (scoreData.tier === 'medium') mediumScoreCount++;
      else lowScoreCount++;
      
      // Add visual badge to the profile card
      this.addScoreBadgeToCard(profile, scoreData);
    });
    
    // Update summary bar
    this.updateSummaryBar(scoredProfiles, highScoreCount, mediumScoreCount, lowScoreCount);
    
    // Store scored profiles for later use (sorting, export, etc.)
    this.scoredProfiles = scoredProfiles;
    
    // Add hover tooltips
    this.addHoverTooltips();
    
    console.log(`NetworkIQ: Batch scoring complete. High: ${highScoreCount}, Medium: ${mediumScoreCount}, Low: ${lowScoreCount}`);
  }
  
  createSummaryBar() {
    // Remove existing summary bar
    const existing = document.querySelector('.networkiq-summary-bar');
    if (existing) existing.remove();
    
    // Create summary bar
    const summaryBar = document.createElement('div');
    summaryBar.className = 'networkiq-summary-bar';
    summaryBar.innerHTML = `
      <div class="niq-summary-content">
        <div class="niq-summary-logo">
          <span class="niq-logo-icon">🎯</span>
          <span class="niq-logo-text">NetworkIQ</span>
        </div>
        
        <div class="niq-summary-stats">
          <div class="niq-stat">
            <span class="niq-stat-value" id="niq-total-profiles">0</span>
            <span class="niq-stat-label">Profiles</span>
          </div>
          <div class="niq-stat niq-stat-high">
            <span class="niq-stat-value" id="niq-high-matches">0</span>
            <span class="niq-stat-label">High</span>
          </div>
          <div class="niq-stat niq-stat-medium">
            <span class="niq-stat-value" id="niq-medium-matches">0</span>
            <span class="niq-stat-label">Medium</span>
          </div>
          <div class="niq-stat niq-stat-low">
            <span class="niq-stat-value" id="niq-low-matches">0</span>
            <span class="niq-stat-label">Low</span>
          </div>
        </div>
        
        <div class="niq-summary-actions">
          <button class="niq-action-btn" id="niq-sort-btn" title="Sort by score">
            ↕️ Sort
          </button>
          <button class="niq-action-btn" id="niq-filter-btn" title="Filter results">
            🔍 Filter
          </button>
          <button class="niq-action-btn" id="niq-export-btn" title="Export to CSV">
            📊 Export
          </button>
        </div>
      </div>
    `;
    
    // Find insertion point (top of search results)
    const searchResults = document.querySelector('.search-results-container, [class*="search-results"], .scaffold-layout__main');
    if (searchResults) {
      searchResults.insertBefore(summaryBar, searchResults.firstChild);
    } else {
      // Fallback to body
      document.body.insertBefore(summaryBar, document.body.firstChild);
    }
    
    // Attach event listeners
    this.attachSummaryBarListeners();
  }
  
  updateSummaryBar(profiles, high, medium, low) {
    document.getElementById('niq-total-profiles').textContent = profiles.length;
    document.getElementById('niq-high-matches').textContent = high;
    document.getElementById('niq-medium-matches').textContent = medium;
    document.getElementById('niq-low-matches').textContent = low;
  }
  
  addScoreBadgeToCard(profile, scoreData) {
    // Find the profile card element
    const card = profile.cardElement || 
                 document.querySelector(`a[href*="${profile.url.split('/in/')[1]}"]`)?.closest('.entity-result__item, .reusable-search__result-container, li[class*="reusable-search__result-container"], div[data-chameleon-result-urn]');
    
    if (!card) {
      console.log(`NetworkIQ: Could not find card for ${profile.name}`);
      return;
    }
    
    // Check if badge already exists
    if (card.querySelector('.niq-search-badge')) return;
    
    // Create score badge
    const badge = document.createElement('div');
    badge.className = 'niq-search-badge';
    badge.innerHTML = `
      <div class="niq-badge-score niq-tier-${scoreData.tier}" data-profile-url="${profile.url}">
        <span class="niq-badge-number">${scoreData.score}</span>
        <span class="niq-badge-label">NIQ</span>
      </div>
      ${scoreData.matches && scoreData.matches.length > 0 ? 
        `<div class="niq-badge-matches">${scoreData.matches.slice(0, 2).map(m => m.text).join(' • ')}</div>` : 
        ''}
    `;
    
    // Add badge to the card
    // Try to insert it near the name/title area
    const titleArea = card.querySelector('.entity-result__title-line, [class*="entity-result__title"]');
    if (titleArea) {
      titleArea.style.position = 'relative';
      badge.style.position = 'absolute';
      badge.style.top = '0';
      badge.style.right = '0';
      titleArea.appendChild(badge);
    } else {
      // Fallback: add to the card itself
      card.style.position = 'relative';
      card.appendChild(badge);
    }
    
    // Add click handler to view full profile with score
    badge.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showProfileQuickView(profile, scoreData);
    });
  }
  
  showProfileQuickView(profile, scoreData) {
    // Create modal for quick profile view
    const modal = document.createElement('div');
    modal.className = 'networkiq-quickview-modal';
    modal.innerHTML = `
      <div class="niq-quickview-content">
        <button class="niq-quickview-close" id="niq-close-quickview">✕</button>
        
        <div class="niq-quickview-header">
          ${profile.imageUrl ? `<img src="${profile.imageUrl}" class="niq-quickview-avatar">` : ''}
          <div class="niq-quickview-info">
            <h3>${profile.name}</h3>
            <p>${profile.title}</p>
            ${profile.company ? `<p class="niq-quickview-company">${profile.company}</p>` : ''}
            ${profile.location ? `<p class="niq-quickview-location">📍 ${profile.location}</p>` : ''}
          </div>
          <div class="niq-quickview-score niq-tier-${scoreData.tier}">
            <span class="niq-score-number">${scoreData.score}</span>
            <span class="niq-score-label">NetworkIQ</span>
          </div>
        </div>
        
        <div class="niq-quickview-body">
          ${scoreData.matches && scoreData.matches.length > 0 ? `
            <div class="niq-quickview-section">
              <h4>🔗 Connections</h4>
              <div class="niq-quickview-matches">
                ${scoreData.matches.map(m => 
                  `<span class="niq-match-chip">${m.text} (+${m.weight})</span>`
                ).join('')}
              </div>
            </div>
          ` : ''}
          
          <div class="niq-quickview-section">
            <h4>💬 Suggested Message</h4>
            <textarea class="niq-quickview-message" id="niq-quickview-message">
${this.scorer.generateMessage(profile, scoreData)}
            </textarea>
          </div>
          
          <div class="niq-quickview-actions">
            <button class="niq-btn niq-btn-primary" id="niq-copy-quickview-message">
              📋 Copy Message
            </button>
            <a href="${profile.url}" target="_blank" class="niq-btn niq-btn-secondary">
              👤 View Full Profile
            </a>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event listeners
    document.getElementById('niq-close-quickview').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
    
    document.getElementById('niq-copy-quickview-message')?.addEventListener('click', () => {
      const message = document.getElementById('niq-quickview-message').value;
      navigator.clipboard.writeText(message);
      this.showToast('Message copied!');
    });
  }
  
  attachSummaryBarListeners() {
    // Sort button
    document.getElementById('niq-sort-btn')?.addEventListener('click', () => {
      this.sortSearchResults();
    });
    
    // Filter button
    document.getElementById('niq-filter-btn')?.addEventListener('click', () => {
      this.showFilterModal();
    });
    
    // Export button
    document.getElementById('niq-export-btn')?.addEventListener('click', () => {
      this.exportToCSV();
    });
  }
  
  sortSearchResults() {
    if (!this.scoredProfiles || this.scoredProfiles.length === 0) return;
    
    // Toggle sort order
    this.sortOrder = this.sortOrder === 'desc' ? 'asc' : 'desc';
    
    // Sort profiles
    const sorted = [...this.scoredProfiles].sort((a, b) => {
      return this.sortOrder === 'desc' ? b.score - a.score : a.score - b.score;
    });
    
    // Find the container with all result cards
    const container = document.querySelector('.search-results-container, [class*="search-results"] > ul, .scaffold-layout__list');
    if (!container) return;
    
    // Reorder DOM elements
    sorted.forEach(profile => {
      const card = profile.cardElement || 
                   document.querySelector(`a[href*="${profile.url.split('/in/')[1]}"]`)?.closest('.entity-result__item, .reusable-search__result-container');
      if (card && card.parentElement) {
        card.parentElement.appendChild(card);
      }
    });
    
    this.showToast(`Sorted by score (${this.sortOrder === 'desc' ? 'high to low' : 'low to high'})`);
  }
  
  showFilterModal() {
    const modal = document.createElement('div');
    modal.className = 'networkiq-filter-modal';
    modal.innerHTML = `
      <div class="niq-filter-content">
        <h3>Filter Results</h3>
        <div class="niq-filter-options">
          <label>
            <input type="checkbox" id="niq-filter-high" checked>
            <span class="niq-filter-label niq-tier-high">High Matches (70+)</span>
          </label>
          <label>
            <input type="checkbox" id="niq-filter-medium" checked>
            <span class="niq-filter-label niq-tier-medium">Medium Matches (40-69)</span>
          </label>
          <label>
            <input type="checkbox" id="niq-filter-low" checked>
            <span class="niq-filter-label niq-tier-low">Low Matches (0-39)</span>
          </label>
        </div>
        <div class="niq-filter-actions">
          <button class="niq-btn niq-btn-primary" id="niq-apply-filter">Apply</button>
          <button class="niq-btn niq-btn-secondary" id="niq-cancel-filter">Cancel</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('niq-apply-filter').addEventListener('click', () => {
      this.applyFilters();
      modal.remove();
    });
    
    document.getElementById('niq-cancel-filter').addEventListener('click', () => {
      modal.remove();
    });
  }
  
  applyFilters() {
    const showHigh = document.getElementById('niq-filter-high').checked;
    const showMedium = document.getElementById('niq-filter-medium').checked;
    const showLow = document.getElementById('niq-filter-low').checked;
    
    let hiddenCount = 0;
    
    this.scoredProfiles.forEach(profile => {
      const card = profile.cardElement || 
                   document.querySelector(`a[href*="${profile.url.split('/in/')[1]}"]`)?.closest('.entity-result__item, .reusable-search__result-container');
      
      if (card) {
        let shouldShow = false;
        if (profile.tier === 'high' && showHigh) shouldShow = true;
        if (profile.tier === 'medium' && showMedium) shouldShow = true;
        if (profile.tier === 'low' && showLow) shouldShow = true;
        
        card.style.display = shouldShow ? '' : 'none';
        if (!shouldShow) hiddenCount++;
      }
    });
    
    this.showToast(`Filter applied. ${hiddenCount} profiles hidden.`);
  }
  
  exportToCSV() {
    if (!this.scoredProfiles || this.scoredProfiles.length === 0) {
      this.showToast('No profiles to export');
      return;
    }
    
    // Create CSV content
    const headers = ['Name', 'Score', 'Tier', 'Title', 'Company', 'Location', 'Matches', 'Profile URL'];
    const rows = this.scoredProfiles.map(p => [
      p.name,
      p.score,
      p.tier,
      p.title || '',
      p.company || '',
      p.location || '',
      (p.matches || []).map(m => m.text).join('; '),
      p.url
    ]);
    
    // Convert to CSV format
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `networkiq-scores-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    
    URL.revokeObjectURL(url);
    this.showToast('Scores exported to CSV');
  }
  
  addHoverTooltips() {
    // Add tooltips on hover for score badges
    document.querySelectorAll('.niq-badge-score').forEach(badge => {
      badge.title = 'Click for quick view and personalized message';
    });
  }

  calculateQuickScore(profile) {
    let score = 0;
    const text = `${profile.name} ${profile.title} ${profile.location}`.toLowerCase();
    
    // Quick military check
    if (text.includes('usafa') || text.includes('air force academy')) score += 40;
    else if (text.includes('military') || text.includes('veteran')) score += 30;
    
    // Quick company check
    if (text.includes('c3') || text.includes('anthropic') || text.includes('palantir')) score += 25;
    
    // Quick role check
    if (text.includes('product') && text.includes('manager')) score += 20;
    if (text.includes('ai') || text.includes('ml')) score += 15;
    
    return Math.min(score, 100);
  }

  getTierFromScore(score) {
    if (score >= 70) return 'platinum';
    if (score >= 50) return 'gold';
    if (score >= 30) return 'silver';
    if (score >= 15) return 'bronze';
    return 'standard';
  }

  formatLabel(key) {
    const labels = {
      military: 'Military Connection',
      company: 'Company Match',
      education: 'Education',
      skills: 'Skills & Role',
      location: 'Location',
      role: 'Role Relevance'
    };
    return labels[key] || key;
  }

  showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'networkiq-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  showUpgradePrompt(feature = 'score more profiles') {
    const modal = document.createElement('div');
    modal.className = 'networkiq-modal';
    modal.innerHTML = `
      <div class="niq-modal-content">
        <h2>🚀 Upgrade to NetworkIQ Pro</h2>
        <p>You've reached your daily limit. Upgrade to Pro to ${feature}!</p>
        <ul class="niq-features">
          <li>✅ Unlimited profile scoring</li>
          <li>✅ AI-powered message generation</li>
          <li>✅ Advanced analytics</li>
          <li>✅ Export connections data</li>
          <li>✅ Priority support</li>
        </ul>
        <div class="niq-modal-actions">
          <button class="niq-btn niq-btn-primary" id="niq-upgrade">
            Upgrade for $19/month
          </button>
          <button class="niq-btn niq-btn-secondary" id="niq-close-modal">
            Maybe Later
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('niq-upgrade')?.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'openUpgrade' });
      modal.remove();
    });
    
    document.getElementById('niq-close-modal')?.addEventListener('click', () => {
      modal.remove();
    });
  }

  trackEvent(eventName, properties = {}) {
    chrome.runtime.sendMessage({
      action: 'track',
      event: eventName,
      properties: {
        ...properties,
        url: window.location.href,
        timestamp: new Date().toISOString()
      }
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new NetworkIQUI());
} else {
  new NetworkIQUI();
}