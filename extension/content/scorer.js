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
    // Generic search elements for users who haven't uploaded resumes
    return [
      {
        category: "role",
        value: "product manager",
        weight: 20,
        display: "Product Management"
      },
      {
        category: "skill",
        value: "leadership",
        weight: 10,
        display: "Leadership"
      },
      {
        category: "skill",
        value: "strategy",
        weight: 10,
        display: "Strategy"
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
    const profileText = (profile.text || '').toLowerCase();
    const profileName = (profile.name || '').toLowerCase();
    const profileHeadline = (profile.headline || '').toLowerCase();
    const profileAbout = (profile.about || '').toLowerCase();
    
    // Combine all text for searching
    const fullText = `${profileText} ${profileName} ${profileHeadline} ${profileAbout}`;

    // Score based on search elements
    for (const element of this.searchElements) {
      const searchValue = (element.value || element.text || '').toLowerCase();
      
      // Check if the profile contains this search element
      if (this.containsMatch(fullText, searchValue)) {
        totalScore += element.weight;
        
        // Debug military/academy matches
        if (searchValue.includes('air force') || searchValue.includes('academy') || searchValue.includes('usafa')) {
          console.log(`NetworkIQ: Found military match "${searchValue}" for ${profile.name}`);
        }
        
        // Track breakdown by category
        if (breakdown[element.category] !== undefined) {
          breakdown[element.category] += element.weight;
        }
        
        // Add to matches for display
        matches.push({
          text: element.display || element.value || element.text,
          weight: element.weight,
          category: element.category
        });
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