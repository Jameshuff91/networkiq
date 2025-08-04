// NetworkIQ Popup Script
// Handles popup UI interactions and displays user stats

const API_BASE_URL = 'http://localhost:8000/api';

document.addEventListener('DOMContentLoaded', async () => {
  // Check auth and show dev button if needed
  await setupDevAuth();
  
  // Load and display user data
  await loadUserData();
  
  // Set up event listeners
  setupEventListeners();
});

async function setupDevAuth() {
  const authCheck = await chrome.storage.sync.get(['authToken']);
  const devBtn = document.getElementById('devAuthBtn');
  
  if (!authCheck.authToken && devBtn) {
    devBtn.style.display = 'block';
    devBtn.addEventListener('click', async () => {
      devBtn.disabled = true;
      devBtn.textContent = '⏳ Authenticating...';
      
      try {
        const response = await fetch('http://localhost:8000/api/auth/test-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        
        if (data.access_token) {
          // Store the token
          await chrome.storage.sync.set({
            authToken: data.access_token,
            user: data.user
          });
          
          await chrome.storage.local.set({
            isAuthenticated: true,
            authToken: data.access_token,
            user: data.user
          });
          
          // Update service worker
          chrome.runtime.sendMessage({
            action: 'updateAuth',
            token: data.access_token,
            user: data.user
          });
          
          devBtn.textContent = '✅ Authenticated!';
          setTimeout(() => window.location.reload(), 1000);
        }
      } catch (error) {
        console.error('Auth failed:', error);
        devBtn.textContent = '❌ Failed - Is backend running?';
        devBtn.disabled = false;
      }
    });
  }
}

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
  
  // Basic tier upgrade button
  document.getElementById('upgradeBasicBtn')?.addEventListener('click', async () => {
    const result = await chrome.storage.local.get(['authToken']);
    if (result.authToken) {
      // Create checkout session with Basic price
      chrome.runtime.sendMessage({
        action: 'open_checkout',
        priceId: 'price_1Rs5yHQaJlv206wSslm2yAQT' // Basic tier ($5/month)
      }, (response) => {
        if (response?.error) {
          console.error('Basic checkout error:', response.error);
          showStatus('Failed to open checkout: ' + response.error, 'error');
        }
      });
    } else {
      showLoginUI();
    }
  });
  
  // Advanced tier upgrade button
  document.getElementById('upgradeAdvancedBtn')?.addEventListener('click', async () => {
    const result = await chrome.storage.local.get(['authToken']);
    if (result.authToken) {
      // Create checkout session with Advanced price
      chrome.runtime.sendMessage({
        action: 'open_checkout',
        priceId: 'price_1Rs5yIQaJlv206wSfUp4nf4u' // Advanced tier ($20/month)
      }, (response) => {
        if (response?.error) {
          console.error('Advanced checkout error:', response.error);
          showStatus('Failed to open checkout: ' + response.error, 'error');
        }
      });
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
  const editBtn = document.getElementById('editWeightsBtn');
  
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
  
  // Show edit button
  if (editBtn) {
    editBtn.style.display = 'block';
    editBtn.addEventListener('click', () => showWeightsEditor(resumeData));
  }
  
  // Update button text to indicate resume is uploaded
  document.getElementById('uploadBtnText').textContent = 'Update Resume';
}

// Show the weights editor with current search elements
async function showWeightsEditor(resumeData) {
  const editor = document.getElementById('weightsEditor');
  const editBtn = document.getElementById('editWeightsBtn');
  
  if (!editor) return;
  
  // Toggle visibility
  if (editor.style.display === 'block') {
    editor.style.display = 'none';
    editBtn.textContent = 'Edit Matching Weights';
    return;
  }
  
  editor.style.display = 'block';
  editBtn.textContent = 'Hide Editor';
  
  // Load current search elements
  const result = await chrome.storage.local.get(['searchElements']);
  const searchElements = result.searchElements || [];
  
  // Display current elements
  displaySearchElements(searchElements);
  
  // Set up event listeners
  setupWeightsEditorListeners(searchElements);
}

// Display search elements in the editor
function displaySearchElements(searchElements) {
  const container = document.getElementById('searchElementsList');
  const bulkActions = document.getElementById('bulkActions');
  if (!container) return;
  
  // Show bulk actions if there are elements
  if (bulkActions) {
    bulkActions.style.display = searchElements.length > 0 ? 'flex' : 'none';
  }
  
  // Group by category
  const grouped = {};
  searchElements.forEach(element => {
    const category = element.category || 'keywords';
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(element);
  });
  
  // Build HTML
  let html = '';
  Object.entries(grouped).forEach(([category, elements]) => {
    html += `
      <div class="weight-category-group">
        <div class="weight-category-header">${category.toUpperCase()}</div>
    `;
    
    elements.forEach((element, index) => {
      const uniqueId = `${category}-${index}`;
      html += `
        <div class="weight-item" data-id="${uniqueId}">
          <input type="checkbox" class="weight-item-checkbox" data-id="${uniqueId}">
          <div class="weight-item-info">
            <input type="text" class="weight-item-label editable-label" 
                   value="${element.display || element.value}" 
                   data-original="${element.value}">
            <span class="weight-item-category">${category}</span>
          </div>
          <div class="weight-item-controls">
            <input type="range" class="weight-slider" 
                   min="0" max="50" value="${element.weight}"
                   data-id="${uniqueId}">
            <input type="number" class="weight-input" 
                   min="0" max="50" value="${element.weight}"
                   data-id="${uniqueId}">
            <button class="delete-btn" data-id="${uniqueId}">✕</button>
          </div>
        </div>
      `;
    });
    
    html += '</div>';
  });
  
  container.innerHTML = html;
  
  // Add change listeners for sliders and inputs
  container.querySelectorAll('.weight-slider').forEach(slider => {
    slider.addEventListener('input', (e) => {
      const id = e.target.dataset.id;
      const value = e.target.value;
      const input = container.querySelector(`.weight-input[data-id="${id}"]`);
      if (input) input.value = value;
    });
  });
  
  container.querySelectorAll('.weight-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const id = e.target.dataset.id;
      const value = e.target.value;
      const slider = container.querySelector(`.weight-slider[data-id="${id}"]`);
      if (slider) slider.value = value;
    });
  });
  
  // Add delete listeners
  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const item = e.target.closest('.weight-item');
      if (item && confirm('Remove this criteria?')) {
        item.remove();
        updateBulkDeleteVisibility();
      }
    });
  });
  
  // Add checkbox listeners
  container.querySelectorAll('.weight-item-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const item = e.target.closest('.weight-item');
      if (item) {
        item.classList.toggle('selected', e.target.checked);
      }
      updateBulkDeleteVisibility();
      updateSelectAllCheckbox();
    });
  });
  
  // Setup bulk operations
  setupBulkOperations();
}

// Set up event listeners for the weights editor
function setupWeightsEditorListeners(originalElements) {
  // Add new criteria
  document.getElementById('addCriteriaBtn')?.addEventListener('click', () => {
    const input = document.getElementById('newCriteriaInput');
    const weight = document.getElementById('newCriteriaWeight');
    
    if (!input.value.trim()) return;
    
    // Always use 'keyword' as the category for user-added items
    const category = 'keyword';
    
    // Add to the list
    const container = document.getElementById('searchElementsList');
    
    const newId = `${category}-${Date.now()}`;
    const newItem = document.createElement('div');
    newItem.className = 'weight-item';
    newItem.dataset.id = newId;
    newItem.innerHTML = `
      <input type="checkbox" class="weight-item-checkbox" data-id="${newId}">
      <div class="weight-item-info">
        <input type="text" class="weight-item-label editable-label" 
               value="${input.value}">
        <span class="weight-item-category">keyword</span>
      </div>
      <div class="weight-item-controls">
        <input type="range" class="weight-slider" 
               min="0" max="50" value="${weight.value}"
               data-id="${newId}">
        <input type="number" class="weight-input" 
               min="0" max="50" value="${weight.value}"
               data-id="${newId}">
        <button class="delete-btn" data-id="${newId}">✕</button>
      </div>
    `;
    
    // Add to appropriate category or create new one
    if (categoryGroup) {
      categoryGroup.appendChild(newItem);
    } else {
      const newGroup = document.createElement('div');
      newGroup.className = 'weight-category-group';
      newGroup.innerHTML = `<div class="weight-category-header">${category.value.toUpperCase()}</div>`;
      newGroup.appendChild(newItem);
      container.appendChild(newGroup);
    }
    
    // Clear input
    input.value = '';
    
    // Reattach listeners
    attachItemListeners(newItem);
  });
  
  // Save changes
  document.getElementById('saveWeightsBtn')?.addEventListener('click', async () => {
    const newElements = [];
    
    document.querySelectorAll('.weight-item').forEach(item => {
      const label = item.querySelector('.editable-label').value;
      const category = item.querySelector('.weight-item-category').textContent;
      const weight = parseInt(item.querySelector('.weight-input').value);
      
      if (label && weight >= 0) {
        newElements.push({
          value: label.toLowerCase(),
          display: label,
          weight: weight,
          category: category
        });
      }
    });
    
    // Save to storage
    await chrome.storage.local.set({ searchElements: newElements });
    
    // Notify content scripts
    notifyContentScripts(newElements);
    
    // Show success
    showStatus('Matching criteria saved!', 'success');
    
    // Hide editor
    document.getElementById('weightsEditor').style.display = 'none';
    document.getElementById('editWeightsBtn').textContent = 'Edit Matching Weights';
  });
  
  // Cancel
  document.getElementById('cancelWeightsBtn')?.addEventListener('click', () => {
    document.getElementById('weightsEditor').style.display = 'none';
    document.getElementById('editWeightsBtn').textContent = 'Edit Matching Weights';
  });
  
  // Reset to defaults
  document.getElementById('resetDefaultsBtn')?.addEventListener('click', async () => {
    const result = await chrome.storage.local.get(['resumeData']);
    if (result.resumeData?.search_elements) {
      displaySearchElements(result.resumeData.search_elements);
      showStatus('Reset to resume defaults', 'success');
    }
  });
}

// Attach listeners to individual items
function attachItemListeners(item) {
  const slider = item.querySelector('.weight-slider');
  const input = item.querySelector('.weight-input');
  const deleteBtn = item.querySelector('.delete-btn');
  const checkbox = item.querySelector('.weight-item-checkbox');
  
  if (slider && input) {
    slider.addEventListener('input', (e) => {
      input.value = e.target.value;
    });
    
    input.addEventListener('input', (e) => {
      slider.value = e.target.value;
    });
  }
  
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      if (confirm('Remove this criteria?')) {
        item.remove();
        updateBulkDeleteVisibility();
      }
    });
  }
  
  if (checkbox) {
    checkbox.addEventListener('change', (e) => {
      item.classList.toggle('selected', e.target.checked);
      updateBulkDeleteVisibility();
      updateSelectAllCheckbox();
    });
  }
}

// Setup bulk operations
function setupBulkOperations() {
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');
  
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', (e) => {
      const checkboxes = document.querySelectorAll('.weight-item-checkbox');
      checkboxes.forEach(checkbox => {
        checkbox.checked = e.target.checked;
        const item = checkbox.closest('.weight-item');
        if (item) {
          item.classList.toggle('selected', e.target.checked);
        }
      });
      updateBulkDeleteVisibility();
    });
  }
  
  if (bulkDeleteBtn) {
    bulkDeleteBtn.addEventListener('click', () => {
      const selectedItems = document.querySelectorAll('.weight-item.selected');
      if (selectedItems.length > 0) {
        const count = selectedItems.length;
        if (confirm(`Delete ${count} selected criteria?`)) {
          selectedItems.forEach(item => item.remove());
          updateBulkDeleteVisibility();
          updateSelectAllCheckbox();
        }
      }
    });
  }
  
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      const allItems = document.querySelectorAll('.weight-item');
      if (allItems.length > 0) {
        if (confirm(`Clear all ${allItems.length} criteria? This cannot be undone.`)) {
          allItems.forEach(item => item.remove());
          updateBulkDeleteVisibility();
          updateSelectAllCheckbox();
          // Hide bulk actions when no items left
          const bulkActions = document.getElementById('bulkActions');
          if (bulkActions) {
            bulkActions.style.display = 'none';
          }
        }
      }
    });
  }
}

// Update bulk delete button visibility
function updateBulkDeleteVisibility() {
  const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
  const selectedItems = document.querySelectorAll('.weight-item.selected');
  if (bulkDeleteBtn) {
    bulkDeleteBtn.classList.toggle('show', selectedItems.length > 0);
    if (selectedItems.length > 0) {
      bulkDeleteBtn.textContent = `Delete Selected (${selectedItems.length})`;
    }
  }
}

// Update select all checkbox state
function updateSelectAllCheckbox() {
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  if (selectAllCheckbox) {
    const allCheckboxes = document.querySelectorAll('.weight-item-checkbox');
    const checkedCheckboxes = document.querySelectorAll('.weight-item-checkbox:checked');
    selectAllCheckbox.checked = allCheckboxes.length > 0 && allCheckboxes.length === checkedCheckboxes.length;
    selectAllCheckbox.indeterminate = checkedCheckboxes.length > 0 && checkedCheckboxes.length < allCheckboxes.length;
  }
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