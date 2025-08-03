// Run this in the Console on the LinkedIn search page to debug

console.log('=== Debugging LinkedIn Search Page Selectors ===');

// Test all our selectors
const selectors = [
  '.entity-result__item',
  '.reusable-search__result-container',
  'li[class*="reusable-search__result-container"]',
  'div[data-chameleon-result-urn]',
  '[data-view-name="search-entity-result-universal-template"]',
  '.search-results__list > li',
  '.pv-search-results-list > li'
];

selectors.forEach(selector => {
  const elements = document.querySelectorAll(selector);
  if (elements.length > 0) {
    console.log(`✅ Found ${elements.length} with: ${selector}`);
    console.log('   First element:', elements[0]);
  }
});

// Look for ANY li or div that might be a search result
console.log('\n=== Looking for search result containers ===');
const allLis = document.querySelectorAll('li');
const searchLis = Array.from(allLis).filter(li => {
  const hasProfileLink = li.querySelector('a[href*="/in/"]');
  const hasRelevantClass = li.className && (
    li.className.includes('result') || 
    li.className.includes('search') ||
    li.className.includes('entity')
  );
  return hasProfileLink && hasRelevantClass;
});

console.log(`Found ${searchLis.length} li elements with profile links and search-related classes`);
if (searchLis.length > 0) {
  console.log('First result classes:', searchLis[0].className);
}

// Check the structure around profile links
console.log('\n=== Profile link parents ===');
const profileLink = document.querySelector('a[href*="/in/"]');
if (profileLink) {
  let parent = profileLink;
  for (let i = 0; i < 5; i++) {
    parent = parent.parentElement;
    if (parent) {
      console.log(`Parent ${i+1}:`, parent.tagName, parent.className || '(no class)');
    }
  }
}

// Try to find the main results container
console.log('\n=== Main containers ===');
const containers = [
  document.querySelector('.search-results-container'),
  document.querySelector('[class*="search-results"]'),
  document.querySelector('.scaffold-layout__list'),
  document.querySelector('main ul'),
  document.querySelector('ul[role="list"]')
];

containers.forEach((container, i) => {
  if (container) {
    console.log(`Container ${i+1} found:`, container.tagName, container.className);
    const profileLinks = container.querySelectorAll('a[href*="/in/"]');
    console.log(`  Contains ${profileLinks.length} profile links`);
  }
});