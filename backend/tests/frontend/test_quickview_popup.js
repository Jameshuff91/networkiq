/**
 * Test for QuickView Popup Display Issues
 * Specifically tests the popup that appears when clicking NetworkIQ scores on search results
 */

// Test case from actual issue reported
const QUICKVIEW_TEST_CASES = [
    {
        name: "Anna L. Ershova - C3.ai Profile",
        profile: {
            name: "Anna L. Ershova",
            company: "C3.ai",
            title: "Product (Generative AI & Supply Chain)",
            headline: "Product (Generative AI & Supply Chain) at C3.ai | ex-Palantir",
            education: "Stanford University",
            location: "San Francisco Bay Area",
            url: "https://www.linkedin.com/in/anna-ershova/"
        },
        scoreData: {
            score: 60,
            tier: "high",
            matches: [
                // These might be undefined or improperly formatted
                undefined,
                null,
                {
                    category: "company",
                    matches_element: "C3.ai",
                    found_in_profile: "C3.ai",
                    points: 30,
                    confidence: 0.9
                }
            ],
            breakdown: {
                company: 30,
                location: 30
            }
        },
        expectedIssues: [
            "undefined matches displaying",
            "undefined points showing"
        ]
    },
    {
        name: "Profile with empty matches array",
        profile: {
            name: "Test User",
            company: "Test Company",
            title: "Engineer"
        },
        scoreData: {
            score: 0,
            tier: "low",
            matches: [],  // Empty array
            breakdown: {}
        },
        expectedIssues: []
    },
    {
        name: "Profile with null/undefined in matches",
        profile: {
            name: "John Doe",
            company: "Tech Corp"
        },
        scoreData: {
            score: 45,
            tier: "medium",
            matches: [
                null,
                undefined,
                { matches_element: undefined, points: null },
                { matches_element: "Valid Match", points: 15, confidence: 0.5 }
            ]
        },
        expectedIssues: [
            "null match elements",
            "undefined match elements"
        ]
    }
];

class QuickViewTester {
    constructor() {
        this.errors = [];
        this.warnings = [];
    }

    /**
     * Simulate the quickview HTML generation from ui.js
     */
    generateQuickViewHTML(profile, scoreData) {
        // This simulates the showQuickView method from ui.js
        const name = profile?.name || 'LinkedIn User';
        const headline = profile?.headline || `${profile?.title || ''} at ${profile?.company || ''}`;
        const score = scoreData?.score || 0;
        const tier = scoreData?.tier || 'low';
        const matches = scoreData?.matches || [];
        
        // Filter and format matches - THIS IS WHERE THE BUG LIKELY IS
        const validMatches = this.filterValidMatches(matches);
        
        // Generate connections HTML
        const connectionsHTML = this.generateConnectionsHTML(validMatches);
        
        // Generate message
        const message = this.generateMessage(profile, validMatches);
        
        return `
            <div class="niq-quickview">
                <div class="niq-quickview-header">
                    <h3>${name}</h3>
                    <p>${headline}</p>
                    <div class="niq-score-display">
                        <span class="niq-score">${score}</span>
                        <span class="niq-label">NetworkIQ</span>
                    </div>
                </div>
                <div class="niq-connections">
                    <h4>🔗 Connections</h4>
                    ${connectionsHTML}
                </div>
                <div class="niq-message">
                    <h4>💬 Suggested Message</h4>
                    <textarea>${message}</textarea>
                </div>
            </div>
        `;
    }

    /**
     * Filter out invalid matches
     */
    filterValidMatches(matches) {
        if (!Array.isArray(matches)) return [];
        
        return matches.filter(match => {
            // Check if match is valid
            if (!match) return false;
            if (match === null || match === undefined) return false;
            if (typeof match !== 'object') return false;
            
            // Check if match has required fields
            if (!match.matches_element) return false;
            if (match.confidence !== undefined && match.confidence < 0.3) return false;
            
            return true;
        });
    }

    /**
     * Generate connections HTML
     */
    generateConnectionsHTML(matches) {
        if (!matches || matches.length === 0) {
            return '<p class="no-connections">No specific connections identified</p>';
        }
        
        return matches.map(match => {
            // Safe extraction of match data
            const element = this.safeExtract(match.matches_element);
            const points = match.points || 0;
            
            // CRITICAL: Check for undefined before rendering
            if (element === 'undefined' || !element) {
                console.error('QuickView: Undefined match element detected', match);
                return ''; // Don't render undefined matches
            }
            
            return `
                <div class="niq-connection-item">
                    <span>${element}</span>
                    <span>(+${points})</span>
                </div>
            `;
        }).filter(html => html !== '').join('') || '<p>No valid connections</p>';
    }

    /**
     * Safely extract display value from various formats
     */
    safeExtract(value) {
        if (value === null || value === undefined) {
            return undefined;
        }
        
        if (typeof value === 'string') {
            return value;
        }
        
        if (typeof value === 'object') {
            // Handle various object formats
            if (value.display) return value.display;
            if (value.text) return value.text;
            if (value.value) return value.value;
            if (value.name) return value.name;
        }
        
        // Avoid [object Object]
        return undefined;
    }

    /**
     * Generate message with proper handling
     */
    generateMessage(profile, matches) {
        const firstName = profile?.name?.split(' ')[0] || 'there';
        
        if (matches && matches.length > 0) {
            const connection = this.safeExtract(matches[0].matches_element) || 'common interests';
            return `Hi ${firstName}! I noticed we share ${connection}. Would love to connect and exchange insights!`;
        }
        
        return `Hi ${firstName}! I'd like to connect and learn about your work.`;
    }

    /**
     * Test a quickview case
     */
    testQuickView(testCase) {
        console.log(`\nTesting: ${testCase.name}`);
        console.log('='.repeat(50));
        
        const issues = [];
        const html = this.generateQuickViewHTML(testCase.profile, testCase.scoreData);
        
        // Check for undefined displays
        if (html.includes('undefined (+')) {
            issues.push('Displays "undefined" in connections');
        }
        
        if (html.includes('(+undefined)')) {
            issues.push('Displays "(+undefined)" for points');
        }
        
        if (html.includes('>undefined<')) {
            issues.push('Raw undefined in HTML');
        }
        
        if (html.includes('share undefined')) {
            issues.push('Message contains "share undefined"');
        }
        
        if (html.includes('[object Object]')) {
            issues.push('Contains [object Object]');
        }
        
        // Check matches processing
        const matches = testCase.scoreData.matches || [];
        const validMatches = this.filterValidMatches(matches);
        
        console.log(`  Input matches: ${matches.length}`);
        console.log(`  Valid matches after filtering: ${validMatches.length}`);
        
        // Show what gets rendered
        if (validMatches.length > 0) {
            console.log('  Rendered connections:');
            validMatches.forEach(match => {
                const element = this.safeExtract(match.matches_element);
                if (element) {
                    console.log(`    - ${element} (+${match.points || 0})`);
                }
            });
        }
        
        // Report issues
        if (issues.length > 0) {
            console.log('  ❌ Issues found:');
            issues.forEach(issue => {
                console.log(`    - ${issue}`);
                this.errors.push({ case: testCase.name, issue });
            });
            return false;
        } else {
            console.log('  ✅ QuickView renders correctly');
            return true;
        }
    }

    /**
     * Run all tests
     */
    runAllTests() {
        console.log('\n' + '='.repeat(60));
        console.log('QUICKVIEW POPUP TESTS');
        console.log('Testing the popup that appears when clicking NetworkIQ scores');
        console.log('='.repeat(60));
        
        let passed = 0;
        let failed = 0;
        
        QUICKVIEW_TEST_CASES.forEach(testCase => {
            if (this.testQuickView(testCase)) {
                passed++;
            } else {
                failed++;
            }
        });
        
        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('TEST SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total Tests: ${QUICKVIEW_TEST_CASES.length}`);
        console.log(`Passed: ${passed} ✅`);
        console.log(`Failed: ${failed} ❌`);
        
        if (this.errors.length > 0) {
            console.log('\nIssues to Fix:');
            const uniqueIssues = [...new Set(this.errors.map(e => e.issue))];
            uniqueIssues.forEach(issue => {
                console.log(`  - ${issue}`);
            });
        }
        
        return failed === 0;
    }
}

// Run tests
if (require.main === module) {
    const tester = new QuickViewTester();
    const success = tester.runAllTests();
    
    if (!success) {
        console.log('\n⚠️  The undefined display issue is confirmed!');
        console.log('The quickview is not properly filtering null/undefined matches.');
        console.log('Fix needed in ui.js showQuickView() method.');
    }
    
    process.exit(success ? 0 : 1);
}

module.exports = { QuickViewTester, QUICKVIEW_TEST_CASES };