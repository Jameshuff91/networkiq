"""
Test the resume upload and parsing functionality
"""

import pytest
from resume_parser import ResumeParser, parse_resume_file


class TestResumeParser:
    def setup_method(self):
        """Setup test fixtures"""
        self.parser = ResumeParser()

    def test_parse_text_resume(self):
        """Test parsing a simple text resume"""
        sample_resume = """
        John Doe
        john.doe@email.com
        (555) 123-4567
        
        EDUCATION
        Stanford University
        Bachelor of Science in Computer Science
        
        EXPERIENCE
        Google - Software Engineer
        2020-2023
        
        SKILLS
        Python, JavaScript, React, AWS
        
        MILITARY SERVICE
        US Air Force - Officer
        2015-2020
        """
        
        result = self.parser._parse_text(sample_resume.lower())
        
        # Check basic extraction
        assert result["email"] == "john.doe@email.com"
        assert result["phone"] == "(555) 123-4567"
        
        # Check education extraction
        assert len(result["education"]) > 0
        education_institutions = [e.get("institution") for e in result["education"] if "institution" in e]
        assert any("stanford university" in inst for inst in education_institutions)
        
        # Check company extraction
        assert "google" in result["companies"]
        
        # Check skills extraction
        assert "python" in result["skills"]
        assert "javascript" in result["skills"]
        assert "aws" in result["skills"]
        
        # Check military extraction
        assert result["military_service"] is not None
        assert result["military_service"]["veteran"] == True
        
        # Check search elements
        assert len(result["search_elements"]) > 0
        
    def test_build_search_elements(self):
        """Test building search elements from parsed data"""
        data = {
            "education": [{"institution": "mit", "type": "university"}],
            "companies": ["apple", "microsoft"],
            "skills": ["python", "machine learning"],
            "military_service": {"branch": "navy", "veteran": True},
            "certifications": ["aws certified"],
            "keywords": ["ai", "data science"]
        }
        
        elements = self.parser._build_search_elements(data)
        
        # Check that elements were created
        assert len(elements) > 0
        
        # Check education element
        edu_elements = [e for e in elements if e["category"] == "education"]
        assert len(edu_elements) == 1
        assert edu_elements[0]["weight"] == 30
        
        # Check company elements
        company_elements = [e for e in elements if e["category"] == "company"]
        assert len(company_elements) == 2
        assert all(e["weight"] == 25 for e in company_elements)
        
        # Check military element
        military_elements = [e for e in elements if e["category"] == "military"]
        assert len(military_elements) == 1
        assert military_elements[0]["weight"] == 30
        
    def test_extract_education(self):
        """Test education extraction"""
        text = """
        education:
        massachusetts institute of technology (mit)
        master of science in computer science
        
        stanford university  
        bachelor of arts in economics
        
        usafa - united states air force academy
        """
        
        result = self.parser._extract_education(text)
        
        # Check that multiple institutions were found
        institutions = [e for e in result if "institution" in e]
        assert len(institutions) >= 2
        
        # Check that degrees were found
        degrees = [e for e in result if "degree" in e]
        assert len(degrees) >= 2
        
    def test_extract_companies(self):
        """Test company extraction"""
        text = """
        work experience:
        
        software engineer at Google
        2020-2023
        
        data scientist - Meta/Facebook
        2018-2020
        
        c3 ai - product manager
        2016-2018
        """
        
        result = self.parser._extract_companies(text.lower())
        
        # Check known tech companies
        assert "google" in result
        assert any("c3" in company for company in result)
        
    def test_extract_military(self):
        """Test military service extraction"""
        # Test with academy
        text1 = "graduated from usafa, served as air force officer"
        result1 = self.parser._extract_military(text1)
        assert result1 is not None
        assert result1.get("academy") == "usafa"
        assert result1["veteran"] == True
        
        # Test with branch only
        text2 = "us navy veteran, 10 years of service"
        result2 = self.parser._extract_military(text2)
        assert result2 is not None
        assert result2.get("branch") == "navy"
        assert result2["veteran"] == True
        
        # Test no military
        text3 = "software engineer with no military experience"
        result3 = self.parser._extract_military(text3)
        assert result3 is None
        
    def test_estimate_experience(self):
        """Test experience estimation"""
        # Test with year range
        text1 = "worked from 2015 to 2023"
        years1 = self.parser._estimate_experience(text1)
        assert years1 == 8
        
        # Test with explicit mention
        text2 = "15 years of experience in software development"
        years2 = self.parser._estimate_experience(text2)
        assert years2 == 15
        
        # Test with no clear experience
        text3 = "recent graduate looking for opportunities"
        years3 = self.parser._estimate_experience(text3)
        assert years3 == 0
        
    def test_search_element_weights(self):
        """Test that search element weights are appropriate"""
        data = {
            "education": [{"institution": "harvard", "type": "university"}],
            "companies": ["google"],
            "skills": ["python"],
            "military_service": {"academy": "usafa"},
            "certifications": ["pmp"],
            "keywords": ["ai"]
        }
        
        elements = self.parser._build_search_elements(data)
        
        # Check weight hierarchy: military academy > education > company > certification > skill > keyword
        weights = {e["category"]: e["weight"] for e in elements}
        
        assert weights.get("military", 0) >= 30  # Military gets high weight
        assert weights.get("education", 0) == 30  # Education is important
        assert weights.get("company", 0) == 25  # Company is valuable
        assert weights.get("certification", 0) == 15  # Certification is moderate
        assert weights.get("skill", 0) == 10  # Skills are lower
        assert weights.get("keyword", 0) == 5  # Keywords are lowest


if __name__ == "__main__":
    pytest.main([__file__, "-v"])