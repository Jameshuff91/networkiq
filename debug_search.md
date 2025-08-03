# Debugging NetworkIQ Batch Scoring on Search Pages

## Quick Steps to Test:

1. **Make sure the extension is properly reloaded:**
   - Go to chrome://extensions/
   - Find NetworkIQ extension
   - Click the refresh/reload icon
   - Make sure "Developer mode" is ON

2. **Navigate to the correct LinkedIn search URL:**
   - Go to: https://www.linkedin.com/search/results/people/
   - Or search for a company like: https://www.linkedin.com/search/results/people/?keywords=anthropic

3. **Check the Chrome Console:**
   - Right-click on the LinkedIn search page
   - Select "Inspect" 
   - Go to the "Console" tab
   - Look for messages starting with "NetworkIQ:"
   - You should see:
     - "NetworkIQ: Starting batch scoring for search results..."
     - "NetworkIQ: Found X profiles to score"

4. **What you should see:**
   - A summary bar at the top of search results with NetworkIQ logo
   - Score badges next to each person's name
   - Sort, Filter, and Export buttons in the summary bar

## Troubleshooting:

### If you don't see anything:
1. The extension might not be detecting the search page correctly
2. Try refreshing the LinkedIn page (F5)
3. Make sure you're on the "People" tab in LinkedIn search

### To check if the code is loading:
Open Chrome DevTools Console and type:
```javascript
// Check if parser is detecting search page
LinkedInParser.isSearchPage()

// Check if profiles are found
LinkedInParser.getSearchResultProfiles()

// Check if UI is initialized
window.NetworkIQUI
```

### Manual trigger (if needed):
In the Console, you can manually trigger the scoring:
```javascript
// Force the batch scoring to run
new NetworkIQUI().injectSearchScores()
```

## URLs that should work:
- https://www.linkedin.com/search/results/people/?keywords=google
- https://www.linkedin.com/search/results/people/?keywords=anthropic
- https://www.linkedin.com/search/results/people/?network=%5B%22F%22%5D

## What might be blocking it:
1. LinkedIn's DOM structure might have changed
2. The extension needs a page refresh after loading
3. You might need to scroll down to trigger loading of results