/**
 * NetworkIQ UI Injector
 * Adds score badges and UI elements to LinkedIn
 */

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
        setTimeout(() => this.onPageChange(), 1000);
      }
    }).observe(document, { subtree: true, childList: true });

    // Initial load
    this.onPageChange();
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
    if (LinkedInParser.isProfilePage()) {
      this.injectProfileScore();
    } else if (LinkedInParser.isSearchPage()) {
      this.injectSearchScores();
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

  injectSearchScores() {
    // Add mini scores to search results
    const profiles = LinkedInParser.getSearchResultProfiles();
    
    profiles.forEach(profile => {
      // Quick score based on limited data
      const quickScore = this.calculateQuickScore(profile);
      
      // Find the profile card
      const card = document.querySelector(`a[href="${profile.url}"]`)?.closest('[class*="entity-result"]');
      if (card && !card.querySelector('.niq-search-score')) {
        const scoreBadge = document.createElement('div');
        scoreBadge.className = 'niq-search-score';
        scoreBadge.innerHTML = `
          <span class="niq-mini-score niq-tier-${this.getTierFromScore(quickScore)}">
            ${quickScore}
          </span>
        `;
        card.appendChild(scoreBadge);
      }
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