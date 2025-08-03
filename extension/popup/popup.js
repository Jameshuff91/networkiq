// NetworkIQ Popup Script
// Handles popup UI interactions and displays user stats

document.addEventListener('DOMContentLoaded', async () => {
    // Get elements
    const profilesScored = document.getElementById('profiles-scored');
    const messagesGenerated = document.getElementById('messages-generated');
    const tierBadge = document.getElementById('tier-badge');
    const scoreProfileBtn = document.getElementById('score-profile');
    const upgradeBtn = document.getElementById('upgrade');
    const settingsBtn = document.getElementById('settings');
    const manageSubBtn = document.getElementById('manage-subscription');
    const viewHistoryBtn = document.getElementById('view-history');
    const signOutBtn = document.getElementById('sign-out');
    
    // Load user data from storage
    const loadUserData = async () => {
        try {
            const result = await chrome.storage.local.get(['user', 'stats', 'isAuthenticated']);
            
            if (!result.isAuthenticated) {
                // Show login UI
                showLoginUI();
                return;
            }
            
            // Update stats display
            if (result.stats) {
                profilesScored.textContent = result.stats.profilesScored || '0';
                messagesGenerated.textContent = result.stats.messagesGenerated || '0';
            }
            
            // Update tier display
            if (result.user) {
                const tier = result.user.subscriptionTier || 'free';
                tierBadge.textContent = tier === 'pro' ? 'PRO' : 'FREE';
                tierBadge.className = tier === 'pro' ? 'tier-badge pro' : 'tier-badge free';
                
                // Show/hide upgrade button
                if (tier === 'pro') {
                    upgradeBtn.style.display = 'none';
                    manageSubBtn.style.display = 'block';
                }
            }
            
            // Get today's usage
            const usage = await chrome.runtime.sendMessage({ action: 'getTodayUsage' });
            if (usage) {
                const remaining = 10 - (usage.scores || 0);
                if (result.user?.subscriptionTier === 'free') {
                    document.querySelector('.footer-text').textContent = 
                        `${remaining} scores remaining today`;
                }
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    };
    
    // Show login UI
    const showLoginUI = () => {
        document.querySelector('.container').innerHTML = `
            <div class="login-container">
                <h2>Welcome to NetworkIQ</h2>
                <p>Sign in to start scoring LinkedIn profiles</p>
                <input type="email" id="email" placeholder="Email" class="input-field">
                <input type="password" id="password" placeholder="Password" class="input-field">
                <button id="login-btn" class="btn btn-primary">Sign In</button>
                <button id="signup-btn" class="btn btn-secondary">Sign Up</button>
                <div class="test-mode">
                    <button id="test-mode-btn" class="btn btn-ghost">Continue in Test Mode</button>
                </div>
            </div>
        `;
        
        // Add login handlers
        document.getElementById('login-btn')?.addEventListener('click', handleLogin);
        document.getElementById('signup-btn')?.addEventListener('click', handleSignup);
        document.getElementById('test-mode-btn')?.addEventListener('click', enableTestMode);
    };
    
    // Handle login
    const handleLogin = async () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        if (!email || !password) {
            alert('Please enter email and password');
            return;
        }
        
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'login',
                data: { email, password }
            });
            
            if (response.success) {
                window.location.reload();
            } else {
                alert(response.error || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Login failed. Please try again.');
        }
    };
    
    // Handle signup
    const handleSignup = async () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        if (!email || !password) {
            alert('Please enter email and password');
            return;
        }
        
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'signup',
                data: { email, password }
            });
            
            if (response.success) {
                window.location.reload();
            } else {
                alert(response.error || 'Signup failed');
            }
        } catch (error) {
            console.error('Signup error:', error);
            alert('Signup failed. Please try again.');
        }
    };
    
    // Enable test mode (no backend required)
    const enableTestMode = async () => {
        await chrome.storage.local.set({
            isAuthenticated: true,
            testMode: true,
            user: {
                id: 'test-user',
                email: 'test@networkiq.ai',
                subscriptionTier: 'pro' // Give test users pro features
            },
            stats: {
                profilesScored: 0,
                messagesGenerated: 0
            }
        });
        window.location.reload();
    };
    
    // Button handlers
    scoreProfileBtn?.addEventListener('click', async () => {
        // Get current tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab.url?.includes('linkedin.com')) {
            alert('Please navigate to a LinkedIn profile to score');
            return;
        }
        
        // Send message to content script to score current profile
        chrome.tabs.sendMessage(tab.id, { action: 'scoreCurrentProfile' });
        window.close();
    });
    
    upgradeBtn?.addEventListener('click', async () => {
        // Open upgrade page
        chrome.tabs.create({ url: 'https://networkiq.ai/pricing' });
    });
    
    settingsBtn?.addEventListener('click', () => {
        // Show settings UI
        document.querySelector('.container').innerHTML = `
            <div class="settings-container">
                <h2>Settings</h2>
                <div class="setting-item">
                    <label>Auto-score profiles</label>
                    <input type="checkbox" id="auto-score">
                </div>
                <div class="setting-item">
                    <label>Show score badges</label>
                    <input type="checkbox" id="show-badges" checked>
                </div>
                <div class="setting-item">
                    <label>Message tone</label>
                    <select id="message-tone">
                        <option value="professional">Professional</option>
                        <option value="casual">Casual</option>
                        <option value="friendly">Friendly</option>
                    </select>
                </div>
                <button id="save-settings" class="btn btn-primary">Save Settings</button>
                <button id="back" class="btn btn-secondary">Back</button>
            </div>
        `;
        
        // Load current settings
        chrome.storage.local.get(['settings'], (result) => {
            const settings = result.settings || {};
            document.getElementById('auto-score').checked = settings.autoScore || false;
            document.getElementById('show-badges').checked = settings.showBadges !== false;
            document.getElementById('message-tone').value = settings.messageTone || 'professional';
        });
        
        // Save settings handler
        document.getElementById('save-settings').addEventListener('click', () => {
            const settings = {
                autoScore: document.getElementById('auto-score').checked,
                showBadges: document.getElementById('show-badges').checked,
                messageTone: document.getElementById('message-tone').value
            };
            chrome.storage.local.set({ settings }, () => {
                alert('Settings saved!');
                window.location.reload();
            });
        });
        
        document.getElementById('back').addEventListener('click', () => {
            window.location.reload();
        });
    });
    
    viewHistoryBtn?.addEventListener('click', () => {
        // Open history page
        chrome.tabs.create({ url: chrome.runtime.getURL('history.html') });
    });
    
    signOutBtn?.addEventListener('click', async () => {
        if (confirm('Are you sure you want to sign out?')) {
            await chrome.storage.local.clear();
            window.location.reload();
        }
    });
    
    // Initialize
    await loadUserData();
    
    // Check if we're in test mode and show indicator
    const testMode = await chrome.storage.local.get(['testMode']);
    if (testMode.testMode) {
        const testBadge = document.createElement('div');
        testBadge.className = 'test-mode-badge';
        testBadge.textContent = 'TEST MODE';
        testBadge.style.cssText = 'position: fixed; top: 5px; right: 5px; background: orange; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px;';
        document.body.appendChild(testBadge);
    }
});

// Add CSS for login UI
const style = document.createElement('style');
style.textContent = `
.login-container {
    padding: 20px;
    text-align: center;
}
.input-field {
    width: 100%;
    padding: 8px;
    margin: 8px 0;
    border: 1px solid #ddd;
    border-radius: 4px;
}
.btn-ghost {
    background: transparent;
    color: #0077B5;
    border: 1px solid #0077B5;
}
.test-mode {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid #eee;
}
.settings-container {
    padding: 20px;
}
.setting-item {
    margin: 15px 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
}
`;
document.head.appendChild(style);