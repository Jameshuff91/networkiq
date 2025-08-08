/**
 * LinkedIn Profile Parser
 * Extracts profile data from LinkedIn pages
 */

// Log to confirm script is loaded
console.log('NetworkIQ: Parser script loaded on', window.location.href);

class LinkedInParser {
  constructor() {
    this.profileData = {};
  }

  /**
   * Parse current LinkedIn page
   * @returns {Object} Parsed profile data
   */
  parse() {
    const url = window.location.href;
    
    // Check if we're on a profile page
    if (!url.includes('/in/')) {
      return null;
    }

    // Extract profile data
    this.profileData = {
      url: url,
      name: this.getName(),
      firstName: this.getFirstName(),
      title: this.getTitle(),
      company: this.getCompany(),
      location: this.getLocation(),
      about: this.getAbout(),
      experience: this.getExperience(),
      education: this.getEducation(),
      skills: this.getSkills(),
      text: this.getAllText(), // For keyword matching
      connectionDegree: this.getConnectionDegree(),
      profilePicture: this.getProfilePicture(),
      timestamp: new Date().toISOString()
    };

    return this.profileData;
  }

  getName() {
    // Multiple selectors for different LinkedIn layouts
    const selectors = [
      'h1.text-heading-xlarge',
      '[class*="pv-text-details__left-panel"] h1',
      '.pv-top-card--list h1',
      'h1[class*="inline"]'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element?.textContent) {
        return element.textContent.trim();
      }
    }
    
    return 'Unknown';
  }

  getFirstName() {
    const fullName = this.getName();
    return fullName.split(' ')[0] || 'there';
  }

  getTitle() {
    const selectors = [
      '[class*="text-body-medium break-words"]',
      '.pv-top-card--list [data-field="headline"]',
      'div[class*="pv-text-details__left-panel"] > div:nth-child(2)'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element?.textContent) {
        return element.textContent.trim();
      }
    }
    
    return '';
  }

  getCompany() {
    // Try to get current company from headline
    const headline = this.getTitle();
    if (headline) {
      // Often formatted as "Title @ Company" or "Title at Company"
      const match = headline.match(/(?:@|at)\s+(.+?)(?:\s*[|,]|$)/i);
      if (match) {
        return match[1].trim();
      }
    }

    // Try to find in the profile header area (newer LinkedIn)
    const headerCompany = document.querySelector('[aria-label*="Current company"]');
    if (headerCompany?.textContent) {
      return headerCompany.textContent.trim();
    }

    // Look for the first experience entry
    const expItems = document.querySelectorAll('[data-view-name="profile-component-entity"]');
    for (const item of expItems) {
      const companyElement = item.querySelector('span[aria-hidden="true"]');
      if (companyElement?.textContent && !companyElement.textContent.includes('·')) {
        return companyElement.textContent.trim();
      }
    }

    return '';
  }

  getLocation() {
    const selectors = [
      '[class*="text-body-small inline t-black--light break-words"]',
      '.pv-top-card--list-bullet > li:first-child',
      'span[class*="text-body-small"][class*="t-black--light"]'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element?.textContent && !element.textContent.includes('connection')) {
        return element.textContent.trim();
      }
    }
    
    return '';
  }

  getAbout() {
    const aboutSection = document.querySelector('[class*="pv-about-section"]');
    if (aboutSection) {
      const text = aboutSection.querySelector('[class*="inline-show-more-text"]');
      if (text) {
        return text.textContent.trim();
      }
    }
    
    // Try alternative selector
    const aboutAlt = document.querySelector('[data-field="about"] span[aria-hidden="true"]');
    if (aboutAlt) {
      return aboutAlt.textContent.trim();
    }
    
    return '';
  }

  getExperience() {
    const experiences = [];
    
    // Try modern LinkedIn structure first
    const experienceSection = Array.from(document.querySelectorAll('section')).find(
      section => section.querySelector('div[id="experience"]')
    );
    
    if (experienceSection) {
      // Look for experience items
      const expItems = experienceSection.querySelectorAll('li[class*="artdeco-list__item"]');
      expItems.forEach(item => {
        // Get role title (usually in a strong or span element)
        const titleElement = item.querySelector('div[data-field="title"] span[aria-hidden="true"], div span[dir="ltr"]');
        const title = titleElement?.textContent?.trim();
        
        // Get company name
        const companyElement = item.querySelector('span[aria-hidden="true"]');
        let company = '';
        if (companyElement) {
          const text = companyElement.textContent.trim();
          // Extract company name (usually after · separator)
          const parts = text.split('·');
          if (parts.length > 1) {
            company = parts[0].trim();
          }
        }
        
        if (title || company) {
          experiences.push(`${title || 'Role'} at ${company || 'Company'}`);
        }
      });
    }
    
    // Fallback: extract from text
    if (experiences.length === 0) {
      const allText = this.getAllText().toLowerCase();
      if (allText.includes('scale ai')) experiences.push('Scale AI');
      if (allText.includes('c3 ai')) experiences.push('C3 AI');
      if (allText.includes('sabel systems')) experiences.push('Sabel Systems');
      if (allText.includes('air force')) experiences.push('US Air Force');
    }
    
    return experiences.join('; ');
  }

  getEducation() {
    const education = [];
    
    // Try modern LinkedIn structure
    const educationSection = Array.from(document.querySelectorAll('section')).find(
      section => section.querySelector('div[id="education"]')
    );
    
    if (educationSection) {
      const eduItems = educationSection.querySelectorAll('li[class*="artdeco-list__item"]');
      eduItems.forEach(item => {
        const schoolElement = item.querySelector('span[aria-hidden="true"], div span[dir="ltr"]');
        if (schoolElement?.textContent) {
          const school = schoolElement.textContent.trim();
          if (school && !school.includes('·')) {
            education.push(school);
          }
        }
      });
    }
    
    // Fallback: extract known schools from text
    if (education.length === 0) {
      const allText = this.getAllText().toLowerCase();
      if (allText.includes('air force academy') || allText.includes('usafa')) {
        education.push('US Air Force Academy');
      }
      if (allText.includes('university of tennessee')) {
        education.push('University of Tennessee');
      }
      // Add other common universities as needed
    }
    
    return education.join('; ');
  }

  getSkills() {
    const skills = [];
    const skillSection = document.querySelector('[id="skills"]')?.parentElement;
    
    if (skillSection) {
      const skillElements = skillSection.querySelectorAll('[class*="pv-skill-category-entity__name"]');
      skillElements.forEach(skill => {
        const name = skill.textContent?.trim();
        if (name) {
          skills.push(name);
        }
      });
    }
    
    return skills.slice(0, 10); // Top 10 skills
  }

  getAllText() {
    // Get all visible text for keyword matching
    const mainContent = document.querySelector('main');
    if (mainContent) {
      return mainContent.textContent
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .slice(0, 10000); // Limit to 10k chars
    }
    return '';
  }

  getConnectionDegree() {
    const connectionElements = document.querySelectorAll('[class*="distance-badge"] span');
    for (const element of connectionElements) {
      const text = element.textContent;
      if (text?.includes('1st')) return '1st';
      if (text?.includes('2nd')) return '2nd';
      if (text?.includes('3rd')) return '3rd';
    }
    return '';
  }

  getProfilePicture() {
    const img = document.querySelector('[class*="pv-top-card-profile-picture"] img');
    return img?.src || '';
  }

  /**
   * Check if we're on a profile page
   */
  static isProfilePage() {
    return window.location.href.includes('/in/');
  }

  /**
   * Check if we're on search results
   */
  static isSearchPage() {
    return window.location.href.includes('/search/');
  }

  /**
   * Get all profile links from search results
   */
  static getSearchResultProfiles() {
    const profiles = [];
    
    // First try standard selectors
    let resultCards = document.querySelectorAll(
      '.entity-result__item, ' +
      '.reusable-search__result-container, ' + 
      'li[class*="reusable-search__result-container"], ' +
      'div[data-chameleon-result-urn], ' +
      '[data-view-name="search-entity-result-universal-template"], ' +
      '.search-results__list > li, ' +
      '.pv-search-results-list > li'
    );
    
    // If no results found, try finding cards by working up from profile links
    if (resultCards.length === 0) {
      console.log('NetworkIQ: Standard selectors failed, trying profile link approach...');
      const profileLinks = document.querySelectorAll('a[href*="/in/"]');
      const uniqueCards = new Set();
      
      profileLinks.forEach(link => {
        // Walk up to find the container card (usually 3-5 levels up)
        let card = link;
        for (let i = 0; i < 6; i++) {
          card = card.parentElement;
          if (card && card.tagName === 'LI') {
            uniqueCards.add(card);
            break;
          }
          // Also check for DIV containers with result-like classes
          if (card && card.className && 
              (card.className.includes('result') || 
               card.className.includes('search') ||
               card.className.includes('entity'))) {
            uniqueCards.add(card);
            break;
          }
        }
      });
      
      resultCards = Array.from(uniqueCards);
      console.log(`NetworkIQ: Found ${resultCards.length} cards via profile link approach`);
    }
    
    resultCards.forEach((card, index) => {
      // Find the main profile link
      const link = card.querySelector('a[href*="/in/"]');
      if (!link) {
        console.log(`NetworkIQ: Card ${index} has no profile link`);
        return;
      }
      
      const url = link.href.split('?')[0]; // Clean URL
      
      // Extract name - try multiple approaches
      let name = '';
      
      // First try: specific selectors for name only (avoid getting title/location)
      const nameSelectors = [
        '.entity-result__title-text span[aria-hidden="true"]',
        '.entity-result__title-line span[dir="ltr"] > span[aria-hidden="true"]',
        'span[class*="entity-result__title-text"] span[aria-hidden="true"]',
        // New selectors - be more specific
        'span[aria-hidden="true"]',
        '.ember-view span[aria-hidden="true"]'
      ];
      
      for (const selector of nameSelectors) {
        const nameElement = card.querySelector(selector);
        if (nameElement?.textContent?.trim()) {
          let potentialName = nameElement.textContent.trim();
          
          // Clean up the name - remove common LinkedIn artifacts
          potentialName = potentialName
            .replace(/\n/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/^\d+\w*\s*/, '') // Remove "1st", "2nd", "3rd" prefixes
            .replace(/\s*(San Francisco Bay Area|Greater Chicago Area|United States|CA|NY).*$/i, '') // Remove location suffixes
            .trim();
          
          // Only use if it looks like a name (not a title or location)
          if (potentialName && 
              !potentialName.toLowerCase().includes('degree connection') &&
              !potentialName.toLowerCase().includes('google') &&
              !potentialName.toLowerCase().includes('san francisco') &&
              potentialName.length < 50) { // Names shouldn't be too long
            name = potentialName;
            break;
          }
        }
      }
      
      // Fallback: try to extract from the profile link URL
      if (!name) {
        const urlParts = url.split('/in/')[1]?.split('-');
        if (urlParts && urlParts.length >= 2) {
          name = urlParts.slice(0, 2).map(part => 
            part.charAt(0).toUpperCase() + part.slice(1)
          ).join(' ');
        }
      }
      
      console.log(`NetworkIQ: Card ${index} - Name: "${name}", URL: ${url}`);
      
      // Get title/headline - this often contains important info like "Air Force Academy"
      const titleSelectors = [
        '.entity-result__primary-subtitle',
        '[class*="primary-subtitle"]',
        '.t-14.t-black.t-normal',
        '.entity-result__title-line + div',  // The div after the name often has the title
        'div[class*="subtitle"]'
      ];
      
      let title = '';
      for (const selector of titleSelectors) {
        const titleElement = card.querySelector(selector);
        if (titleElement?.textContent?.trim()) {
          title = titleElement.textContent.trim();
          break;
        }
      }
      
      // Get location
      const locationElement = card.querySelector(
        '.entity-result__secondary-subtitle, ' +
        '[class*="secondary-subtitle"], ' +
        '.t-12.t-black--light.t-normal'
      );
      const location = locationElement?.textContent?.trim();
      
      // Get summary/snippet text if available - look for more elements
      const summarySelectors = [
        '.entity-result__summary',
        '[class*="summary"]',
        '.entity-result__divider + .t-12',
        '[class*="insight"]', // LinkedIn insight boxes
        '[class*="highlight"]', // Profile highlights
        '.search-result__info', // Additional info sections
        '[data-test-id*="snippet"]' // Text snippets
      ];
      
      let summary = '';
      for (const selector of summarySelectors) {
        const summaryElement = card.querySelector(selector);
        if (summaryElement?.textContent?.trim()) {
          const text = summaryElement.textContent.trim();
          if (text.length > summary.length) {
            summary = text;
          }
        }
      }
      
      // Get mutual connections if shown - expanded selectors
      const mutualSelectors = [
        '[class*="shared-connections"]',
        '[class*="mutual"]',
        '.entity-result__insights span',
        '[class*="connection-insight"]',
        'span:contains("mutual connection")', // Not valid CSS but conceptual
        '[class*="highlight"]' // Sometimes mutual connections are in highlights
      ];
      
      let mutualConnections = '';
      for (const selector of mutualSelectors) {
        // Skip invalid selectors
        if (selector.includes(':contains')) continue;
        
        try {
          const mutualElement = card.querySelector(selector);
          if (mutualElement?.textContent?.trim()) {
            const text = mutualElement.textContent.trim();
            if (text.includes('mutual') || text.includes('connection') || text.includes('both')) {
              mutualConnections = text;
              break;
            }
          }
        } catch (e) {
          // Skip invalid selectors
          console.log('NetworkIQ: Skipping invalid selector:', selector);
        }
      }
      
      // Also search for "mutual connection" text in all spans if not found
      if (!mutualConnections) {
        const allSpans = card.querySelectorAll('span');
        for (const span of allSpans) {
          const text = span.textContent?.trim() || '';
          if (text.includes('mutual connection')) {
            mutualConnections = text;
            break;
          }
        }
      }
      
      // Extract company from title
      let company = '';
      if (title) {
        // Try to extract company from title (e.g., "Software Engineer at Google")
        const atIndex = title.toLowerCase().indexOf(' at ');
        if (atIndex > -1) {
          company = title.substring(atIndex + 4).trim();
        } else if (title.includes('·')) {
          // Sometimes format is "Title · Company"
          const parts = title.split('·');
          if (parts.length > 1) {
            company = parts[1].trim();
          }
        }
      }
      
      // Get profile image for visual appeal
      const imageElement = card.querySelector(
        'img[class*="presence-entity__image"], ' +
        'img[class*="entity-image"], ' +
        'img[class*="EntityPhoto"]'
      );
      const imageUrl = imageElement?.src;
      
      // Get ALL text from the card for comprehensive matching
      // This ensures we catch things like "Air Force Academy" that might be anywhere
      let cardFullText = '';
      
      // Try to get text more precisely to avoid cross-contamination between cards
      try {
        // Clone the card to avoid modifying the original
        const cardClone = card.cloneNode(true);
        
        // Remove any nested search result cards that might contaminate the text
        const nestedCards = cardClone.querySelectorAll('.entity-result__item, [data-chameleon-result-urn]');
        nestedCards.forEach(nested => {
          if (nested !== cardClone) nested.remove();
        });
        
        cardFullText = cardClone.textContent?.replace(/\s+/g, ' ').trim() || '';
        
        // Fallback: if clone fails, use original but limit length
        if (!cardFullText) {
          cardFullText = card.textContent?.replace(/\s+/g, ' ').trim().substring(0, 1000) || '';
        }
      } catch (e) {
        // Fallback to basic extraction
        cardFullText = card.textContent?.replace(/\s+/g, ' ').trim().substring(0, 1000) || '';
      }
      
      const structuredText = `${name} ${title} ${company} ${location} ${summary}`.toLowerCase();
      
      // Also look for any additional text elements that might contain keywords
      const additionalTextElements = card.querySelectorAll('span[aria-hidden="true"]:not(.entity-result__item span), div[class*="subline"]:not(.entity-result__item div)');
      const additionalTexts = Array.from(additionalTextElements)
        .map(el => el.textContent?.trim())
        .filter(text => text && text.length > 0 && text.length < 200) // Avoid very long text that might be contamination
        .join(' ')
        .toLowerCase();
      
      // Combine all text sources for maximum coverage but with reasonable limits
      const fullText = (cardFullText + ' ' + structuredText + ' ' + additionalTexts)
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .substring(0, 2000); // Limit total text length to avoid huge strings
      
      console.log(`NetworkIQ: Card ${index} (${name}):`);
      console.log(`  - Title: "${title}"`);
      console.log(`  - Summary: "${summary}"`);
      console.log(`  - Mutual: "${mutualConnections}"`);
      console.log(`  - Full text sample: "${fullText.substring(0, 200)}"`);
      
      // Debug: Check if this specific profile contains key terms
      if (fullText.includes('air force academy') || fullText.includes('usafa') || fullText.includes('veteran')) {
        console.log(`NetworkIQ: ⭐ MILITARY/ACADEMY found in card ${index} (${name}):`, fullText.substring(0, 500));
      }
      
      // Add profile if we have at least a URL (name might be empty on some cards)
      if (url && !profiles.find(p => p.url === url)) {
        const profile = {
          url,
          name: name || 'LinkedIn Member',  // Fallback for private profiles
          title: title || '',
          company: company || '',
          location: location || '',
          summary: summary || '',
          mutualConnections: mutualConnections || '',
          imageUrl: imageUrl || '',
          fullText: fullText,
          cardElement: card // Store reference to the card for easier manipulation
        };
        profiles.push(profile);
        console.log(`NetworkIQ: Added profile ${profiles.length}:`, profile.name);
      }
    });
    
    return profiles;
  }
}

// Export for use in other scripts
window.LinkedInParser = LinkedInParser;