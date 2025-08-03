/**
 * NetworkIQ Background Service Worker
 * Handles API calls, authentication, and tracking
 */

// Configuration
// For testing: Use localhost, then update to production URL when deployed
const API_BASE_URL = 'http://localhost:8000/api'; // Change to production URL when deployed
// Production example: 'https://api.networkiq.ai/api'

const STRIPE_CHECKOUT_URL = 'https://checkout.stripe.com/c/pay/';

// State
let userState = {
  isAuthenticated: false,
  subscription: 'free',
  email: null,
  userId: null,
  token: null
};

// Initialize on install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Open onboarding page
    chrome.tabs.create({
      url: 'https://networkiq.ai/welcome'
    });
    
    // Set default settings
    chrome.storage.sync.set({
      settings: {
        showScore: true,
        showConnections: true,
        autoGenerate: false
      }
    });
    
    // Track installation
    trackEvent('extension_installed');
  }
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'api_call':
      handleAPICall(request.endpoint, request.data)
        .then(sendResponse)
        .catch(error => sendResponse({ error: error.message }));
      return true; // Will respond asynchronously
      
    case 'track':
      trackEvent(request.event, request.data);
      sendResponse({ success: true });
      break;
      
    case 'check_auth':
      sendResponse({ isAuthenticated: userState.isAuthenticated, subscription: userState.subscription });
      break;
      
    case 'open_checkout':
      openStripeCheckout(request.priceId);
      sendResponse({ success: true });
      break;
      
    default:
      sendResponse({ error: 'Unknown action' });
  }
});

// API call handler with improved error handling
async function handleAPICall(endpoint, data) {
  try {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // Add auth token if available
    if (userState.token) {
      headers['Authorization'] = `Bearer ${userState.token}`;
    }
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Handle specific error codes
      if (response.status === 429) {
        return {
          error: true,
          message: errorData.detail || 'Daily limit reached. Upgrade to Pro!',
          code: 'RATE_LIMIT'
        };
      } else if (response.status === 401) {
        userState.isAuthenticated = false;
        userState.token = null;
        chrome.storage.sync.remove('authToken');
        return {
          error: true,
          message: 'Please sign in to continue',
          code: 'UNAUTHORIZED'
        };
      } else if (response.status === 503) {
        return {
          error: true,
          message: 'Service temporarily unavailable',
          code: 'SERVICE_UNAVAILABLE'
        };
      }
      
      throw new Error(errorData.detail || `API error: ${response.status}`);
    }
    
    const result = await response.json();
    
    // Update usage tracking
    if (endpoint === '/profiles/score' || endpoint === '/messages/generate') {
      updateUsageTracking();
    }
    
    return result;
  } catch (error) {
    console.error('API call failed:', error);
    
    // Network error handling
    if (error.message.includes('Failed to fetch')) {
      return {
        error: true,
        message: 'Cannot connect to server. Try Test Mode!',
        code: 'NETWORK_ERROR'
      };
    }
    
    return {
      error: true,
      message: error.message,
      code: 'UNKNOWN_ERROR'
    };
  }
}

// Track events
async function trackEvent(event, data = {}) {
  try {
    // Add user context
    const eventData = {
      ...data,
      userId: userState.userId,
      subscription: userState.subscription,
      timestamp: new Date().toISOString()
    };
    
    // Send to analytics API
    await fetch(`${API_BASE_URL}/analytics/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        event: event,
        data: eventData
      })
    });
    
    // Also store locally for offline analytics
    chrome.storage.local.get(['analytics'], (result) => {
      const analytics = result.analytics || [];
      analytics.push({ event, data: eventData });
      
      // Keep only last 100 events
      if (analytics.length > 100) {
        analytics.shift();
      }
      
      chrome.storage.local.set({ analytics });
    });
  } catch (error) {
    console.error('Failed to track event:', error);
  }
}

// Update usage tracking
function updateUsageTracking() {
  const today = new Date().toDateString();
  
  chrome.storage.local.get(['usage', 'lastReset'], (result) => {
    let usage = result.usage || {};
    
    // Reset if new day
    if (result.lastReset !== today) {
      usage = {};
    }
    
    // Increment usage
    const currentCount = usage[today] || 0;
    usage[today] = currentCount + 1;
    
    chrome.storage.local.set({
      usage: usage,
      lastReset: today
    });
  });
}

// Open Stripe checkout
function openStripeCheckout(priceId) {
  // Create checkout session via API
  fetch(`${API_BASE_URL}/payments/create-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userState.token}`
    },
    body: JSON.stringify({
      priceId: priceId,
      userId: userState.userId
    })
  })
  .then(response => response.json())
  .then(data => {
    // Open Stripe checkout in new tab
    chrome.tabs.create({
      url: data.checkoutUrl
    });
  })
  .catch(error => {
    console.error('Failed to create checkout session:', error);
  });
}

// Check authentication status
async function checkAuthStatus() {
  try {
    const result = await chrome.storage.sync.get(['token', 'userId', 'email']);
    
    if (result.token) {
      // Verify token with API
      const response = await fetch(`${API_BASE_URL}/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${result.token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        userState = {
          isAuthenticated: true,
          subscription: data.subscription || 'free',
          email: data.email,
          userId: data.userId,
          token: result.token
        };
        
        // Update badge based on subscription
        updateExtensionBadge();
      } else {
        // Token invalid, clear it
        chrome.storage.sync.remove(['token', 'userId', 'email']);
        userState = {
          isAuthenticated: false,
          subscription: 'free',
          email: null,
          userId: null,
          token: null
        };
      }
    }
  } catch (error) {
    console.error('Failed to check auth status:', error);
  }
}

// Update extension badge
function updateExtensionBadge() {
  if (userState.subscription === 'pro' || userState.subscription === 'team') {
    chrome.action.setBadgeText({ text: 'PRO' });
    chrome.action.setBadgeBackgroundColor({ color: '#8B5CF6' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Listen for tab updates to inject content scripts
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('linkedin.com')) {
    // Content scripts are already injected via manifest
    // This is just for tracking active LinkedIn tabs
    trackEvent('linkedin_tab_opened', { url: tab.url });
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // Open popup is handled by manifest
  // This is a fallback if popup is not set
  chrome.tabs.create({
    url: 'https://networkiq.ai/dashboard'
  });
});

// Periodic tasks
chrome.alarms.create('checkAuth', { periodInMinutes: 60 });
chrome.alarms.create('syncData', { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener((alarm) => {
  switch (alarm.name) {
    case 'checkAuth':
      checkAuthStatus();
      break;
    case 'syncData':
      syncLocalData();
      break;
  }
});

// Sync local data with server
async function syncLocalData() {
  if (!userState.isAuthenticated) return;
  
  try {
    // Get local analytics
    const result = await chrome.storage.local.get(['analytics']);
    const analytics = result.analytics || [];
    
    if (analytics.length > 0) {
      // Send to server
      await fetch(`${API_BASE_URL}/analytics/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userState.token}`
        },
        body: JSON.stringify({ events: analytics })
      });
      
      // Clear local analytics
      chrome.storage.local.set({ analytics: [] });
    }
  } catch (error) {
    console.error('Failed to sync data:', error);
  }
}

// Initialize on startup
checkAuthStatus();