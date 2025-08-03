# Testing Resume Upload Feature

## Prerequisites
1. Backend server running at http://localhost:8000
2. Chrome browser with developer mode enabled
3. Test resume files (PDF, DOCX, or TXT)

## Setup Instructions

### 1. Load the Extension in Chrome
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `extension/` directory
5. The NetworkIQ extension should appear in your extensions

### 2. Test the Resume Upload Flow

#### A. Test Mode (No Backend Required)
1. Click the NetworkIQ extension icon in Chrome toolbar
2. Click "Try Test Mode" button
3. The popup should reload showing the main interface
4. Click "Choose Resume File" button
5. Select a test resume (PDF, DOCX, or TXT)
6. Verify upload status message appears

#### B. Full Backend Test
1. Create a test account:
   ```bash
   curl -X POST http://localhost:8000/api/auth/signup \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com", "password": "test123"}'
   ```

2. Click the NetworkIQ extension icon
3. Login with test@example.com / test123
4. Click "Choose Resume File" button
5. Select a test resume file
6. Watch for:
   - "Uploading and analyzing resume..." status
   - Success message
   - Resume summary display showing:
     - Companies found
     - Education institutions
     - Military status (if applicable)
     - Skills count
     - Match criteria count

### 3. Test Scoring with Uploaded Resume

1. Navigate to any LinkedIn profile: https://www.linkedin.com/in/[username]
2. Wait for the page to load
3. Look for the NetworkIQ score badge (should appear near the profile name)
4. The score should be based on your uploaded resume's matching criteria
5. Click "Score Current Profile" in the extension popup to force a rescore

## Test Cases

### Positive Tests
- [x] Upload PDF resume
- [x] Upload DOCX resume
- [x] Upload TXT resume
- [x] View resume summary after upload
- [x] Score profiles based on resume data
- [x] Update resume (upload new file)

### Negative Tests
- [x] Upload invalid file type (should show error)
- [x] Upload file > 5MB (should show error)
- [x] Upload without login (should prompt login)
- [x] Upload corrupted file (should show error)

## Verification Points

### Resume Upload Success
- Status shows "Resume uploaded successfully!"
- Button text changes to "Update Resume"
- Resume summary appears with extracted data
- Data is stored in chrome.storage.local

### Dynamic Scoring
- Profiles are scored based on resume elements
- Scores range from 0-100
- Matches display shows relevant connections
- Different resumes produce different scores

## Sample Test Resumes

### Military-focused Resume
Should extract:
- Military service branch
- Academy (USAFA, West Point, etc.)
- Companies worked at
- Technical skills

### Tech-focused Resume
Should extract:
- Tech companies (Google, Microsoft, etc.)
- Programming languages
- Frameworks and tools
- Certifications

### Business-focused Resume
Should extract:
- Business schools (MBA programs)
- Fortune 500 companies
- Management experience
- Industry keywords

## Troubleshooting

### Backend Connection Issues
1. Check backend is running: `curl http://localhost:8000/docs`
2. Check console for CORS errors
3. Verify API_BASE_URL in popup.js is correct

### Upload Failures
1. Check browser console for errors (F12)
2. Verify file size < 5MB
3. Check file format is supported
4. Ensure you're logged in

### Scoring Issues
1. Check chrome.storage.local has resumeData
2. Verify search_elements array is populated
3. Check scorer.js is loading search elements
4. Look for console errors in LinkedIn tab

## Debug Commands

```javascript
// In Chrome DevTools Console (extension popup)
chrome.storage.local.get(['resumeData', 'searchElements'], console.log);

// Check auth status
chrome.storage.local.get(['authToken', 'user'], console.log);

// Clear all data (reset)
chrome.storage.local.clear();
```

## API Endpoints

- POST `/api/resume/upload` - Upload and parse resume
- GET `/api/auth/user` - Get user info with resume data
- POST `/api/profiles/score` - Score profile with resume matching

## Expected Backend Response

```json
{
  "success": true,
  "message": "Resume uploaded and parsed successfully",
  "data": {
    "companies": ["C3 AI", "Google"],
    "skills": 15,
    "education": [
      {"institution": "stanford university", "type": "university"}
    ],
    "military": true,
    "search_elements": 25
  }
}
```