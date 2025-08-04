// Fix checkout authentication issue
// Run this in Chrome console (type "allow pasting" first if needed)

console.log('🔧 Fixing checkout authentication...');

// Get a fresh token and ensure it's properly stored
fetch('http://localhost:8000/api/auth/test-login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
})
.then(r => r.json())
.then(data => {
  if (data.access_token) {
    console.log('✅ Got auth token');
    
    // Store in both storages for redundancy
    const authData = {
      authToken: data.access_token,
      user: data.user,
      isAuthenticated: true
    };
    
    // Store in sync storage (persistent)
    chrome.storage.sync.set(authData, () => {
      console.log('✅ Saved to sync storage');
    });
    
    // Store in local storage (faster access)
    chrome.storage.local.set(authData, () => {
      console.log('✅ Saved to local storage');
    });
    
    // Force service worker to reload auth
    chrome.runtime.sendMessage({
      action: 'updateAuth',
      token: data.access_token,
      user: data.user
    }, (response) => {
      console.log('✅ Service worker updated:', response);
      
      // Test that checkout works
      console.log('\n🧪 Testing checkout...');
      chrome.runtime.sendMessage({
        action: 'open_checkout',
        priceId: 'price_1Rs5yIQaJlv206wSfUp4nf4u' // Advanced tier
      }, (checkoutResponse) => {
        if (checkoutResponse?.error) {
          console.error('❌ Checkout test failed:', checkoutResponse.error);
        } else {
          console.log('✅ Checkout test successful! The Advanced tier button should work now.');
        }
      });
    });
  } else {
    console.error('❌ Failed to get auth token:', data);
  }
})
.catch(err => console.error('❌ Error:', err));