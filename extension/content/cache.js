/**
 * NetworkIQ Profile Analysis Cache
 * Uses IndexedDB for persistent caching of LLM analysis results
 */

class ProfileAnalysisCache {
  constructor() {
    this.dbName = 'NetworkIQCache';
    this.dbVersion = 1;
    this.storeName = 'profileAnalysis';
    this.db = null;
    this.cacheExpiryHours = 24; // Cache expires after 24 hours
  }

  // Initialize the IndexedDB database
  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('NetworkIQ Cache: Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('NetworkIQ Cache: Database initialized successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log('NetworkIQ Cache: Creating object store');
        
        // Create object store for profile analysis results
        const store = db.createObjectStore(this.storeName, { keyPath: 'cacheKey' });
        
        // Create indexes for efficient querying
        store.createIndex('profileUrl', 'profileUrl', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('resumeHash', 'resumeHash', { unique: false });
      };
    });
  }

  // Generate cache key from profile URL and user's search elements
  generateCacheKey(profileUrl, searchElements) {
    // Create hash from search elements to detect resume changes
    const searchHash = this.hashSearchElements(searchElements);
    
    // Extract LinkedIn profile ID from URL
    const profileId = this.extractProfileId(profileUrl);
    
    return `${profileId}_${searchHash}`;
  }

  // Create hash from search elements to detect changes
  hashSearchElements(searchElements) {
    if (!searchElements || !Array.isArray(searchElements)) {
      return 'default';
    }

    // Sort elements by category and value for consistent hashing
    const sortedElements = [...searchElements]
      .sort((a, b) => {
        const aKey = `${a.category}_${a.value}`;
        const bKey = `${b.category}_${b.value}`;
        return aKey.localeCompare(bKey);
      })
      .map(e => `${e.category}:${e.value}:${e.weight}`)
      .join('|');

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < sortedElements.length; i++) {
      const char = sortedElements.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // Extract profile ID from LinkedIn URL
  extractProfileId(profileUrl) {
    if (!profileUrl) return 'unknown';
    
    const match = profileUrl.match(/\/in\/([^\/\?]+)/);
    return match ? match[1] : profileUrl.replace(/[^a-zA-Z0-9]/g, '_');
  }

  // Check if cache entry is expired
  isExpired(timestamp) {
    const now = Date.now();
    const expiryTime = this.cacheExpiryHours * 60 * 60 * 1000; // Convert hours to milliseconds
    return (now - timestamp) > expiryTime;
  }

  // Get cached analysis result
  async get(profileUrl, searchElements) {
    try {
      await this.init();
      if (!this.db) return null;

      const cacheKey = this.generateCacheKey(profileUrl, searchElements);
      console.log('NetworkIQ Cache: Looking up cache key:', cacheKey);

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(cacheKey);

        request.onerror = () => {
          console.error('NetworkIQ Cache: Error retrieving from cache:', request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          const result = request.result;
          
          if (!result) {
            console.log('NetworkIQ Cache: No cache entry found for key:', cacheKey);
            resolve(null);
            return;
          }

          // Check if cached result is expired
          if (this.isExpired(result.timestamp)) {
            console.log('NetworkIQ Cache: Cache entry expired for key:', cacheKey);
            // Delete expired entry
            this.delete(cacheKey);
            resolve(null);
            return;
          }

          console.log('NetworkIQ Cache: Cache hit for key:', cacheKey, 'age:', Math.round((Date.now() - result.timestamp) / (1000 * 60)), 'minutes');
          resolve(result.analysisResult);
        };
      });
    } catch (error) {
      console.error('NetworkIQ Cache: Error in get():', error);
      return null;
    }
  }

  // Store analysis result in cache
  async set(profileUrl, searchElements, analysisResult) {
    try {
      await this.init();
      if (!this.db) return false;

      const cacheKey = this.generateCacheKey(profileUrl, searchElements);
      const resumeHash = this.hashSearchElements(searchElements);
      
      const cacheEntry = {
        cacheKey,
        profileUrl,
        resumeHash,
        timestamp: Date.now(),
        analysisResult: {
          ...analysisResult,
          // Add cache metadata
          cached: true,
          cacheTimestamp: Date.now()
        }
      };

      console.log('NetworkIQ Cache: Storing result for key:', cacheKey);

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.put(cacheEntry);

        request.onerror = () => {
          console.error('NetworkIQ Cache: Error storing to cache:', request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          console.log('NetworkIQ Cache: Successfully cached result for key:', cacheKey);
          resolve(true);
        };
      });
    } catch (error) {
      console.error('NetworkIQ Cache: Error in set():', error);
      return false;
    }
  }

  // Delete specific cache entry
  async delete(cacheKey) {
    try {
      await this.init();
      if (!this.db) return false;

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.delete(cacheKey);

        request.onerror = () => {
          console.error('NetworkIQ Cache: Error deleting from cache:', request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          console.log('NetworkIQ Cache: Deleted cache entry:', cacheKey);
          resolve(true);
        };
      });
    } catch (error) {
      console.error('NetworkIQ Cache: Error in delete():', error);
      return false;
    }
  }

  // Clear expired entries
  async clearExpired() {
    try {
      await this.init();
      if (!this.db) return 0;

      const now = Date.now();
      const expiryTime = this.cacheExpiryHours * 60 * 60 * 1000;
      let deletedCount = 0;

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const index = store.index('timestamp');
        const request = index.openCursor();

        request.onerror = () => {
          console.error('NetworkIQ Cache: Error clearing expired entries:', request.error);
          reject(request.error);
        };

        request.onsuccess = (event) => {
          const cursor = event.target.result;
          
          if (cursor) {
            const entry = cursor.value;
            
            if (this.isExpired(entry.timestamp)) {
              cursor.delete();
              deletedCount++;
            }
            
            cursor.continue();
          } else {
            console.log('NetworkIQ Cache: Cleared', deletedCount, 'expired entries');
            resolve(deletedCount);
          }
        };
      });
    } catch (error) {
      console.error('NetworkIQ Cache: Error in clearExpired():', error);
      return 0;
    }
  }

  // Clear all cache entries (for resume changes)
  async clearAll() {
    try {
      await this.init();
      if (!this.db) return false;

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.clear();

        request.onerror = () => {
          console.error('NetworkIQ Cache: Error clearing all cache entries:', request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          console.log('NetworkIQ Cache: Cleared all cache entries');
          resolve(true);
        };
      });
    } catch (error) {
      console.error('NetworkIQ Cache: Error in clearAll():', error);
      return false;
    }
  }

  // Clear entries for a specific resume hash (when resume changes)
  async clearForResumeChange(oldResumeHash) {
    try {
      await this.init();
      if (!this.db) return 0;

      let deletedCount = 0;

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const index = store.index('resumeHash');
        const request = index.openCursor(IDBKeyRange.only(oldResumeHash));

        request.onerror = () => {
          console.error('NetworkIQ Cache: Error clearing entries for resume change:', request.error);
          reject(request.error);
        };

        request.onsuccess = (event) => {
          const cursor = event.target.result;
          
          if (cursor) {
            cursor.delete();
            deletedCount++;
            cursor.continue();
          } else {
            console.log('NetworkIQ Cache: Cleared', deletedCount, 'entries for resume change');
            resolve(deletedCount);
          }
        };
      });
    } catch (error) {
      console.error('NetworkIQ Cache: Error in clearForResumeChange():', error);
      return 0;
    }
  }

  // Get cache statistics
  async getStats() {
    try {
      await this.init();
      if (!this.db) return { totalEntries: 0, expiredEntries: 0 };

      const now = Date.now();
      let totalEntries = 0;
      let expiredEntries = 0;

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.openCursor();

        request.onerror = () => {
          console.error('NetworkIQ Cache: Error getting cache stats:', request.error);
          reject(request.error);
        };

        request.onsuccess = (event) => {
          const cursor = event.target.result;
          
          if (cursor) {
            totalEntries++;
            
            if (this.isExpired(cursor.value.timestamp)) {
              expiredEntries++;
            }
            
            cursor.continue();
          } else {
            resolve({ totalEntries, expiredEntries });
          }
        };
      });
    } catch (error) {
      console.error('NetworkIQ Cache: Error in getStats():', error);
      return { totalEntries: 0, expiredEntries: 0 };
    }
  }
}

// Global cache instance
window.profileAnalysisCache = new ProfileAnalysisCache();