/**
 * Frontend UI Display Tests for NetworkIQ
 * Validates that profile data is correctly displayed without [object Object], null, or undefined
 */

// Test data matching real profiles from test_real_profiles.py
const TEST_PROFILES = [
    {
        name: "Meghana R. - Anthropic GTM",
        profile: {
            name: "Meghana R.",
            company: "Anthropic",
            title: "GTM @ Anthropic",
            education: "Stanford University",
            location: "San Francisco Bay Area",
            about: "",
            text: "meghana r. 2nd degree connection gtm @ anthropic stanford university san francisco bay area"
        },
        scoreData: {
            score: 75,
            tier: "high",
            matches: [
                {
                    category: "education",
                    found_in_profile: "Stanford University",
                    matches_element: "Stanford University",
                    points: 45,
                    confidence: 0.8,
                    reasoning: "Clear match with Stanford University"
                },
                {
                    category: "location",
                    found_in_profile: "San Francisco Bay Area",
                    matches_element: "Bay Area, CA",
                    points: 30,
                    confidence: 0.7,
                    reasoning: "Location match in Bay Area"
                }
            ],
            insights: ["Strong educational background at Stanford"],
            hidden_connections: [],
            recommendation: "Connect based on Stanford connection and Bay Area location"
        }
    },
    {
        name: "NULL Values Test Profile",
        profile: {
            name: "David Kim",
            company: null,  // NULL company
            title: "Consultant",
            education: "",  // Empty education
            location: "Remote",
            about: undefined,  // Undefined about
            text: "david kim consultant remote"
        },
        scoreData: {
            score: 0,
            tier: "low",
            matches: [],  // Empty matches array
            insights: [],
            hidden_connections: null,  // NULL connections
            recommendation: ""
        }
    },
    {
        name: "[object Object] Test Case",
        profile: {
            name: "Test User",
            company: { name: "Company" },  // Object instead of string
            title: ["Senior", "Engineer"],  // Array instead of string
            education: { school: "MIT" },  // Object instead of string
            location: "Boston",
            about: {},  // Empty object
            text: "test user boston"
        },
        scoreData: {
            score: 15,
            tier: "low",
            matches: [
                {
                    category: "skill",
                    found_in_profile: { text: "JavaScript" },  // Object in found_in_profile
                    matches_element: ["JS", "JavaScript"],  // Array in matches_element
                    points: 15,
                    confidence: 0.5
                }
            ],
            insights: [null, undefined, "Valid insight"],  // Mixed null/undefined
            hidden_connections: {},  // Empty object instead of array
            recommendation: null
        }
    }
];

class UIDisplayTester {
    constructor() {
        this.results = [];
        this.errors = [];
    }

    /**
     * Test that values are properly formatted for display
     */
    testValueFormatting(value, fieldName) {
        const issues = [];
        
        // Check for [object Object]
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            const stringified = String(value);
            if (stringified === '[object Object]') {
                issues.push(`${fieldName} displays as [object Object]`);
            }
        }
        
        // Check for null/undefined
        if (value === null || value === undefined) {
            issues.push(`${fieldName} is ${value}`);
        }
        
        // Check for empty strings that should have defaults
        if (value === "" && ['company', 'title', 'education'].includes(fieldName)) {
            issues.push(`${fieldName} is empty string without default`);
        }
        
        return issues;
    }

    /**
     * Simulate the formatters used in the UI
     */
    formatForDisplay(value, fieldName) {
        // Simulate UI formatting logic from ui.js
        if (value === null || value === undefined) {
            return this.getDefaultValue(fieldName);
        }
        
        if (typeof value === 'object') {
            if (Array.isArray(value)) {
                // Arrays should be joined or use first element
                return value.filter(v => v != null).join(', ') || this.getDefaultValue(fieldName);
            } else {
                // Objects need special handling
                if (value.text) return value.text;
                if (value.display) return value.display;
                if (value.value) return value.value;
                if (value.name) return value.name;
                if (value.school) return value.school;
                
                // Fallback to prevent [object Object]
                return this.getDefaultValue(fieldName);
            }
        }
        
        if (value === "") {
            return this.getDefaultValue(fieldName);
        }
        
        return String(value);
    }

    getDefaultValue(fieldName) {
        // Default values that should be displayed instead of null/undefined/empty
        const defaults = {
            company: "Not specified",
            title: "Professional",
            education: "Not specified",
            location: "Not specified",
            about: "",
            name: "LinkedIn User",
            recommendation: "No specific recommendation available",
            insights: []
        };
        return defaults[fieldName] || "";
    }

    /**
     * Test score badge display
     */
    testScoreBadge(scoreData) {
        const issues = [];
        
        // Test score display
        if (typeof scoreData.score !== 'number') {
            issues.push(`Score is not a number: ${typeof scoreData.score}`);
        }
        
        // Test tier display
        if (!['high', 'medium', 'low'].includes(scoreData.tier)) {
            issues.push(`Invalid tier: ${scoreData.tier}`);
        }
        
        // Test tier color class
        const tierColors = {
            high: 'niq-tier-high',
            medium: 'niq-tier-medium',
            low: 'niq-tier-low'
        };
        const expectedClass = tierColors[scoreData.tier];
        if (!expectedClass) {
            issues.push(`No color class for tier: ${scoreData.tier}`);
        }
        
        return issues;
    }

    /**
     * Test matches display in sidebar
     */
    testMatchesDisplay(matches) {
        const issues = [];
        
        if (!Array.isArray(matches)) {
            issues.push(`Matches is not an array: ${typeof matches}`);
            return issues;
        }
        
        matches.forEach((match, index) => {
            // Check category
            if (!match.category) {
                issues.push(`Match ${index} missing category`);
            }
            
            // Check matches_element display
            const elementDisplay = this.formatForDisplay(match.matches_element, 'matches_element');
            if (elementDisplay.includes('[object Object]')) {
                issues.push(`Match ${index} element displays as [object Object]`);
            }
            
            // Check found_in_profile display
            const foundDisplay = this.formatForDisplay(match.found_in_profile, 'found_in_profile');
            if (foundDisplay.includes('[object Object]')) {
                issues.push(`Match ${index} found_in_profile displays as [object Object]`);
            }
            
            // Check points is a number
            if (typeof match.points !== 'number') {
                issues.push(`Match ${index} points is not a number`);
            }
            
            // Check confidence is a number
            if (typeof match.confidence !== 'number') {
                issues.push(`Match ${index} confidence is not a number`);
            }
        });
        
        return issues;
    }

    /**
     * Test insights display
     */
    testInsightsDisplay(insights) {
        const issues = [];
        
        // Handle various insight formats
        const processedInsights = this.processInsights(insights);
        
        processedInsights.forEach((insight, index) => {
            if (!insight || insight === 'null' || insight === 'undefined') {
                issues.push(`Insight ${index} is invalid: ${insight}`);
            }
        });
        
        return issues;
    }

    processInsights(insights) {
        if (!insights) return [];
        if (!Array.isArray(insights)) {
            if (typeof insights === 'object') return [];
            return [String(insights)];
        }
        
        return insights
            .filter(i => i != null && i !== "")
            .map(i => String(i));
    }

    /**
     * Test message generation display
     */
    testMessageDisplay(scoreData, profile) {
        const issues = [];
        
        // Simulate message generation
        const message = this.generateTestMessage(profile, scoreData);
        
        // Check for [object Object] in message
        if (message.includes('[object Object]')) {
            issues.push('Generated message contains [object Object]');
        }
        
        // Check for null/undefined in message
        if (message.includes('null') || message.includes('undefined')) {
            issues.push('Generated message contains null or undefined');
        }
        
        return issues;
    }

    generateTestMessage(profile, scoreData) {
        const name = this.formatForDisplay(profile.name, 'name').split(' ')[0] || 'there';
        const company = this.formatForDisplay(profile.company, 'company');
        const matches = scoreData.matches || [];
        
        if (matches.length > 0) {
            const connection = this.formatForDisplay(matches[0].matches_element, 'connection');
            return `Hi ${name}, I noticed we share ${connection}. Would love to connect!`;
        } else {
            return `Hi ${name}, I'd like to connect and learn about your work at ${company}.`;
        }
    }

    /**
     * Run all tests for a profile
     */
    testProfile(testCase) {
        console.log(`\nTesting: ${testCase.name}`);
        console.log('='.repeat(50));
        
        const profileIssues = [];
        const { profile, scoreData } = testCase;
        
        // Test profile fields
        ['name', 'company', 'title', 'education', 'location', 'about'].forEach(field => {
            const issues = this.testValueFormatting(profile[field], field);
            if (issues.length > 0) {
                profileIssues.push(...issues);
            }
            
            const formatted = this.formatForDisplay(profile[field], field);
            console.log(`  ${field}: "${formatted}"`);
        });
        
        // Test score badge
        const badgeIssues = this.testScoreBadge(scoreData);
        if (badgeIssues.length > 0) {
            profileIssues.push(...badgeIssues);
        }
        
        // Test matches display
        const matchIssues = this.testMatchesDisplay(scoreData.matches);
        if (matchIssues.length > 0) {
            profileIssues.push(...matchIssues);
        }
        
        // Test insights
        const insightIssues = this.testInsightsDisplay(scoreData.insights);
        if (insightIssues.length > 0) {
            profileIssues.push(...insightIssues);
        }
        
        // Test message generation
        const messageIssues = this.testMessageDisplay(scoreData, profile);
        if (messageIssues.length > 0) {
            profileIssues.push(...messageIssues);
        }
        
        // Report results
        if (profileIssues.length === 0) {
            console.log('  ✅ All UI displays correctly');
            this.results.push({ profile: testCase.name, passed: true });
        } else {
            console.log('  ❌ UI display issues found:');
            profileIssues.forEach(issue => {
                console.log(`    - ${issue}`);
                this.errors.push({ profile: testCase.name, issue });
            });
            this.results.push({ profile: testCase.name, passed: false, issues: profileIssues });
        }
        
        return profileIssues.length === 0;
    }

    /**
     * Run all tests
     */
    runAllTests() {
        console.log('\n' + '='.repeat(60));
        console.log('FRONTEND UI DISPLAY TESTS');
        console.log('='.repeat(60));
        
        let passed = 0;
        let failed = 0;
        
        TEST_PROFILES.forEach(testCase => {
            if (this.testProfile(testCase)) {
                passed++;
            } else {
                failed++;
            }
        });
        
        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('TEST SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total Tests: ${TEST_PROFILES.length}`);
        console.log(`Passed: ${passed} ✅`);
        console.log(`Failed: ${failed} ❌`);
        
        if (this.errors.length > 0) {
            console.log('\nCommon Issues:');
            const issueCounts = {};
            this.errors.forEach(error => {
                const key = error.issue.split(':')[0];
                issueCounts[key] = (issueCounts[key] || 0) + 1;
            });
            
            Object.entries(issueCounts)
                .sort((a, b) => b[1] - a[1])
                .forEach(([issue, count]) => {
                    console.log(`  - ${issue}: ${count} occurrence(s)`);
                });
        }
        
        return failed === 0;
    }
}

// Run tests if executed directly
if (typeof module !== 'undefined' && require.main === module) {
    const tester = new UIDisplayTester();
    const success = tester.runAllTests();
    process.exit(success ? 0 : 1);
}

// Export for use in other tests
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { UIDisplayTester, TEST_PROFILES };
}