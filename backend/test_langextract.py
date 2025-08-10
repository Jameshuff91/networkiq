#!/usr/bin/env python3
"""Test script to verify LangExtract integration"""

import os
from langextract import extract
from langextract.data import ExampleData

# Test text (simple resume excerpt)
test_text = """
John Doe
john.doe@email.com
(555) 123-4567

EDUCATION
Stanford University - BS Computer Science, 2018
MIT - MS Artificial Intelligence, 2020

EXPERIENCE
Google - Software Engineer (2020-2022)
- Developed machine learning models
- Led team of 5 engineers

Meta - Senior Engineer (2022-Present)
- Architected distributed systems
- Improved performance by 40%

SKILLS
Python, TensorFlow, AWS, Docker, Kubernetes

CERTIFICATIONS
AWS Certified Solutions Architect
"""

# Define what we want to extract
prompt = """Extract the following from this resume:
- email
- phone
- education (list of objects with institution, degree, field, year)
- companies (list of company names)
- skills (list of skills)
- certifications (list)

Return as JSON."""

def test_basic_extraction():
    """Test basic extraction with LangExtract"""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY not found")
        return
    
    # Create an example for better extraction
    example_text = """Jane Smith
jane@example.com
(555) 987-6543

EDUCATION
Harvard University - BA Economics, 2015

EXPERIENCE
Apple - Product Manager (2015-2020)

SKILLS
Python, SQL"""
    
    example_output = {
        "email": "jane@example.com",
        "phone": "(555) 987-6543",
        "education": [
            {"institution": "Harvard University", "degree": "BA", "field": "Economics", "year": "2015"}
        ],
        "companies": ["Apple"],
        "skills": ["Python", "SQL"],
        "certifications": []
    }
    
    example = ExampleData(
        input_text=example_text,
        output=example_output
    )
    
    try:
        result = extract(
            text_or_documents=test_text,
            prompt_description=prompt,
            examples=[example],
            model_id="gemini-1.5-flash",
            api_key=api_key,
            format_type="json",
            debug=False
        )
        
        print("Extraction successful!")
        print("Result type:", type(result))
        
        # Access the extracted data
        if hasattr(result, 'data'):
            print("\nExtracted data:")
            print(result.data)
        
        # Check for source grounding
        if hasattr(result, 'spans'):
            print("\nSource spans available:", len(result.spans) if result.spans else 0)
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_basic_extraction()