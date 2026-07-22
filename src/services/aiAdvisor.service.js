import { supabase, isMissingFunctionError } from './supabase';

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

    if (error) {
      // Backward compatibility: if the RPC hasn't been deployed yet (sql/66
      // not applied), fall back to the legacy client-side matching so the AI
      // Advisor keeps returning lawyers during the migration window. Once the
      // migration is applied the RPC exists and this branch is never taken.
      if (isMissingFunctionError(error)) {
        return await queryMatchingLawyersClientSide({ category, location, needType, offset, limit, excludeIds });
      }
      throw error;
    }

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

/**
 * Legacy client-side lawyer matching. Retained only as a backward-compatible
 * fallback for queryMatchingLawyers when the match_lawyers_for_ai RPC is not
 * yet present in the database (pre-migration). Not used once sql/66 is applied.
 * Mirrors the RPC's semantics: category match falls back to unfiltered results
 * if nothing matches; location filter is only applied if it doesn't empty the
 * result; sort order depends on needType.
 */
const queryMatchingLawyersClientSide = async ({
  category = null,
  location = null,
  needType = 'consultation',
  offset = 0,
  limit = 3,
  excludeIds = []
}) => {
  const { data: lawyersData, error: lawyersErr } = await supabase
    .from('lawyers')
    .select('*, user:users(name, profile_picture_url, phone, email)')
    .eq('is_verified', true);

  if (lawyersErr) throw lawyersErr;

  const [areasRes, expRes, junctionRes] = await Promise.all([
    supabase.from('practice_areas').select('*'),
    supabase.from('legal_expertise').select('*'),
    supabase.from('lawyer_expertise_junction').select('*')
  ]);

  const practiceAreas = areasRes.data || [];
  const legalExpertise = expRes.data || [];
  const junctionData = junctionRes.data || [];

  let allLawyers = (lawyersData || []).map(lwr => {
    const lwrId = lwr.id || lwr.user_id;
    const expertiseIds = junctionData
      .filter(j => j.lawyer_id === lwrId || j.lawyer_id === lwr.user_id)
      .map(j => j.expertise_id);

    const expertiseNames = expertiseIds.map(id => {
      const expObj = legalExpertise.find(e => e.id === id);
      return expObj ? expObj.name : '';
    }).filter(Boolean);

    const areaNames = expertiseIds.map(id => {
      const expObj = legalExpertise.find(e => e.id === id);
      const areaObj = practiceAreas.find(pa => pa.id === expObj?.practice_area_id);
      return areaObj ? areaObj.name : '';
    }).filter(Boolean);

    return {
      ...lwr,
      expertiseNames,
      areaNames,
      full_name: lwr.user?.name || lwr.full_name || 'Verified Lawyer',
      avatar_url: lwr.user?.profile_picture_url || lwr.avatar_url,
      phone: lwr.user?.phone || lwr.phone,
      email: lwr.user?.email || lwr.email
    };
  });

  if (excludeIds && excludeIds.length > 0) {
    allLawyers = allLawyers.filter(l => !excludeIds.includes(l.id) && !excludeIds.includes(l.user_id));
  }

  let matchedLawyers = [...allLawyers];
  let isFallback = false;

  if (category) {
    const catLower = category.toLowerCase();
    const rootConcept = catLower.replace(' law', '').replace(' and ', ' ').trim();
    const categoryFiltered = matchedLawyers.filter(l => {
      const specMatch = l.specialization?.toLowerCase().includes(rootConcept) || l.specialization?.toLowerCase().includes(catLower);
      const bioMatch = l.bio?.toLowerCase().includes(rootConcept);
      const expMatch = l.expertiseNames?.some(name => name.toLowerCase().includes(rootConcept));
      const areaMatch = l.areaNames?.some(name => name.toLowerCase().includes(rootConcept));
      return specMatch || bioMatch || expMatch || areaMatch;
    });
    if (categoryFiltered.length > 0) {
      matchedLawyers = categoryFiltered;
    } else {
      isFallback = true;
    }
  }

  if (location && !isFallback) {
    const locLower = location.toLowerCase();
    const locationFiltered = matchedLawyers.filter(l =>
      l.location?.toLowerCase().includes(locLower) || l.city?.toLowerCase().includes(locLower)
    );
    if (locationFiltered.length > 0) {
      matchedLawyers = locationFiltered;
    }
  }

  if (needType === 'case') {
    matchedLawyers.sort((a, b) => {
      const expA = (a.experience_years || 0) >= 3 ? 1 : 0;
      const expB = (b.experience_years || 0) >= 3 ? 1 : 0;
      if (expA !== expB) return expB - expA;
      return (b.avg_rating || 0) - (a.avg_rating || 0);
    });
  } else {
    matchedLawyers.sort((a, b) => {
      if ((b.avg_rating || 0) !== (a.avg_rating || 0)) {
        return (b.avg_rating || 0) - (a.avg_rating || 0);
      }
      return (b.completed_cases || 0) - (a.completed_cases || 0);
    });
  }

  const totalMatches = matchedLawyers.length;
  const paginatedLawyers = matchedLawyers.slice(offset, offset + limit);

  return {
    lawyers: paginatedLawyers,
    totalMatches,
    isFallback,
    category: category || 'General Practice'
  };
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
