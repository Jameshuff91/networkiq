"""
LLM-based Profile Analyzer using Google Gemini Flash
Intelligently matches LinkedIn profiles against user's background
"""

import google.generativeai as genai
import json
from typing import Dict, List
import os
from dataclasses import dataclass


@dataclass
class ProfileMatch:
    """Represents a match between profile and user background"""

    category: str  # education, company, military, skill, etc.
    match_text: str  # What was found in the profile
    user_element: str  # What from user's background it matches
    confidence: float  # 0-1 confidence score
    weight: int  # Points to assign


class ProfileAnalyzer:
    def __init__(self, api_key: str = None):
        """Initialize the Gemini Flash analyzer"""
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("Gemini API key required")

        genai.configure(api_key=self.api_key)

        # Use Gemini Flash for fast, cost-effective analysis
        self.model = genai.GenerativeModel("gemini-1.5-flash")

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

        # Build the prompt
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

            # Log raw matches before filtering
            print(f"Raw matches from LLM: {len(result.get('matches', []))} matches")
            for i, match in enumerate(result.get("matches", [])[:3]):
                print(
                    f"  Match {i+1}: {match.get('matches_element')} (confidence: {match.get('confidence', 'N/A')})"
                )

            # Filter out low-confidence matches and NULL values
            CONFIDENCE_THRESHOLD = 0.3
            valid_matches = []
            for match in result.get("matches", []):
                found_text = match.get("found_in_profile", "").strip().upper()

                # Force confidence to 0 if NULL or no real match found
                if (
                    found_text in ["NULL", "NONE", "N/A", ""]
                    or "NO DIRECT MENTION" in found_text
                    or "NOTHING STATES" in found_text
                ):
                    match["confidence"] = 0.0
                    print(
                        f"Forcing confidence to 0.0 for NULL/empty match: {match.get('matches_element', 'unknown')}"
                    )

                confidence = match.get(
                    "confidence", 1.0
                )  # Default to 1.0 if not specified
                if confidence >= CONFIDENCE_THRESHOLD:
                    valid_matches.append(match)
                else:
                    print(
                        f"Filtering out low-confidence match ({confidence}): {match.get('matches_element', 'unknown')}"
                    )

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

        # Debug logging
        print(f"\n=== BUILDING LLM PROMPT ===")
        print(f"Profile name: {profile.get('name', 'Unknown')}")
        print(f"Profile headline: {profile.get('headline', '')[:100]}")
        print(f"Profile text preview: {profile.get('text', '')[:300]}")
        print(f"User search elements by category:")
        for cat, elems in elements_by_category.items():
            print(f"  {cat}: {[e['display'] for e in elems[:3]]}")

        prompt = f"""Analyze this LinkedIn profile and find connections to the user's background.

PROFILE DATA:
Name: {profile.get('name', 'Unknown')}
Headline: {profile.get('headline', '')}
About: {profile.get('about', '')[:500]}  # Truncate for token limit
Full Text: {profile.get('text', '')[:1000]}  # Include searchable text

USER'S BACKGROUND TO MATCH AGAINST:
{json.dumps(elements_by_category, indent=2)}

SPECIAL MATCHING RULES:

1. MILITARY BROTHERHOOD (High Priority):
   - ANY military service matches ANY other military service (e.g., Air Force Academy grad matches Army veteran)
   - This includes: veterans, active duty, reserves, National Guard, service academies, ROTC
   - Award FULL POINTS for military-to-military connections even if different branches
   - Examples: "West Point" matches "Naval Academy", "Army" matches "Air Force", "Veteran" matches any military

2. COMPANY MATCHING (Exact Match Required):
   - Only match if it's the EXACT SAME company or a direct subsidiary
   - "Google" matches "Google", "Alphabet", or "Google Cloud"
   - "Palantir" only matches "Palantir" or "Palantir Technologies"
   - Do NOT match different companies in the same industry

3. EDUCATION MATCHING (Exact Match Required):
   - Only match if it's the EXACT SAME institution
   - "MIT" matches "MIT" or "Massachusetts Institute of Technology"
   - Do NOT match different schools even if both are prestigious

4. SKILLS & KEYWORDS (Flexible Matching):
   - Match if the skill/keyword is clearly present
   - Can be more flexible with variations

CRITICAL:
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
