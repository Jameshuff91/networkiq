// Run these commands in the Chrome DevTools Console on a LinkedIn search page

// 1. Check current URL
console.log('Current URL:', window.location.href);

// 2. Check if extension recognizes it as a search page
console.log('Is search page?', LinkedInParser.isSearchPage());

// 3. Look for search result elements
const selectors = {
    'entity-result__item': document.querySelectorAll('.entity-result__item').length,
    'data-view-name': document.querySelectorAll('[data-view-name="search-entity-result-universal-template"]').length,
    'profile links': document.querySelectorAll('a[href*="/in/"]').length,
    'reusable-search': document.querySelectorAll('.reusable-search__result-container').length
};

console.table(selectors);

// 4. Try to get profiles manually
const profiles = LinkedInParser.getSearchResultProfiles();
console.log('Profiles found:', profiles.length);
if (profiles.length > 0) {
    console.log('First profile:', profiles[0]);
}

// 5. Check if NetworkIQ UI is loaded
console.log('NetworkIQ UI loaded?', typeof NetworkIQUI !== 'undefined');

// 6. Force the scoring to run
if (typeof NetworkIQUI !== 'undefined') {
    console.log('Manually triggering batch scoring...');
    const ui = new NetworkIQUI();
    ui.injectSearchScores();
} else {
    console.log('NetworkIQUI not found - extension may not be loaded properly');
}