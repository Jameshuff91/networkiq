#!/usr/bin/env python3
"""
Comprehensive Testing Pipeline for NetworkIQ Profile Scoring
Tests real LinkedIn profiles against Jim's actual resume data
"""

import json
import time
import asyncio
from pathlib import Path
from typing import Dict, List, Any
from datetime import datetime
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from resume_parser import ResumeParser
from profile_analyzer import ProfileAnalyzer

# Test profile data - Real LinkedIn profiles with different characteristics
TEST_PROFILES = [
    {
        "name": "Test Profile 1 - Johns Hopkins Alumni",
        "url": "https://www.linkedin.com/in/test1",
        "data": {
            "name": "John Smith",
            "headline": "Software Engineer at Google",
            "company": "Google",
            "education": "Johns Hopkins University",
            "location": "San Francisco Bay Area",
            "about": "Passionate software engineer with experience in machine learning and AI",
            "text": "john smith software engineer at google johns hopkins university class of 2015 san francisco bay area"
        }
    },
    {
        "name": "Test Profile 2 - Air Force Academy",
        "url": "https://www.linkedin.com/in/test2", 
        "data": {
            "name": "Sarah Johnson",
            "headline": "Product Manager at Meta",
            "company": "Meta",
            "education": "United States Air Force Academy",
            "location": "Denver, CO",
            "about": "Former Air Force officer turned tech product manager",
            "text": "sarah johnson product manager meta usafa graduate air force veteran denver colorado"
        }
    },
    {
        "name": "Test Profile 3 - No Match",
        "url": "https://www.linkedin.com/in/test3",
        "data": {
            "name": "Michael Chen",
            "headline": "Investment Banker at Goldman Sachs",
            "company": "Goldman Sachs",
            "education": "Harvard Business School",
            "location": "New York, NY",
            "about": "Investment banking professional focused on tech M&A",
            "text": "michael chen investment banker goldman sachs harvard mba new york finance"
        }
    },
    {
        "name": "Test Profile 4 - Partial Match (Location + Skills)",
        "url": "https://www.linkedin.com/in/test4",
        "data": {
            "name": "Emily Rodriguez",
            "headline": "ML Engineer at OpenAI",
            "company": "OpenAI", 
            "education": "Stanford University",
            "location": "San Francisco, CA",
            "about": "Building next-gen AI systems with focus on NLP and computer vision",
            "text": "emily rodriguez machine learning engineer openai stanford san francisco artificial intelligence deep learning python tensorflow"
        }
    },
    {
        "name": "Test Profile 5 - NULL values test",
        "url": "https://www.linkedin.com/in/test5",
        "data": {
            "name": "David Kim",
            "headline": "Consultant",
            "company": "",
            "education": "",
            "location": "Remote",
            "about": "",
            "text": "david kim consultant remote"
        }
    }
]

class TestPipeline:
    def __init__(self, gemini_api_key: str):
        self.resume_parser = ResumeParser()
        self.profile_analyzer = ProfileAnalyzer(api_key=gemini_api_key)
        self.results = []
        self.performance_metrics = {}
        
    def parse_resume(self, resume_path: str) -> Dict:
        """Parse Jim's actual resume"""
        print("\n" + "="*80)
        print("STEP 1: PARSING RESUME")
        print("="*80)
        
        start_time = time.time()
        
        # Use the resume parser to extract data
        with open(resume_path, 'rb') as f:
            resume_data = self.resume_parser.parse_resume(f.read(), 'docx')
        
        parse_time = time.time() - start_time
        
        print(f"\n✓ Resume parsed in {parse_time:.2f} seconds")
        print(f"\nExtracted Categories:")
        print(f"  - Education: {len(resume_data.get('education', []))} institutions")
        print(f"  - Companies: {len(resume_data.get('companies', []))} companies")
        print(f"  - Skills: {len(resume_data.get('skills', []))} skills")
        print(f"  - Military: {resume_data.get('military', {})}")
        
        # Convert to search elements format
        search_elements = resume_data.get('search_elements', [])
        print(f"\n✓ Generated {len(search_elements)} search elements")
        
        # Display sample elements
        print("\nSample Search Elements:")
        for elem in search_elements[:5]:
            print(f"  - {elem['category']}: {elem['display']} (weight: {elem['weight']})")
        
        self.performance_metrics['resume_parse_time'] = parse_time
        return search_elements
    
    def test_single_profile(self, profile: Dict, search_elements: List[Dict]) -> Dict:
        """Test scoring for a single profile"""
        print(f"\nTesting: {profile['name']}")
        print("-" * 40)
        
        start_time = time.time()
        
        try:
            # Analyze profile with LLM
            analysis = self.profile_analyzer.analyze_profile(
                profile_data=profile['data'],
                user_search_elements=search_elements
            )
            
            analysis_time = time.time() - start_time
            
            # Display results
            print(f"  Score: {analysis['score']} ({analysis['tier']} tier)")
            print(f"  Time: {analysis_time:.2f}s")
            
            # Show matches
            if analysis['matches']:
                print(f"  Matches ({len(analysis['matches'])}):")
                for match in analysis['matches']:
                    confidence = match.get('confidence', 0)
                    if confidence >= 0.3:  # Only show valid matches
                        print(f"    - {match['category']}: {match['matches_element']}")
                        print(f"      Found: {match['found_in_profile'][:50]}...")
                        print(f"      Confidence: {confidence:.1f}, Points: {match['points']}")
            
            # Validate categorization
            validation = self.validate_scoring(profile, analysis)
            
            result = {
                'profile': profile['name'],
                'score': analysis['score'],
                'tier': analysis['tier'],
                'matches': len([m for m in analysis['matches'] if m.get('confidence', 0) >= 0.3]),
                'time': analysis_time,
                'validation': validation,
                'analysis': analysis
            }
            
            self.results.append(result)
            return result
            
        except Exception as e:
            print(f"  ERROR: {str(e)}")
            return {
                'profile': profile['name'],
                'error': str(e),
                'time': time.time() - start_time
            }
    
    def validate_scoring(self, profile: Dict, analysis: Dict) -> Dict:
        """Validate that scoring is accurate"""
        validation = {
            'correct_categorization': True,
            'no_false_positives': True,
            'issues': []
        }
        
        # Check for false positives
        for match in analysis['matches']:
            if match.get('confidence', 0) >= 0.3:
                found_text = match.get('found_in_profile', '').upper()
                
                # Check for NULL/None matches that shouldn't be counted
                if found_text in ['NULL', 'NONE', 'N/A', '']:
                    validation['no_false_positives'] = False
                    validation['issues'].append(f"NULL value counted: {match['matches_element']}")
                
                # Check for wrong university matches
                if match['category'] == 'education':
                    if 'Johns Hopkins' in match['matches_element'] and 'Johns Hopkins' not in profile['data'].get('education', ''):
                        validation['no_false_positives'] = False
                        validation['issues'].append(f"Wrong university match: {match['matches_element']}")
        
        if validation['issues']:
            print(f"  ⚠️  Validation Issues:")
            for issue in validation['issues']:
                print(f"    - {issue}")
        else:
            print(f"  ✓ Validation passed")
        
        return validation
    
    def test_batch_profiles(self, profiles: List[Dict], search_elements: List[Dict]) -> None:
        """Test batch processing of profiles"""
        print("\n" + "="*80)
        print("STEP 3: BATCH PROFILE TESTING")
        print("="*80)
        
        batch_start = time.time()
        
        # Prepare batch request
        batch_profiles = [p['data'] for p in profiles]
        
        try:
            # This would normally call the batch endpoint
            # For testing, we'll process sequentially but measure batch time
            print(f"\nProcessing batch of {len(profiles)} profiles...")
            
            for profile in profiles:
                self.test_single_profile(profile, search_elements)
            
            batch_time = time.time() - batch_start
            avg_time = batch_time / len(profiles)
            
            print(f"\n✓ Batch completed in {batch_time:.2f}s")
            print(f"  Average time per profile: {avg_time:.2f}s")
            
            self.performance_metrics['batch_time'] = batch_time
            self.performance_metrics['avg_profile_time'] = avg_time
            
        except Exception as e:
            print(f"Batch processing error: {e}")
    
    def generate_report(self) -> None:
        """Generate comprehensive test report"""
        print("\n" + "="*80)
        print("TEST REPORT")
        print("="*80)
        
        # Performance Summary
        print("\n📊 PERFORMANCE METRICS:")
        print(f"  Resume Parse Time: {self.performance_metrics.get('resume_parse_time', 0):.2f}s")
        print(f"  Avg Profile Score Time: {self.performance_metrics.get('avg_profile_time', 0):.2f}s")
        print(f"  Total Batch Time: {self.performance_metrics.get('batch_time', 0):.2f}s")
        
        # Scoring Summary
        print("\n📈 SCORING SUMMARY:")
        high_tier = [r for r in self.results if r.get('tier') == 'high']
        medium_tier = [r for r in self.results if r.get('tier') == 'medium']
        low_tier = [r for r in self.results if r.get('tier') == 'low']
        
        print(f"  High Tier: {len(high_tier)} profiles")
        print(f"  Medium Tier: {len(medium_tier)} profiles")
        print(f"  Low Tier: {len(low_tier)} profiles")
        
        # Validation Summary
        print("\n✅ VALIDATION SUMMARY:")
        valid_results = [r for r in self.results if r.get('validation', {}).get('no_false_positives', False)]
        print(f"  Correctly Scored: {len(valid_results)}/{len(self.results)}")
        
        validation_issues = []
        for r in self.results:
            if r.get('validation', {}).get('issues'):
                validation_issues.extend(r['validation']['issues'])
        
        if validation_issues:
            print(f"\n  Issues Found ({len(validation_issues)}):")
            for issue in set(validation_issues):  # Unique issues only
                print(f"    - {issue}")
        
        # Detailed Results
        print("\n📝 DETAILED RESULTS:")
        for result in self.results:
            print(f"\n  {result['profile']}")
            print(f"    Score: {result.get('score', 'N/A')} ({result.get('tier', 'N/A')})")
            print(f"    Matches: {result.get('matches', 0)}")
            print(f"    Time: {result.get('time', 0):.2f}s")
            if result.get('error'):
                print(f"    ERROR: {result['error']}")
        
        # Save report to file
        report_path = Path("test_report.json")
        with open(report_path, 'w') as f:
            json.dump({
                'timestamp': datetime.now().isoformat(),
                'performance_metrics': self.performance_metrics,
                'results': self.results,
                'summary': {
                    'total_profiles': len(self.results),
                    'high_tier': len(high_tier),
                    'medium_tier': len(medium_tier),
                    'low_tier': len(low_tier),
                    'validation_pass_rate': len(valid_results) / len(self.results) if self.results else 0
                }
            }, f, indent=2)
        
        print(f"\n✓ Report saved to {report_path}")

def main():
    """Run the complete test pipeline"""
    print("\n" + "="*80)
    print("NETWORKIQ TESTING PIPELINE")
    print("="*80)
    
    # Load API key
    from dotenv import load_dotenv
    load_dotenv()
    gemini_key = os.getenv('GEMINI_API_KEY')
    
    if not gemini_key:
        print("ERROR: GEMINI_API_KEY not found in environment")
        return
    
    # Initialize pipeline
    pipeline = TestPipeline(gemini_api_key=gemini_key)
    
    # Step 1: Parse Jim's resume
    resume_path = "../Jim Huff - Two Page (July 25).docx"
    if not Path(resume_path).exists():
        print(f"ERROR: Resume not found at {resume_path}")
        return
    
    search_elements = pipeline.parse_resume(resume_path)
    
    # Step 2: Test individual profiles
    print("\n" + "="*80)
    print("STEP 2: INDIVIDUAL PROFILE TESTING")
    print("="*80)
    
    for profile in TEST_PROFILES:
        pipeline.test_single_profile(profile, search_elements)
    
    # Step 3: Test batch processing
    pipeline.test_batch_profiles(TEST_PROFILES, search_elements)
    
    # Step 4: Generate report
    pipeline.generate_report()
    
    print("\n✅ Testing pipeline complete!")

if __name__ == "__main__":
    main()