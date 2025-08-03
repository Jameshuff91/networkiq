// NetworkIQ Popup Script
// Handles popup UI interactions and displays user stats

const API_BASE_URL = 'http://localhost:8000/api';

document.addEventListener('DOMContentLoaded', async () => {
  // Load and display user data
  await loadUserData();
  
  // Set up event listeners
  setupEventListeners();
});

async function loadUserData() {
  try {
    const result = await chrome.storage.local.get(['user', 'stats', 'isAuthenticated', 'authToken', 'resumeData']);
    
    if (!result.isAuthenticated) {
      // Redirect to login/signup flow
      showLoginUI();
      return;
    }
    
    // Update user tier
    const userTier = document.getElementById('userTier');
    if (result.user?.subscriptionTier === 'pro') {
      userTier.textContent = 'PRO';
      userTier.style.background = '#5E5ADB';
      userTier.style.color = 'white';
      document.getElementById('upgradeSection').style.display = 'none';
      document.getElementById('usageSection').style.display = 'none';
    } else {
      userTier.textContent = 'FREE';
      // Show usage limits for free users
      updateUsageDisplay(result.stats);
    }
    
    // Update stats
    if (result.stats) {
      document.getElementById('todayScores').textContent = result.stats.todayScores || '0';
      document.getElementById('totalConnections').textContent = result.stats.totalConnections || '0';
      document.getElementById('acceptanceRate').textContent = result.stats.acceptanceRate || '0%';
    }
    
    // Show resume status if uploaded
    if (result.resumeData) {
      showResumeStatus(result.resumeData);
    }
    
  } catch (error) {
    console.error('Error loading user data:', error);
  }
}

function updateUsageDisplay(stats) {
  const usageSection = document.getElementById('usageSection');
  const usageFill = document.getElementById('usageFill');
  const usageCount = document.getElementById('usageCount');
  
  const used = stats?.todayScores || 0;
  const limit = 10;
  const percentage = (used / limit) * 100;
  
  usageFill.style.width = `${percentage}%`;
  usageCount.textContent = `${used}/${limit}`;
  
  if (percentage >= 80) {
    usageFill.style.background = '#FFA500';
  } else if (percentage >= 100) {
    usageFill.style.background = '#DC2626';
  }
}

function setupEventListeners() {
  // Score current profile button
  document.getElementById('scoreCurrentBtn')?.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url?.includes('linkedin.com/in/')) {
      showStatus('Please navigate to a LinkedIn profile', 'error');
      return;
    }
    
    // Send message to content script to score the profile
    chrome.tabs.sendMessage(tab.id, { action: 'scoreProfile' });
    window.close();
  });
  
  // View history button
  document.getElementById('viewHistoryBtn')?.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('history.html') });
  });
  
  // Resume upload button
  document.getElementById('uploadResumeBtn')?.addEventListener('click', () => {
    document.getElementById('resumeUpload').click();
  });
  
  // Resume file selection
  document.getElementById('resumeUpload')?.addEventListener('change', handleResumeUpload);
  
  // Upgrade button
  document.getElementById('upgradeBtn')?.addEventListener('click', async () => {
    const result = await chrome.storage.local.get(['authToken']);
    if (result.authToken) {
      // Create checkout session
      createCheckoutSession(result.authToken);
    } else {
      showLoginUI();
    }
  });
  
  // Footer links - commented out until deployed
  document.getElementById('dashboardLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    // chrome.tabs.create({ url: 'https://networkiq.ai/dashboard' });
    alert('Dashboard coming soon!');
  });
  
  document.getElementById('supportLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    // chrome.tabs.create({ url: 'https://networkiq.ai/support' });
    alert('Support: Please email support@networkiq.ai');
  });
  
  document.getElementById('logoutLink')?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (confirm('Are you sure you want to logout?')) {
      await chrome.storage.local.clear();
      window.location.reload();
    }
  });
}

async function handleResumeUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  // Validate file type
  const validTypes = ['.pdf', '.docx', '.doc', '.txt'];
  const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  
  if (!validTypes.includes(fileExt)) {
    showStatus('Please upload a PDF, DOCX, or TXT file', 'error');
    return;
  }
  
  // Validate file size (10MB max)
  if (file.size > 10 * 1024 * 1024) {
    showStatus('File size must be less than 10MB', 'error');
    return;
  }
  
  // Get auth token
  const result = await chrome.storage.local.get(['authToken', 'testMode']);
  
  // Show loading status
  showStatus('Analyzing resume locally...', 'loading');
  document.getElementById('uploadBtnText').textContent = 'Processing...';
  
  try {
    let extractedElements = null;
    let needsBackendProcessing = false;
    
    // Try to extract text locally first
    if (fileExt === '.txt') {
      // Text files can be processed locally
      const text = await file.text();
      extractedElements = ResumeExtractor.extractKeyElements(text);
      console.log('Extracted elements locally:', extractedElements);
    } else if (fileExt === '.docx') {
      // DOCX files - extract text directly
      showStatus('Extracting text from Word document...', 'loading');
      const text = await extractDocxText(file);
      if (text) {
        extractedElements = ResumeExtractor.extractKeyElements(text);
        console.log('Extracted elements from DOCX:', extractedElements);
      } else {
        // Fallback to backend if extraction fails
        needsBackendProcessing = true;
      }
    } else {
      // PDF and DOC files need backend processing (for OCR and parsing)
      needsBackendProcessing = true;
    }
    
    // If we extracted locally, just save the search elements
    if (extractedElements && !needsBackendProcessing) {
      const searchElements = ResumeExtractor.createSearchElements(extractedElements);
      
      // Store in chrome storage
      await chrome.storage.local.set({
        searchElements: searchElements,
        resumeData: {
          ...extractedElements,
          search_elements: searchElements
        },
        resumeUploadedAt: new Date().toISOString()
      });
      
      // Show success
      showStatus('Resume analyzed successfully!', 'success');
      document.getElementById('uploadBtnText').textContent = 'Update Resume';
      
      // Display summary
      showResumeStatus({
        ...extractedElements,
        search_elements: searchElements.length
      });
      
      // Notify content scripts
      notifyContentScripts(searchElements);
      
    } else if (result.authToken && !result.testMode) {
      // Need backend processing for PDF (OCR) or DOCX parsing
      showStatus('Processing resume with advanced extraction...', 'loading');
      
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      
      // Upload to backend
      const response = await fetch(`${API_BASE_URL}/resume/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${result.authToken}`
        },
        body: formData
      });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Upload failed');
    }
    
    const data = await response.json();
    
    // Store resume data in chrome storage
    await chrome.storage.local.set({
      resumeData: data.data,
      resumeUploadedAt: new Date().toISOString()
    });
    
    // Show success
    showStatus('Resume uploaded successfully!', 'success');
    document.getElementById('uploadBtnText').textContent = 'Update Resume';
    
    // Display resume summary
    showResumeStatus(data.data);
    
    // Notify content scripts
    notifyContentScripts(data.data.search_elements);
    
    } else {
      // Test mode or no backend - process locally only
      showStatus('Processing resume locally...', 'loading');
      
      // Try to extract text based on file type
      let text = '';
      let extractedElements = null;
      
      if (fileExt === '.txt') {
        text = await file.text();
        extractedElements = ResumeExtractor.extractKeyElements(text);
      } else if (fileExt === '.docx') {
        // Try to extract from DOCX
        text = await extractDocxText(file);
        if (text) {
          extractedElements = ResumeExtractor.extractKeyElements(text);
        } else {
          showStatus('Could not extract text from DOCX. Please try saving as TXT file.', 'error');
          document.getElementById('uploadBtnText').textContent = 'Choose Resume File';
          return;
        }
      } else {
        // PDF files would need backend
        showStatus('PDF files require backend processing. Please convert to TXT or DOCX.', 'error');
        document.getElementById('uploadBtnText').textContent = 'Choose Resume File';
        return;
      }
      
      // Create search elements
      const searchElements = ResumeExtractor.createSearchElements(extractedElements);
      
      // Store in chrome storage
      await chrome.storage.local.set({
        searchElements: searchElements,
        resumeData: {
          ...extractedElements,
          search_elements: searchElements
        },
        resumeUploadedAt: new Date().toISOString()
      });
      
      // Show success
      showStatus('Resume analyzed successfully!', 'success');
      document.getElementById('uploadBtnText').textContent = 'Update Resume';
      
      // Display summary
      showResumeStatus({
        ...extractedElements,
        search_elements: searchElements.length
      });
      
      // Notify content scripts
      notifyContentScripts(searchElements);
    }
    
  } catch (error) {
    console.error('Upload error:', error);
    showStatus(error.message || 'Failed to process resume', 'error');
    document.getElementById('uploadBtnText').textContent = 'Choose Resume File';
  }
}

// Extract text from DOCX files
async function extractDocxText(file) {
  try {
    // For large DOCX files, we need a better approach
    // Try to get the plain text by looking for readable content
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    let text = '';
    const decoder = new TextDecoder('utf-8', { fatal: false });
    
    // Convert to string - this will have XML and binary mixed
    const fullContent = decoder.decode(uint8Array);
    
    // First try: Look for text between <w:t> tags (Word text elements)
    const textMatches = fullContent.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
    if (textMatches && textMatches.length > 10) {
      text = textMatches
        .map(match => match.replace(/<[^>]+>/g, ''))
        .filter(t => t.trim().length > 0)
        .join(' ');
      
      console.log(`Extracted ${text.length} chars from XML tags`);
    }
    
    // If that didn't work, try a simpler approach
    // Extract any readable ASCII/UTF-8 text
    if (!text || text.length < 100) {
      const chunks = [];
      let currentChunk = '';
      
      for (let i = 0; i < uint8Array.length; i++) {
        const byte = uint8Array[i];
        // Readable ASCII and extended characters
        if ((byte >= 32 && byte <= 126) || (byte >= 160 && byte <= 255)) {
          currentChunk += String.fromCharCode(byte);
        } else if (currentChunk.length > 3) {
          // Save chunks of readable text
          chunks.push(currentChunk);
          currentChunk = '';
        } else {
          currentChunk = '';
        }
      }
      
      if (currentChunk.length > 3) {
        chunks.push(currentChunk);
      }
      
      // Filter and join chunks that look like actual text
      text = chunks
        .filter(chunk => {
          // Keep chunks that look like words/sentences
          return chunk.length > 5 && /[a-zA-Z]{2,}/.test(chunk);
        })
        .join(' ');
    }
    
    // Look for resume-like content patterns in the full text
    // Resume text often appears after the XML/binary content
    // Look for common resume keywords or email patterns
    const resumeStart = fullContent.search(/\b(SUMMARY|EXPERIENCE|EDUCATION|SKILLS|PROFESSIONAL|WORK\s+HISTORY|EMPLOYMENT|[A-Z][a-z]+ [A-Z][a-z]+[\s\S]{0,50}\w+@\w+\.\w+)/i);
    if (resumeStart > 0) {
      // Extract from where real resume content starts
      const resumeContent = fullContent.substring(resumeStart);
      // Clean it up
      text = resumeContent
        .replace(/<[^>]*>/g, '') // Remove XML tags
        .replace(/[^\x20-\x7E\s]/g, ' ') // Keep only printable chars
        .replace(/\s+/g, ' ') // Normalize whitespace
        .substring(0, 50000) // Limit to 50k chars
        .trim();
      
      console.log('Found resume content starting at position', resumeStart);
    }
    
    // Final cleanup
    text = text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/([A-Z]{2,})\s+([A-Z]{2,})/g, '$1 $2') // Fix spacing between acronyms
      .trim();
    
    console.log(`Extracted ${text.length} characters from DOCX`);
    
    // Make sure we got enough text
    if (text.length < 100) {
      console.log('Not enough text extracted from DOCX, will try backend');
      return null;
    }
    
    return text;
  } catch (error) {
    console.error('Error extracting DOCX text:', error);
    return null;
  }
}

// Helper function to notify content scripts
function notifyContentScripts(searchElements) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.url?.includes('linkedin.com')) {
        chrome.tabs.sendMessage(tab.id, { 
          action: 'updateScoringElements',
          data: { search_elements: searchElements }
        }).catch(() => {}); // Ignore errors for tabs without content script
      }
    });
  });
}

function showResumeStatus(resumeData) {
  const resumeDetails = document.getElementById('resumeDetails');
  const resumeSummary = document.getElementById('resumeSummary');
  
  if (!resumeData) return;
  
  // Build summary HTML
  let summaryHTML = '';
  
  // Companies
  if (resumeData.companies && resumeData.companies.length > 0) {
    summaryHTML += `
      <div class="resume-item">
        <span class="resume-item-label">Companies:</span>
        <span>${resumeData.companies.slice(0, 3).join(', ')}${resumeData.companies.length > 3 ? '...' : ''}</span>
      </div>
    `;
  }
  
  // Education
  if (resumeData.education && resumeData.education.length > 0) {
    const schools = resumeData.education
      .filter(e => e.institution)
      .map(e => e.institution)
      .slice(0, 2);
    if (schools.length > 0) {
      summaryHTML += `
        <div class="resume-item">
          <span class="resume-item-label">Education:</span>
          <span>${schools.join(', ')}</span>
        </div>
      `;
    }
  }
  
  // Military
  if (resumeData.military) {
    summaryHTML += `
      <div class="resume-item">
        <span class="resume-item-label">Military:</span>
        <span>Veteran</span>
      </div>
    `;
  }
  
  // Skills count
  if (resumeData.skills && typeof resumeData.skills === 'number') {
    summaryHTML += `
      <div class="resume-item">
        <span class="resume-item-label">Skills:</span>
        <span>${resumeData.skills} identified</span>
      </div>
    `;
  }
  
  // Search elements count
  if (resumeData.search_elements && typeof resumeData.search_elements === 'number') {
    summaryHTML += `
      <div class="resume-item">
        <span class="resume-item-label">Match Points:</span>
        <span>${resumeData.search_elements} criteria</span>
      </div>
    `;
  }
  
  resumeSummary.innerHTML = summaryHTML;
  resumeDetails.style.display = 'block';
  
  // Update button text to indicate resume is uploaded
  document.getElementById('uploadBtnText').textContent = 'Update Resume';
}

function showStatus(message, type) {
  const statusEl = document.getElementById('uploadStatus');
  statusEl.textContent = message;
  statusEl.className = `upload-status ${type}`;
  
  if (type !== 'loading') {
    setTimeout(() => {
      statusEl.className = 'upload-status';
    }, 5000);
  }
}

function showLoginUI() {
  document.querySelector('.popup-container').innerHTML = `
    <div class="popup-header">
      <div class="logo">
        <span class="logo-icon">🎯</span>
        <span class="logo-text">NetworkIQ</span>
      </div>
    </div>
    <div class="login-container">
      <h2>Welcome to NetworkIQ</h2>
      <p>Sign in to start scoring LinkedIn profiles</p>
      <input type="email" id="email" placeholder="Email" class="input-field">
      <input type="password" id="password" placeholder="Password" class="input-field">
      <button id="loginBtn" class="action-btn primary">Sign In</button>
      <button id="signupBtn" class="action-btn secondary">Create Account</button>
      <div class="test-mode">
        <button id="testModeBtn" class="action-btn secondary">Try Test Mode</button>
      </div>
    </div>
  `;
  
  // Add login handlers
  document.getElementById('loginBtn')?.addEventListener('click', handleLogin);
  document.getElementById('signupBtn')?.addEventListener('click', handleSignup);
  document.getElementById('testModeBtn')?.addEventListener('click', enableTestMode);
}

async function handleLogin() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  if (!email || !password) {
    alert('Please enter email and password');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    }
    
    const data = await response.json();
    
    // Store auth data
    await chrome.storage.local.set({
      isAuthenticated: true,
      authToken: data.access_token,
      user: data.user,
      stats: {
        todayScores: 0,
        totalConnections: 0,
        acceptanceRate: '0%'
      }
    });
    
    window.location.reload();
    
  } catch (error) {
    alert(error.message || 'Login failed');
  }
}

async function handleSignup() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  if (!email || !password) {
    alert('Please enter email and password');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Signup failed');
    }
    
    const data = await response.json();
    
    // Store auth data
    await chrome.storage.local.set({
      isAuthenticated: true,
      authToken: data.access_token,
      user: data.user,
      stats: {
        todayScores: 0,
        totalConnections: 0,
        acceptanceRate: '0%'
      }
    });
    
    window.location.reload();
    
  } catch (error) {
    alert(error.message || 'Signup failed');
  }
}

async function enableTestMode() {
  await chrome.storage.local.set({
    isAuthenticated: true,
    testMode: true,
    user: {
      id: 'test-user',
      email: 'test@networkiq.ai',
      subscriptionTier: 'pro'
    },
    stats: {
      todayScores: 0,
      totalConnections: 0,
      acceptanceRate: '0%'
    }
  });
  
  window.location.reload();
}

async function createCheckoutSession(token) {
  try {
    const response = await fetch(`${API_BASE_URL}/payments/create-checkout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to create checkout session');
    }
    
    const data = await response.json();
    
    // Open Stripe checkout
    chrome.tabs.create({ url: data.checkout_url });
    
  } catch (error) {
    console.error('Checkout error:', error);
    alert('Failed to start checkout process');
  }
}

// Add additional CSS for login UI
const style = document.createElement('style');
style.textContent = `
.login-container {
  padding: 24px;
  text-align: center;
}

.login-container h2 {
  margin-bottom: 8px;
  color: #2C3E50;
}

.login-container p {
  color: #64748B;
  margin-bottom: 20px;
  font-size: 14px;
}

.input-field {
  width: 100%;
  padding: 10px 12px;
  margin: 8px 0;
  border: 1px solid #E0E0E0;
  border-radius: 6px;
  font-size: 14px;
}

.input-field:focus {
  outline: none;
  border-color: #5E5ADB;
  box-shadow: 0 0 0 3px rgba(94, 90, 219, 0.1);
}

.test-mode {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #E0E0E0;
}
`;
document.head.appendChild(style);