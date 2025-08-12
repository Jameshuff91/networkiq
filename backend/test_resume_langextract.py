#!/usr/bin/env python3
"""Test the resume parser with LangExtract integration"""

import os
import sys
from resume_parser import ResumeParser

# Sample resume text for testing
test_resume = """
John Doe
john.doe@email.com
Phone: (555) 123-4567
LinkedIn: linkedin.com/in/johndoe

EDUCATION
Stanford University - Stanford, CA
BS Computer Science, 2018
GPA: 3.8/4.0

Massachusetts Institute of Technology - Cambridge, MA  
MS Artificial Intelligence, 2020

EXPERIENCE
Google - Mountain View, CA
Software Engineer (June 2020 - December 2022)
- Developed machine learning models for search ranking
- Led team of 5 engineers on recommendation system
- Improved query performance by 35%

Meta - Menlo Park, CA
Senior Software Engineer (January 2023 - Present)
- Architected distributed systems handling 1B+ requests/day
- Implemented real-time data pipelines using Kafka
- Reduced infrastructure costs by 40%

MILITARY SERVICE
United States Air Force Academy - Colorado Springs, CO
Graduated 2014, Distinguished Graduate
Active Duty Air Force Officer (2014-2018)
Captain, Space Operations

SKILLS
Programming: Python, Java, C++, Go, JavaScript
Frameworks: TensorFlow, PyTorch, React, Django
Tools: Docker, Kubernetes, AWS, GCP, Git
Databases: PostgreSQL, MongoDB, Redis

CERTIFICATIONS
- AWS Certified Solutions Architect - Professional
- Google Cloud Professional Data Engineer
- Certified Kubernetes Administrator (CKA)

ACHIEVEMENTS
- USAFA Dean's List (4 semesters)
- Google Peer Bonus Award (2021)
- Published paper on distributed ML systems at NeurIPS 2022
"""


def test_langextract_parsing():
    """Test parsing with LangExtract enabled"""
    print("Testing resume parsing with LangExtract...")
    print("-" * 50)

    # Create parser with LangExtract enabled
    parser = ResumeParser(use_gemini=True, use_langextract=True)

    # Parse the test resume
    result = parser.parse_resume(test_resume.encode("utf-8"), "test_resume.txt")

    # Display results
    print("\n📊 PARSING RESULTS:")
    print("-" * 50)

    if result.get("extraction_method") == "langextract":
        print("✅ Successfully parsed with LangExtract!")
    else:
        print(f"⚠️ Parsed with: {result.get('extraction_method', 'unknown')}")

    print(f"\n📧 Email: {result.get('email')}")
    print(f"📱 Phone: {result.get('phone')}")

    print("\n🎓 Education:")
    for edu in result.get("education", []):
        if isinstance(edu, dict):
            print(
                f"  - {edu.get('institution', 'Unknown')}: {edu.get('degree', '')} {edu.get('field', '')}"
            )
        else:
            print(f"  - {edu}")

    print("\n🏢 Companies:")
    for company in result.get("companies", []):
        print(f"  - {company}")

    print("\n🎖️ Military Service:")
    military = result.get("military_service")
    if military:
        print(f"  - Branch: {military.get('branch', 'N/A')}")
        print(f"  - Academy: {military.get('academy', 'N/A')}")
        print(f"  - Veteran: {military.get('veteran', False)}")
    else:
        print("  - None detected")

    print("\n💻 Skills:")
    for skill in result.get("skills", [])[:10]:
        print(f"  - {skill}")

    print("\n🏆 Certifications:")
    for cert in result.get("certifications", []):
        print(f"  - {cert}")

    print("\n🔍 Search Elements (Top 10):")
    for element in result.get("search_elements", [])[:10]:
        print(
            f"  - [{element['category']}] {element['display']} (weight: {element['weight']})"
        )

    print("\n" + "=" * 50)
    print(f"Extraction confidence: {result.get('extraction_confidence', 'N/A')}")
    print(f"Total search elements: {len(result.get('search_elements', []))}")


def test_fallback_parsing():
    """Test parsing with LangExtract disabled"""
    print("\n\nTesting fallback parsing (LangExtract disabled)...")
    print("-" * 50)

    # Create parser without LangExtract
    parser = ResumeParser(use_gemini=True, use_langextract=False)

    # Parse the test resume
    result = parser.parse_resume(test_resume.encode("utf-8"), "test_resume.txt")

    print(f"Parsed with: {result.get('extraction_method', 'gemini/regex')}")
    print(f"Found {len(result.get('companies', []))} companies")
    print(f"Found {len(result.get('skills', []))} skills")
    print(f"Found {len(result.get('search_elements', []))} search elements")


if __name__ == "__main__":
    # Check for API key
    if not os.getenv("GEMINI_API_KEY"):
        print("❌ Error: GEMINI_API_KEY environment variable not set")
        sys.exit(1)

    try:
        test_langextract_parsing()
        test_fallback_parsing()
        print("\n✅ All tests completed!")
    except Exception as e:
        print(f"\n❌ Error during testing: {e}")
        import traceback

        traceback.print_exc()
