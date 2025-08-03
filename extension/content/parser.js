/**
 * LinkedIn Profile Parser
 * Extracts profile data from LinkedIn pages
 */

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
    // Try to get current company from experience section or headline
    const headline = this.getTitle();
    if (headline) {
      // Often formatted as "Title at Company"
      const match = headline.match(/\bat\s+(.+?)(?:\s*[|,]|$)/i);
      if (match) {
        return match[1].trim();
      }
    }

    // Try experience section
    const expSection = document.querySelector('[data-field="experience"]');
    if (expSection) {
      const firstCompany = expSection.querySelector('[class*="pv-entity__secondary-title"]');
      if (firstCompany) {
        return firstCompany.textContent.trim();
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
    const expSection = document.querySelector('[id="experience"]')?.parentElement;
    
    if (expSection) {
      const items = expSection.querySelectorAll('[class*="pv-entity__position-group-pager"]');
      items.forEach(item => {
        const title = item.querySelector('h3')?.textContent?.trim();
        const company = item.querySelector('[class*="pv-entity__secondary-title"]')?.textContent?.trim();
        if (title || company) {
          experiences.push(`${title} at ${company}`);
        }
      });
    }
    
    return experiences.join('; ');
  }

  getEducation() {
    const education = [];
    const eduSection = document.querySelector('[id="education"]')?.parentElement;
    
    if (eduSection) {
      const schools = eduSection.querySelectorAll('[class*="pv-entity__school-name"]');
      schools.forEach(school => {
        const name = school.textContent?.trim();
        if (name) {
          education.push(name);
        }
      });
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
    
    // Get all search result cards - LinkedIn uses different structures
    const resultCards = document.querySelectorAll(
      '.entity-result__item, ' +
      '.reusable-search__result-container, ' + 
      'li[class*="reusable-search__result-container"], ' +
      'div[data-chameleon-result-urn], ' +
      '[data-view-name="search-entity-result-universal-template"], ' +
      '.search-results__list > li, ' +
      '.pv-search-results-list > li'
    );
    
    resultCards.forEach(card => {
      // Find the main profile link
      const link = card.querySelector('a[href*="/in/"]');
      if (!link) return;
      
      const url = link.href.split('?')[0]; // Clean URL
      
      // Extract name - LinkedIn has multiple possible selectors
      const nameElement = card.querySelector(
        '.entity-result__title-text span[aria-hidden="true"], ' +
        '.entity-result__title-line span[dir="ltr"] > span[aria-hidden="true"], ' +
        'span[class*="entity-result__title-text"] span[aria-hidden="true"]'
      );
      const name = nameElement?.textContent?.trim();
      
      // Get title/headline
      const titleElement = card.querySelector(
        '.entity-result__primary-subtitle, ' +
        '[class*="primary-subtitle"], ' +
        '.t-14.t-black.t-normal'
      );
      const title = titleElement?.textContent?.trim();
      
      // Get location
      const locationElement = card.querySelector(
        '.entity-result__secondary-subtitle, ' +
        '[class*="secondary-subtitle"], ' +
        '.t-12.t-black--light.t-normal'
      );
      const location = locationElement?.textContent?.trim();
      
      // Get summary/snippet text if available
      const summaryElement = card.querySelector(
        '.entity-result__summary, ' +
        '[class*="summary"], ' +
        '.entity-result__divider + .t-12'
      );
      const summary = summaryElement?.textContent?.trim();
      
      // Get mutual connections if shown
      const mutualElement = card.querySelector(
        '[class*="shared-connections"], ' +
        '[class*="mutual"], ' +
        '.entity-result__insights span'
      );
      const mutualConnections = mutualElement?.textContent?.trim();
      
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
      
      // Get the full text content for better matching
      const fullText = `${name} ${title} ${company} ${location} ${summary}`.toLowerCase();
      
      if (name && !profiles.find(p => p.url === url)) {
        profiles.push({
          url,
          name,
          title: title || '',
          company: company || '',
          location: location || '',
          summary: summary || '',
          mutualConnections: mutualConnections || '',
          imageUrl: imageUrl || '',
          fullText: fullText,
          cardElement: card // Store reference to the card for easier manipulation
        });
      }
    });
    
    return profiles;
  }
}

// Export for use in other scripts
window.LinkedInParser = LinkedInParser;