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
    const links = document.querySelectorAll('a[href*="/in/"]');
    
    links.forEach(link => {
      const url = link.href;
      const name = link.querySelector('[class*="entity-result__title-text"] span[aria-hidden="true"]')?.textContent?.trim();
      const title = link.querySelector('[class*="entity-result__primary-subtitle"]')?.textContent?.trim();
      const location = link.querySelector('[class*="entity-result__secondary-subtitle"]')?.textContent?.trim();
      
      if (name && !profiles.find(p => p.url === url)) {
        profiles.push({
          url,
          name,
          title,
          location
        });
      }
    });
    
    return profiles;
  }
}

// Export for use in other scripts
window.LinkedInParser = LinkedInParser;