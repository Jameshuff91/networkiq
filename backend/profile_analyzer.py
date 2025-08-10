"""
LLM-based Profile Analyzer using Google Gemini Flash
Intelligently matches LinkedIn profiles against user's background
Enhanced with LangExtract for precise extraction and matching
"""

import google.generativeai as genai
import json
from typing import Dict, List, Optional
import os
from dataclasses import dataclass

try:
    from langextract import extract
    from langextract.data import ExampleData, Extraction, FormatType
    LANGEXTRACT_AVAILABLE = True
except ImportError:
    LANGEXTRACT_AVAILABLE = False
    print("LangExtract not available for profile analysis")


@dataclass
class ProfileMatch:
    """Represents a match between profile and user background"""

    category: str  # education, company, military, skill, etc.
    match_text: str  # What was found in the profile
    user_element: str  # What from user's background it matches
    confidence: float  # 0-1 confidence score
    weight: int  # Points to assign


class ProfileAnalyzer:
    def __init__(self, api_key: str = None, use_langextract: bool = True):
        """Initialize the Gemini Flash analyzer with optional LangExtract support"""
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("Gemini API key required")

        genai.configure(api_key=self.api_key)

        # Use Gemini Flash for fast, cost-effective analysis
        self.model = genai.GenerativeModel("gemini-1.5-flash")
        
        # Enable LangExtract if available
        self.use_langextract = use_langextract and LANGEXTRACT_AVAILABLE
        if self.use_langextract:
            print("LangExtract enabled for enhanced profile analysis")

    def analyze_profile(
        self, profile_data: Dict, user_search_elements: List[Dict]
    ) -> Dict:
        """
        Analyze a LinkedIn profile against user's search elements using LLM

        Args:
            profile_data: Parsed LinkedIn profile data
            user_search_elements: User's background elements to match against

        Returns:
            Analysis results with matches, score, and insights
        """
        
        # Try LangExtract first if enabled
        if self.use_langextract:
            try:
                print("Analyzing profile with LangExtract...")
                result = self._analyze_with_langextract(profile_data, user_search_elements)
                if result:
                    print("LangExtract analysis successful")
                    return result
            except Exception as e:
                print(f"LangExtract analysis failed: {e}, falling back to standard Gemini")

        # Build the prompt for standard Gemini analysis
        prompt = self._build_analysis_prompt(profile_data, user_search_elements)

        try:
            # Call Gemini Flash
            response = self.model.generate_content(prompt)

            # Clean the response text (remove markdown code blocks if present)
            response_text = response.text.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]  # Remove ```json
            if response_text.startswith("```"):
                response_text = response_text[3:]  # Remove ```
            if response_text.endswith("```"):
                response_text = response_text[:-3]  # Remove trailing ```
            response_text = response_text.strip()

            # Parse the JSON response
            result = json.loads(response_text)

            # Filter out low-confidence matches and NULL values
            CONFIDENCE_THRESHOLD = 0.3
            valid_matches = []
            for match in result["matches"]:
                found_text = match.get("found_in_profile", "").strip().upper()
                
                # Force confidence to 0 if NULL or no real match found
                if found_text in ["NULL", "NONE", "N/A", ""] or "NO DIRECT MENTION" in found_text or "NOTHING STATES" in found_text:
                    match["confidence"] = 0.0
                    print(f"Forcing confidence to 0.0 for NULL/empty match: {match.get('matches_element', 'unknown')}")
                
                confidence = match.get("confidence", 1.0)  # Default to 1.0 if not specified
                if confidence >= CONFIDENCE_THRESHOLD:
                    valid_matches.append(match)
                else:
                    print(f"Filtering out low-confidence match ({confidence}): {match.get('matches_element', 'unknown')}")

            # Calculate total score from valid matches only
            total_score = sum(m["points"] for m in valid_matches)
            total_score = min(total_score, 100)  # Cap at 100

            # Determine tier (40+ is high, 20-39 is medium, <20 is low)
            tier = (
                "high"
                if total_score >= 40
                else "medium" if total_score >= 20 else "low"
            )

            return {
                "score": total_score,
                "tier": tier,
                "matches": valid_matches,  # Return only valid matches
                "insights": result.get("insights", []),
                "hidden_connections": result.get("hidden_connections", []),
                "recommendation": result.get("recommendation", ""),
            }

        except Exception as e:
            print(f"Error analyzing profile: {e}")
            # Fallback to basic scoring if LLM fails
            return self._fallback_scoring(profile_data, user_search_elements)
    
    def _analyze_with_langextract(self, profile_data: Dict, user_search_elements: List[Dict]) -> Optional[Dict]:
        """
        Analyze profile using LangExtract for precise entity extraction and matching
        """
        # Combine profile text for analysis
        profile_text = f"""
        Name: {profile_data.get('name', '')}
        Headline: {profile_data.get('headline', '')}
        About: {profile_data.get('about', '')}
        Experience: {profile_data.get('experienceText', '')}
        Education: {profile_data.get('educationText', '')}
        Full Text: {profile_data.get('text', '')}
        """
        
        # Build extraction prompt focused on finding matches
        extraction_prompt = f"""
        Analyze this LinkedIn profile and extract entities that match the user's background.
        
        User's Background Elements to Find:
        {json.dumps(user_search_elements, indent=2)}
        
        For each match found, extract:
        1. The exact text from the profile that matches
        2. Which user background element it matches
        3. The category (education, company, military, skill, location, certification)
        4. A confidence score (0.0-1.0) based on how exact the match is
        
        Focus on finding:
        - Education institutions (universities, colleges, schools)
        - Companies and organizations worked at
        - Military service (branch, academy, rank)
        - Technical skills and tools
        - Certifications and qualifications
        - Geographic locations
        - Notable achievements or roles
        
        Return as structured JSON with a "matches" array.
        """
        
        # Create example for better extraction
        example_profile = """
        Name: Jane Smith
        Headline: Software Engineer at Google
        Education: Stanford University - BS Computer Science
        Experience: Google - Software Engineer (2020-Present)
        """
        
        example_extractions = [
            Extraction(extraction_class="company", extraction_text="Google"),
            Extraction(extraction_class="education", extraction_text="Stanford University"),
            Extraction(extraction_class="skill", extraction_text="Software Engineer"),
        ]
        
        example = ExampleData(
            text=example_profile,
            extractions=example_extractions
        )
        
        try:
            # Perform extraction with LangExtract
            result = extract(
                text_or_documents=profile_text,
                prompt_description=extraction_prompt,
                examples=[example],
                model_id="gemini-1.5-flash",
                api_key=self.api_key,
                format_type=FormatType.JSON,
                debug=False,
                temperature=0.3  # Lower temperature for more consistent matching
            )
            
            # Parse the result
            if hasattr(result, 'data'):
                extracted_data = result.data
            else:
                extracted_data = json.loads(str(result)) if isinstance(result, str) else {}
            
            # Process extracted matches
            matches = []
            if "matches" in extracted_data:
                for match_data in extracted_data["matches"]:
                    # Find corresponding user element
                    user_element = self._find_matching_element(
                        match_data.get("text", ""),
                        user_search_elements
                    )
                    
                    if user_element:
                        matches.append({
                            "category": match_data.get("category", user_element["category"]),
                            "found_in_profile": match_data.get("text", ""),
                            "matches_element": user_element["display"],
                            "points": user_element["weight"],
                            "confidence": match_data.get("confidence", 0.8),
                            "reasoning": f"Found exact match for {user_element['category']}"
                        })
            
            # If we got extractions instead of matches
            elif hasattr(result, 'extractions'):
                matches = self._process_extractions(result.extractions, user_search_elements)
            
            # Calculate score and tier
            total_score = sum(m["points"] for m in matches if m.get("confidence", 0) >= 0.3)
            total_score = min(total_score, 100)
            
            tier = (
                "high" if total_score >= 40
                else "medium" if total_score >= 20
                else "low"
            )
            
            # Generate insights based on matches
            insights = self._generate_insights(matches, profile_data)
            
            return {
                "score": total_score,
                "tier": tier,
                "matches": matches,
                "insights": insights,
                "hidden_connections": self._find_hidden_connections(matches),
                "recommendation": self._generate_recommendation(matches, profile_data),
                "extraction_method": "langextract"
            }
            
        except Exception as e:
            print(f"LangExtract processing error: {e}")
            return None
    
    def _find_matching_element(self, extracted_text: str, user_elements: List[Dict]) -> Optional[Dict]:
        """Find the user element that best matches the extracted text"""
        extracted_lower = extracted_text.lower()
        
        for element in user_elements:
            element_value = element.get("value", "").lower()
            # Check for exact or partial match
            if element_value in extracted_lower or extracted_lower in element_value:
                return element
            
            # Check for common variations
            if element.get("category") == "education":
                # Handle university name variations
                if self._match_education(element_value, extracted_lower):
                    return element
            elif element.get("category") == "company":
                # Handle company name variations
                if self._match_company(element_value, extracted_lower):
                    return element
        
        return None
    
    def _match_education(self, user_edu: str, profile_edu: str) -> bool:
        """Check if education institutions match (handling variations)"""
        # Common abbreviations and variations
        edu_variations = {
            "mit": ["massachusetts institute of technology", "mit"],
            "stanford": ["stanford university", "stanford"],
            "harvard": ["harvard university", "harvard college", "harvard"],
            "usafa": ["air force academy", "united states air force academy", "usafa"],
            "west point": ["west point", "usma", "united states military academy"],
        }
        
        for key, variations in edu_variations.items():
            if key in user_edu:
                for variation in variations:
                    if variation in profile_edu:
                        return True
        
        return False
    
    def _match_company(self, user_company: str, profile_company: str) -> bool:
        """Check if companies match (handling subsidiaries and variations)"""
        company_variations = {
            "google": ["google", "alphabet", "youtube"],
            "meta": ["meta", "facebook", "instagram", "whatsapp"],
            "amazon": ["amazon", "aws", "amazon web services"],
            "microsoft": ["microsoft", "linkedin", "github"],
        }
        
        for key, variations in company_variations.items():
            if key in user_company:
                for variation in variations:
                    if variation in profile_company:
                        return True
        
        return False
    
    def _process_extractions(self, extractions: List, user_elements: List[Dict]) -> List[Dict]:
        """Process LangExtract extractions into matches"""
        matches = []
        
        for extraction in extractions:
            user_element = self._find_matching_element(
                extraction.extraction_text,
                user_elements
            )
            
            if user_element:
                matches.append({
                    "category": user_element["category"],
                    "found_in_profile": extraction.extraction_text,
                    "matches_element": user_element["display"],
                    "points": user_element["weight"],
                    "confidence": 0.9,  # High confidence from LangExtract
                    "reasoning": f"LangExtract found {user_element['category']} match"
                })
        
        return matches
    
    def _generate_insights(self, matches: List[Dict], profile_data: Dict) -> List[str]:
        """Generate strategic insights based on matches"""
        insights = []
        
        # Check for strong connections
        high_weight_matches = [m for m in matches if m["points"] >= 30]
        if high_weight_matches:
            insights.append(f"Strong connection through {high_weight_matches[0]['category']}")
        
        # Check for multiple touchpoints
        categories = set(m["category"] for m in matches)
        if len(categories) >= 3:
            insights.append("Multiple connection points across different areas")
        
        return insights
    
    def _find_hidden_connections(self, matches: List[Dict]) -> List[str]:
        """Identify hidden connection patterns"""
        connections = []
        
        categories = [m["category"] for m in matches]
        if "education" in categories:
            connections.append("Alumni connection")
        if "company" in categories:
            connections.append("Professional network overlap")
        if "military" in categories:
            connections.append("Military bond")
        
        return connections
    
    def _generate_recommendation(self, matches: List[Dict], profile_data: Dict) -> str:
        """Generate connection recommendation"""
        if not matches:
            return "Consider connecting to expand your network"
        
        strongest_match = max(matches, key=lambda x: x["points"])
        return f"Strong connection opportunity through {strongest_match['matches_element']}"

    def _build_analysis_prompt(self, profile: Dict, search_elements: List[Dict]) -> str:
        """Build the prompt for Gemini Flash"""

        # Group search elements by category for clarity
        elements_by_category = {}
        for elem in search_elements:
            category = elem.get("category", "other")
            if category not in elements_by_category:
                elements_by_category[category] = []
            elements_by_category[category].append(
                {
                    "value": elem["value"],
                    "display": elem.get("display", elem["value"]),
                    "weight": elem["weight"],
                }
            )

        prompt = f"""Analyze this LinkedIn profile and find connections to the user's background.

PROFILE DATA:
Name: {profile.get('name', 'Unknown')}
Headline: {profile.get('headline', '')}
About: {profile.get('about', '')[:500]}  # Truncate for token limit
Full Text: {profile.get('text', '')[:1000]}  # Include searchable text

USER'S BACKGROUND TO MATCH AGAINST:
{json.dumps(elements_by_category, indent=2)}

INSTRUCTIONS:
1. Find connections between the profile and user's background
2. BE STRICT about what constitutes a match - only match if it's the SAME entity
3. For military connections, recognize service academies, units, bases, ranks
4. For companies, recognize subsidiaries, divisions, and former names of the SAME company
5. For education, ONLY match if it's the SAME institution (e.g., both went to MIT, both went to Stanford)

CRITICAL MATCHING RULES:
- Education: MUST be the SAME school/university. Stanford ≠ Johns Hopkins, MIT ≠ Harvard, etc.
- "USAFA", "Air Force Academy", "United States Air Force Academy" all refer to the same academy
- Company variations like "Google", "Alphabet", "Google Cloud" refer to the same company
- Different universities are NEVER a match, even if both are prestigious
- Different companies are NEVER a match, unless one is a subsidiary/division of the other

CONFIDENCE SCORING RULES:
- If there's NO mention of something in the profile, confidence MUST be 0.0-0.2
- "No direct mention" or "Nothing states" = confidence 0.0-0.1 (will be filtered out)
- "NULL", "None", "N/A", or empty string = confidence MUST be 0.0 (NOT A MATCH!)
- NULL or missing data is NEVER a match - confidence MUST be 0.0
- Only use confidence > 0.3 when you find an ACTUAL match with real text
- Confidence 0.8-1.0: Clear, explicit match (e.g., "Johns Hopkins" found when looking for "Johns Hopkins")
- Confidence 0.5-0.7: Strong implied match (e.g., "USAFA grad" when looking for "Air Force Academy")
- Confidence 0.3-0.4: Weak but valid match (e.g., abbreviations or informal references)
- Confidence 0.0-0.2: NO match found (will be filtered out)

Return ONLY valid JSON in this format:
{{
  "matches": [
    {{
      "category": "education|company|military|skill|certification|keyword",
      "found_in_profile": "exact text or description found",
      "matches_element": "which user element this matches",
      "points": <weight from user element>,
      "confidence": 0.0-1.0,
      "reasoning": "brief explanation"
    }}
  ],
  "hidden_connections": [
    "Short category labels ONLY like: 'Same university', 'Fellow veteran', 'Similar region', 'Shared company', 'Common skillset', 'Military connection', 'Industry overlap'"
  ],
  "insights": [
    "ONE strategic insight about this connection (max 2 sentences)"
  ],
  "recommendation": "one sentence on why to connect"
}}

CRITICAL REMINDERS:
1. Only match the SAME institutions/companies. Stanford ≠ Johns Hopkins
2. If you write "No direct mention", "Nothing states", "NULL", "None", confidence MUST be 0.0-0.1
3. DO NOT give points for things that aren't actually in the profile!
4. NULL is NOT a match! If found_in_profile is NULL, confidence = 0.0
5. NEVER assign confidence > 0.2 unless you found ACTUAL TEXT in the profile"""

        return prompt

    def _fallback_scoring(self, profile: Dict, search_elements: List[Dict]) -> Dict:
        """Fallback to basic string matching if LLM fails"""
        matches = []
        score = 0

        profile_text = f"{profile.get('text', '')} {profile.get('headline', '')} {profile.get('about', '')}".lower()

        for element in search_elements:
            search_value = element.get("value", "").lower()
            if search_value in profile_text:
                matches.append(
                    {
                        "found_in_profile": search_value,
                        "matches_element": element.get("display", search_value),
                        "points": element["weight"],
                        "category": element.get("category", "keyword"),
                    }
                )
                score += element["weight"]

        score = min(score, 100)
        tier = "high" if score >= 40 else "medium" if score >= 20 else "low"

        return {
            "score": score,
            "tier": tier,
            "matches": matches,
            "insights": [],
            "hidden_connections": [],
            "recommendation": "",
        }

    def generate_enhanced_message(
        self, profile: Dict, analysis: Dict, user_background: List[Dict] = None
    ) -> str:
        """Generate a highly personalized message based on LLM analysis"""

        print(
            f"generate_enhanced_message called with user_background: {user_background is not None}"
        )
        if user_background:
            print(f"User background items: {len(user_background)}")
            print(f"First 3 items: {user_background[:3]}")

        # Extract user's actual background from search elements
        user_info = ""
        if user_background:
            companies = [
                elem["display"]
                for elem in user_background
                if elem.get("category") == "company"
            ]
            education = [
                elem["display"]
                for elem in user_background
                if elem.get("category") == "education"
            ]
            skills = [
                elem["display"]
                for elem in user_background
                if elem.get("category") == "skill"
            ]

            print(f"Found companies: {companies}")
            print(f"Found education: {education}")
            print(f"Found skills: {skills}")

            if companies:
                user_info += f"My companies: {', '.join(companies[:3])}\n"
            if education:
                user_info += f"My education: {', '.join(education[:2])}\n"
            if skills:
                user_info += f"My expertise: {', '.join(skills[:3])}\n"

        prompt = f"""Generate a personalized LinkedIn connection request message.

THEIR PROFILE:
Name: {profile.get('name', 'there')}
Headline: {profile.get('headline', '')}
Company: {profile.get('company', '')}

MY BACKGROUND:
{user_info if user_info else "Professional with diverse experience"}

CONNECTIONS FOUND:
{json.dumps(analysis.get('matches', []), indent=2)}

INSIGHTS:
{json.dumps(analysis.get('insights', []), indent=2)}

Create a brief, genuine connection request that:
1. Mentions MY specific company/school/experience (not placeholders like [your field])
2. References the strongest connection point between us
3. Shows authentic interest in THEIR work
4. Suggests mutual value
5. Keeps it under 300 characters
6. Uses specific details, NO PLACEHOLDERS or brackets
7. IMPORTANT: Do NOT assume we work at the same company unless there's a direct company match in the connections found
8. We are connecting across companies/organizations, not as colleagues

Return only the message text, no quotes or explanation."""

        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            print(f"Message generation error: {e}")
            # Fallback message with actual user background
            name = (
                profile.get("name", "").split()[0] if profile.get("name") else "there"
            )

            # Get user's first company for fallback
            my_company = "my work"
            if user_background:
                companies = [
                    elem["display"]
                    for elem in user_background
                    if elem.get("category") == "company"
                ]
                if companies:
                    my_company = f"my experience at {companies[0]}"

            if analysis["matches"]:
                connection = analysis["matches"][0].get(
                    "matches_element", "similar interests"
                )
                return f"Hi {name}! I noticed we share {connection}. Given {my_company}, I'd love to connect and exchange insights!"
            return f"Hi {name}! Your background at {profile.get('company', 'your company')} is impressive. With {my_company}, I'd value connecting!"
    
    def analyze_profiles_batch(
        self, profiles: List[Dict], user_search_elements: List[Dict], max_workers: int = 5
    ) -> List[Dict]:
        """
        Analyze multiple profiles in batch using LangExtract for efficiency
        
        Args:
            profiles: List of LinkedIn profile data dictionaries
            user_search_elements: User's background elements to match against
            max_workers: Maximum parallel workers for batch processing
        
        Returns:
            List of analysis results for each profile
        """
        if not profiles:
            return []
        
        # If LangExtract is available and we have multiple profiles, use batch processing
        if self.use_langextract and len(profiles) > 1:
            try:
                print(f"Batch analyzing {len(profiles)} profiles with LangExtract...")
                return self._batch_analyze_with_langextract(profiles, user_search_elements, max_workers)
            except Exception as e:
                print(f"Batch LangExtract failed: {e}, falling back to sequential processing")
        
        # Fallback to sequential processing
        results = []
        for i, profile in enumerate(profiles):
            print(f"Analyzing profile {i+1}/{len(profiles)}: {profile.get('name', 'Unknown')}")
            result = self.analyze_profile(profile, user_search_elements)
            results.append(result)
        
        return results
    
    def _batch_analyze_with_langextract(
        self, profiles: List[Dict], user_search_elements: List[Dict], max_workers: int
    ) -> List[Dict]:
        """
        Perform batch analysis using LangExtract's parallel processing capabilities
        """
        # Prepare documents for batch processing
        documents = []
        for profile in profiles:
            profile_text = f"""
            Name: {profile.get('name', '')}
            Headline: {profile.get('headline', '')}
            About: {profile.get('about', '')}
            Experience: {profile.get('experienceText', '')}
            Education: {profile.get('educationText', '')}
            Full Text: {profile.get('text', '')}
            """
            documents.append(profile_text)
        
        # Build extraction prompt
        extraction_prompt = f"""
        Extract entities from each LinkedIn profile that match the user's background.
        
        User's Background Elements:
        {json.dumps(user_search_elements, indent=2)}
        
        For each profile, identify:
        - Matching education institutions
        - Matching companies
        - Matching skills
        - Military connections
        - Geographic connections
        - Certifications
        
        Return structured data with matches, confidence scores, and categories.
        """
        
        # Create example
        example_profile = "Name: John Doe\nEducation: MIT\nCompany: Google"
        example_extractions = [
            Extraction(extraction_class="education", extraction_text="MIT"),
            Extraction(extraction_class="company", extraction_text="Google"),
        ]
        
        example = ExampleData(
            text=example_profile,
            extractions=example_extractions
        )
        
        try:
            # Batch extract with parallel processing
            results = extract(
                text_or_documents=documents,
                prompt_description=extraction_prompt,
                examples=[example],
                model_id="gemini-1.5-flash",
                api_key=self.api_key,
                format_type=FormatType.JSON,
                debug=False,
                max_workers=max_workers,
                batch_length=min(10, len(profiles)),  # Process in batches of 10
                temperature=0.3
            )
            
            # Process results for each profile
            analyzed_profiles = []
            
            # Handle different result formats
            if isinstance(results, list):
                for i, (profile, result) in enumerate(zip(profiles, results)):
                    analysis = self._process_batch_result(result, profile, user_search_elements)
                    analyzed_profiles.append(analysis)
            else:
                # Single result, apply to all profiles
                for profile in profiles:
                    analysis = self._process_batch_result(results, profile, user_search_elements)
                    analyzed_profiles.append(analysis)
            
            return analyzed_profiles
            
        except Exception as e:
            print(f"Batch processing error: {e}")
            # Fall back to individual processing
            return [self.analyze_profile(p, user_search_elements) for p in profiles]
    
    def _process_batch_result(
        self, result, profile: Dict, user_search_elements: List[Dict]
    ) -> Dict:
        """Process a single result from batch extraction"""
        matches = []
        
        # Extract matches from result
        if hasattr(result, 'data'):
            data = result.data
            if "matches" in data:
                for match in data["matches"]:
                    user_element = self._find_matching_element(
                        match.get("text", ""),
                        user_search_elements
                    )
                    if user_element:
                        matches.append({
                            "category": user_element["category"],
                            "found_in_profile": match.get("text", ""),
                            "matches_element": user_element["display"],
                            "points": user_element["weight"],
                            "confidence": match.get("confidence", 0.8),
                            "reasoning": "Batch extraction match"
                        })
        
        elif hasattr(result, 'extractions'):
            matches = self._process_extractions(result.extractions, user_search_elements)
        
        # Calculate score
        total_score = sum(m["points"] for m in matches if m.get("confidence", 0) >= 0.3)
        total_score = min(total_score, 100)
        
        tier = (
            "high" if total_score >= 40
            else "medium" if total_score >= 20
            else "low"
        )
        
        return {
            "profile_name": profile.get("name", "Unknown"),
            "score": total_score,
            "tier": tier,
            "matches": matches,
            "insights": self._generate_insights(matches, profile),
            "hidden_connections": self._find_hidden_connections(matches),
            "recommendation": self._generate_recommendation(matches, profile),
            "extraction_method": "langextract_batch"
        }
