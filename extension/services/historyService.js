/**
 * Minimal Compliant History Service
 * Stores only scores and metadata, no LinkedIn profile data
 */

class HistoryService {
  constructor() {
    this.dbName = 'NetworkIQHistory';
    this.dbVersion = 1;
    this.db = null;
  }

  async init() {
    try {
      // Check if IndexedDB is available
      if (!window.indexedDB) {
        console.warn('NetworkIQ: IndexedDB not available, using localStorage fallback');
        this.useLocalStorage = true;
        return Promise.resolve();
      }

      return new Promise((resolve, reject) => {
        try {
          const request = indexedDB.open(this.dbName, this.dbVersion);
          
          request.onerror = () => {
            console.warn('NetworkIQ: IndexedDB error, falling back to localStorage:', request.error);
            this.useLocalStorage = true;
            resolve(); // Don't reject, just use fallback
          };
          
          request.onsuccess = () => {
            this.db = request.result;
            this.useLocalStorage = false;
            resolve();
          };
          
          request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Store only privacy-compliant data
            if (!db.objectStoreNames.contains('scores')) {
              const scoresStore = db.createObjectStore('scores', { 
                keyPath: 'id', 
                autoIncrement: true 
              });
              scoresStore.createIndex('timestamp', 'timestamp', { unique: false });
              scoresStore.createIndex('date', 'date', { unique: false });
              scoresStore.createIndex('tier', 'tier', { unique: false });
            }
            
            // Daily aggregated stats (no personal data)
            if (!db.objectStoreNames.contains('dailyStats')) {
              const statsStore = db.createObjectStore('dailyStats', { 
                keyPath: 'date' 
              });
            }
          };
        } catch (error) {
          console.warn('NetworkIQ: Failed to open IndexedDB, using localStorage:', error);
          this.useLocalStorage = true;
          resolve();
        }
      });
    } catch (error) {
      console.warn('NetworkIQ: Init error, using localStorage fallback:', error);
      this.useLocalStorage = true;
      return Promise.resolve();
    }
  }

  async addScore(scoreData) {
    // If using localStorage fallback
    if (this.useLocalStorage) {
      return this.addScoreToLocalStorage(scoreData);
    }
    
    // Store only non-identifying information
    const privacyData = {
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleDateString(),
      score: scoreData.score,
      tier: scoreData.tier,
      matchCount: (scoreData.matches || []).length,
      // Store match types but not actual names/companies
      matchTypes: this.categorizeMatches(scoreData.matches || []),
      hasMessage: !!scoreData.message,
      source: scoreData.source || 'individual'
    };
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['scores'], 'readwrite');
      const store = transaction.objectStore('scores');
      const request = store.add(privacyData);
      
      request.onsuccess = () => {
        this.updateDailyStats(privacyData);
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  categorizeMatches(matches) {
    // Categorize matches without storing actual data
    const categories = {
      education: 0,
      company: 0,
      skills: 0,
      military: 0,
      location: 0,
      other: 0
    };
    
    matches.forEach(match => {
      // Handle different match formats
      let matchText = '';
      if (typeof match === 'string') {
        matchText = match.toLowerCase();
      } else if (match && typeof match === 'object') {
        // Handle match objects from LLM with properties like matches_element, category, etc.
        matchText = (match.matches_element || match.text || match.found_in_profile || '').toLowerCase();
        
        // Use category if available for more accurate categorization
        if (match.category) {
          const category = match.category.toLowerCase();
          if (category === 'education') {
            categories.education++;
            return;
          } else if (category === 'company') {
            categories.company++;
            return;
          } else if (category === 'skill' || category === 'skills') {
            categories.skills++;
            return;
          } else if (category === 'military') {
            categories.military++;
            return;
          }
        }
      }
      
      // Fallback to text-based categorization
      if (matchText.includes('university') || matchText.includes('college') || matchText.includes('academy')) {
        categories.education++;
      } else if (matchText.includes('company') || matchText.includes('worked')) {
        categories.company++;
      } else if (matchText.includes('skill') || matchText.includes('technology')) {
        categories.skills++;
      } else if (matchText.includes('military') || matchText.includes('veteran') || matchText.includes('force')) {
        categories.military++;
      } else if (matchText.includes('location') || matchText.includes('city')) {
        categories.location++;
      } else {
        categories.other++;
      }
    });
    
    return categories;
  }

  async updateDailyStats(scoreData) {
    const today = new Date().toLocaleDateString();
    
    const transaction = this.db.transaction(['dailyStats'], 'readwrite');
    const store = transaction.objectStore('dailyStats');
    
    const getRequest = store.get(today);
    
    getRequest.onsuccess = () => {
      const stats = getRequest.result || {
        date: today,
        totalScored: 0,
        highTier: 0,
        mediumTier: 0,
        lowTier: 0,
        totalScore: 0,
        messagesGenerated: 0
      };
      
      stats.totalScored++;
      stats.totalScore += scoreData.score;
      
      if (scoreData.tier === 'high') stats.highTier++;
      else if (scoreData.tier === 'medium') stats.mediumTier++;
      else stats.lowTier++;
      
      if (scoreData.hasMessage) stats.messagesGenerated++;
      
      stats.averageScore = Math.round(stats.totalScore / stats.totalScored);
      
      store.put(stats);
    };
  }

  async getRecentScores(limit = 50) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['scores'], 'readonly');
      const store = transaction.objectStore('scores');
      const index = store.index('timestamp');
      
      const scores = [];
      const request = index.openCursor(null, 'prev');
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && scores.length < limit) {
          scores.push(cursor.value);
          cursor.continue();
        } else {
          resolve(scores);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async getDailyStats(daysBack = 7) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['dailyStats'], 'readonly');
      const store = transaction.objectStore('dailyStats');
      
      const stats = [];
      const request = store.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          stats.push(cursor.value);
          cursor.continue();
        } else {
          // Sort by date and return last N days
          stats.sort((a, b) => new Date(b.date) - new Date(a.date));
          resolve(stats.slice(0, daysBack));
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async getStats() {
    if (this.useLocalStorage) {
      return this.getStatsFromLocalStorage(7);
    }
    
    const [recentScores, dailyStats] = await Promise.all([
      this.getRecentScores(100),
      this.getDailyStats(30)
    ]);
    
    const today = new Date().toLocaleDateString();
    const todayStats = dailyStats.find(s => s.date === today) || {
      totalScored: 0,
      averageScore: 0,
      highTier: 0,
      mediumTier: 0,
      lowTier: 0
    };
    
    const last7Days = dailyStats.slice(0, 7);
    const weekTotal = last7Days.reduce((sum, day) => sum + day.totalScored, 0);
    const weekAverage = last7Days.length > 0 
      ? Math.round(last7Days.reduce((sum, day) => sum + day.averageScore, 0) / last7Days.length)
      : 0;
    
    return {
      today: todayStats,
      week: {
        total: weekTotal,
        average: weekAverage,
        daily: last7Days
      },
      recentScores: recentScores.slice(0, 10)
    };
  }

  async clearOldData(daysToKeep = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffString = cutoffDate.toISOString();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['scores'], 'readwrite');
      const store = transaction.objectStore('scores');
      const index = store.index('timestamp');
      
      const request = index.openCursor();
      let deleted = 0;
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          if (cursor.value.timestamp < cutoffString) {
            cursor.delete();
            deleted++;
          }
          cursor.continue();
        } else {
          resolve(deleted);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  // LocalStorage fallback methods
  async addScoreToLocalStorage(scoreData) {
    try {
      const privacyData = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        date: new Date().toLocaleDateString(),
        score: scoreData.score,
        tier: scoreData.tier,
        matchCount: (scoreData.matches || []).length,
        matchTypes: this.categorizeMatches(scoreData.matches || []),
        hasMessage: !!scoreData.message,
        source: scoreData.source || 'individual'
      };
      
      // Get existing scores
      const scores = JSON.parse(localStorage.getItem('networkiq_scores') || '[]');
      scores.push(privacyData);
      
      // Keep only last 100 scores to avoid storage issues
      const recentScores = scores.slice(-100);
      localStorage.setItem('networkiq_scores', JSON.stringify(recentScores));
      
      // Update daily stats
      this.updateDailyStatsInLocalStorage(privacyData);
      
      return Promise.resolve(privacyData.id);
    } catch (error) {
      console.warn('NetworkIQ: Failed to save to localStorage:', error);
      return Promise.resolve(null);
    }
  }
  
  async getStatsFromLocalStorage(days = 7) {
    try {
      const scores = JSON.parse(localStorage.getItem('networkiq_scores') || '[]');
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const recentScores = scores.filter(s => new Date(s.timestamp) > cutoffDate);
      
      return {
        totalScored: recentScores.length,
        averageScore: recentScores.reduce((acc, s) => acc + s.score, 0) / (recentScores.length || 1),
        tierBreakdown: this.getTierBreakdown(recentScores),
        dailyActivity: this.getDailyActivity(recentScores)
      };
    } catch (error) {
      console.warn('NetworkIQ: Failed to get stats from localStorage:', error);
      return {
        totalScored: 0,
        averageScore: 0,
        tierBreakdown: {},
        dailyActivity: []
      };
    }
  }
  
  updateDailyStatsInLocalStorage(privacyData) {
    try {
      const stats = JSON.parse(localStorage.getItem('networkiq_daily_stats') || '{}');
      const today = privacyData.date;
      
      if (!stats[today]) {
        stats[today] = {
          count: 0,
          totalScore: 0,
          tiers: {}
        };
      }
      
      stats[today].count++;
      stats[today].totalScore += privacyData.score;
      stats[today].tiers[privacyData.tier] = (stats[today].tiers[privacyData.tier] || 0) + 1;
      
      localStorage.setItem('networkiq_daily_stats', JSON.stringify(stats));
    } catch (error) {
      console.warn('NetworkIQ: Failed to update daily stats:', error);
    }
  }
  
  getTierBreakdown(scores) {
    const breakdown = {};
    scores.forEach(s => {
      breakdown[s.tier] = (breakdown[s.tier] || 0) + 1;
    });
    return breakdown;
  }
  
  getDailyActivity(scores) {
    const activity = {};
    scores.forEach(s => {
      const date = s.date;
      if (!activity[date]) {
        activity[date] = {
          count: 0,
          avgScore: 0,
          scores: []
        };
      }
      activity[date].count++;
      activity[date].scores.push(s.score);
    });
    
    // Calculate averages
    Object.keys(activity).forEach(date => {
      const scores = activity[date].scores;
      activity[date].avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      delete activity[date].scores; // Remove raw scores for privacy
    });
    
    return activity;
  }
}

// Make available globally
window.HistoryService = HistoryService;