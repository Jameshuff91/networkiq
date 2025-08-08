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
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
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
    });
  }

  async addScore(scoreData) {
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
      const matchText = (match.text || match || '').toLowerCase();
      if (matchText.includes('university') || matchText.includes('college')) {
        categories.education++;
      } else if (matchText.includes('company') || matchText.includes('worked')) {
        categories.company++;
      } else if (matchText.includes('skill') || matchText.includes('technology')) {
        categories.skills++;
      } else if (matchText.includes('military') || matchText.includes('veteran')) {
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
}

// Make available globally
window.HistoryService = HistoryService;