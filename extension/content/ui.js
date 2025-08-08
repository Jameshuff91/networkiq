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
      // Check daily limit for free tier
      // TODO: Re-enable for production
      /*
      if (this.userTier === 'free' && this.dailyUsage >= 10) {
        console.log('NetworkIQ: Daily limit reached for free tier (usage:', this.dailyUsage, ')');
        console.log('NetworkIQ: User tier:', this.userTier);
        // Check if we've already shown the upgrade prompt today
        const today = new Date().toDateString();
        chrome.storage.local.get(['lastUpgradePromptDate'], (result) => {
          if (result.lastUpgradePromptDate !== today) {
            this.showUpgradePrompt();
            chrome.storage.local.set({ lastUpgradePromptDate: today });
          }
        });
        return;
      }
      */
      
      console.log('NetworkIQ: Daily usage:', this.dailyUsage, '/ 10 (limits disabled for dev)');

      // Wait a bit for the page to fully load
      await new Promise(resolve => setTimeout(resolve, 1000));

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
              console.log('NetworkIQ: Sending to LLM with search elements:', this.scorer.searchElements);
            const response = await chrome.runtime.sendMessage({
              action: 'analyzeProfile',
              profile: profile,
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

      // Track usage for free tier
      if (this.userTier === 'free') {
        this.dailyUsage++;
        chrome.storage.sync.set({ dailyUsage: this.dailyUsage });
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
    // Enhanced batch scoring for search results
    console.log('NetworkIQ: Starting batch scoring for search results...');
    console.log('NetworkIQ: Current URL:', window.location.href);
    
    // Check if we should use LLM for batch scoring (default: no for performance)
    // To enable batch LLM processing, run in console: chrome.storage.local.set({ useLLMForBatch: true })
    const settings = await chrome.storage.local.get(['useLLMForBatch', 'useLLMAnalysis']);
    const useLLMForBatch = settings.useLLMForBatch === true;
    const useLLMAnalysis = settings.useLLMAnalysis !== false;
    
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
    
    // Score all profiles - use for...of loop to handle async properly
    const scoredProfiles = [];
    let highScoreCount = 0;
    let mediumScoreCount = 0;
    let lowScoreCount = 0;
    
    console.log(`NetworkIQ: Starting to score ${profiles.length} profiles${useLLMForBatch ? ' with LLM' : ' locally'}`);
    
    // Prepare profile data for scoring
    const profilesData = profiles.map(profile => ({
      url: profile.url,
      name: profile.name,
      title: profile.title,
      company: profile.company,
      location: profile.location,
      // Map fullText to both 'text' and 'headline' for better matching
      text: profile.fullText || `${profile.name} ${profile.title} ${profile.company} ${profile.location} ${profile.summary}`.toLowerCase(),
      headline: profile.title || '', // Add headline field that scorer expects
      about: profile.summary || '', // Add about field
      experience: profile.company || '', // Map company to experience
      education: '', // Will be extracted from fullText if present
      skills: [], // Will be extracted from fullText if present
      connectionDegree: '', // Not available in search results
      profilePicture: profile.imageUrl || '',
      timestamp: new Date().toISOString()
    }));
    
    // Debug: log what we're scoring
    console.log('NetworkIQ: Scoring profile data sample:', profilesData.slice(0, 2));
    console.log('NetworkIQ: Scorer search elements:', this.scorer.searchElements);
    
    // Check cache first for batch analysis - do all checks in parallel
    console.log('NetworkIQ: Checking cache for profiles in parallel...');
    const cacheChecks = profiles.map(async (profile, i) => {
      try {
        const cachedResult = await window.profileAnalysisCache.get(profile.url, this.scorer.searchElements);
        return {
          profile,
          profileData: profilesData[i],
          cachedResult,
          index: i
        };
      } catch (error) {
        console.warn('NetworkIQ: Cache error for profile', profile.name, error);
        return {
          profile,
          profileData: profilesData[i],
          cachedResult: null,
          index: i
        };
      }
    });
    
    // Wait for all cache checks to complete in parallel
    const cacheResults = await Promise.all(cacheChecks);
    
    // Separate cached from uncached
    const cachedResults = [];
    const uncachedProfiles = [];
    const uncachedProfilesData = [];
    
    cacheResults.forEach(({ profile, profileData, cachedResult }) => {
      if (cachedResult) {
        console.log(`NetworkIQ: Cache hit for ${profile.name}`);
        cachedResults.push({
          profile,
          profileData,
          result: cachedResult,
          cached: true
        });
      } else {
        uncachedProfiles.push(profile);
        uncachedProfilesData.push(profileData);
      }
    });
    
    console.log(`NetworkIQ: Cache stats - ${cachedResults.length} cached, ${uncachedProfiles.length} need analysis`);
    
    // Process cached results immediately
    cachedResults.forEach(({ profile, result }) => {
      const scoreData = {
        score: result.score,
        tier: result.tier,
        matches: result.matches || [],
        breakdown: result.breakdown || this.buildBreakdownFromMatches(result.matches || []),
        insights: result.insights || [],
        hiddenConnections: result.hidden_connections || [],
        recommendation: result.recommendation || '',
        message: result.message,
        cached: true
      };
      
      // Store scored profile
      scoredProfiles.push({
        ...profile,
        score: result.score,
        tier: result.tier,
        matches: (result.matches || []).map(m => 
          typeof m === 'string' ? m : (m.text || m.display || m.value || '')
        )
      });
      
      // Count by tier
      if (result.tier === 'high') highScoreCount++;
      else if (result.tier === 'medium') mediumScoreCount++;
      else lowScoreCount++;
      
      // Add visual badge immediately
      this.addScoreBadgeToCard(profile, scoreData);
    });

    // Use batch LLM analysis for uncached profiles only
    if (useLLMForBatch && useLLMAnalysis && chrome.runtime?.id && uncachedProfilesData.length > 0) {
      try {
        // Create and show progress bar for uncached profiles only
        const progressBar = this.createProgressBar(uncachedProfilesData.length);
        
        // Process in smaller chunks to avoid timeouts (max 3 profiles per batch)
        const chunkSize = 3;
        const chunks = [];
        for (let i = 0; i < uncachedProfilesData.length; i += chunkSize) {
          chunks.push({
            profiles: uncachedProfilesData.slice(i, i + chunkSize),
            originalProfiles: uncachedProfiles.slice(i, i + chunkSize),
            startIdx: i
          });
        }
        
        console.log(`NetworkIQ: Using batch LLM for ${uncachedProfilesData.length} uncached profiles in ${chunks.length} chunks of ${chunkSize}`);
        
        let allResults = [];
        let processedCount = 0;
        
        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
          const chunkData = chunks[chunkIndex];
          const chunk = chunkData.profiles;
          const originalProfiles = chunkData.originalProfiles;
          
          console.log(`NetworkIQ: Processing chunk ${chunkIndex + 1}/${chunks.length} with ${chunk.length} profiles`);
          
          // Double-check cache for each profile in this chunk before sending to LLM
          const stillUncachedProfiles = [];
          const stillUncachedOriginalProfiles = [];
          const newlyCachedResults = [];
          
          for (let i = 0; i < chunk.length; i++) {
            const profile = originalProfiles[i];
            const profileData = chunk[i];
            
            try {
              const cachedResult = await window.profileAnalysisCache.get(profile.url, this.scorer.searchElements);
              if (cachedResult) {
                console.log(`NetworkIQ: Cache hit during chunk processing for ${profile.name}`);
                newlyCachedResults.push({
                  profile,
                  result: cachedResult,
                  cached: true
                });
              } else {
                stillUncachedProfiles.push(profileData);
                stillUncachedOriginalProfiles.push(profile);
              }
            } catch (error) {
              console.warn('NetworkIQ: Cache check error during chunk processing:', error);
              // If cache check fails, proceed with LLM
              stillUncachedProfiles.push(profileData);
              stillUncachedOriginalProfiles.push(profile);
            }
          }
          
          // Process newly cached results immediately
          newlyCachedResults.forEach(({ profile, result }) => {
            const scoreData = {
              score: result.score,
              tier: result.tier,
              matches: result.matches || [],
              breakdown: result.breakdown || this.buildBreakdownFromMatches(result.matches || []),
              insights: result.insights || [],
              hiddenConnections: result.hidden_connections || [],
              recommendation: result.recommendation || '',
              message: result.message,
              cached: true
            };
            
            // Store scored profile
            scoredProfiles.push({
              ...profile,
              score: result.score,
              tier: result.tier,
              matches: (result.matches || []).map(m => 
                typeof m === 'string' ? m : (m.text || m.display || m.value || '')
              )
            });
            
            // Count by tier
            if (result.tier === 'high') highScoreCount++;
            else if (result.tier === 'medium') mediumScoreCount++;
            else lowScoreCount++;
            
            // Add visual badge immediately
            this.addScoreBadgeToCard(profile, scoreData);
            
            processedCount++;
            this.updateProgressBar(progressBar, processedCount, uncachedProfilesData.length);
          });
          
          // Skip LLM call if all profiles in chunk were cached
          if (stillUncachedProfiles.length === 0) {
            console.log(`NetworkIQ: Chunk ${chunkIndex + 1} - all profiles now cached, skipping LLM`);
            continue;
          }
          
          console.log(`NetworkIQ: Chunk ${chunkIndex + 1} - sending ${stillUncachedProfiles.length} profiles to LLM (${newlyCachedResults.length} were cached)`);
          
          try {
            const batchResponse = await chrome.runtime.sendMessage({
              action: 'analyzeBatch',
              profiles: stillUncachedProfiles
            });
            
            console.log(`NetworkIQ: Chunk ${chunkIndex + 1} response:`, batchResponse);
            
            if (batchResponse && !batchResponse.error && batchResponse.results) {
              // Process results as they come in and cache them
              batchResponse.results.forEach(async (result, idx) => {
                const profile = stillUncachedOriginalProfiles[idx];
                
                const scoreData = !result.error ? {
                    score: result.score,
                    tier: result.tier,
                    matches: result.matches || [],
                    breakdown: this.buildBreakdownFromMatches(result.matches || []),
                    insights: result.insights || [],
                    hiddenConnections: result.hidden_connections || [],
                    recommendation: result.recommendation || '',
                    message: result.message
                  } : {
                    score: 0,
                    tier: 'low',
                    matches: [],
                    breakdown: {},
                    insights: [],
                    hiddenConnections: [],
                    recommendation: '',
                    message: null
                  };
                  
                  // Cache the result for future use (only if successful)
                  if (!result.error) {
                    try {
                      await window.profileAnalysisCache.set(profile.url, this.scorer.searchElements, result);
                      console.log(`NetworkIQ: Cached result for ${profile.name}`);
                    } catch (error) {
                      console.warn('NetworkIQ: Failed to cache result for', profile.name, error);
                    }
                  }
                  
                  // Immediately add visual badge to the profile card
                  this.addScoreBadgeToCard(profile, scoreData);
                  
                  processedCount++;
                  this.updateProgressBar(progressBar, processedCount, uncachedProfilesData.length);
              });
              
              allResults = allResults.concat(batchResponse.results);
            } else {
              console.warn(`NetworkIQ: Chunk ${chunkIndex + 1} failed:`, batchResponse?.error);
              // Add empty results and badges for failed chunk profiles
              for (let i = 0; i < stillUncachedProfiles.length; i++) {
                const profile = stillUncachedOriginalProfiles[i];
                allResults.push({ error: 'Chunk processing failed', score: 0, tier: 'low' });
                
                // Add low score badge for failed profile
                this.addScoreBadgeToCard(profile, {
                  score: 0,
                  tier: 'low',
                  matches: [],
                  breakdown: {},
                  insights: [],
                  hiddenConnections: [],
                  recommendation: '',
                  message: null
                });
                
                processedCount++;
                this.updateProgressBar(progressBar, processedCount, profilesData.length);
              }
            }
            
            // Small delay between chunks to avoid rate limiting
            if (chunkIndex < chunks.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          } catch (chunkError) {
            console.error(`NetworkIQ: Chunk ${chunkIndex + 1} error:`, chunkError);
            // Add empty results and badges for failed chunk profiles
            for (let i = 0; i < stillUncachedProfiles.length; i++) {
              const profile = stillUncachedOriginalProfiles[i];
              allResults.push({ error: chunkError.message, score: 0, tier: 'low' });
              
              // Add low score badge for failed profile
              this.addScoreBadgeToCard(profile, {
                score: 0,
                tier: 'low',
                matches: [],
                breakdown: {},
                insights: [],
                hiddenConnections: [],
                recommendation: '',
                message: null
              });
              
              processedCount++;
              this.updateProgressBar(progressBar, processedCount, uncachedProfilesData.length);
            }
          }
        }
        
        // Remove progress bar after completion
        setTimeout(() => {
          progressBar?.remove();
        }, 1000)
        
        // Process final results after all chunks are complete
        console.log(`NetworkIQ: Batch LLM completed - ${allResults.filter(r => !r.error).length}/${allResults.length} successful`);
        
        // Count results and store profiles (already added badges during streaming)
        allResults.forEach((result, idx) => {
          const profile = profiles[idx];
          if (!result.error) {
            // Store scored profile
            scoredProfiles.push({
              ...profile,
              score: result.score,
              tier: result.tier,
              matches: (result.matches || []).map(m => 
                typeof m === 'string' ? m : (m.text || m.display || m.value || '')
              )
            });
            
            // Count by tier
            if (result.tier === 'high') highScoreCount++;
            else if (result.tier === 'medium') mediumScoreCount++;
            else lowScoreCount++;
          } else {
            // Fallback to local scoring for failed profiles
            const scoreData = this.scorer.calculateScore(profilesData[idx]);
            scoredProfiles.push({
              ...profile,
              score: scoreData.score,
              tier: scoreData.tier,
              matches: (scoreData.matches || []).map(m => 
                typeof m === 'string' ? m : (m.text || m.display || m.value || '')
              )
            });
            if (scoreData.tier === 'high') highScoreCount++;
            else if (scoreData.tier === 'medium') mediumScoreCount++;
            else lowScoreCount++;
            // Add badge for failed profiles
            this.addScoreBadgeToCard(profile, scoreData);
          }
        });
      } catch (error) {
        console.error('NetworkIQ: Batch LLM failed, falling back to local scoring:', error);
        console.error('NetworkIQ: Full error details:', error.message, error.stack);
        useLLMForBatch = false; // Fallback to local processing
      }
    }
    
    // If batch LLM wasn't used or failed, process locally
    if (!useLLMForBatch || scoredProfiles.length === 0) {
      for (const [idx, profile] of profiles.entries()) {
        const profileData = profilesData[idx];
        const scoreData = this.scorer.calculateScore(profileData);
        
        // Store scored profile
        scoredProfiles.push({
          ...profile,
          score: scoreData.score,
          tier: scoreData.tier,
          matches: (scoreData.matches || []).map(m => 
            typeof m === 'string' ? m : (m.text || m.display || m.value || '')
          )
        });
        
        // Count by tier
        if (scoreData.tier === 'high') highScoreCount++;
        else if (scoreData.tier === 'medium') mediumScoreCount++;
        else lowScoreCount++;
        
        // Add visual badge to the profile card
        this.addScoreBadgeToCard(profile, scoreData);
      }
    }
    
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

// Listen for messages from popup (cache clearing)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'clearProfileCache') {
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
  document.addEventListener('DOMContentLoaded', () => new NetworkIQUI());
} else {
  new NetworkIQUI();
}