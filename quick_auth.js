// Quick authentication setup for NetworkIQ
// Run this in Chrome DevTools console on any page with the extension loaded
// Type "allow pasting" first if prompted

console.log('🔐 Setting up NetworkIQ authentication...');

// First, clear any old data
chrome.storage.local.clear(() => {
  chrome.storage.sync.clear(() => {
    console.log('✅ Cleared old data');
    
    // Now get fresh auth token
    fetch('http://localhost:8000/api/auth/test-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    .then(r => r.json())
    .then(data => {
      if (data.access_token) {
        console.log('✅ Got auth token');
        
        // Store in BOTH storages
        const authData = {
          authToken: data.access_token,
          user: data.user,
          isAuthenticated: true
        };
        
        chrome.storage.sync.set(authData, () => {
          console.log('✅ Saved to sync storage');
          
          chrome.storage.local.set(authData, () => {
            console.log('✅ Saved to local storage');
            
            // Notify service worker to reload auth
            chrome.runtime.sendMessage({
              action: 'updateAuth',
              token: data.access_token,
              user: data.user
            }, (response) => {
              console.log('✅ Service worker updated:', response);
              console.log('\n🎉 Authentication complete! Reload the LinkedIn page now.');
            });
          });
        });
      }
    })
    .catch(err => console.error('❌ Error:', err));
  });
});