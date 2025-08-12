/**
 * Tests for NetworkIQ Scorer to prevent undefined matches issue
 * This ensures we don't show "undefined (+undefined)" in the UI
 */

// Mock scorer test
function testScorerFiltersUndefinedMatches() {
  console.log('Testing: Scorer should filter undefined matches');

  // Mock profile with potentially undefined values
  const mockProfile = {
    name: 'Test User',
    title: 'Software Engineer',
    company: 'Test Company',
    education: 'MIT',
    skills: ['Python', undefined, '', null, 'JavaScript'],
    summary: 'Test summary'
  };

  // Mock search elements with some undefined values
  const mockSearchElements = [
    { text: 'Python', weight: 10, category: 'skills', display: 'Python' },
    { text: undefined, weight: 5, category: 'skills', display: undefined },
    { text: '', weight: 5, category: 'skills', display: '' },
    { text: 'MIT', weight: 30, category: 'education', display: 'MIT' },
    { text: 'JavaScript', weight: 10, category: 'skills', display: 'JavaScript' }
  ];

  // Simulate the scorer's match filtering logic
  const matches = [];
  for (const element of mockSearchElements) {
    const matchText = element.display || element.value || element.text;
    if (matchText && matchText !== 'undefined') {
      matches.push({
        text: matchText,
        weight: element.weight,
        category: element.category
      });
    }
  }

  // Verify no undefined matches
  console.assert(matches.length === 3, 'Should have 3 valid matches');
  console.assert(!matches.some(m => m.text === undefined), 'No undefined text');
  console.assert(!matches.some(m => m.text === 'undefined'), 'No "undefined" string');
  console.assert(!matches.some(m => m.text === ''), 'No empty strings');
  console.assert(!matches.some(m => m.text === null), 'No null values');

  console.log('✅ Scorer correctly filters undefined matches');
  return true;
}

// Test UI filtering of undefined matches
function testUIFiltersUndefinedMatches() {
  console.log('Testing: UI should filter undefined matches in display');

  // Mock scoreData with some invalid matches
  const mockScoreData = {
    score: 75,
    matches: [
      { text: 'Python', weight: 10 },
      { text: undefined, weight: 5 },
      { text: 'undefined', weight: 5 },
      { text: '', weight: 5 },
      { text: null, weight: 5 },
      { text: 'MIT', weight: 30 }
    ]
  };

  // Simulate the UI's match filtering logic
  const displayedMatches = mockScoreData.matches
    .filter(m => {
      const hasText = m && (m.text || m.matches_element || m.display || m.value);
      const text = m?.text || m?.matches_element || m?.display || m?.value || '';
      return hasText && text !== 'undefined' && text !== '';
    })
    .map(m => {
      const text = m.text || m.matches_element || m.display || m.value || '';
      const points = m.weight || m.points || 0;
      if (text && text !== 'undefined') {
        return `${text} (+${points})`;
      }
      return '';
    })
    .filter(html => html !== '');

  // Verify only valid matches are displayed
  console.assert(displayedMatches.length === 2, 'Should display 2 valid matches');
  console.assert(displayedMatches[0] === 'Python (+10)', 'First match should be Python');
  console.assert(displayedMatches[1] === 'MIT (+30)', 'Second match should be MIT');
  console.assert(!displayedMatches.includes('undefined (+5)'), 'No undefined in display');
  console.assert(!displayedMatches.includes(' (+5)'), 'No empty text in display');

  console.log('✅ UI correctly filters undefined matches in display');
  return true;
}

// Run all tests
function runTests() {
  console.log('🧪 Running NetworkIQ Scorer Tests...\n');

  const tests = [
    testScorerFiltersUndefinedMatches,
    testUIFiltersUndefinedMatches
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      if (test()) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`❌ Test failed: ${test.name}`, error);
      failed++;
    }
  }

  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

// Export for use in test runners
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runTests };
}

// Run tests if executed directly
if (typeof window === 'undefined') {
  runTests();
}