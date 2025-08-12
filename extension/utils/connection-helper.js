/**
 * Connection Helper for Chrome Extension
 * Handles extension context invalidation and message passing errors
 */

class ConnectionHelper {
  /**
   * Check if the extension context is still valid
   */
  static isContextValid() {
    try {
      // Try to access chrome.runtime.id - will throw if context is invalid
      return chrome.runtime && chrome.runtime.id;
    } catch (e) {
      return false;
    }
  }

  /**
   * Send a message to the background script with error handling
   */
  static async sendMessage(message) {
    // Check if context is valid first
    if (!this.isContextValid()) {
      console.warn('NetworkIQ: Extension context invalid, reloading page...');
      // Optionally reload the page to restore context
      // location.reload();
      throw new Error('Extension context invalidated - please refresh the page');
    }

    try {
      // Wrap in a promise to handle async response properly
      return await new Promise((resolve, reject) => {
        // Set a timeout for the response
        const timeout = setTimeout(() => {
          reject(new Error('Message timeout - background script not responding'));
        }, 10000); // 10 second timeout

        // Send the message
        chrome.runtime.sendMessage(message, (response) => {
          clearTimeout(timeout);

          // Check for chrome.runtime.lastError
          if (chrome.runtime.lastError) {
            console.warn('NetworkIQ: Message error:', chrome.runtime.lastError);

            // Handle specific error cases
            if (chrome.runtime.lastError.message?.includes('Receiving end does not exist')) {
              reject(new Error('Background script not available - extension may be updating'));
            } else if (chrome.runtime.lastError.message?.includes('Extension context invalidated')) {
              reject(new Error('Extension context invalidated - please refresh the page'));
            } else {
              reject(new Error(chrome.runtime.lastError.message));
            }
            return;
          }

          // Check for error in response
          if (response?.error) {
            reject(new Error(response.error));
            return;
          }

          resolve(response);
        });
      });
    } catch (error) {
      console.error('NetworkIQ: Failed to send message:', error);
      throw error;
    }
  }

  /**
   * Safe storage access with error handling
   */
  static async getStorage(keys) {
    if (!this.isContextValid()) {
      console.warn('NetworkIQ: Context invalid for storage access');
      return {};
    }

    try {
      return await new Promise((resolve) => {
        chrome.storage.local.get(keys, (result) => {
          if (chrome.runtime.lastError) {
            console.warn('NetworkIQ: Storage error:', chrome.runtime.lastError);
            resolve({});
          } else {
            resolve(result);
          }
        });
      });
    } catch (error) {
      console.warn('NetworkIQ: Storage access failed:', error);
      return {};
    }
  }

  /**
   * Safe storage write with error handling
   */
  static async setStorage(data) {
    if (!this.isContextValid()) {
      console.warn('NetworkIQ: Context invalid for storage write');
      return false;
    }

    try {
      return await new Promise((resolve) => {
        chrome.storage.local.set(data, () => {
          if (chrome.runtime.lastError) {
            console.warn('NetworkIQ: Storage write error:', chrome.runtime.lastError);
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });
    } catch (error) {
      console.warn('NetworkIQ: Storage write failed:', error);
      return false;
    }
  }

  /**
   * Check if background script is available
   */
  static async isBackgroundAvailable() {
    try {
      const response = await this.sendMessage({ action: 'ping' });
      return response && response.pong === true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Reload extension context if needed
   */
  static handleContextInvalidation() {
    console.log('NetworkIQ: Handling context invalidation...');

    // Show user notification if possible
    if (document.body) {
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #FEF2F2;
        border: 1px solid #FCA5A5;
        color: #991B1B;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      `;
      notification.innerHTML = `
        <strong>NetworkIQ Extension Updated</strong><br>
        Please refresh the page to continue using NetworkIQ.
        <button onclick="location.reload()" style="
          margin-left: 10px;
          padding: 4px 8px;
          background: #DC2626;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        ">Refresh Now</button>
      `;
      document.body.appendChild(notification);

      // Auto-remove after 10 seconds
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 10000);
    }
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConnectionHelper;
}