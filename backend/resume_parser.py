"""
Resume Parser Module
Extracts text and key information from PDF and DOCX resumes
"""

import re
from typing import Dict, List, Optional
import PyPDF2
from docx import Document
import io


class ResumeParser:
    """Parse resumes and extract key information for profile matching"""

    def __init__(self):
        # Common section headers to identify
        self.section_headers = [
            "experience",
            "work experience",
            "professional experience",
            "employment",
            "education",
            "academic",
            "qualifications",
            "skills",
            "technical skills",
            "competencies",
            "projects",
            "achievements",
            "accomplishments",
            "certifications",
            "licenses",
            "military service",
            "service",
        ]

        # Keywords that indicate important connections
        self.connection_indicators = {
            "education": [
                "university",
                "college",
                "school",
                "academy",
                "institute",
                "degree",
                "bs",
                "ms",
                "phd",
                "mba",
            ],
            "military": [
                "military",
                "army",
                "navy",
                "air force",
                "marine",
                "coast guard",
                "veteran",
                "officer",
                "enlisted",
            ],
            "companies": [],  # Will be extracted dynamically
            "skills": [],  # Will be extracted dynamically
        }

    def parse_resume(self, file_content: bytes, filename: str) -> Dict:
        """
        Parse resume from file content
        Returns structured data about the resume
        """
        # Extract text based on file type
        text = ""
        if filename.lower().endswith(".pdf"):
            text = self._extract_pdf_text(file_content)
        elif filename.lower().endswith((".docx", ".doc")):
            text = self._extract_docx_text(file_content)
        else:
            text = file_content.decode("utf-8", errors="ignore")

        # Parse the extracted text
        parsed_data = self._parse_text(text)

        return parsed_data

    def _extract_pdf_text(self, file_content: bytes) -> str:
        """Extract text from PDF file"""
        try:
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
            text = ""
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
            return text
        except Exception as e:
            print(f"Error parsing PDF: {e}")
            return ""

    def _extract_docx_text(self, file_content: bytes) -> str:
        """Extract text from DOCX file"""
        try:
            doc = Document(io.BytesIO(file_content))
            text = ""
            for paragraph in doc.paragraphs:
                text += paragraph.text + "\n"
            # Also extract text from tables
            for table in doc.tables:
                for row in table.rows:
                    for cell in row.cells:
                        text += cell.text + " "
                text += "\n"
            return text
        except Exception as e:
            print(f"Error parsing DOCX: {e}")
            return ""

    def _parse_text(self, text: str) -> Dict:
        """Parse resume text and extract structured information"""
        # Clean and normalize text
        text = text.lower()

        # Extract key information
        data = {
            "full_text": text[:5000],  # Store first 5000 chars for reference
            "email": self._extract_email(text),
            "phone": self._extract_phone(text),
            "education": self._extract_education(text),
            "companies": self._extract_companies(text),
            "skills": self._extract_skills(text),
            "military_service": self._extract_military(text),
            "years_experience": self._estimate_experience(text),
            "keywords": self._extract_keywords(text),
            "certifications": self._extract_certifications(text),
            "search_elements": [],  # This will be used for matching
        }

        # Build search elements for matching
        data["search_elements"] = self._build_search_elements(data)

        return data

    def _extract_email(self, text: str) -> Optional[str]:
        """Extract email address from text"""
        email_pattern = r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
        match = re.search(email_pattern, text)
        return match.group(0) if match else None

    def _extract_phone(self, text: str) -> Optional[str]:
        """Extract phone number from text"""
        phone_pattern = r"[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}"
        match = re.search(phone_pattern, text)
        return match.group(0) if match else None

    def _extract_education(self, text: str) -> List[Dict]:
        """Extract education information"""
        education = []

        # Common university patterns
        university_patterns = [
            r"([a-z\s]+university)",
            r"([a-z\s]+college)",
            r"([a-z\s]+institute)",
            r"([a-z\s]+academy)",
            r"(usafa|usma|usna|uscga|usmma)",  # Military academies
        ]

        # Common degrees
        degree_patterns = [
            r"(bachelor|b\.s\.|bs\.|b\.a\.|ba\.)",
            r"(master|m\.s\.|ms\.|m\.a\.|ma\.|mba)",
            r"(ph\.d\.|phd|doctorate)",
        ]

        for pattern in university_patterns:
            matches = re.findall(pattern, text)
            for match in matches:
                education.append({"institution": match.strip(), "type": "university"})

        for pattern in degree_patterns:
            matches = re.findall(pattern, text)
            for match in matches:
                education.append({"degree": match.strip(), "type": "degree"})

        return education

    def _extract_companies(self, text: str) -> List[str]:
        """Extract company names from work experience"""
        companies = []

        # Look for patterns like "at Company" or "Company Name"
        # This is simplified - in production, you'd use NER
        company_patterns = [
            r"at\s+([A-Z][A-Za-z\s&]+)",
            r"[\n•]\s*([A-Z][A-Za-z\s&]+)\s*[\n•]",
            r"([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)\s*\|",
        ]

        for pattern in company_patterns:
            matches = re.findall(pattern, text[:2000])  # Focus on first part of resume
            companies.extend([m.strip() for m in matches if len(m.strip()) > 2])

        # Also look for known tech companies
        tech_companies = [
            "google",
            "meta",
            "facebook",
            "amazon",
            "apple",
            "microsoft",
            "openai",
            "anthropic",
            "tesla",
            "spacex",
            "uber",
            "airbnb",
            "stripe",
            "coinbase",
            "dropbox",
            "slack",
            "zoom",
            "oracle",
            "ibm",
            "intel",
            "nvidia",
            "amd",
            "salesforce",
            "adobe",
            "c3.ai",
            "c3 ai",
            "palantir",
            "databricks",
            "snowflake",
        ]

        for company in tech_companies:
            if company in text:
                companies.append(company)

        return list(set(companies))  # Remove duplicates

    def _extract_skills(self, text: str) -> List[str]:
        """Extract technical skills"""
        skills = []

        # Programming languages
        languages = [
            "python",
            "java",
            "javascript",
            "typescript",
            "c++",
            "c#",
            "ruby",
            "go",
            "rust",
            "swift",
            "kotlin",
            "scala",
            "r",
        ]

        # Frameworks and tools
        frameworks = [
            "react",
            "angular",
            "vue",
            "django",
            "flask",
            "fastapi",
            "spring",
            "nodejs",
            "express",
            "rails",
            "laravel",
            "tensorflow",
            "pytorch",
            "scikit-learn",
            "pandas",
            "numpy",
        ]

        # Cloud and DevOps
        cloud_tools = [
            "aws",
            "azure",
            "gcp",
            "google cloud",
            "kubernetes",
            "docker",
            "terraform",
            "jenkins",
            "gitlab",
            "github",
            "ci/cd",
        ]

        # Databases
        databases = [
            "sql",
            "postgresql",
            "mysql",
            "mongodb",
            "redis",
            "elasticsearch",
            "cassandra",
            "dynamodb",
            "firebase",
        ]

        all_skills = languages + frameworks + cloud_tools + databases

        for skill in all_skills:
            if skill in text:
                skills.append(skill)

        return skills

    def _extract_military(self, text: str) -> Optional[Dict]:
        """Extract military service information"""
        # Check for negative context first
        negative_patterns = [
            "no military",
            "not military",
            "non-military",
            "without military",
            "never served",
            "civilian",
        ]

        for pattern in negative_patterns:
            if pattern in text:
                return None

        military_keywords = [
            "air force",
            "army",
            "navy",
            "marine",
            "coast guard",
            "military",
            "veteran",
            "active duty",
            "reserve",
            "national guard",
            "usafa",
            "west point",
            "usma",
            "naval academy",
            "usna",
            "officer",
            "enlisted",
            "sergeant",
            "lieutenant",
            "captain",
            "major",
            "colonel",
        ]

        military_info = {}
        for keyword in military_keywords:
            if keyword in text:
                if "branch" not in military_info:
                    if any(
                        branch in keyword
                        for branch in ["air force", "army", "navy", "marine", "coast guard"]
                    ):
                        military_info["branch"] = keyword
                military_info["veteran"] = True

                # Check for academy
                if any(
                    academy in keyword
                    for academy in ["usafa", "usma", "usna", "west point", "naval academy"]
                ):
                    military_info["academy"] = keyword

        return military_info if military_info else None

    def _extract_certifications(self, text: str) -> List[str]:
        """Extract professional certifications"""
        certifications = []

        cert_patterns = [
            "aws certified",
            "azure certified",
            "google certified",
            "pmp",
            "cissp",
            "ccna",
            "ccnp",
            "comptia",
            "scrum master",
            "six sigma",
            "itil",
            "cpa",
            "cfa",
        ]

        for cert in cert_patterns:
            if cert in text:
                certifications.append(cert)

        return certifications

    def _estimate_experience(self, text: str) -> int:
        """Estimate years of experience from resume"""
        # Look for year patterns (e.g., 2018-2023)
        year_pattern = r"\b(19\d{2}|20\d{2})\b"
        years = re.findall(year_pattern, text)

        if years:
            years = [int(y) for y in years]
            # Rough estimate: difference between earliest and latest year
            return max(years) - min(years)

        # Look for explicit mentions
        exp_pattern = r"(\d+)\+?\s*years?\s*(?:of\s*)?experience"
        match = re.search(exp_pattern, text)
        if match:
            return int(match.group(1))

        return 0

    def _extract_keywords(self, text: str) -> List[str]:
        """Extract important keywords for matching"""
        # This would ideally use TF-IDF or similar
        # For now, extract nouns and important terms
        keywords = []

        # Industry keywords
        industries = [
            "fintech",
            "healthtech",
            "edtech",
            "biotech",
            "cleantech",
            "saas",
            "b2b",
            "b2c",
            "marketplace",
            "platform",
            "ai",
            "machine learning",
            "data science",
            "analytics",
            "blockchain",
            "crypto",
            "web3",
            "defi",
        ]

        # Role keywords
        roles = [
            "engineer",
            "developer",
            "architect",
            "manager",
            "director",
            "analyst",
            "scientist",
            "designer",
            "consultant",
            "lead",
            "senior",
            "principal",
            "staff",
            "founder",
            "ceo",
            "cto",
        ]

        all_keywords = industries + roles

        for keyword in all_keywords:
            if keyword in text:
                keywords.append(keyword)

        return keywords

    def _build_search_elements(self, data: Dict) -> List[Dict]:
        """
        Build search elements that will be used for matching profiles
        Each element has a category, value, and weight for scoring
        """
        elements = []

        # Add education elements
        for edu in data.get("education", []):
            if "institution" in edu:
                elements.append(
                    {
                        "category": "education",
                        "value": edu["institution"],
                        "weight": 30,  # High weight for education matches
                        "display": f"Alumni: {edu['institution'].title()}",
                    }
                )

        # Add company elements
        for company in data.get("companies", []):
            elements.append(
                {
                    "category": "company",
                    "value": company.lower(),
                    "weight": 25,  # Good weight for company matches
                    "display": f"Former {company.title()}",
                }
            )

        # Add military elements
        if data.get("military_service"):
            military = data["military_service"]
            if military.get("academy"):
                elements.append(
                    {
                        "category": "military",
                        "value": military["academy"],
                        "weight": 40,  # Very high weight for military academy
                        "display": f"{military['academy'].upper()} Alumni",
                    }
                )
            elif military.get("branch"):
                elements.append(
                    {
                        "category": "military",
                        "value": military["branch"],
                        "weight": 30,
                        "display": f"{military['branch'].title()} Veteran",
                    }
                )

        # Add skill elements (lower weight)
        for skill in data.get("skills", [])[:10]:  # Top 10 skills
            elements.append(
                {
                    "category": "skill",
                    "value": skill,
                    "weight": 10,
                    "display": f"Shared skill: {skill}",
                }
            )

        # Add certification elements
        for cert in data.get("certifications", []):
            elements.append(
                {
                    "category": "certification",
                    "value": cert,
                    "weight": 15,
                    "display": f"Both have {cert.upper()}",
                }
            )

        # Add keyword elements
        for keyword in data.get("keywords", [])[:5]:  # Top 5 keywords
            elements.append(
                {"category": "keyword", "value": keyword, "weight": 5, "display": keyword.title()}
            )

        return elements


def parse_resume_file(file_content: bytes, filename: str) -> Dict:
    """Convenience function to parse a resume file"""
    parser = ResumeParser()
    return parser.parse_resume(file_content, filename)
