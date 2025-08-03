/**
 * NetworkIQ Scoring Algorithm
 * Based on proven success from 61 LinkedIn professionals analyzed
 */

class NetworkScorer {
  constructor(userBackground = null) {
    // Default user background (will be loaded from storage)
    this.userBackground = userBackground || {
      name: "James Huff",
      military: {
        branch: "Air Force",
        academy: "USAFA",
        years: "2009-2017"
      },
      companies: ["C3 AI", "Polco", "Marque Ventures"],
      education: ["Johns Hopkins", "USAFA"],
      skills: ["Product Management", "AI/ML", "Defense Tech"],
      location: "Denver, CO"
    };
  }

  /**
   * Calculate NetworkIQ score for a LinkedIn profile
   * @param {Object} profile - Parsed LinkedIn profile data
   * @returns {Object} Score and breakdown
   */
  calculateScore(profile) {
    let score = 0;
    const breakdown = {
      military: 0,
      company: 0,
      education: 0,
      skills: 0,
      location: 0,
      role: 0
    };
    const connections = [];

    // Military connections (Highest priority)
    if (this.checkMilitaryConnection(profile)) {
      if (profile.text.toLowerCase().includes('usafa') || 
          profile.text.toLowerCase().includes('air force academy')) {
        score += 40;
        breakdown.military = 40;
        connections.push('USAFA Alumni 🎓');
      } else if (this.hasKeywords(profile.text, ['military', 'veteran', 'navy', 'army', 'marine', 'coast guard'])) {
        score += 30;
        breakdown.military = 30;
        connections.push('Military Veteran 🎖️');
      }
    }

    // Company connections
    const companyScore = this.checkCompanyConnection(profile);
    score += companyScore;
    breakdown.company = companyScore;
    if (companyScore > 0) {
      if (companyScore === 40) {
        connections.push('Former Colleague 🤝');
      } else if (companyScore >= 25) {
        connections.push(`Works at ${profile.company} 🏢`);
      }
    }

    // Education connections
    const eduScore = this.checkEducationConnection(profile);
    score += eduScore;
    breakdown.education = eduScore;
    if (eduScore > 0) {
      connections.push('Alumni Network 🎓');
    }

    // Skills/Role relevance
    const skillScore = this.checkSkillsConnection(profile);
    score += skillScore;
    breakdown.skills = skillScore;
    if (skillScore > 0) {
      if (profile.title?.toLowerCase().includes('product')) {
        connections.push('Product Management 📊');
      }
      if (this.hasKeywords(profile.text, ['ai', 'ml', 'machine learning', 'artificial intelligence'])) {
        connections.push('AI/ML Focus 🤖');
      }
    }

    // Location proximity
    const locationScore = this.checkLocationConnection(profile);
    score += locationScore;
    breakdown.location = locationScore;
    if (locationScore > 0) {
      connections.push('Same Location 📍');
    }

    return {
      score: Math.min(score, 100), // Cap at 100
      breakdown,
      connections,
      tier: this.getTier(score)
    };
  }

  checkMilitaryConnection(profile) {
    const militaryKeywords = [
      'military', 'veteran', 'usaf', 'usafa', 'air force', 'army', 'navy', 
      'marine', 'coast guard', 'west point', 'naval academy', 'service academy',
      'officer', 'enlisted', 'active duty', 'reserves', 'national guard',
      'deployment', 'combat', 'clearance', 'ts/sci', 'secret', 'dod'
    ];
    return this.hasKeywords(profile.text, militaryKeywords);
  }

  checkCompanyConnection(profile) {
    const company = profile.company?.toLowerCase() || '';
    const experience = profile.experience?.toLowerCase() || '';
    
    // Former colleagues (highest score)
    for (const userCompany of this.userBackground.companies) {
      if (company.includes(userCompany.toLowerCase()) || 
          experience.includes(userCompany.toLowerCase())) {
        return 40; // Former colleague
      }
    }
    
    // High-value tech companies
    if (this.hasKeywords(company, ['anthropic', 'openai', 'google', 'meta', 'microsoft'])) {
      return 25;
    }
    
    // Defense tech companies
    if (this.hasKeywords(company, ['palantir', 'anduril', 'shield ai', 'rebellion defense'])) {
      return 30;
    }
    
    return 0;
  }

  checkEducationConnection(profile) {
    const education = profile.education?.toLowerCase() || profile.text.toLowerCase();
    
    for (const school of this.userBackground.education) {
      if (education.includes(school.toLowerCase())) {
        return 20;
      }
    }
    
    // Ivy League or top schools
    if (this.hasKeywords(education, ['harvard', 'stanford', 'mit', 'yale', 'princeton'])) {
      return 15;
    }
    
    return 0;
  }

  checkSkillsConnection(profile) {
    let score = 0;
    const title = profile.title?.toLowerCase() || '';
    const text = profile.text.toLowerCase();
    
    // Product Management roles
    if (title.includes('product') && (title.includes('manager') || title.includes('lead'))) {
      score += 20;
    }
    
    // AI/ML roles
    if (this.hasKeywords(text, ['ai', 'ml', 'machine learning', 'artificial intelligence', 'deep learning'])) {
      score += 15;
    }
    
    // Leadership positions
    if (this.hasKeywords(title, ['director', 'vp', 'vice president', 'head of', 'chief'])) {
      score += 10;
    }
    
    return score;
  }

  checkLocationConnection(profile) {
    const location = profile.location?.toLowerCase() || '';
    const userLocation = this.userBackground.location?.toLowerCase() || '';
    
    if (location && userLocation) {
      // Same city
      if (location.includes(userLocation.split(',')[0])) {
        return 10;
      }
      // Same state
      if (location.includes(userLocation.split(',')[1]?.trim())) {
        return 5;
      }
    }
    
    return 0;
  }

  hasKeywords(text, keywords) {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
  }

  getTier(score) {
    if (score >= 70) return 'platinum';
    if (score >= 50) return 'gold';
    if (score >= 30) return 'silver';
    if (score >= 15) return 'bronze';
    return 'standard';
  }

  /**
   * Generate personalized message based on connections
   */
  generateMessage(profile, scoreData) {
    const { connections } = scoreData;
    let message = '';
    
    // Priority: Military > Company > Education > Skills
    if (connections.includes('USAFA Alumni 🎓')) {
      message = `Hi ${profile.firstName}, fellow Falcon! I noticed we're both USAFA grads. `;
    } else if (connections.includes('Military Veteran 🎖️')) {
      message = `Hi ${profile.firstName}, fellow veteran! Great to connect with military professionals in tech. `;
    } else if (connections.includes('Former Colleague 🤝')) {
      message = `Hi ${profile.firstName}, great to see a fellow ${profile.company} alum! `;
    } else if (connections.includes('Alumni Network 🎓')) {
      message = `Hi ${profile.firstName}, fellow alum! `;
    } else {
      message = `Hi ${profile.firstName}, `;
    }
    
    // Add context about their current role
    if (profile.title) {
      message += `Your work as ${profile.title} at ${profile.company} looks really interesting. `;
    }
    
    // Add connection reason
    if (connections.includes('AI/ML Focus 🤖')) {
      message += `I'm also passionate about AI/ML and would love to connect and share insights. `;
    } else if (connections.includes('Product Management 📊')) {
      message += `As a fellow PM, I'd enjoy connecting and comparing notes on product strategy. `;
    } else {
      message += `Would love to connect and learn from your experience. `;
    }
    
    return message.trim();
  }
}

// Export for use in other scripts
window.NetworkScorer = NetworkScorer;