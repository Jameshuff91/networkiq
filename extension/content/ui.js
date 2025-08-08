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
    this.historyService = null;
    this.init();
  }

  async init() {
    // Initialize history service
    try {
      if (typeof HistoryService !== 'undefined') {
        this.historyService = new HistoryService();
        await this.historyService.init();
        console.log('NetworkIQ: History service initialized');
      }
    } catch (error) {
      console.warn('NetworkIQ: Could not initialize history service:', error);
    }
    
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
      // Get user data from storage
      chrome.storage.local.get(['user', 'resumeData', 'searchElements', 'authToken'], (localData) => {
        console.log('NetworkIQ: Storage data loaded:', {
          hasUser: !!localData.user,
          hasResumeData: !!localData.resumeData,
          hasSearchElements: !!localData.searchElements,
          searchElementsCount: localData.searchElements?.length || 0,
          hasAuthToken: !!localData.authToken
        });
        
        // Get all relevant data
        chrome.storage.sync.get(['userTier', 'dailyUsage'], (syncData) => {
          this.userTier = syncData.userTier || 'free';
          this.dailyUsage = syncData.dailyUsage || 0;
          
          // Load search elements from resume data
          if (localData.searchElements && localData.searchElements.length > 0) {
            this.scorer.searchElements = localData.searchElements;
            console.log('NetworkIQ: Loaded search elements:', this.scorer.searchElements.length, 'items');
            console.log('NetworkIQ: Search elements:', JSON.stringify(this.scorer.searchElements));
          } else if (localData.resumeData?.search_elements && localData.resumeData.search_elements.length > 0) {
            this.scorer.searchElements = localData.resumeData.search_elements;
            console.log('NetworkIQ: Loaded search elements from resume:', this.scorer.searchElements.length, 'items');
            console.log('NetworkIQ: First few elements:', this.scorer.searchElements.slice(0, 3));
          } else {
            // Use default if no resume uploaded
            this.scorer.searchElements = this.scorer.getDefaultSearchElements();
            console.log('NetworkIQ: Using default search elements - NO RESUME UPLOADED');
            console.log('NetworkIQ: Please upload your resume in the extension popup');
          }
          
          resolve();
        });
      });
    });
  }

  onPageChange() {
    const url = window.location.href;
    console.log('NetworkIQ: Page changed to:', url);
    
    if (LinkedInParser.isProfilePage()) {
      console.log('NetworkIQ: Detected profile page');
      console.log('NetworkIQ: About to call injectProfileScore...');
      this.injectProfileScore();
      console.log('NetworkIQ: injectProfileScore called');
    } else if (LinkedInParser.isSearchPage()) {
      console.log('NetworkIQ: Detected search page - starting batch scoring');
      this.injectSearchScores();
    } else {
      console.log('NetworkIQ: Not a profile or search page');
    }
  }

  async injectProfileScore() {
    console.log('NetworkIQ: injectProfileScore started');
    try {
      // Rate limiting configuration
      const MIN_DELAY_MS = 2000; // Minimum 2 seconds before parsing
      const MAX_DELAY_MS = 5000; // Maximum 5 seconds before parsing
      
      // Check daily usage before proceeding
      const storage = await chrome.storage.local.get(['dailyScoredProfiles', 'lastResetDate']);
      const today = new Date().toDateString();
      let dailyScoredProfiles = storage.dailyScoredProfiles || 0;
      
      if (storage.lastResetDate !== today) {
        dailyScoredProfiles = 0;
        await chrome.storage.local.set({ 
          dailyScoredProfiles: 0,
          lastResetDate: today
        });
      }
      
      // Check daily limit (30 for free, 100 for pro)
      const maxDaily = this.userTier === 'pro' ? 100 : 30;
      if (dailyScoredProfiles >= maxDaily) {
        console.log(`NetworkIQ: Daily limit reached (${maxDaily} profiles)`);
        this.showToast(`Daily scoring limit reached (${maxDaily} profiles). Upgrade to Pro for more.`);
        
        // Check if we should show upgrade prompt
        const lastPrompt = await chrome.storage.local.get(['lastUpgradePromptDate']);
        if (lastPrompt.lastUpgradePromptDate !== today && this.userTier === 'free') {
          this.showUpgradePrompt();
          await chrome.storage.local.set({ lastUpgradePromptDate: today });
        }
        return;
      }
      
      console.log(`NetworkIQ: Daily usage: ${dailyScoredProfiles}/${maxDaily}`);

      // Add human-like random delay before parsing
      const randomDelay = Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
      console.log(`NetworkIQ: Waiting ${randomDelay}ms before parsing profile...`);
      await new Promise(resolve => setTimeout(resolve, randomDelay));
      
      // Simulate human scrolling behavior
      window.scrollTo({
        top: Math.random() * 500,
        behavior: 'smooth'
      });
      await new Promise(resolve => setTimeout(resolve, 500));

      // Parse profile
      console.log('NetworkIQ: Parsing profile...');
      const profile = this.parser.parse();
      if (!profile) {
        console.log('NetworkIQ: Could not parse profile');
        console.log('NetworkIQ: Parser returned null/undefined');
        return;
      }
      console.log('NetworkIQ: Profile parsed successfully:', profile);

      // Calculate score - try LLM first, fallback to local
      console.log('NetworkIQ: Calculating score...');
      let scoreData;
      
      // Check if we should use LLM (default: yes for better matching)
      const settings = await chrome.storage.local.get(['useLLMAnalysis']);
      const useLLM = settings.useLLMAnalysis !== false;
      
      if (useLLM) {
        try {
          // First check cache
          try {
            const cachedResult = await window.profileAnalysisCache.get(profile.url, this.scorer.searchElements);
            if (cachedResult) {
              console.log('NetworkIQ: Cache hit for individual profile:', profile.name);
              scoreData = {
                score: cachedResult.score,
                tier: cachedResult.tier,
                matches: cachedResult.matches || [],
                breakdown: cachedResult.breakdown || this.buildBreakdownFromMatches(cachedResult.matches || []),
                insights: cachedResult.insights || [],
                hiddenConnections: cachedResult.hidden_connections || [],
                recommendation: cachedResult.recommendation || '',
                message: cachedResult.message,
                cached: true
              };
            }
          } catch (error) {
            console.warn('NetworkIQ: Cache error for individual profile:', error);
          }
          
          // If not cached, proceed with LLM or local scoring
          if (!scoreData) {
            // Check if extension context is still valid
            if (!chrome.runtime?.id) {
              console.log('NetworkIQ: Extension context invalid, using local scoring');
              scoreData = this.scorer.calculateScore(profile);
            } else {
              console.log('NetworkIQ: Sending sanitized data to LLM');
            // Sanitize profile data before sending to LLM
            const sanitizedProfile = this.sanitizeProfileForLLM(profile);
            const response = await chrome.runtime.sendMessage({
              action: 'analyzeProfile',
              profile: sanitizedProfile,
              searchElements: this.scorer.searchElements
            });
            
            if (response && !response.error) {
              console.log('NetworkIQ: LLM response for', profile.name, ':', response);
              
              // Cache the raw response for future use
              try {
                await window.profileAnalysisCache.set(profile.url, this.scorer.searchElements, response);
                console.log(`NetworkIQ: Cached individual profile result for ${profile.name}`);
              } catch (error) {
                console.warn('NetworkIQ: Failed to cache individual profile result:', error);
              }
              
              // Format LLM response to match local scorer format
              scoreData = {
                score: response.score,
                tier: response.tier,
                matches: response.matches || [],
                breakdown: this.buildBreakdownFromMatches(response.matches || []),
                insights: response.insights || [],
                hiddenConnections: response.hidden_connections || [],
                recommendation: response.recommendation || '',
                message: response.message
              };
              console.log('NetworkIQ: Formatted scoreData for', profile.name, ':', scoreData);
            } else {
              console.log('NetworkIQ: LLM response error, using local scoring:', response);
              scoreData = this.scorer.calculateScore(profile);
            }
            }
          }
        } catch (error) {
          if (error.message?.includes('Extension context invalidated')) {
            console.log('NetworkIQ: Extension reloaded, using local scoring');
            scoreData = this.scorer.calculateScore(profile);
          } else {
            console.log('NetworkIQ: LLM error, using local scoring:', error);
            scoreData = this.scorer.calculateScore(profile);
          }
        }
      } else {
        scoreData = this.scorer.calculateScore(profile);
      }
      
      this.currentProfile = { profile, scoreData };

      // Create and inject UI
      console.log('NetworkIQ: Creating UI elements...');
      this.createScoreBadge(scoreData);
      await this.createMessageBox(profile, scoreData);
      this.createFloatingWidget(scoreData);

      // Update daily usage counter
      await chrome.storage.local.set({ 
        dailyScoredProfiles: dailyScoredProfiles + 1 
      });

      // Track in history (privacy-compliant)
      if (this.historyService) {
        try {
          await this.historyService.addScore({
            score: scoreData.score,
            tier: scoreData.tier,
            matches: scoreData.matches || scoreData.connections || [],
            message: scoreData.message,
            source: 'individual'
          });
          console.log('NetworkIQ: Score added to history');
        } catch (error) {
          console.warn('NetworkIQ: Could not add to history:', error);
        }
      }
      
      // Send analytics
      this.trackEvent('profile_scored', {
        score: scoreData.score,
        tier: scoreData.tier
      });
      
    } catch (error) {
      console.error('NetworkIQ: Error scoring profile:', error);
      console.error('NetworkIQ: Error details:', error.message, error.stack);
      // Don't let errors crash the page
    }
  }
  
  sanitizeProfileForLLM(profile) {
    // Extract only keywords and concepts, not full profile data
    const sanitized = {
      // Keep URL for caching but not sent to LLM
      url: profile.url,
      
      // Extract keywords instead of full text
      keywords: this.extractKeywords(profile),
      
      // Categories instead of actual names
      hasEducation: !!(profile.education && profile.education.length > 0),
      hasExperience: !!(profile.experience && profile.experience.length > 0),
      hasSkills: !!(profile.skills && profile.skills.length > 0),
      
      // Industry/role indicators without PII
      roleLevel: this.categorizeRole(profile.headline || profile.title),
      industryType: this.categorizeIndustry(profile.text || ''),
      
      // Connection strength indicators
      connectionDegree: profile.connectionDegree || '',
      
      // Simplified location (just country/region)
      region: this.extractRegion(profile.location || '')
    };
    
    return sanitized;
  }
  
  extractKeywords(profile) {
    const text = [
      profile.headline || '',
      profile.about || '',
      profile.text || ''
    ].join(' ').toLowerCase();
    
    // Extract only technical/professional keywords
    const keywords = [];
    const importantTerms = [
      'engineer', 'developer', 'manager', 'director', 'analyst',
      'python', 'java', 'javascript', 'react', 'node', 'aws',
      'machine learning', 'ai', 'data', 'cloud', 'devops',
      'startup', 'enterprise', 'saas', 'fintech', 'healthcare'
    ];
    
    importantTerms.forEach(term => {
      if (text.includes(term)) {
        keywords.push(term);
      }
    });
    
    return keywords;
  }
  
  categorizeRole(title) {
    const lower = (title || '').toLowerCase();
    if (lower.includes('ceo') || lower.includes('founder') || lower.includes('president')) {
      return 'executive';
    } else if (lower.includes('director') || lower.includes('vp') || lower.includes('head of')) {
      return 'senior';
    } else if (lower.includes('manager') || lower.includes('lead')) {
      return 'mid';
    } else if (lower.includes('junior') || lower.includes('intern')) {
      return 'entry';
    }
    return 'individual';
  }
  
  categorizeIndustry(text) {
    const lower = text.toLowerCase();
    if (lower.includes('tech') || lower.includes('software') || lower.includes('saas')) {
      return 'technology';
    } else if (lower.includes('finance') || lower.includes('banking') || lower.includes('investment')) {
      return 'finance';
    } else if (lower.includes('health') || lower.includes('medical') || lower.includes('pharma')) {
      return 'healthcare';
    } else if (lower.includes('consult')) {
      return 'consulting';
    }
    return 'other';
  }
  
  extractRegion(location) {
    const lower = location.toLowerCase();
    if (lower.includes('united states') || lower.includes('usa')) return 'US';
    if (lower.includes('united kingdom') || lower.includes('uk')) return 'UK';
    if (lower.includes('canada')) return 'Canada';
    if (lower.includes('india')) return 'India';
    if (lower.includes('germany')) return 'Germany';
    return 'Other';
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

  async createMessageBox(profile, scoreData) {
    // Remove existing sidebar
    const existing = document.querySelector('.networkiq-sidebar');
    if (existing) existing.remove();
    
    // Get saved Calendly link
    const storage = await chrome.storage.local.get(['calendlyLink']);
    let message = scoreData.message || this.scorer.generateMessage(profile, scoreData);
    
    // Add Calendly link if available and not already included
    if (storage.calendlyLink && !message.includes(storage.calendlyLink)) {
      message = `${message}\n\nFeel free to book time: ${storage.calendlyLink}`;
    }

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
            ${(() => {
              const matches = scoreData.matches || [];
              console.log('NetworkIQ: UI displaying matches for', profile.name, ':', matches);
              
              if (matches.length === 0 && scoreData.score > 0) {
                // If we have a score but no matches array, try to extract from breakdown
                const breakdown = scoreData.breakdown || {};
                const breakdownMatches = Object.entries(breakdown)
                  .filter(([_, value]) => value > 0)
                  .map(([key, _]) => this.formatLabel(key));
                
                if (breakdownMatches.length > 0) {
                  return breakdownMatches.slice(0, 3).map(match => 
                    `<div class="niq-insight-chip">✓ ${match}</div>`
                  ).join('');
                }
              }
              
              const validMatches = matches.slice(0, 3).map(match => {
                let matchText;
                if (typeof match === 'string') {
                  matchText = match;
                } else if (match.matches_element) {
                  // LLM format - show the element name, optionally with context
                  matchText = match.matches_element;
                  if (match.found_in_profile && match.found_in_profile !== match.matches_element.toLowerCase()) {
                    matchText += ` (${match.found_in_profile})`;
                  }
                } else {
                  // Local format (from scorer.js)
                  matchText = match.text || match.display || match.value || '';
                }
                return matchText ? `<div class="niq-insight-chip">✓ ${matchText}</div>` : '';
              }).filter(text => text.length > 0);
              
              return validMatches.length > 0 ? validMatches.join('') : 
                (scoreData.score > 0 ? 
                  `<div class="niq-insight-chip">✓ Profile compatibility detected</div>` : 
                  `<div class="niq-insight-chip">No direct matches found</div>`);
            })()}
          </div>
          ${scoreData.hiddenConnections && scoreData.hiddenConnections.length > 0 ? `
            <div class="niq-hidden-connections" style="margin-top: 8px;">
              ${scoreData.hiddenConnections.map(conn => 
                `<span style="display: inline-block; background: #F3F4F6; color: #6B7280; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin: 2px;">🔍 ${conn}</span>`
              ).join(' ')}
            </div>
          ` : ''}
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
      // Get the current message from the textarea (in case it was regenerated or edited)
      const textarea = document.querySelector('.niq-message-text');
      const currentMessage = textarea ? textarea.value : message;
      navigator.clipboard.writeText(currentMessage);
      this.showToast('Message copied to clipboard!');
      this.trackEvent('message_copied');
    });

    // Regenerate message (Pro feature)
    document.getElementById('niq-regenerate')?.addEventListener('click', async () => {
      // TODO: Re-enable for production
      /*
      if (this.userTier === 'free') {
        this.showUpgradePrompt('Regenerate messages with AI');
        return;
      }
      */
      await this.regenerateMessage();
    });

  }

  async regenerateMessage() {
    try {
      console.log('NetworkIQ: Regenerating message...');
      console.log('NetworkIQ: Current profile:', this.currentProfile);
      
      // Get saved Calendly link
      const storage = await chrome.storage.local.get(['calendlyLink']);
      
      // Show loading state
      const textarea = document.querySelector('.niq-message-text');
      const regenerateBtn = document.getElementById('niq-regenerate');
      if (regenerateBtn) {
        regenerateBtn.disabled = true;
        regenerateBtn.textContent = 'Generating...';
      }
      
      const response = await chrome.runtime.sendMessage({
        action: 'generateMessage',
        profile: this.currentProfile.profile,
        scoreData: this.currentProfile.scoreData,
        calendlyLink: storage.calendlyLink || ''
      });
      
      console.log('NetworkIQ: Generate message response:', response);
      console.log('NetworkIQ: Response type:', typeof response);
      console.log('NetworkIQ: Response keys:', response ? Object.keys(response) : 'null');

      // Handle both response formats (with .success or direct .message)
      if (response && response.message && typeof response.message === 'string') {
        if (textarea) {
          textarea.value = response.message;
          this.showToast('New message generated!');
          this.trackEvent('message_regenerated');
        }
      } else if (response && typeof response === 'string') {
        // Sometimes the response might be a direct string
        if (textarea) {
          textarea.value = response;
          this.showToast('New message generated!');
          this.trackEvent('message_regenerated');
        }
      } else if (response && response.error) {
        console.error('NetworkIQ: Message generation error:', response);
        
        // Handle different error types with appropriate messages
        let errorMessage = 'Failed to generate message. Please try again.';
        if (response.code === 'NETWORK_ERROR') {
          errorMessage = 'Cannot connect to server. Please check your connection.';
        } else if (response.code === 'UNAUTHORIZED') {
          errorMessage = 'Please sign in to generate messages. Open the extension popup to login.';
        } else if (response.code === 'RATE_LIMIT') {
          errorMessage = response.message || 'Daily limit reached. Upgrade to Pro for unlimited messages!';
        } else if (response.message) {
          errorMessage = response.message;
        }
        
        this.showToast(errorMessage);
      } else {
        console.error('NetworkIQ: Unexpected response format:', response);
        // If we somehow get an object, try to extract any text we can find
        if (response && typeof response === 'object') {
          const possibleMessage = response.text || response.data || response.result || 
                                 (response.response && response.response.message) || 
                                 JSON.stringify(response);
          if (textarea && possibleMessage !== '[object Object]') {
            textarea.value = possibleMessage;
            console.warn('NetworkIQ: Had to extract message from unexpected format');
          }
        }
        this.showToast('Message generated with unexpected format. Please check.');
      }
    } catch (error) {
      console.error('NetworkIQ: Failed to regenerate message:', error);
      this.showToast('Failed to generate message. Please try again.');
    } finally {
      // Restore button state
      const regenerateBtn = document.getElementById('niq-regenerate');
      if (regenerateBtn) {
        regenerateBtn.disabled = false;
        regenerateBtn.textContent = '🔄 Regenerate';
      }
    }
  }

  async injectSearchScores() {
    // Throttled scoring for search results - compliant version
    console.log('NetworkIQ: Starting throttled scoring for visible profiles...');
    
    // Rate limiting configuration
    const MAX_PROFILES_PER_PAGE = 5; // Only score first 5 visible profiles
    const MIN_DELAY_MS = 3000; // Minimum 3 seconds between profiles
    const MAX_DELAY_MS = 7000; // Maximum 7 seconds between profiles
    
    // Check daily usage before proceeding
    const storage = await chrome.storage.local.get(['dailyScoredProfiles', 'lastResetDate']);
    const today = new Date().toDateString();
    let dailyScoredProfiles = storage.dailyScoredProfiles || 0;
    
    if (storage.lastResetDate !== today) {
      dailyScoredProfiles = 0;
      await chrome.storage.local.set({ 
        dailyScoredProfiles: 0,
        lastResetDate: today
      });
    }
    
    // Check daily limit (30 for free, 100 for pro)
    const maxDaily = this.userTier === 'pro' ? 100 : 30;
    if (dailyScoredProfiles >= maxDaily) {
      console.log(`NetworkIQ: Daily limit reached (${maxDaily} profiles)`);
      this.showToast(`Daily scoring limit reached (${maxDaily} profiles). Upgrade to Pro for more.`);
      return;
    }
    
    // Get only visible profiles in viewport
    const allProfiles = LinkedInParser.getSearchResultProfiles();
    const visibleProfiles = allProfiles.slice(0, MAX_PROFILES_PER_PAGE);
    
    console.log(`NetworkIQ: Found ${visibleProfiles.length} visible profiles (max ${MAX_PROFILES_PER_PAGE})`);
    
    if (visibleProfiles.length === 0) {
      console.log('NetworkIQ: No visible profiles found');
      return;
    }
    
    // Create summary bar if not exists
    this.createSummaryBar();
    
    // Helper function to add human-like random delay
    const randomDelay = (min, max) => {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    };
    
    // Helper function to simulate human scrolling
    const simulateScroll = async (element) => {
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise(resolve => setTimeout(resolve, randomDelay(500, 1500)));
      }
    };
    
    // Score profiles sequentially with delays
    const scoredProfiles = [];
    let highScoreCount = 0;
    let mediumScoreCount = 0;
    let lowScoreCount = 0;
    let profilesScored = 0;
    
    console.log(`NetworkIQ: Will score up to ${visibleProfiles.length} visible profiles with delays`);
    
    // Process profiles one by one with delays
    for (let i = 0; i < visibleProfiles.length; i++) {
      const profile = visibleProfiles[i];
      
      // Check if we've hit daily limit
      if (dailyScoredProfiles + profilesScored >= maxDaily) {
        console.log('NetworkIQ: Daily limit reached, stopping');
        break;
      }
      
      // Simulate human scrolling to the profile
      const profileElement = profile.element || document.querySelector(`a[href="${profile.url}"]`);
      await simulateScroll(profileElement);
      
      // Prepare profile data for scoring
      const profileData = {
        url: profile.url,
        name: profile.name,
        title: profile.title,
        company: profile.company,
        location: profile.location,
        text: profile.fullText || `${profile.name} ${profile.title} ${profile.company} ${profile.location} ${profile.summary}`.toLowerCase(),
        headline: profile.title || '',
        about: profile.summary || '',
        experience: profile.company || '',
        education: '',
        skills: [],
        connectionDegree: '',
        profilePicture: profile.imageUrl || '',
        timestamp: new Date().toISOString()
      };
      
      console.log(`NetworkIQ: Scoring profile ${i+1}/${visibleProfiles.length}: ${profile.name}`);
      
      // Score locally using the scorer
      const scoreResult = this.scorer.calculateScore(profileData);
      
      // Store scored profile
      scoredProfiles.push({
        ...profile,
        score: scoreResult.score,
        tier: scoreResult.tier,
        matches: scoreResult.connections || []
      });
      
      // Count by tier
      if (scoreResult.tier === 'high') highScoreCount++;
      else if (scoreResult.tier === 'medium') mediumScoreCount++;
      else lowScoreCount++;
      
      // Add visual badge
      this.addScoreBadgeToCard(profile, scoreResult);
      
      // Track in history (privacy-compliant)
      if (this.historyService) {
        try {
          await this.historyService.addScore({
            score: scoreResult.score,
            tier: scoreResult.tier,
            matches: scoreResult.connections || [],
            message: null,
            source: 'batch'
          });
        } catch (error) {
          console.warn('NetworkIQ: Could not add batch score to history:', error);
        }
      }
      
      profilesScored++;
      
      // Add human-like delay before next profile (except for last one)
      if (i < visibleProfiles.length - 1) {
        const delay = randomDelay(MIN_DELAY_MS, MAX_DELAY_MS);
        console.log(`NetworkIQ: Waiting ${delay}ms before next profile...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // Update daily usage
    await chrome.storage.local.set({ 
      dailyScoredProfiles: dailyScoredProfiles + profilesScored 
    });
    
    // Store scored profiles for filtering/sorting
    this.scoredProfiles = scoredProfiles;
    
    // Update summary bar
    this.updateSummaryBar(scoredProfiles, highScoreCount, mediumScoreCount, lowScoreCount);
    
    console.log(`NetworkIQ: Scoring complete. Scored ${profilesScored} profiles. High: ${highScoreCount}, Medium: ${mediumScoreCount}, Low: ${lowScoreCount}`);
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
              <h4>🎯 Commonalities</h4>
              <div class="niq-quickview-matches">
                ${scoreData.matches
                  .filter(m => {
                    // Only include matches that have valid text and aren't undefined
                    const hasText = m && (m.text || m.matches_element || m.display || m.value);
                    const text = m?.text || m?.matches_element || m?.display || m?.value || '';
                    return hasText && text !== 'undefined' && text !== '';
                  })
                  .map(m => {
                    // Extract the display text from various possible formats
                    const text = m.text || m.matches_element || m.display || m.value || '';
                    const points = m.weight || m.points || 0;
                    // Only show if we have valid text
                    if (text && text !== 'undefined') {
                      return `<span class="niq-match-chip">${text} (+${points})</span>`;
                    }
                    return '';
                  })
                  .filter(html => html !== '')
                  .join('')}
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
      skill: 'Skills & Role',
      location: 'Location',
      role: 'Role Relevance',
      certification: 'Certifications',
      keyword: 'Keywords'
    };
    return labels[key] || key;
  }

  buildBreakdownFromMatches(matches) {
    const breakdown = {};
    const CONFIDENCE_THRESHOLD = 0.3; // Minimum confidence to count as a real match
    
    console.log('NetworkIQ: buildBreakdownFromMatches input:', matches);
    
    matches.forEach(match => {
      // Skip low-confidence matches (non-hits)
      if (match.confidence !== undefined && match.confidence < CONFIDENCE_THRESHOLD) {
        console.log(`NetworkIQ: Skipping low-confidence match (${match.confidence}):`, match.matches_element);
        return;
      }
      
      const category = match.category || 'other';
      if (!breakdown[category]) {
        breakdown[category] = 0;
      }
      // Handle different match formats - LLM might use 'points' or 'weight'
      breakdown[category] += match.points || match.weight || match.score || 0;
    });
    
    console.log('NetworkIQ: buildBreakdownFromMatches result:', breakdown);
    return breakdown;
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
            Upgrade for $20/month
          </button>
          <button class="niq-btn niq-btn-secondary" id="niq-close-modal">
            Maybe Later
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('niq-upgrade')?.addEventListener('click', () => {
      // Send message to open Stripe checkout with Advanced price
      chrome.runtime.sendMessage({ 
        action: 'open_checkout',
        priceId: 'price_1Rs5yIQaJlv206wSfUp4nf4u' // Advanced tier $20/month
      });
      modal.remove();
    });
    
    document.getElementById('niq-close-modal')?.addEventListener('click', () => {
      modal.remove();
    });
  }

  trackEvent(eventName, properties = {}) {
    // Check if extension context is still valid before sending message
    if (chrome.runtime?.id) {
      try {
        chrome.runtime.sendMessage({
          action: 'track',
          event: eventName,
          properties: {
            ...properties,
            url: window.location.href,
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        // Silently fail if extension was reloaded
        console.log('NetworkIQ: Could not track event (extension reloaded)');
      }
    }
  }

  // Create progress bar for batch processing
  createProgressBar(totalProfiles) {
    // Remove any existing progress bar
    const existing = document.querySelector('.networkiq-progress-container');
    if (existing) existing.remove();
    
    // Create progress container
    const container = document.createElement('div');
    container.className = 'networkiq-progress-container';
    container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 300px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      padding: 16px;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;
    
    // Add NetworkIQ branding
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      margin-bottom: 12px;
    `;
    header.innerHTML = `
      <span style="font-weight: 600; font-size: 14px; color: #1a1a1a;">
        🎯 NetworkIQ Processing
      </span>
    `;
    
    // Progress text
    const progressText = document.createElement('div');
    progressText.className = 'networkiq-progress-text';
    progressText.style.cssText = `
      font-size: 12px;
      color: #666;
      margin-bottom: 8px;
    `;
    progressText.textContent = `Analyzing 0 of ${totalProfiles} profiles...`;
    
    // Progress bar background
    const progressBarBg = document.createElement('div');
    progressBarBg.style.cssText = `
      width: 100%;
      height: 8px;
      background: #f0f0f0;
      border-radius: 4px;
      overflow: hidden;
      position: relative;
    `;
    
    // Progress bar fill
    const progressBarFill = document.createElement('div');
    progressBarFill.className = 'networkiq-progress-fill';
    progressBarFill.style.cssText = `
      width: 0%;
      height: 100%;
      background: linear-gradient(90deg, #8B5CF6, #7C3AED);
      border-radius: 4px;
      transition: width 0.3s ease;
    `;
    
    // Add animation shimmer effect
    const shimmer = document.createElement('div');
    shimmer.style.cssText = `
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
      animation: shimmer 2s infinite;
    `;
    
    // Add shimmer animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes shimmer {
        0% { left: -100%; }
        100% { left: 100%; }
      }
    `;
    document.head.appendChild(style);
    
    progressBarBg.appendChild(progressBarFill);
    progressBarBg.appendChild(shimmer);
    
    container.appendChild(header);
    container.appendChild(progressText);
    container.appendChild(progressBarBg);
    
    document.body.appendChild(container);
    
    return container;
  }
  
  // Update progress bar
  updateProgressBar(container, processed, total) {
    if (!container) return;
    
    const progressText = container.querySelector('.networkiq-progress-text');
    const progressFill = container.querySelector('.networkiq-progress-fill');
    
    if (progressText) {
      progressText.textContent = `Analyzed ${processed} of ${total} profiles...`;
    }
    
    if (progressFill) {
      const percentage = (processed / total) * 100;
      progressFill.style.width = `${percentage}%`;
      
      // Add completion message
      if (processed === total) {
        progressText.textContent = `✅ Completed analyzing ${total} profiles!`;
        progressText.style.color = '#10b981';
      }
    }
  }
}

// Listen for messages from popup (cache clearing and auth changes)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scoreProfile') {
    // Manually trigger profile scoring
    console.log('NetworkIQ: Manual score requested from popup');
    if (window.networkIQUI) {
      window.networkIQUI.injectProfileScore();
    }
    return true;
  }
  
  if (request.action === 'authStateChanged') {
    // User just logged in, show the sidebar
    if (request.isAuthenticated) {
      console.log('NetworkIQ: Auth state changed, initializing UI');
      chrome.storage.local.get(['isAuthenticated'], (result) => {
        if (result.isAuthenticated) {
          initializeUI();
        }
      });
    }
    sendResponse({ success: true });
  } else if (request.action === 'clearProfileCache') {
    console.log('NetworkIQ: Clearing profile cache due to:', request.reason);
    try {
      if (window.profileAnalysisCache) {
        window.profileAnalysisCache.clearAll().then(() => {
          console.log('NetworkIQ: Profile cache cleared successfully');
          sendResponse({ success: true });
        }).catch(error => {
          console.error('NetworkIQ: Failed to clear cache:', error);
          sendResponse({ success: false, error: error.message });
        });
      } else {
        console.log('NetworkIQ: Cache not available yet');
        sendResponse({ success: false, error: 'Cache not initialized' });
      }
    } catch (error) {
      console.error('NetworkIQ: Error clearing cache:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true; // Will respond asynchronously
  }
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.networkIQUI = new NetworkIQUI();
  });
} else {
  window.networkIQUI = new NetworkIQUI();
}