import { supabase } from './supabase';

// ============================================================================
// 1. LEGAL CATEGORY DETECTION (KEYWORD & PHRASE MAPPING)
// ============================================================================

const PRACTICE_AREA_KEYWORDS = {
  'Criminal Law': [
    'murder', 'assault', 'theft', 'robbery', 'arrest', 'fir', 'bail', 'police', 
    'crime', 'jail', 'warrant', 'custody', 'investigation', 'fraud', 'bribery', 
    'extortion', 'rape', 'harassment', 'detained', 'magistrate', 'cheating', '420',
    'narcotics', 'yaba', 'drugs', 'cybercrime', 'ict act', 'digital security'
  ],
  'Family Law': [
    'divorce', 'talaq', 'child custody', 'alimony', 'dower', 'denmohar', 'marriage', 
    'adoption', 'domestic violence', 'hizanat', 'maintenance', 'spouse', 'husband', 
    'wife', 'inheritance', 'succession', 'family court', 'restitution of conjugal rights',
    'guardian', 'kabin', 'kabinnama', 'dowry', 'polygamy', 'second marriage'
  ],
  'Property Law': [
    'land', 'property', 'real estate', 'tenant', 'landlord', 'rent', 'eviction', 
    'lease', 'deed', 'khatian', 'namjari', 'mutation', 'boundary', 'mortgage', 
    'flat', 'plot', 'building', 'development', 'saf kabala', 'power of attorney', 
    'mouza', 'rs khatian', 'cs khatian', 'bs khatian', 'ac land', 'sub registrar',
    'encroachment', 'partition', 'heirship certificate'
  ],
  'Corporate Law': [
    'startup', 'company', 'business', 'registration', 'rjsc', 'shares', 'partnership', 
    'merger', 'acquisition', 'contract', 'commercial', 'compliance', 'joint venture', 
    'incorporation', 'trade license', 'shareholder', 'director', 'memorandum', 
    'articles of association', 'winding up', 'liquidation', 'insolvency', 'bangladesh bank'
  ],
  'Civil Law': [
    'contract dispute', 'defamation', 'money recovery', 'breach of contract', 'tort', 
    'damages', 'negligence', 'nuisance', 'injunction', 'compensation', 'civil suit',
    'specific performance', 'cheque bounce', 'ni act', 'negotiable instruments',
    'recovery of money', 'arbitration', 'legal notice'
  ],
  'Labor Law': [
    'termination', 'salary', 'workplace harassment', 'severance', 'provident fund', 
    'gratuity', 'employment', 'labor court', 'wrongful dismissal', 'worker', 
    'trade union', 'overtime', 'maternity benefit', 'appointment letter', 'layoff',
    'retrenchment', 'bangladesh labor act'
  ],
  'Constitutional Law': [
    'fundamental rights', 'writ', 'supreme court', 'high court', 'judicial review', 
    'public interest litigation', 'pil', 'constitutional', 'habeas corpus', 
    'mandamus', 'certiorari', 'quo warranto', 'detention without trial'
  ],
  'Immigration Law': [
    'visa', 'work permit', 'citizenship', 'passport', 'deportation', 'immigration', 
    'dual citizenship', 'residency', 'foreign national', 'embassy', 'boesl', 
    'overseas migration', 'asylum'
  ],
  'Intellectual Property': [
    'trademark', 'patent', 'copyright', 'design infringement', 'ip', 'trade secret', 
    'royalty', 'brand protection', 'infringement', 'dpdt', 'intellectual property'
  ],
  'Tax Law': [
    'vat', 'income tax', 'customs', 'excise', 'tax return', 'nbr', 'audit', 
    'tax exemption', 'corporate tax', 'tariff', 'tin', 'bin', 'national board of revenue',
    'customs duty', 'surcharge'
  ]
};

const BANGLADESH_CITIES = [
  'dhaka', 'chattogram', 'chittagong', 'sylhet', 'rajshahi', 'khulna', 'barishal', 
  'barisal', 'rangpur', 'mymensingh', 'comilla', 'cumilla', 'gazipur', 'narayanganj', 
  'cox\'s bazar', 'savar', 'bogra', 'bogura', 'jessore', 'jashore', 'dinajpur', 
  'faridpur', 'pabna', 'tangail', 'noakhali', 'brahmanbaria', 'feni', 'kushtia'
];

/**
 * Analyzes user input text and detects the most relevant legal practice area.
 * @param {string} text - User message or conversation text
 * @returns {object} { category, confidence, matchedKeywords }
 */
export const detectLegalCategory = (text = '') => {
  if (!text || typeof text !== 'string') {
    return { category: null, confidence: 'none', matchedKeywords: [] };
  }

  const lowerText = text.toLowerCase();
  const scores = {};
  const matchedMap = {};

  for (const [area, keywords] of Object.entries(PRACTICE_AREA_KEYWORDS)) {
    let count = 0;
    const matches = [];
    for (const kw of keywords) {
      // Check for exact word or phrase boundary match where possible
      if (lowerText.includes(kw)) {
        count += 1;
        matches.push(kw);
      }
    }
    if (count > 0) {
      scores[area] = count;
      matchedMap[area] = matches;
    }
  }

  const sortedAreas = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);

  if (sortedAreas.length === 0) {
    return { category: null, confidence: 'none', matchedKeywords: [] };
  }

  const topCategory = sortedAreas[0];
  const topScore = scores[topCategory];
  const matchedKeywords = matchedMap[topCategory];

  let confidence = 'medium';
  if (topScore >= 2) {
    confidence = 'high';
  }

  return {
    category: topCategory,
    confidence,
    matchedKeywords
  };
};

/**
 * Extracts location (city) and specific legal need type from text.
 * @param {string} text 
 * @returns {object} { location: string|null, needType: 'urgent'|'case'|'consultation' }
 */
export const extractLocationAndNeed = (text = '') => {
  const lower = text.toLowerCase();
  let detectedCity = null;

  for (const city of BANGLADESH_CITIES) {
    if (lower.includes(city)) {
      // Capitalize first letter
      detectedCity = city.charAt(0).toUpperCase() + city.slice(1);
      if (detectedCity === 'Chittagong') detectedCity = 'Chattogram';
      if (detectedCity === 'Barisal') detectedCity = 'Barishal';
      if (detectedCity === 'Cumilla') detectedCity = 'Comilla';
      break;
    }
  }

  let needType = 'consultation';
  if (lower.includes('urgent') || lower.includes('emergency') || lower.includes('arrest') || lower.includes('detained') || lower.includes('right now') || lower.includes('immediate')) {
    needType = 'urgent';
  } else if (lower.includes('case') || lower.includes('court') || lower.includes('lawsuit') || lower.includes('sue') || lower.includes('litigation') || lower.includes('represent') || lower.includes('hearing') || lower.includes('trial')) {
    needType = 'case';
  }

  return { location: detectedCity, needType };
};

// ============================================================================
// 2. SUPABASE LAWYER MATCHING SERVICE
// ============================================================================

/**
 * Queries Supabase lawyers table matching category, location, and need type.
 * @param {object} options - { category, location, needType, offset, limit, excludeIds }
 * @returns {Promise<object>} { lawyers: Array, totalMatches: number, isFallback: boolean, category: string }
 */
export const queryMatchingLawyers = async ({
  category = null,
  location = null,
  needType = 'consultation',
  offset = 0,
  limit = 3,
  excludeIds = []
}) => {
  try {
    // Filtering, fallback, sorting, and pagination now happen in the database
    // via the match_lawyers_for_ai RPC (see sql/66_p1_high_priority_hardening.sql)
    // instead of fetching every verified lawyer + all expertise data into the browser.
    const { data, error } = await supabase.rpc('match_lawyers_for_ai', {
      p_category: category,
      p_location: location,
      p_need_type: needType,
      p_limit: limit,
      p_offset: offset,
      p_exclude_ids: excludeIds
    });

    if (error) throw error;

    const lawyers = (data?.lawyers || []).map(l => ({
      ...l,
      expertiseNames: l.expertise_names || [],
      areaNames: l.area_names || []
    }));

    return {
      lawyers,
      totalMatches: data?.totalMatches || 0,
      isFallback: data?.isFallback || false,
      category: data?.category || category || 'General Practice'
    };
  } catch (err) {
    console.error('[AI Advisor Service] Error querying lawyers:', err);
    return {
      lawyers: [],
      totalMatches: 0,
      isFallback: true,
      category: category || 'General Practice',
      error: err.message
    };
  }
};

// ============================================================================
// 3. CASE FILE UPLOAD & GEMINI ANALYSIS SERVICE
// ============================================================================

/**
 * Uploads a document or image to Supabase Storage.
 * @param {File} file 
 * @param {object} user - Authenticated user object (optional)
 * @returns {Promise<object>} { publicUrl, filePath, fileName, fileSize, fileType }
 */
export const uploadCaseFile = async (file, user = null) => {
  if (!file) throw new Error('No file provided for upload.');

  const fileExt = file.name.split('.').pop().toLowerCase();
  const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
  const filePath = `ai-advisor-uploads/${uniqueName}`;

  // Use 'documents' bucket
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from('documents')
    .getPublicUrl(filePath);

  return {
    publicUrl,
    filePath,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type || fileExt
  };
};

/**
 * Converts a File or Blob into Base64 string for Gemini API inlineData.
 * @param {File|Blob} file 
 * @returns {Promise<string>} Base64 string without data URI prefix
 */
export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = reader.result.split(',')[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Sends uploaded case file to the `gemini-proxy` Edge Function for structured
 * legal analysis. The Gemini API key never reaches the browser (audit #3) —
 * the function holds it as a server-side secret.
 * @param {object} params - { file, base64Data, userPrompt }
 * @returns {Promise<object>} Structured analysis JSON object
 */
export const analyzeDocumentWithGemini = async ({ file, base64Data, userPrompt = '' }) => {
  if (!base64Data) {
    throw new Error('Missing file data.');
  }

  const mimeType = file?.type || 'application/pdf';

  const { data, error } = await supabase.functions.invoke('gemini-proxy', {
    body: { mode: 'analyzeDocument', base64Data, mimeType, userPrompt }
  });

  if (error || !data || data.error) {
    console.error('[AI Advisor] gemini-proxy analyzeDocument failed:', error || data?.error);
    return {
      documentType: "Uploaded Legal Document",
      keyFacts: ["Document content recognized.", "Detailed extraction requires manual attorney review."],
      practiceArea: "Civil Law",
      urgentIssues: "Please consult a lawyer to verify statutory limitation periods.",
      recommendedAction: "We recommend booking a consultation with a verified lawyer below to review this file in detail."
    };
  }

  return data.analysis;
};

/**
 * Sends a chat message (with prior history) to the `gemini-proxy` Edge
 * Function for a conversational response. Returns null if the AI is
 * unavailable so the caller can fall back to the local rule-engine.
 * @param {Array<{role: string, parts: {text: string}[]}>} history
 * @param {string} message
 * @returns {Promise<string|null>}
 */
export const sendAIChatMessage = async (history, message) => {
  try {
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: { mode: 'chat', history, message }
    });
    if (error || !data || data.error) {
      console.warn('[AI Advisor] gemini-proxy chat failed:', error || data?.error);
      return null;
    }
    return data.text || null;
  } catch (err) {
    console.warn('[AI Advisor] gemini-proxy chat request failed:', err.message);
    return null;
  }
};
