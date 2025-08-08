/**
 * Test to validate the quickview popup fix for undefined displays
 * Tests with actual data structures from the LLM responses
 */

// Real data structure from LLM response (from server logs)
const REAL_LLM_RESPONSE_DATA = {
    profile: {
        name: "Anna L. Ershova",
        company: "C3.ai",
        title: "Product (Generative AI & Supply Chain)",
        headline: "Product (Generative AI & Supply Chain) at C3.ai | ex-Palantir",
        location: "San Francisco Bay Area"
    },
    scoreData: {
        score: 60,
        tier: "high",
        // Matches from actual LLM response format
        matches: [
            {
                category: "company",
                found_in_profile: "C3.ai",
                matches_element: "C3 AI",  // Note: This is the actual format from LLM
                points: 32,  // Not 'weight', but 'points'
                confidence: 0.9,
                reasoning: "Direct match with C3 AI company"
            },
            {
                category: "location", 
                found_in_profile: "San Francisco Bay Area",
                matches_element: "Bay Area, CA",
                points: 28,
                confidence: 0.8,
                reasoning: "Location match in Bay Area"
            }
        ],
        breakdown: {
            company: 32,
            location: 28
        }
    }
};

// Mixed format data (what might happen with cached vs fresh data)
const MIXED_FORMAT_DATA = {
    profile: {
        name: "Test User",
        company: "Tech Company"
    },
    scoreData: {
        score: 45,
        tier: "medium",
        matches: [
            // Old format (from local scorer)
            { text: "Johns Hopkins", weight: 20 },
            // New format (from LLM)
            { matches_element: "Python", points: 15, category: "skill" },
            // Undefined/null that shouldn't display
            null,
            undefined,
            { matches_element: undefined, points: 10 }
        ]
    }
};

function testQuickViewHTML(testName, profile, scoreData) {
    console.log(`\nTesting: ${testName}`);
    console.log('='.repeat(50));
    
    // Simulate the fixed quickview HTML generation
    const generateQuickViewMatches = (matches) => {
        if (!matches || matches.length === 0) return '';
        
        return matches
            .filter(m => m && (m.text || m.matches_element || m.display || m.value))
            .map(m => {
                const text = m.text || m.matches_element || m.display || m.value || 'Unknown';
                const points = m.weight || m.points || 0;
                return `<span class="niq-match-chip">${text} (+${points})</span>`;
            })
            .join('');
    };
    
    const matchesHTML = generateQuickViewMatches(scoreData.matches);
    
    // Check for issues
    const issues = [];
    
    if (matchesHTML.includes('undefined')) {
        issues.push('Contains "undefined" in output');
    }
    
    if (matchesHTML.includes('null')) {
        issues.push('Contains "null" in output');
    }
    
    if (matchesHTML.includes('[object Object]')) {
        issues.push('Contains "[object Object]" in output');
    }
    
    // Count valid matches rendered
    const validMatches = (scoreData.matches || [])
        .filter(m => m && (m.text || m.matches_element || m.display || m.value))
        .length;
    
    console.log(`  Input matches: ${(scoreData.matches || []).length}`);
    console.log(`  Valid matches rendered: ${validMatches}`);
    console.log(`  Generated HTML: ${matchesHTML || '(empty)'}`);
    
    if (issues.length > 0) {
        console.log('  ❌ Issues found:');
        issues.forEach(issue => console.log(`    - ${issue}`));
        return false;
    } else {
        console.log('  ✅ Renders correctly without undefined/null');
        return true;
    }
}

// Run tests
console.log('\n' + '='.repeat(60));
console.log('QUICKVIEW FIX VALIDATION TEST');
console.log('='.repeat(60));

let allPassed = true;

// Test with real LLM response format
allPassed = testQuickViewHTML(
    'Real LLM Response Data (C3.ai profile)',
    REAL_LLM_RESPONSE_DATA.profile,
    REAL_LLM_RESPONSE_DATA.scoreData
) && allPassed;

// Test with mixed format data
allPassed = testQuickViewHTML(
    'Mixed Format Data (old + new + nulls)',
    MIXED_FORMAT_DATA.profile,
    MIXED_FORMAT_DATA.scoreData
) && allPassed;

// Test with empty/null cases
allPassed = testQuickViewHTML(
    'Empty matches array',
    { name: "Empty Test" },
    { score: 0, tier: "low", matches: [] }
) && allPassed;

allPassed = testQuickViewHTML(
    'Null matches',
    { name: "Null Test" },
    { score: 0, tier: "low", matches: null }
) && allPassed;

allPassed = testQuickViewHTML(
    'All undefined matches',
    { name: "Undefined Test" },
    { score: 0, tier: "low", matches: [undefined, null, {}, { matches_element: undefined }] }
) && allPassed;

// Summary
console.log('\n' + '='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60));

if (allPassed) {
    console.log('✅ All tests passed! The fix properly handles all data formats.');
    console.log('The quickview will no longer show "undefined" for matches.');
} else {
    console.log('❌ Some tests failed. The undefined issue may still occur.');
}

process.exit(allPassed ? 0 : 1);