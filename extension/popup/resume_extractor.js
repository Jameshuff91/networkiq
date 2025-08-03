/**
 * Client-side resume text extraction and keyword identification
 * Extracts text from files and identifies key elements without sending large files
 */

class ResumeExtractor {
  /**
   * Extract text content from file
   */
  static async extractText(file) {
    const fileType = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (fileType === '.txt') {
      return await file.text();
    } else if (fileType === '.pdf' || fileType === '.docx' || fileType === '.doc') {
      // For binary files, we'll extract text on backend
      // But first try to get just the text content
      return await this.extractTextFromBinary(file);
    }
    
    throw new Error('Unsupported file type');
  }

  /**
   * Extract text from binary files (simplified approach)
   * For DOCX files, we can extract some text directly
   */
  static async extractTextFromBinary(file) {
    // For now, return a placeholder - the backend will handle this
    // But we can try to extract some text from DOCX files
    if (file.name.endsWith('.docx')) {
      try {
        // DOCX files are ZIP archives with XML inside
        // We'll just send to backend for proper parsing
        return null; // Signal to use backend parsing
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  /**
   * Extract key elements from resume text locally
   * This reduces the amount of data we need to send
   */
  static extractKeyElements(text) {
    const elements = {
      education: [],
      companies: [],
      skills: [],
      military: [],
      certifications: [],
      keywords: []
    };

    // Convert to lowercase for matching
    const lowerText = text.toLowerCase();
    
    // Extract education - look for universities and academies
    const educationPatterns = [
      /air force academy|usafa|u\.s\. air force academy/gi,
      /naval academy|usna|u\.s\. naval academy/gi,
      /west point|usma|military academy/gi,
      /coast guard academy/gi,
      /\b(university|college|institute|academy)\s+of\s+[\w\s]+/gi,
      /\b[\w\s]+\s+(university|college|institute|academy)\b/gi,
      /\b(mit|stanford|harvard|yale|princeton|columbia|berkeley|ucla|usc)\b/gi,
      /\b(bachelor|master|phd|doctorate|mba|bs|ba|ms|ma)\b[\s\w]*\b(computer science|engineering|business|mathematics|physics)/gi
    ];

    educationPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const normalized = match.trim();
          if (normalized && !elements.education.find(e => e.toLowerCase() === normalized.toLowerCase())) {
            elements.education.push(normalized);
          }
        });
      }
    });

    // Extract companies - look for company names
    const companyPatterns = [
      /\b(google|amazon|microsoft|apple|facebook|meta|netflix|tesla|spacex)\b/gi,
      /\b(anthropic|openai|deepmind|palantir|anduril|shield ai)\b/gi,
      /\b(lockheed martin|boeing|northrop grumman|raytheon|general dynamics|bae systems)\b/gi,
      /\b(deloitte|pwc|kpmg|ey|ernst & young|mckinsey|bain|bcg)\b/gi,
      /\b(goldman sachs|jp morgan|morgan stanley|blackrock|citadel)\b/gi,
      /\bat\s+([A-Z][\w\s&]+(?:Inc|Corp|LLC|Ltd|Company|Co\.|Technologies|Systems|Solutions|Group|Industries|Ventures|Capital|Partners))/g
    ];

    companyPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          // Clean up "at Company" format
          const cleaned = match.replace(/^at\s+/i, '').trim();
          if (cleaned && !elements.companies.find(c => c.toLowerCase() === cleaned.toLowerCase())) {
            elements.companies.push(cleaned);
          }
        });
      }
    });

    // Extract military service
    const militaryPatterns = [
      /air force|usaf|united states air force/gi,
      /army|usa|united states army/gi,
      /navy|usn|united states navy/gi,
      /marine|usmc|marine corps/gi,
      /coast guard|uscg/gi,
      /space force|ussf/gi,
      /\b(captain|major|colonel|lieutenant|general|admiral|commander|sergeant|airman|seaman|officer)\b/gi,
      /\b(veteran|military|active duty|reserves|national guard)\b/gi,
      /\b(deployment|combat|operation\s+\w+|OIF|OEF|desert storm)\b/gi
    ];

    militaryPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const normalized = match.trim();
          if (normalized && !elements.military.find(m => m.toLowerCase() === normalized.toLowerCase())) {
            elements.military.push(normalized);
          }
        });
      }
    });

    // Extract technical skills
    const skillPatterns = [
      /\b(python|java|javascript|typescript|c\+\+|c#|ruby|go|rust|swift|kotlin|scala|r|matlab)\b/gi,
      /\b(react|angular|vue|node\.js|django|flask|spring|\.net|rails|laravel)\b/gi,
      /\b(aws|azure|gcp|google cloud|kubernetes|docker|terraform|jenkins|ci\/cd)\b/gi,
      /\b(machine learning|deep learning|artificial intelligence|ai|ml|nlp|computer vision)\b/gi,
      /\b(data science|data analytics|sql|nosql|mongodb|postgresql|redis)\b/gi,
      /\b(agile|scrum|project management|product management|lean|six sigma)\b/gi,
      /\b(cybersecurity|penetration testing|security clearance|ts\/sci|secret clearance)\b/gi
    ];

    skillPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const normalized = match.trim();
          if (normalized && !elements.skills.find(s => s.toLowerCase() === normalized.toLowerCase())) {
            elements.skills.push(normalized);
          }
        });
      }
    });

    // Extract certifications
    const certPattern = /\b(certified|certification|cert\.?)\s+[\w\s]+/gi;
    const certMatches = text.match(certPattern);
    if (certMatches) {
      certMatches.forEach(match => {
        const normalized = match.trim();
        if (normalized.length > 5 && normalized.length < 100) {
          elements.certifications.push(normalized);
        }
      });
    }

    // Extract other important keywords (limit to most relevant)
    const importantWords = text.match(/\b[A-Z][\w]+(?:\s+[A-Z][\w]+){0,2}\b/g);
    if (importantWords) {
      const wordFreq = {};
      importantWords.forEach(word => {
        if (word.length > 3) {
          wordFreq[word] = (wordFreq[word] || 0) + 1;
        }
      });
      
      // Get top keywords by frequency
      const sortedWords = Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([word]) => word);
      
      elements.keywords = sortedWords;
    }

    return elements;
  }

  /**
   * Convert extracted elements to search elements for scoring
   */
  static createSearchElements(extractedElements) {
    const searchElements = [];
    
    // Add education with high weight
    extractedElements.education.forEach(edu => {
      // Extra high weight for military academies
      const weight = edu.toLowerCase().includes('academy') || 
                     edu.toLowerCase().includes('usafa') || 
                     edu.toLowerCase().includes('west point') ? 40 : 30;
      searchElements.push({
        value: edu.toLowerCase(),
        display: edu,
        weight: weight,
        category: 'education'
      });
    });

    // Add companies with medium-high weight
    extractedElements.companies.forEach(company => {
      searchElements.push({
        value: company.toLowerCase(),
        display: company,
        weight: 25,
        category: 'company'
      });
    });

    // Add military experience with high weight
    extractedElements.military.forEach(mil => {
      const weight = mil.toLowerCase().includes('academy') ? 40 : 30;
      searchElements.push({
        value: mil.toLowerCase(),
        display: mil,
        weight: weight,
        category: 'military'
      });
    });

    // Add skills with medium weight
    extractedElements.skills.slice(0, 15).forEach(skill => {
      searchElements.push({
        value: skill.toLowerCase(),
        display: skill,
        weight: 15,
        category: 'skills'
      });
    });

    // Add certifications with medium weight
    extractedElements.certifications.slice(0, 10).forEach(cert => {
      searchElements.push({
        value: cert.toLowerCase(),
        display: cert,
        weight: 15,
        category: 'certifications'
      });
    });

    // Add top keywords with lower weight
    extractedElements.keywords.slice(0, 10).forEach(keyword => {
      // Skip if already added in other categories
      if (!searchElements.find(e => e.display.toLowerCase() === keyword.toLowerCase())) {
        searchElements.push({
          value: keyword.toLowerCase(),
          display: keyword,
          weight: 5,
          category: 'keywords'
        });
      }
    });

    return searchElements;
  }
}

// Export for use in popup
window.ResumeExtractor = ResumeExtractor;