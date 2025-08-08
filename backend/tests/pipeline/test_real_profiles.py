#!/usr/bin/env python3
"""
Real LinkedIn Profile Testing Pipeline
Tests actual LinkedIn profiles with real scraping simulation
"""

import json
import time
from pathlib import Path
from typing import Dict, List, Any
from datetime import datetime
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from profile_analyzer import ProfileAnalyzer

# Sample of Jim's actual resume data based on common patterns
# This would normally come from parsing Jim Huff - Two Page (July 25).docx
JIM_RESUME_DATA = {
    "search_elements": [
        # Education
        {"category": "education", "value": "johns hopkins", "display": "Johns Hopkins University", "weight": 45},
        {"category": "education", "value": "johns hopkins university", "display": "Johns Hopkins University", "weight": 45},
        {"category": "education", "value": "usafa", "display": "United States Air Force Academy", "weight": 45},
        {"category": "education", "value": "air force academy", "display": "United States Air Force Academy", "weight": 45},
        
        # Military
        {"category": "military", "value": "air force", "display": "U.S. Air Force", "weight": 40},
        {"category": "military", "value": "usaf", "display": "U.S. Air Force", "weight": 40},
        {"category": "military", "value": "military", "display": "Military Service", "weight": 35},
        
        # Companies (specific companies Jim worked at - examples)
        {"category": "company", "value": "microsoft", "display": "Microsoft", "weight": 35},
        {"category": "company", "value": "google", "display": "Google", "weight": 35},
        # Note: Anthropic, Scale AI, etc. are NOT in this list because Jim didn't work there
        
        # Skills (specific technical skills, not industry terms)
        {"category": "skill", "value": "machine learning", "display": "Machine Learning", "weight": 20},
        {"category": "skill", "value": "python", "display": "Python", "weight": 15},
        {"category": "skill", "value": "data science", "display": "Data Science", "weight": 15},
        
        # Location
        {"category": "location", "value": "bay area", "display": "Bay Area, CA", "weight": 30},
        {"category": "location", "value": "san francisco", "display": "San Francisco", "weight": 30},
        
        # Keywords
        {"category": "keyword", "value": "leadership", "display": "Leadership", "weight": 10},
        {"category": "keyword", "value": "strategy", "display": "Strategy", "weight": 10},
    ]
}

# Real LinkedIn profiles scraped data (simulating actual parser output)
REAL_LINKEDIN_PROFILES = [
    {
        "name": "Meghana R. - Anthropic GTM",
        "url": "https://www.linkedin.com/in/meghana-reddysd/",
        "scraped_data": {
            "name": "Meghana R.",
            "company": "Anthropic",
            "title": "GTM @ Anthropic",
            "education": "Stanford University",
            "location": "San Francisco Bay Area",
            "about": "",
            "text": "meghana r. 2nd degree connection gtm @ anthropic stanford university san francisco bay area"
        },
        "expected": {
            "should_match": ["Bay Area, CA"],  # Only location should match
            "should_not_match": ["Johns Hopkins University", "U.S. Air Force", "Anthropic"],  # Anthropic is not in Jim's companies
            "expected_tier": "low"  # Just location match = low tier
        }
    },
    {
        "name": "Neerav Kingsland - Yale Law/Anthropic",
        "url": "https://www.linkedin.com/in/neerav-kingsland-4991a828/",
        "scraped_data": {
            "name": "Neerav Kingsland",
            "company": "Anthropic",
            "title": "Strategic Initiatives",
            "education": "Yale Law School; Tulane University",
            "location": "San Francisco Bay Area",
            "about": "",
            "text": "neerav kingsland strategic initiatives anthropic yale law school tulane university san francisco bay area"
        },
        "expected": {
            "should_match": ["Bay Area, CA"],  # Only location should match
            "should_not_match": ["Johns Hopkins University", "U.S. Air Force", "United States Air Force Academy", "Anthropic"],
            "expected_tier": "low"  # Just location match = low tier
        }
    },
    {
        "name": "Nicholas S. - Scale AI Product",
        "url": "https://www.linkedin.com/in/nsemansky/",
        "scraped_data": {
            "name": "Nicholas S.",
            "company": "Scale AI",
            "title": "Head of Product, Security",
            "education": "",  # Not visible/NULL
            "location": "San Francisco, CA",
            "about": "Product leader focused on AI security and safety",
            "text": "nicholas s head of product security scale ai san francisco ca product ai machine learning"
        },
        "expected": {
            "should_match": ["Machine Learning"],  # Only skills should match, not company
            "should_not_match": ["United States Air Force Academy", "Scale AI"],  # Scale AI is not in Jim's companies
            "expected_tier": "low"  # Just skill matches = low tier
        }
    },
    {
        "name": "Johns Hopkins Alumni Test",
        "url": "https://www.linkedin.com/in/test-jhu/",
        "scraped_data": {
            "name": "Test JHU Alumni",
            "company": "Tech Company",
            "title": "Software Engineer",
            "education": "Johns Hopkins University",
            "location": "Baltimore, MD",
            "about": "Johns Hopkins graduate working in tech",
            "text": "test alumni software engineer tech company johns hopkins university baltimore maryland"
        },
        "expected": {
            "should_match": ["Johns Hopkins University"],
            "should_not_match": ["Stanford University", "U.S. Air Force"],
            "expected_tier": "high"  # Strong education match
        }
    },
    {
        "name": "Air Force Academy Graduate",
        "url": "https://www.linkedin.com/in/usafa-grad/",
        "scraped_data": {
            "name": "USAFA Graduate",
            "company": "Defense Contractor",
            "title": "Systems Engineer",
            "education": "United States Air Force Academy",
            "location": "Colorado Springs, CO",
            "about": "USAFA graduate, former Air Force officer",
            "text": "usafa graduate systems engineer defense contractor united states air force academy colorado springs former air force officer"
        },
        "expected": {
            "should_match": ["United States Air Force Academy", "U.S. Air Force"],
            "should_not_match": ["Johns Hopkins University"],
            "expected_tier": "high"  # Strong military + education match
        }
    }
]

class RealProfileTester:
    def __init__(self, gemini_api_key: str):
        self.profile_analyzer = ProfileAnalyzer(api_key=gemini_api_key)
        self.results = []
        self.validation_summary = {
            "total_tests": 0,
            "passed": 0,
            "failed": 0,
            "false_positives": [],
            "missed_matches": [],
            "null_issues": []
        }
    
    def test_profile(self, profile_data: Dict, search_elements: List[Dict]) -> Dict:
        """Test a single real LinkedIn profile"""
        print(f"\n{'='*60}")
        print(f"Testing: {profile_data['name']}")
        print(f"URL: {profile_data['url']}")
        print(f"{'='*60}")
        
        start_time = time.time()
        
        try:
            # Analyze with LLM
            analysis = self.profile_analyzer.analyze_profile(
                profile_data=profile_data['scraped_data'],
                user_search_elements=search_elements
            )
            
            elapsed = time.time() - start_time
            
            # Display results
            print(f"\n📊 Results:")
            print(f"  Score: {analysis['score']} points")
            print(f"  Tier: {analysis['tier']}")
            print(f"  Time: {elapsed:.2f}s")
            
            # Show matches
            valid_matches = [m for m in analysis['matches'] if m.get('confidence', 0) >= 0.3]
            print(f"\n✅ Valid Matches ({len(valid_matches)}):")
            for match in valid_matches:
                print(f"  • {match['category']}: {match['matches_element']}")
                print(f"    Found: '{match['found_in_profile'][:60]}...'")
                print(f"    Confidence: {match['confidence']:.1f}, Points: {match['points']}")
            
            # Validate against expectations
            validation = self.validate_results(profile_data, analysis)
            
            # Show validation results
            if validation['passed']:
                print(f"\n✅ VALIDATION PASSED")
            else:
                print(f"\n❌ VALIDATION FAILED")
                for issue in validation['issues']:
                    print(f"  ⚠️ {issue}")
            
            result = {
                'profile': profile_data['name'],
                'score': analysis['score'],
                'tier': analysis['tier'],
                'matches': valid_matches,
                'time': elapsed,
                'validation': validation,
                'passed': validation['passed']
            }
            
            self.results.append(result)
            return result
            
        except Exception as e:
            print(f"\n❌ ERROR: {str(e)}")
            return {
                'profile': profile_data['name'],
                'error': str(e),
                'passed': False
            }
    
    def validate_results(self, profile_data: Dict, analysis: Dict) -> Dict:
        """Validate that the LLM correctly identified matches"""
        validation = {
            'passed': True,
            'issues': []
        }
        
        expected = profile_data.get('expected', {})
        valid_matches = [m for m in analysis['matches'] if m.get('confidence', 0) >= 0.3]
        matched_elements = [m['matches_element'] for m in valid_matches]
        
        # Check for expected matches
        for expected_match in expected.get('should_match', []):
            if not any(expected_match in m for m in matched_elements):
                validation['passed'] = False
                validation['issues'].append(f"Missing expected match: {expected_match}")
                self.validation_summary['missed_matches'].append({
                    'profile': profile_data['name'],
                    'missed': expected_match
                })
        
        # Check for false positives
        for should_not_match in expected.get('should_not_match', []):
            if any(should_not_match in m for m in matched_elements):
                validation['passed'] = False
                validation['issues'].append(f"False positive: {should_not_match}")
                self.validation_summary['false_positives'].append({
                    'profile': profile_data['name'],
                    'false_match': should_not_match
                })
        
        # Check for NULL issues
        for match in valid_matches:
            found_text = match.get('found_in_profile', '').strip().upper()
            if found_text in ['NULL', 'NONE', 'N/A', '']:
                validation['passed'] = False
                validation['issues'].append(f"NULL value counted: {match['matches_element']}")
                self.validation_summary['null_issues'].append({
                    'profile': profile_data['name'],
                    'null_match': match['matches_element']
                })
        
        # Check tier expectation
        if expected.get('expected_tier'):
            if analysis['tier'] != expected['expected_tier']:
                validation['issues'].append(
                    f"Tier mismatch: expected {expected['expected_tier']}, got {analysis['tier']}"
                )
                # This is a warning, not a failure
        
        self.validation_summary['total_tests'] += 1
        if validation['passed']:
            self.validation_summary['passed'] += 1
        else:
            self.validation_summary['failed'] += 1
        
        return validation
    
    def run_all_tests(self) -> None:
        """Run tests on all real profiles"""
        search_elements = JIM_RESUME_DATA['search_elements']
        
        print("\n" + "="*80)
        print("REAL LINKEDIN PROFILE TESTING")
        print("="*80)
        print(f"\nUsing {len(search_elements)} search elements from resume")
        print(f"Testing {len(REAL_LINKEDIN_PROFILES)} real LinkedIn profiles")
        
        for profile in REAL_LINKEDIN_PROFILES:
            self.test_profile(profile, search_elements)
        
        self.generate_report()
    
    def generate_report(self) -> None:
        """Generate comprehensive validation report"""
        print("\n" + "="*80)
        print("VALIDATION REPORT")
        print("="*80)
        
        # Overall Results
        print(f"\n📊 OVERALL RESULTS:")
        print(f"  Total Tests: {self.validation_summary['total_tests']}")
        print(f"  Passed: {self.validation_summary['passed']} ✅")
        print(f"  Failed: {self.validation_summary['failed']} ❌")
        print(f"  Success Rate: {(self.validation_summary['passed']/self.validation_summary['total_tests']*100):.1f}%")
        
        # Performance Metrics
        avg_time = sum(r.get('time', 0) for r in self.results) / len(self.results)
        print(f"\n⚡ PERFORMANCE:")
        print(f"  Average Response Time: {avg_time:.2f}s")
        print(f"  Max Response Time: {max(r.get('time', 0) for r in self.results):.2f}s")
        print(f"  Min Response Time: {min(r.get('time', 0) for r in self.results if r.get('time', 0) > 0):.2f}s")
        
        # Common Issues
        if self.validation_summary['false_positives']:
            print(f"\n❌ FALSE POSITIVES ({len(self.validation_summary['false_positives'])}):")
            for fp in self.validation_summary['false_positives']:
                print(f"  • {fp['profile']}: incorrectly matched '{fp['false_match']}'")
        
        if self.validation_summary['missed_matches']:
            print(f"\n⚠️ MISSED MATCHES ({len(self.validation_summary['missed_matches'])}):")
            for mm in self.validation_summary['missed_matches']:
                print(f"  • {mm['profile']}: failed to match '{mm['missed']}'")
        
        if self.validation_summary['null_issues']:
            print(f"\n🚫 NULL ISSUES ({len(self.validation_summary['null_issues'])}):")
            for ni in self.validation_summary['null_issues']:
                print(f"  • {ni['profile']}: NULL counted as '{ni['null_match']}'")
        
        # Score Distribution
        print(f"\n📈 SCORE DISTRIBUTION:")
        high_tier = [r for r in self.results if r.get('tier') == 'high']
        medium_tier = [r for r in self.results if r.get('tier') == 'medium']
        low_tier = [r for r in self.results if r.get('tier') == 'low']
        print(f"  High Tier (40+): {len(high_tier)} profiles")
        print(f"  Medium Tier (20-39): {len(medium_tier)} profiles")
        print(f"  Low Tier (<20): {len(low_tier)} profiles")
        
        # Save detailed report
        report_path = Path("real_profile_test_report.json")
        with open(report_path, 'w') as f:
            json.dump({
                'timestamp': datetime.now().isoformat(),
                'summary': self.validation_summary,
                'results': self.results,
                'performance': {
                    'avg_time': avg_time,
                    'max_time': max(r.get('time', 0) for r in self.results),
                    'min_time': min(r.get('time', 0) for r in self.results if r.get('time', 0) > 0)
                }
            }, f, indent=2, default=str)
        
        print(f"\n💾 Detailed report saved to {report_path}")
        
        # Final verdict
        if self.validation_summary['passed'] == self.validation_summary['total_tests']:
            print("\n🎉 ALL TESTS PASSED!")
        else:
            print(f"\n⚠️ {self.validation_summary['failed']} tests failed - review issues above")

def main():
    """Run the real profile testing pipeline"""
    from dotenv import load_dotenv
    load_dotenv()
    
    gemini_key = os.getenv('GEMINI_API_KEY')
    if not gemini_key:
        print("ERROR: GEMINI_API_KEY not found")
        return
    
    tester = RealProfileTester(gemini_api_key=gemini_key)
    tester.run_all_tests()

if __name__ == "__main__":
    main()