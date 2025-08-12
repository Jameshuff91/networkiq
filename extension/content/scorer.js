/**
 * NetworkIQ Dynamic Scoring Algorithm
 * Scores profiles based on user's uploaded resume
 */

// Log to confirm script is loaded
console.log('NetworkIQ: Scorer script loaded');

class NetworkScorer {
  constructor() {
    this.searchElements = [];
    this.userBackground = null;
    this.loadUserData();
  }

  async loadUserData() {
    // Load search elements from storage
    const result = await chrome.storage.local.get(['resumeData', 'searchElements']);
    
    if (result.searchElements) {
      this.searchElements = result.searchElements;
    } else if (result.resumeData && result.resumeData.search_elements) {
      // If we have resume data but no direct search elements, extract them
      this.searchElements = result.resumeData.search_elements;
    } else {
      // Fallback to default elements for users without resumes
      this.searchElements = this.getDefaultSearchElements();
    }
  }

  getDefaultSearchElements() {
    // Enhanced default search elements for users who haven't uploaded resumes
    // These cover common high-value backgrounds and connections
    return [
      // Military connections (high weight)
      {
        category: "military",
        value: "veteran",
        weight: 30,
        display: "Military Veteran"
      },
      {
        category: "military",
        value: "green beret",
        weight: 40,
        display: "Special Forces"
      },
      {
        category: "military",
        value: "special forces",
        weight: 40,
        display: "Special Forces"
      },
      {
        category: "military",
        value: "army",
        weight: 25,
        display: "U.S. Army"
      },
      {
        category: "military",
        value: "navy",
        weight: 25,
        display: "U.S. Navy"
      },
      {
        category: "military",
        value: "air force",
        weight: 25,
        display: "U.S. Air Force"
      },
      {
        category: "military",
        value: "marine",
        weight: 25,
        display: "U.S. Marines"
      },
      
      // Top tech companies (medium-high weight)
      {
        category: "company",
        value: "palantir",
        weight: 25,
        display: "Palantir Technologies"
      },
      {
        category: "company",
        value: "google",
        weight: 25,
        display: "Google"
      },
      {
        category: "company",
        value: "meta",
        weight: 25,
        display: "Meta"
      },
      {
        category: "company",
        value: "microsoft",
        weight: 20,
        display: "Microsoft"
      },
      {
        category: "company",
        value: "amazon",
        weight: 20,
        display: "Amazon"
      },
      {
        category: "company",
        value: "apple",
        weight: 20,
        display: "Apple"
      },
      
      // Elite universities (high weight)
      {
        category: "education",
        value: "stanford",
        weight: 30,
        display: "Stanford University"
      },
      {
        category: "education",
        value: "mit",
        weight: 30,
        display: "MIT"
      },
      {
        category: "education",
        value: "harvard",
        weight: 30,
        display: "Harvard University"
      },
      {
        category: "education",
        value: "columbia",
        weight: 25,
        display: "Columbia University"
      },
      
      // Government/Defense
      {
        category: "company",
        value: "dod",
        weight: 20,
        display: "Department of Defense"
      },
      {
        category: "company",
        value: "cia",
        weight: 25,
        display: "CIA"
      },
      {
        category: "company",
        value: "nsa",
        weight: 25,
        display: "NSA"
      },
      
      // Key roles
      {
        category: "role",
        value: "software engineer",
        weight: 15,
        display: "Software Engineering"
      },
      {
        category: "role",
        value: "product manager",
        weight: 15,
        display: "Product Management"
      },
      {
        category: "role",
        value: "data scientist",
        weight: 15,
        display: "Data Science"
      },
      
      // Key skills
      {
        category: "skill",
        value: "machine learning",
        weight: 10,
        display: "Machine Learning"
      },
      {
        category: "skill",
        value: "artificial intelligence",
        weight: 10,
        display: "AI"
      },
      {
        category: "skill",
        value: "leadership",
        weight: 10,
        display: "Leadership"
      }
    ];
  }

  /**
   * Calculate NetworkIQ score for a LinkedIn profile
   * @param {Object} profile - Parsed LinkedIn profile data
   * @returns {Object} Score and breakdown
   */
  calculateScore(profile) {
    let totalScore = 0;
    const matches = [];
    const breakdown = {
      education: 0,
      company: 0,
      military: 0,
      skills: 0,
      certifications: 0,
      keywords: 0
    };

    // Convert profile text to lowercase for matching
    // Note: parser stores full text as 'fullText' for search results, 'text' for individual profiles
    const profileText = (profile.text || profile.fullText || '').toLowerCase();
    const profileName = (profile.name || '').toLowerCase();
    const profileHeadline = (profile.headline || profile.title || '').toLowerCase();
    const profileAbout = (profile.about || profile.summary || '').toLowerCase();
    const profileCompany = (profile.company || '').toLowerCase();
    const profileLocation = (profile.location || '').toLowerCase();
    const profileExperience = (profile.experience || '').toLowerCase();
    const profileEducation = (profile.education || '').toLowerCase();
    const profileMutual = (profile.mutualConnections || '').toLowerCase();
    
    // Combine all text for searching - include all available fields
    const fullText = `${profileText} ${profileName} ${profileHeadline} ${profileAbout} ${profileCompany} ${profileLocation} ${profileExperience} ${profileEducation} ${profileMutual}`.replace(/\s+/g, ' ').trim();
    
    // Check if profile has military background (broader matching)
    const profileHasMilitary = this.hasMilitaryBackground(fullText);
    const userHasMilitary = this.searchElements.some(el => 
      el.category === 'military' || 
      this.isMilitaryRelated(el.value || el.text || '')
    );

    // Debug: Show what we're searching through
    if (profile.name && (fullText.includes('air force academy') || fullText.includes('haley'))) {
      console.log(`NetworkIQ: Debugging scoring for ${profile.name}:`);
      console.log(`  - Full text length: ${fullText.length}`);
      console.log(`  - Contains "air force academy": ${fullText.includes('air force academy')}`);
      console.log(`  - Contains "united states air force academy": ${fullText.includes('united states air force academy')}`);
      console.log(`  - Text sample: "${fullText.substring(0, 300)}"`);
    }
    
    // Score based on search elements
    for (const element of this.searchElements) {
      const searchValue = (element.value || element.text || '').toLowerCase();
      const elementCategory = element.category || '';
      
      let isMatch = false;
      let matchReason = '';
      
      // Special handling for military - brotherhood matching
      if (elementCategory === 'military' || this.isMilitaryRelated(searchValue)) {
        // If user has military background and profile has military, it's a match
        if (profileHasMilitary) {
          isMatch = true;
          matchReason = 'Military Brotherhood';
          console.log(`NetworkIQ: Military brotherhood match for ${profile.name} - both have military backgrounds`);
        }
      } 
      // For education and company - exact matching required
      else if (elementCategory === 'education' || elementCategory === 'company') {
        isMatch = this.containsMatch(fullText, searchValue);
        if (isMatch) {
          matchReason = `Exact ${elementCategory} match`;
        }
      }
      // For other categories - flexible matching
      else {
        isMatch = this.containsMatch(fullText, searchValue);
        if (isMatch) {
          matchReason = 'Keyword match';
        }
      }
      
      // Add score if matched
      if (isMatch) {
        totalScore += element.weight;
        
        // Debug all matches for troubleshooting
        console.log(`NetworkIQ: Found match "${searchValue}" (weight: ${element.weight}, reason: ${matchReason}) for ${profile.name}`);
        
        // Track breakdown by category
        if (breakdown[element.category] !== undefined) {
          breakdown[element.category] += element.weight;
        }
        
        // Add to matches for display (only if we have valid text)
        const matchText = element.display || element.value || element.text;
        if (matchText && matchText !== 'undefined') {
          matches.push({
            text: matchReason === 'Military Brotherhood' ? 'Military Connection' : matchText,
            weight: element.weight,
            category: element.category
          });
        }
      }
    }

    // Cap the score at 100
    totalScore = Math.min(totalScore, 100);

    // Determine quality tier
    let tier = 'low';
    if (totalScore >= 70) {
      tier = 'high';
    } else if (totalScore >= 40) {
      tier = 'medium';
    }

    return {
      score: totalScore,
      tier: tier,
      breakdown: breakdown,
      matches: matches,
      matchCount: matches.length
    };
  }

  /**
   * Check if text contains a match for the search term
   * @param {string} text - Text to search in
   * @param {string} searchTerm - Term to search for
   * @returns {boolean}
   */
  containsMatch(text, searchTerm) {
    // Convert both to lowercase for case-insensitive matching
    text = text.toLowerCase();
    searchTerm = searchTerm.toLowerCase();
    
    // Handle multi-word search terms
    const words = searchTerm.split(/\s+/);
    
    // For single words, do a simple contains check
    if (words.length === 1) {
      return text.includes(searchTerm);
    }
    
    // For multi-word terms, check if all words are present
    // This handles cases like "air force academy" or "c3 ai"
    const allWordsPresent = words.every(word => text.includes(word));
    
    // Also check if the exact phrase exists
    const exactPhrasePresent = text.includes(searchTerm);
    
    // Return true if either condition is met
    return allWordsPresent || exactPhrasePresent;
  }

  /**
   * Check if a search term is military-related
   * @param {string} term - Term to check
   * @returns {boolean}
   */
  isMilitaryRelated(term) {
    const militaryKeywords = [
      'air force', 'army', 'navy', 'marine', 'coast guard', 'space force',
      'military', 'veteran', 'active duty', 'reserve', 'national guard',
      'usaf', 'usafa', 'west point', 'naval academy', 'annapolis',
      'air force academy', 'citadel', 'vmi', 'norwich',
      'special forces', 'green beret', 'seal', 'ranger', 'airborne',
      'combat', 'deployment', 'commissioned', 'enlisted', 'officer',
      'colonel', 'general', 'admiral', 'captain', 'major', 'lieutenant',
      'sergeant', 'corporal', 'specialist'
    ];
    
    const lowerTerm = term.toLowerCase();
    return militaryKeywords.some(keyword => lowerTerm.includes(keyword));
  }

  /**
   * Check if profile text indicates military background
   * @param {string} text - Full profile text
   * @returns {boolean}
   */
  hasMilitaryBackground(text) {
    const militaryIndicators = [
      'veteran', 'military', 'air force', 'army', 'navy', 'marine',
      'coast guard', 'space force', 'usaf', 'usafa', 'west point',
      'naval academy', 'air force academy', 'special forces',
      'green beret', 'seal', 'ranger', 'airborne', 'active duty',
      'deployment', 'combat', 'commissioned officer', 'enlisted',
      'served in', 'military service', 'armed forces', 'defense',
      'dod', 'pentagon', 'colonel', 'general', 'admiral', 'captain',
      'major', 'lieutenant', 'sergeant', 'corporal'
    ];
    
    const lowerText = text.toLowerCase();
    return militaryIndicators.some(indicator => lowerText.includes(indicator));
  }

  /**
   * Update search elements when user uploads a new resume
   * @param {Array} newElements - New search elements from resume
   */
  updateSearchElements(newElements) {
    this.searchElements = newElements;
    // Store in chrome storage for persistence
    chrome.storage.local.set({ searchElements: newElements });
  }

  /**
   * Get formatted display of top matches
   * @param {Array} matches - Array of matches
   * @returns {string}
   */
  getMatchDisplay(matches) {
    if (matches.length === 0) {
      return 'No strong connections found';
    }

    // Sort by weight and take top 3
    const topMatches = matches
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map(m => m.text);

    return topMatches.join(' • ');
  }

  /**
   * Get emoji for score tier
   * @param {string} tier - Score tier
   * @returns {string}
   */
  getTierEmoji(tier) {
    switch (tier) {
      case 'high':
        return '🔥';
      case 'medium':
        return '⭐';
      case 'low':
        return '💡';
      default:
        return '📊';
    }
  }

  /**
   * Get color for score
   * @param {number} score - Numeric score
   * @returns {string}
   */
  getScoreColor(score) {
    if (score >= 70) return '#00A86B';  // Green
    if (score >= 40) return '#FFA500';  // Orange
    return '#64748B';  // Gray
  }

  /**
   * Generate a personalized connection message
   * @param {Object} profile - LinkedIn profile data
   * @param {Object} scoreData - Score calculation results
   * @returns {string}
   */
  generateMessage(profile, scoreData) {
    const name = profile.name?.split(' ')[0] || 'there';
    const connections = scoreData.matches || [];
    
    // Extract text from match objects
    const getMatchText = (match) => {
      if (!match) return null;
      if (typeof match === 'string') return match;
      return match.text || match.display || match.value || null;
    };
    
    // Build message based on score tier
    if (scoreData.tier === 'high') {
      const commonality = getMatchText(connections[0]) || 'your background';
      return `Hi ${name}! I noticed we share ${commonality}. Would love to connect and exchange insights about our field. Looking forward to learning from your experience!`;
    } else if (scoreData.tier === 'medium') {
      const interest = getMatchText(connections[0]) || profile.headline || 'your work';
      return `Hi ${name}! I'm impressed by ${interest}. I'd appreciate the opportunity to connect and learn more about your journey. Best regards!`;
    } else {
      return `Hi ${name}! I came across your profile and would love to connect. I'm always interested in expanding my network with professionals in ${profile.headline || 'the industry'}. Looking forward to connecting!`;
    }
  }
}

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateScoringElements' && message.data) {
    // Update search elements when resume is uploaded
    const scorer = new NetworkScorer();
    
    // Extract search elements from resume data
    if (message.data.search_elements && Array.isArray(message.data.search_elements)) {
      scorer.updateSearchElements(message.data.search_elements);
    }
  }
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NetworkScorer;
}