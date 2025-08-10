#!/usr/bin/env python3
"""Test the enhanced profile analyzer with LangExtract integration"""

import os
import sys
from profile_analyzer import ProfileAnalyzer
import json

# Sample LinkedIn profiles for testing
test_profiles = [
    {
        "name": "Alice Johnson",
        "headline": "Senior Software Engineer at Google | Stanford Alumni",
        "about": "Passionate about machine learning and distributed systems. Stanford CS grad with 8 years at Google working on search infrastructure.",
        "experienceText": "Google - Senior Software Engineer (2016-Present)\nPreviously at Microsoft",
        "educationText": "Stanford University - MS Computer Science\nMIT - BS Computer Science",
        "text": "Alice Johnson Senior Software Engineer Google Stanford Alumni Machine Learning Distributed Systems",
        "company": "Google"
    },
    {
        "name": "Bob Smith",
        "headline": "Product Manager at Meta | USAFA Graduate",
        "about": "Former Air Force officer turned tech PM. Leading social commerce initiatives at Meta.",
        "experienceText": "Meta - Product Manager (2020-Present)\nUS Air Force - Captain (2014-2020)",
        "educationText": "United States Air Force Academy - BS Aeronautical Engineering",
        "text": "Bob Smith Product Manager Meta USAFA Graduate Air Force Officer Captain",
        "company": "Meta"
    },
    {
        "name": "Carol Davis",
        "headline": "Data Scientist at Amazon | Harvard MBA",
        "about": "Combining business acumen with technical expertise. AWS certified, focusing on ML ops.",
        "experienceText": "Amazon - Data Scientist (2019-Present)\nDeloitte - Consultant",
        "educationText": "Harvard Business School - MBA\nUC Berkeley - BS Statistics",
        "text": "Carol Davis Data Scientist Amazon Harvard MBA AWS Certified Machine Learning",
        "company": "Amazon"
    }
]

# Sample user background (similar to what would come from resume parsing)
user_search_elements = [
    {"category": "education", "value": "stanford university", "weight": 35, "display": "Stanford Alumni"},
    {"category": "education", "value": "mit", "weight": 30, "display": "MIT Alumni"},
    {"category": "company", "value": "google", "weight": 30, "display": "Former Google"},
    {"category": "military", "value": "air force academy", "weight": 45, "display": "USAFA Graduate"},
    {"category": "military", "value": "air force", "weight": 35, "display": "Air Force Veteran"},
    {"category": "skill", "value": "machine learning", "weight": 15, "display": "ML Expertise"},
    {"category": "skill", "value": "distributed systems", "weight": 15, "display": "Distributed Systems"},
    {"category": "certification", "value": "aws certified", "weight": 20, "display": "AWS Certified"},
    {"category": "location", "value": "california", "weight": 25, "display": "California Connection"}
]

def test_individual_analysis():
    """Test individual profile analysis with LangExtract"""
    print("=" * 60)
    print("Testing Individual Profile Analysis with LangExtract")
    print("=" * 60)
    
    analyzer = ProfileAnalyzer(use_langextract=True)
    
    for profile in test_profiles:
        print(f"\n📋 Analyzing: {profile['name']}")
        print("-" * 40)
        
        result = analyzer.analyze_profile(profile, user_search_elements)
        
        print(f"Score: {result['score']} ({result['tier']} tier)")
        print(f"Method: {result.get('extraction_method', 'standard')}")
        
        if result['matches']:
            print("\nMatches found:")
            for match in result['matches']:
                print(f"  ✓ {match['matches_element']} - {match['found_in_profile'][:50]}...")
                print(f"    Confidence: {match.get('confidence', 'N/A')}, Points: {match['points']}")
        
        if result.get('insights'):
            print("\nInsights:")
            for insight in result['insights']:
                print(f"  • {insight}")
        
        if result.get('recommendation'):
            print(f"\nRecommendation: {result['recommendation']}")

def test_batch_analysis():
    """Test batch profile analysis with LangExtract"""
    print("\n" + "=" * 60)
    print("Testing Batch Profile Analysis with LangExtract")
    print("=" * 60)
    
    analyzer = ProfileAnalyzer(use_langextract=True)
    
    print(f"\nBatch analyzing {len(test_profiles)} profiles...")
    results = analyzer.analyze_profiles_batch(test_profiles, user_search_elements, max_workers=3)
    
    print("\n📊 Batch Results Summary:")
    print("-" * 40)
    
    for result in results:
        name = result.get('profile_name', 'Unknown')
        score = result['score']
        tier = result['tier']
        method = result.get('extraction_method', 'unknown')
        matches = len(result.get('matches', []))
        
        print(f"{name:20} | Score: {score:3} | Tier: {tier:6} | Matches: {matches} | Method: {method}")
    
    # Calculate statistics
    scores = [r['score'] for r in results]
    avg_score = sum(scores) / len(scores) if scores else 0
    high_tier = sum(1 for r in results if r['tier'] == 'high')
    
    print(f"\n📈 Statistics:")
    print(f"  Average Score: {avg_score:.1f}")
    print(f"  High Tier Profiles: {high_tier}/{len(results)}")

def test_fallback():
    """Test fallback behavior when LangExtract is disabled"""
    print("\n" + "=" * 60)
    print("Testing Fallback (LangExtract Disabled)")
    print("=" * 60)
    
    analyzer = ProfileAnalyzer(use_langextract=False)
    
    profile = test_profiles[0]
    print(f"\nAnalyzing {profile['name']} without LangExtract...")
    
    result = analyzer.analyze_profile(profile, user_search_elements)
    
    print(f"Score: {result['score']} ({result['tier']} tier)")
    print(f"Method: {result.get('extraction_method', 'standard gemini')}")
    print(f"Matches found: {len(result.get('matches', []))}")

def test_comparison():
    """Compare results with and without LangExtract"""
    print("\n" + "=" * 60)
    print("Comparing LangExtract vs Standard Analysis")
    print("=" * 60)
    
    profile = test_profiles[0]  # Use first profile for comparison
    
    # With LangExtract
    analyzer_with = ProfileAnalyzer(use_langextract=True)
    result_with = analyzer_with.analyze_profile(profile, user_search_elements)
    
    # Without LangExtract
    analyzer_without = ProfileAnalyzer(use_langextract=False)
    result_without = analyzer_without.analyze_profile(profile, user_search_elements)
    
    print(f"\nProfile: {profile['name']}")
    print("-" * 40)
    print(f"{'Method':<20} | {'Score':<10} | {'Matches':<10} | {'Confidence'}")
    print("-" * 40)
    
    # LangExtract results
    avg_confidence_with = sum(m.get('confidence', 0) for m in result_with.get('matches', [])) / max(len(result_with.get('matches', [])), 1)
    print(f"{'LangExtract':<20} | {result_with['score']:<10} | {len(result_with.get('matches', [])):<10} | {avg_confidence_with:.2f}")
    
    # Standard results
    avg_confidence_without = sum(m.get('confidence', 0) for m in result_without.get('matches', [])) / max(len(result_without.get('matches', [])), 1)
    print(f"{'Standard Gemini':<20} | {result_without['score']:<10} | {len(result_without.get('matches', [])):<10} | {avg_confidence_without:.2f}")

if __name__ == "__main__":
    # Check for API key
    if not os.getenv("GEMINI_API_KEY"):
        print("❌ Error: GEMINI_API_KEY environment variable not set")
        sys.exit(1)
    
    try:
        # Run all tests
        test_individual_analysis()
        test_batch_analysis()
        test_fallback()
        test_comparison()
        
        print("\n" + "=" * 60)
        print("✅ All tests completed successfully!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Error during testing: {e}")
        import traceback
        traceback.print_exc()