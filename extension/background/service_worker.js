/**
 * NetworkIQ Background Service Worker
 * Progressive build - adding functionality step by step
 */

console.log('NetworkIQ Service Worker loaded');

// Configuration
const API_BASE_URL = 'http://localhost:8000/api';

// State management
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
    console.log('NetworkIQ extension installed successfully!');
    
    // Set default settings
    chrome.storage.sync.set({
      settings: {
        showScore: true,
        showConnections: true,
        autoGenerate: false
      }
    });
  }
  
  // Always reload auth on install/update
  loadAuthToken().then(() => {
    console.log('Auth loaded on install/update, state:', {
      isAuthenticated: userState.isAuthenticated,
      hasToken: !!userState.token
    });
  });
});

// Load auth token on startup - check both sync and local storage
async function loadAuthToken() {
  // First try sync storage
  const syncData = await chrome.storage.sync.get(['authToken', 'user']);
  if (syncData.authToken) {
    userState.token = syncData.authToken;
    userState.isAuthenticated = true;
    if (syncData.user) {
      userState.email = syncData.user.email;
      userState.subscription = syncData.user.tier || 'free';
    }
    return;
  }
  
  // Fallback to local storage
  const localData = await chrome.storage.local.get(['authToken', 'user']);
  if (localData.authToken) {
    userState.token = localData.authToken;
    userState.isAuthenticated = true;
    if (localData.user) {
      userState.email = localData.user.email;
      userState.subscription = localData.user.tier || 'free';
    }
    
    // Copy to sync storage for persistence
    chrome.storage.sync.set({
      authToken: localData.authToken,
      user: localData.user
    });
  }
}

// Load auth on startup
(async () => {
  try {
    await loadAuthToken();
    console.log('Initial auth loaded, state:', {
      isAuthenticated: userState.isAuthenticated,
      hasToken: !!userState.token,
      email: userState.email
    });
  } catch (err) {
    console.error('Failed to load auth token:', err);
  }
})();

// Listen for storage changes to update auth
chrome.storage.onChanged.addListener((changes, _namespace) => {
  if (changes.authToken) {
    if (changes.authToken.newValue) {
      userState.token = changes.authToken.newValue;
      userState.isAuthenticated = true;
    }
  }
});

// API call handler with error handling
async function handleAPICall(endpoint, data) {
  try {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // Add auth token if available
    if (userState.token) {
      headers['Authorization'] = `Bearer ${userState.token}`;
      console.log(`API call to ${endpoint} with auth token`);
    } else {
      console.log(`API call to ${endpoint} WITHOUT auth token - this will likely fail`);
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

// Get today's usage
function getTodayUsage(callback) {
  const today = new Date().toDateString();
  
  chrome.storage.local.get(['usage'], (result) => {
    const usage = result.usage || {};
    const todayCount = usage[today] || 0;
    
    // Return counts based on what was tracked
    callback({
      scores: todayCount,
      messages: Math.floor(todayCount / 3) // Rough estimate
    });
  });
}

// Open Stripe checkout
async function openStripeCheckout(priceId) {
  try {
    console.log('Creating checkout session with priceId:', priceId, 'userId:', userState.userId);
    
    // Create checkout session via API
    const response = await fetch(`${API_BASE_URL}/payments/create-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': userState.token ? `Bearer ${userState.token}` : ''
      },
      body: JSON.stringify({
        price_id: priceId,
        user_id: userState.userId || userState.email || 'unknown'
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Checkout API error:', response.status, errorData);
      throw new Error(errorData.detail || 'Failed to create checkout session');
    }
    
    const data = await response.json();
    
    // Open Stripe checkout in new tab
    if (data.checkout_url) {
      chrome.tabs.create({
        url: data.checkout_url
      });
    } else {
      console.error('No checkout URL returned', data);
    }
  } catch (error) {
    console.error('Failed to create checkout session:', error);
    // Notify popup of error
    chrome.runtime.sendMessage({
      action: 'checkout_error',
      message: error.message
    });
  }
}

// Check authentication status
async function checkAuthStatus() {
  try {
    const result = await chrome.storage.sync.get(['token', 'userId', 'email']);
    
    if (result.token) {
      // For now, just use stored data
      // TODO: Verify token with API when /auth/verify endpoint is ready
      userState = {
        isAuthenticated: true,
        subscription: 'free', // Default, will be updated from API
        email: result.email,
        userId: result.userId,
        token: result.token
      };
      
      // Try to get user info from API
      const response = await fetch(`${API_BASE_URL}/auth/user`, {
        headers: {
          'Authorization': `Bearer ${result.token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        userState.subscription = data.subscription_tier || 'free';
        updateExtensionBadge();
      }
    } else {
      userState = {
        isAuthenticated: false,
        subscription: 'free',
        email: null,
        userId: null,
        token: null
      };
    }
  } catch (error) {
    console.error('Failed to check auth status:', error);
  }
}

// Update extension badge
function updateExtensionBadge() {
  if (userState.subscription === 'advanced' || userState.subscription === 'basic') {
    chrome.action.setBadgeText({ text: 'PRO' });
    chrome.action.setBadgeBackgroundColor({ color: '#8B5CF6' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  console.log('Message received:', request);
  
  // Create a wrapper to ensure response is sent even on timeout
  let responseSent = false;
  const safeResponse = (data) => {
    if (!responseSent) {
      responseSent = true;
      sendResponse(data);
    }
  };
  
  // Set a timeout to ensure response is always sent
  const timeout = setTimeout(() => {
    safeResponse({ error: 'Request timeout', code: 'TIMEOUT' });
  }, 10000); // 10 second timeout
  
  // Original response wrapper that clears timeout
  const originalSendResponse = (data) => {
    clearTimeout(timeout);
    safeResponse(data);
  };
  
  switch (request.action) {
    case 'api_call':
      handleAPICall(request.endpoint, request.data)
        .then(originalSendResponse)
        .catch(error => originalSendResponse({ error: error.message }));
      return true; // Will respond asynchronously
      
    case 'analyzeProfile':
      // Use the new LLM-based analysis endpoint
      (async () => {
        try {
          // Ensure auth is loaded first
          if (!userState.token) {
            console.log('No auth token, attempting to load...');
            await loadAuthToken();
          }
          
          console.log('analyzeProfile - auth state:', {
            hasToken: !!userState.token,
            tokenPrefix: userState.token ? userState.token.substring(0, 20) + '...' : 'none'
          });
          
          const result = await handleAPICall('/profiles/analyze', {
            linkedin_url: request.profile.url || '',
            profile_data: request.profile
          });
          originalSendResponse(result);
        } catch (error) {
          console.error('analyzeProfile error:', error);
          originalSendResponse({ error: error.message || 'Failed to analyze profile' });
        }
      })();
      return true; // Will respond asynchronously
      
    case 'generateMessage':
      // Use LLM for message generation
      handleAPICall('/messages/generate', {
        profile: request.profile,
        score_data: request.scoreData
      })
        .then(originalSendResponse)
        .catch(error => originalSendResponse({ error: error.message }));
      return true; // Will respond asynchronously
      
    case 'track':
      // Simple console logging for now (analytics endpoint doesn't exist)
      console.log('Event tracked:', request.event, request.data);
      originalSendResponse({ success: true });
      break;
      
    case 'check_auth':
      originalSendResponse({ 
        isAuthenticated: userState.isAuthenticated, 
        subscription: userState.subscription,
        email: userState.email
      });
      break;
      
    case 'getTodayUsage':
      getTodayUsage((usage) => {
        originalSendResponse(usage);
      });
      return true; // Will respond asynchronously
      
    case 'open_checkout':
      openStripeCheckout(request.priceId);
      originalSendResponse({ success: true });
      break;
      
    case 'login':
      // Store auth data
      userState = {
        isAuthenticated: true,
        subscription: request.subscription || 'free',
        email: request.email,
        userId: request.userId,
        token: request.token
      };
      chrome.storage.sync.set({
        token: request.token,
        userId: request.userId,
        email: request.email
      });
      updateExtensionBadge();
      originalSendResponse({ success: true });
      break;
      
    case 'logout':
      // Clear auth data
      userState = {
        isAuthenticated: false,
        subscription: 'free',
        email: null,
        userId: null,
        token: null
      };
      chrome.storage.sync.remove(['token', 'userId', 'email']);
      updateExtensionBadge();
      originalSendResponse({ success: true });
      break;
      
    case 'updateAuth':
      // Update auth state
      if (request.token) {
        userState.token = request.token;
        userState.isAuthenticated = true;
      }
      if (request.user) {
        userState.email = request.user.email;
        userState.subscription = request.user.tier || 'free';
      }
      originalSendResponse({ success: true, authenticated: userState.isAuthenticated });
      break;
      
    default:
      originalSendResponse({ error: 'Unknown action' });
  }
  
  return false; // Default to synchronous response
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('linkedin.com')) {
    console.log('LinkedIn tab detected:', tab.url);
    // Content scripts are injected via manifest
  }
});

// Periodic auth check (every 60 minutes)
chrome.alarms.create('checkAuth', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkAuth') {
    checkAuthStatus();
  }
});

// Initialize on startup
checkAuthStatus();

console.log('Service worker setup complete');