"""
LLM-based Profile Analyzer using Google Gemini Flash
Intelligently matches LinkedIn profiles against user's background
"""

import google.generativeai as genai
import json
from typing import Dict, List, Any
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
        self.api_key = api_key or os.getenv('GEMINI_API_KEY')
        if not self.api_key:
            raise ValueError("Gemini API key required")
        
        genai.configure(api_key=self.api_key)
        
        # Use Gemini Flash for fast, cost-effective analysis
        self.model = genai.GenerativeModel('gemini-1.5-flash')
        
    def analyze_profile(self, profile_data: Dict, user_search_elements: List[Dict]) -> Dict:
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
            
            # Parse the JSON response
            result = json.loads(response.text)
            
            # Calculate total score
            total_score = sum(m['points'] for m in result['matches'])
            total_score = min(total_score, 100)  # Cap at 100
            
            # Determine tier
            tier = 'high' if total_score >= 70 else 'medium' if total_score >= 40 else 'low'
            
            return {
                'score': total_score,
                'tier': tier,
                'matches': result['matches'],
                'insights': result.get('insights', []),
                'hidden_connections': result.get('hidden_connections', []),
                'recommendation': result.get('recommendation', '')
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
            category = elem.get('category', 'other')
            if category not in elements_by_category:
                elements_by_category[category] = []
            elements_by_category[category].append({
                'value': elem['value'],
                'display': elem.get('display', elem['value']),
                'weight': elem['weight']
            })
        
        prompt = f"""Analyze this LinkedIn profile and find connections to the user's background.

PROFILE DATA:
Name: {profile.get('name', 'Unknown')}
Headline: {profile.get('headline', '')}
About: {profile.get('about', '')[:500]}  # Truncate for token limit
Full Text: {profile.get('text', '')[:1000]}  # Include searchable text

USER'S BACKGROUND TO MATCH AGAINST:
{json.dumps(elements_by_category, indent=2)}

INSTRUCTIONS:
1. Find ALL connections between the profile and user's background
2. Look for direct mentions AND indirect/implied connections
3. Recognize variations, abbreviations, and informal references
4. For military connections, recognize service academies, units, bases, ranks
5. For companies, recognize subsidiaries, divisions, and former names
6. For education, recognize abbreviations (USAFA, MIT, etc.) and informal references

IMPORTANT MATCHING RULES:
- "USAFA", "Air Force Academy", "United States Air Force Academy", "Academy" (in military context) all match "air force academy"
- "Zoomie" or "Academy grad" in military context matches service academies
- Company variations like "Google", "Alphabet", "Google Cloud" all match
- Skills can be implied from job descriptions
- Award the FULL weight for any match, partial matches still get full points

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
    "connections that aren't obvious from text matching"
  ],
  "insights": [
    "strategic insights about this connection"
  ],
  "recommendation": "one sentence on why to connect"
}}

Be generous with matching - if there's any reasonable connection, include it."""
        
        return prompt
    
    def _fallback_scoring(self, profile: Dict, search_elements: List[Dict]) -> Dict:
        """Fallback to basic string matching if LLM fails"""
        matches = []
        score = 0
        
        profile_text = f"{profile.get('text', '')} {profile.get('headline', '')} {profile.get('about', '')}".lower()
        
        for element in search_elements:
            search_value = element.get('value', '').lower()
            if search_value in profile_text:
                matches.append({
                    'found_in_profile': search_value,
                    'matches_element': element.get('display', search_value),
                    'points': element['weight'],
                    'category': element.get('category', 'keyword')
                })
                score += element['weight']
        
        score = min(score, 100)
        tier = 'high' if score >= 70 else 'medium' if score >= 40 else 'low'
        
        return {
            'score': score,
            'tier': tier,
            'matches': matches,
            'insights': [],
            'hidden_connections': [],
            'recommendation': ''
        }
    
    def generate_enhanced_message(self, profile: Dict, analysis: Dict) -> str:
        """Generate a highly personalized message based on LLM analysis"""
        
        prompt = f"""Generate a personalized LinkedIn connection request message.

PROFILE:
Name: {profile.get('name', 'there')}
Headline: {profile.get('headline', '')}

CONNECTIONS FOUND:
{json.dumps(analysis.get('matches', []), indent=2)}

INSIGHTS:
{json.dumps(analysis.get('insights', []), indent=2)}

Create a brief, genuine connection request that:
1. Mentions the strongest/most unique connection
2. Shows authentic interest
3. Suggests mutual value
4. Keeps it under 300 characters
5. Doesn't sound generic or salesy

Return only the message text, no quotes or explanation."""

        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except:
            # Fallback message
            name = profile.get('name', '').split()[0] if profile.get('name') else 'there'
            if analysis['matches']:
                connection = analysis['matches'][0].get('matches_element', 'your background')
                return f"Hi {name}! I noticed we share {connection}. Would love to connect and exchange insights!"
            return f"Hi {name}! Your background is impressive. Would love to connect and learn from your experience!"