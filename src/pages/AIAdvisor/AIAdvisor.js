import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import toast from 'react-hot-toast';
import {
  detectLegalCategory,
  extractLocationAndNeed,
  queryMatchingLawyers,
  uploadCaseFile,
  fileToBase64,
  analyzeDocumentWithGemini
} from '../../services/aiAdvisor.service';
import LawyerSuggestionCards from '../../components/AIAdvisor/LawyerSuggestionCards';
import CategoryQuickStartChips from '../../components/AIAdvisor/CategoryQuickStartChips';

const AIAdvisor = () => {
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const [messages, setMessages] = useState([
    {
      role: 'model',
      content: "Hello! I am your LegalConnect AI Advisor. I can provide general legal information, analyze your legal documents, and connect you with verified Supreme Court and District Court advocates for your specific situation.\n\nHow can I help you today?",
      category: null,
      lawyers: null
    }
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  // Conversational Session State
  const [sessionCategory, setSessionCategory] = useState(null);
  const [sessionLocation, setSessionLocation] = useState(null);
  const [sessionNeedType, setSessionNeedType] = useState('consultation');

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, isUploading, isLoadingMore]);

  const handleInput = (e) => {
    e.target.style.height = '';
    e.target.style.height = e.target.scrollHeight + 'px';
    setInputText(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limit file size to 10MB
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds 10MB limit.');
      return;
    }

    setSelectedFile(file);
    toast.success(`Attached ${file.name}`);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleQuickStartCategory = (categoryName, starterPrompt) => {
    setSessionCategory(categoryName);
    setInputText(starterPrompt);
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
    }
    toast.success(`Selected practice area: ${categoryName}`);
  };

  const handleShowMoreLawyers = async (msgIndex) => {
    const targetMsg = messages[msgIndex];
    if (!targetMsg || !targetMsg.lawyers) return;

    setIsLoadingMore(true);
    try {
      const currentOffset = targetMsg.offset || targetMsg.lawyers.length;
      const excludeIds = targetMsg.excludeIds || targetMsg.lawyers.map(l => l.id || l.user_id);
      const activeCat = targetMsg.category || sessionCategory || 'General Practice';

      const res = await queryMatchingLawyers({
        category: activeCat,
        location: sessionLocation,
        needType: sessionNeedType,
        offset: currentOffset,
        limit: 3,
        excludeIds
      });

      if (res.lawyers && res.lawyers.length > 0) {
        setMessages(prev => prev.map((m, idx) => {
          if (idx === msgIndex) {
            const updatedLawyers = [...m.lawyers, ...res.lawyers];
            return {
              ...m,
              lawyers: updatedLawyers,
              offset: currentOffset + res.lawyers.length,
              excludeIds: [...excludeIds, ...res.lawyers.map(l => l.id || l.user_id)],
              hasMoreLawyers: res.totalMatches > updatedLawyers.length
            };
          }
          return m;
        }));
        toast.success(`Loaded ${res.lawyers.length} more lawyers.`);
      } else {
        setMessages(prev => prev.map((m, idx) => {
          if (idx === msgIndex) {
            return { ...m, hasMoreLawyers: false };
          }
          return m;
        }));
        toast('No additional matching lawyers found.', { icon: 'ℹ️' });
      }
    } catch (err) {
      console.error('Error loading more lawyers:', err);
      toast.error('Failed to load more lawyers.');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() && !selectedFile) return;
    
    const userMsg = inputText.trim() || (selectedFile ? `Uploaded legal file: ${selectedFile.name}` : "");
    const fileToProcess = selectedFile;
    
    // Append user message
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: userMsg,
      file: fileToProcess ? { fileName: fileToProcess.name, fileSize: fileToProcess.size } : null
    }]);
    
    setInputText('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const apiKey = process.env.REACT_APP_GOOGLE_API_KEY;
    let genAI = null;
    if (apiKey) {
      genAI = new GoogleGenerativeAI(apiKey);
    }

    // =========================================================================
    // BRANCH A: FILE UPLOAD & ANALYSIS
    // =========================================================================
    if (fileToProcess) {
      setIsUploading(true);
      setIsLoading(true);
      try {
        // 1. Upload to Supabase Storage
        const uploadedFile = await uploadCaseFile(fileToProcess);
        
        // 2. Convert to base64 for Gemini
        const base64Data = await fileToBase64(fileToProcess);
        
        // 3. Analyze with Gemini
        let analysis = null;
        if (genAI) {
          analysis = await analyzeDocumentWithGemini({
            file: fileToProcess,
            base64Data,
            genAI,
            userPrompt: userMsg
          });
        } else {
          // Fallback if no API key
          analysis = {
            documentType: "Uploaded Legal Document",
            keyFacts: ["Document successfully uploaded to storage.", "Requires attorney review for formal legal extraction."],
            practiceArea: sessionCategory || "Civil Law",
            urgentIssues: "Verify statutory deadlines with counsel.",
            recommendedAction: "We recommend booking a consultation with a verified lawyer below to review this document."
          };
        }

        // 4. Update session category if detected
        const docCategory = analysis?.practiceArea || sessionCategory || "General Practice";
        if (analysis?.practiceArea) {
          setSessionCategory(analysis.practiceArea);
        }

        // 5. Query matching lawyers from Supabase
        const lawyerRes = await queryMatchingLawyers({
          category: docCategory,
          location: sessionLocation,
          needType: sessionNeedType,
          offset: 0,
          limit: 3
        });

        // 6. Format analysis summary as AI response
        const formattedText = `**Document Analysis Report: ${analysis.documentType}**\n\n` +
          `**Key Facts & Legal Issues:**\n` +
          `${(analysis.keyFacts || []).map(f => `• ${f}`).join('\n')}\n\n` +
          `**Detected Practice Area:** ${docCategory}\n` +
          `**Urgent Deadlines / Risks:** ${analysis.urgentIssues || 'None identified'}\n\n` +
          `**Recommended Action:**\n${analysis.recommendedAction || 'Please consult with one of our verified lawyers below for representation.'}`;

        setMessages(prev => [...prev, {
          role: 'model',
          content: formattedText,
          category: lawyerRes.category,
          lawyers: lawyerRes.lawyers,
          isFallback: lawyerRes.isFallback,
          file: uploadedFile,
          analysis,
          hasMoreLawyers: lawyerRes.totalMatches > 3,
          offset: 3,
          excludeIds: lawyerRes.lawyers.map(l => l.id || l.user_id)
        }]);
      } catch (err) {
        console.error('[AI Advisor] Document processing failed:', err);
        toast.error('Failed to analyze document. Please try again or consult a lawyer directly.');
        setMessages(prev => [...prev, {
          role: 'model',
          content: `We encountered an issue analyzing your document (${fileToProcess.name}). However, our verified lawyers are available to review your file directly in a 1-on-1 consultation.`,
          category: sessionCategory || "General Practice",
          lawyers: null
        }]);
      } finally {
        setIsUploading(false);
        setIsLoading(false);
      }
      return;
    }

    // =========================================================================
    // BRANCH B: CONVERSATION & CATEGORY DETECTION
    // =========================================================================
    setIsLoading(true);
    try {
      // Check if user is asking for more lawyers
      const lowerMsg = userMsg.toLowerCase();
      if (lowerMsg.includes('more lawyer') || lowerMsg.includes('show more') || lowerMsg.includes('other lawyer') || lowerMsg.includes('anyone else')) {
        // Find the last model message with lawyers
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === 'model' && messages[i].lawyers && messages[i].lawyers.length > 0) {
            await handleShowMoreLawyers(i);
            setIsLoading(false);
            return;
          }
        }
      }

      // 1. Lightweight Keyword & Phrase Detection
      const detection = detectLegalCategory(userMsg);
      const { location, needType } = extractLocationAndNeed(userMsg);

      if (location) setSessionLocation(location);
      if (needType !== 'consultation') setSessionNeedType(needType);

      let activeCat = sessionCategory;
      if (detection.confidence !== 'none' && detection.category) {
        activeCat = detection.category;
        setSessionCategory(detection.category);
      }

      // 2. Prepare conversation history for Gemini
      const validHistory = [];
      let expectedRole = 'user';
      for (const msg of messages) {
        const normalizedRole = msg.role === 'model' || msg.role === 'ai' ? 'model' : 'user';
        if (normalizedRole === expectedRole) {
          validHistory.push({
            role: normalizedRole,
            parts: [{ text: msg.content }]
          });
          expectedRole = expectedRole === 'user' ? 'model' : 'user';
        }
      }

      let responseText = null;
      if (genAI) {
        const modelsToTry = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash", "gemini-2.0-flash-001", "gemini-2.0-flash-lite"];
        for (const modelName of modelsToTry) {
          try {
            const model = genAI.getGenerativeModel({ model: modelName });
            try {
              const chat = model.startChat({ history: validHistory });
              const result = await chat.sendMessage(userMsg);
              responseText = result.response.text();
            } catch (chatErr) {
              const prompt = validHistory.length > 0 
                ? validHistory.map(h => `${h.role}: ${h.parts[0].text}`).join('\n') + `\nuser: ${userMsg}`
                : userMsg;
              const result = await model.generateContent(prompt);
              responseText = result.response.text();
            }
            if (responseText) break;
          } catch (err) {
            // Try next model
          }
        }
      }

      // 3. Fallback rule-engine if Gemini API fails or is unavailable
      if (!responseText) {
        console.warn("[AI Advisor] Utilizing intelligent local legal rule-engine.");
        const lower = userMsg.toLowerCase();
        if (lower.includes('family') || lower.includes('divorce') || lower.includes('marriage') || lower.includes('custody') || lower.includes('wife') || lower.includes('husband')) {
          responseText = `**Family Law Guidance (Bangladesh Context)**\n\nUnder Bangladeshi family law (governed by respective personal laws such as Muslim Family Laws Ordinance 1961):\n\n1. **Divorce Procedures**: Requires written notice to the Chairman of the Union Parishad/Mayor and the spouse. A 90-day reconciliation period follows before the talaq/divorce takes legal effect.\n2. **Child Custody (Hizanat)**: Mothers generally hold right of custody for sons up to age 7 and daughters until puberty, subject to the paramount consideration of the welfare of the child under the Guardians and Wards Act 1890.\n3. **Maintenance & Dower (Denmohar)**: The wife is legally entitled to prompt dower and financial maintenance during marriage and iddat.\n\n*Next Steps*: I have matched you with specialized Family Advocates below from our verified directory.`;
          if (!activeCat) activeCat = 'Family Law';
        } else if (lower.includes('property') || lower.includes('land') || lower.includes('real estate') || lower.includes('deed') || lower.includes('flat') || lower.includes('rent') || lower.includes('tenant')) {
          responseText = `**Land & Real Estate Law Guidance**\n\nWhen dealing with land or property transactions in Bangladesh:\n\n1. **Title Verification (Balam Bahir)**: Always verify the RS, CS, SA, and BS Khatian records at the local AC Land office to confirm unbroken chain of ownership for at least 25 years.\n2. **Registration**: Under the Registration Act 1908, all deeds of sale (Saf Kabala) must be registered with the Sub-Registrar within 3 months of execution.\n3. **Mutation (Namjari)**: After deed registration, obtaining a fresh Khatiyan (Mutation) and paying up-to-date Land Development Tax (Khajna) is mandatory before building or reselling.\n\n*Next Steps*: Our vetted property verification lawyers below can conduct a thorough title search on your behalf.`;
          if (!activeCat) activeCat = 'Property Law';
        } else if (lower.includes('company') || lower.includes('business') || lower.includes('corporate') || lower.includes('startup') || lower.includes('tax') || lower.includes('vat')) {
          responseText = `**Corporate & Business Formation Guidance**\n\nSetting up a business entity in Bangladesh involves the following key regulatory steps:\n\n1. **RJSC Registration**: Reserve your trade name and register your Private Limited Company or Partnership with the Registrar of Joint Stock Companies and Firms (RJSC) under the Companies Act 1994.\n2. **Trade License**: Apply at the respective City Corporation or Pourashava with your commercial lease agreement.\n3. **TIN & BIN**: Obtain an e-TIN from NBR and a Business Identification Number (BIN/VAT registration) for commercial invoicing and tax compliance.\n\n*Next Steps*: You can book a consultation with our Corporate Specialists below.`;
          if (!activeCat) activeCat = 'Corporate Law';
        } else if (lower.includes('crime') || lower.includes('police') || lower.includes('bail') || lower.includes('arrest') || lower.includes('case') || lower.includes('court') || lower.includes('jail')) {
          responseText = `**Criminal Defense & Bail Rights**\n\nUnder the Code of Criminal Procedure (CrPC) 1898:\n\n1. **Right to Legal Representation**: Every person arrested has the fundamental right under Article 33 of the Constitution to consult and be defended by a legal practitioner.\n2. **Bail Provisions**: For bailable offenses, bail is a matter of statutory right upon furnishing surety. For non-bailable offenses, bail is granted at the discretion of the Magistrate or Sessions Court considering factors like medical grounds or lack of prima facie evidence.\n3. **Anticipatory Bail**: Can only be moved before the High Court Division of the Supreme Court of Bangladesh.\n\n*Emergency Action*: If someone is currently detained, immediately contact our verified criminal defense attorneys below.`;
          if (!activeCat) activeCat = 'Criminal Law';
        } else {
          responseText = `**LegalConnect AI Preliminary Analysis**\n\nThank you for sharing your query regarding: *"${userMsg.substring(0, 60)}..."*\n\nBased on basic principles of civil and administrative jurisprudence in Bangladesh:\n\n1. **Documentation is Key**: Ensure you preserve all relevant physical and digital documentation (contracts, notices, receipts, SMS/emails) chronologically.\n2. **Limitation Period**: Legal claims are subject to strict statutory limitation periods under the Limitation Act 1908. Prompt legal action prevents claims from becoming time-barred.\n3. **Alternative Dispute Resolution (ADR)**: Before formal litigation, sending a formal legal notice through an advocate or exploring mediation often resolves disputes 80% faster.\n\n*Recommended Action*: Browse our verified practice area recommendations below to speak directly with an experienced advocate.`;
        }
      }

      // 4. Secondary Category Detection from Gemini's response if still unknown
      if (!activeCat) {
        const secondaryDetect = detectLegalCategory(responseText);
        if (secondaryDetect.confidence !== 'none' && secondaryDetect.category) {
          activeCat = secondaryDetect.category;
          setSessionCategory(secondaryDetect.category);
        }
      }

      // 5. Query matching lawyers from Supabase
      const queryCat = activeCat || 'General Practice';
      const lawyerRes = await queryMatchingLawyers({
        category: queryCat,
        location: sessionLocation,
        needType: sessionNeedType,
        offset: 0,
        limit: 3
      });

      setMessages(prev => [...prev, { 
        role: 'model', 
        content: responseText,
        category: lawyerRes.category,
        lawyers: lawyerRes.lawyers,
        isFallback: lawyerRes.isFallback,
        hasMoreLawyers: lawyerRes.totalMatches > 3,
        offset: 3,
        excludeIds: lawyerRes.lawyers.map(l => l.id || l.user_id)
      }]);
    } catch (error) {
      console.error("[AI Advisor] Error in message flow:", error);
      toast.error("An error occurred while processing your request.");
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to format text with basic bolding and line breaks
  const formatText = (text) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => {
      const parts = line.split(/(\*\*.*?\*\*)/g).map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index} className="font-bold text-primary dark:text-secondary-fixed">{part.slice(2, -2)}</strong>;
        }
        return part;
      });
      return <p key={i} className="m-0 mb-2 leading-relaxed">{parts}</p>;
    });
  };

  const clearChat = () => {
    setMessages([{
      role: 'model',
      content: "Chat cleared. I am your LegalConnect AI Advisor. How can I help you today?",
      category: null,
      lawyers: null
    }]);
    setSessionCategory(null);
    setSessionLocation(null);
    setSessionNeedType('consultation');
    setSelectedFile(null);
    toast.success("Started a new session");
  };

  return (
    <div className="flex h-[calc(100vh-73px)] overflow-hidden bg-surface text-on-surface font-body-md w-full">
      <style>{`
        .chat-scroll::-webkit-scrollbar { width: 6px; }
        .chat-scroll::-webkit-scrollbar-track { background: transparent; }
        .chat-scroll::-webkit-scrollbar-thumb { background: #dce3ef; border-radius: 10px; }
        @keyframes typing {
          0% { opacity: .2; }
          20% { opacity: 1; }
          100% { opacity: .2; }
        }
        .typing-dot { animation: typing 1.4s infinite both; }
        .typing-dot:nth-child(2) { animation-delay: .2s; }
        .typing-dot:nth-child(3) { animation-delay: .4s; }
        .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
        .filled-icon { font-variation-settings: 'FILL' 1; }
      `}</style>
      
      {/* Left Sidebar */}
      <aside className="h-full w-72 bg-primary dark:bg-primary border-r border-primary-container shadow-lg flex flex-col shrink-0 hidden md:flex">
        <div className="p-6">
          <button 
            onClick={clearChat}
            className="w-full bg-secondary-container text-on-secondary-container py-3 px-4 rounded-xl font-headline-sm text-sm font-bold flex items-center justify-center gap-2 hover:bg-secondary-fixed transition-colors shadow-md active:scale-[0.98]">
            <span className="material-symbols-outlined">add</span>
            New Session
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-6">
          <section>
            <h3 className="text-on-primary-container font-label-md text-xs uppercase tracking-wider mb-2 px-2 font-bold opacity-80">Session Memory</h3>
            <div className="flex flex-col gap-2">
              <div className="text-white border-l-4 border-secondary-fixed bg-primary-container/60 px-3 py-2.5 flex items-center gap-3 rounded-r-xl shadow-sm">
                <span className="material-symbols-outlined text-[18px] text-secondary-fixed">psychology</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-xs">Active Topic</p>
                  <p className="text-[11px] text-on-primary-container truncate font-medium">
                    {sessionCategory || 'General Guidance'}
                  </p>
                </div>
              </div>
              {sessionLocation && (
                <div className="text-white border-l-4 border-emerald-400 bg-primary-container/40 px-3 py-2 flex items-center gap-3 rounded-r-xl text-xs">
                  <span className="material-symbols-outlined text-[16px] text-emerald-400">location_on</span>
                  <span className="truncate">City: {sessionLocation}</span>
                </div>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-on-primary-container font-label-md text-xs uppercase tracking-wider mb-2 px-2 font-bold opacity-80">Practice Areas</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: 'Family Law', icon: 'family_restroom', prompt: 'I need help with a family law dispute regarding marriage, divorce, or child custody.' },
                { name: 'Property Law', icon: 'real_estate_agent', prompt: 'I need help verifying land deeds or resolving a property dispute.' },
                { name: 'Criminal Law', icon: 'gavel', prompt: 'I need legal assistance with a criminal law matter regarding bail or police investigation.' },
                { name: 'Corporate Law', icon: 'business_center', prompt: 'I need legal advice on company formation, RJSC registration, or compliance.' },
                { name: 'Civil Law', icon: 'balance', prompt: 'I need advice regarding a civil contract breach or money recovery.' },
                { name: 'Labor Law', icon: 'work', prompt: 'I need guidance on employment rights or wrongful termination.' }
              ].map((cat) => (
                <button 
                  key={cat.name}
                  onClick={() => handleQuickStartCategory(cat.name, cat.prompt)}
                  className={`flex flex-col items-center p-3 rounded-xl border transition-all text-center ${sessionCategory === cat.name ? 'bg-secondary-fixed text-primary font-bold border-secondary' : 'bg-primary-container/30 border-primary-container/80 text-on-primary-container hover:border-secondary-fixed'}`}
                >
                  <span className="material-symbols-outlined text-[20px]">{cat.icon}</span>
                  <span className="text-[10px] mt-1.5 leading-tight">{cat.name.replace(' Law', '')}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative bg-surface">
        {/* Header */}
        <div className="h-16 px-6 border-b border-outline-variant flex items-center justify-between bg-surface-container-lowest shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-secondary-fixed shadow-sm">
              <span className="material-symbols-outlined filled-icon text-[22px]">smart_toy</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-headline-sm text-base font-bold text-primary leading-none m-0">Legal AI Advisor</h2>
                {sessionCategory && (
                  <span className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">
                    {sessionCategory}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[11px] text-on-surface-variant font-medium uppercase tracking-wider">Online · Supabase Verified Matching</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={clearChat}
              title="Clear session and start fresh"
              className="px-3.5 py-2 rounded-xl border border-outline-variant text-on-surface-variant font-label-md text-xs font-bold flex items-center gap-1.5 hover:bg-surface-container transition-colors shadow-2xs active:scale-95">
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              Reset
            </button>
          </div>
        </div>

        {/* Message Flow */}
        <div className="flex-1 overflow-y-auto chat-scroll px-6 py-8 flex flex-col gap-8 max-w-4xl mx-auto w-full">
          {messages.map((msg, index) => (
            <div key={index} className={`flex gap-4 items-start ${msg.role === 'user' ? 'max-w-[85%] self-end flex-row-reverse' : 'max-w-[95%] self-start w-full'}`}>
              
              {msg.role === 'user' ? (
                <>
                  <div className="w-10 h-10 rounded-full bg-surface-container-high shrink-0 overflow-hidden border border-outline-variant flex items-center justify-center font-bold text-primary shadow-sm">
                    U
                  </div>
                  <div className="bg-primary text-on-primary p-4 rounded-2xl rounded-tr-none shadow-sm font-body-md text-sm whitespace-pre-wrap flex flex-col gap-2">
                    {msg.file && (
                      <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg text-xs border border-white/20">
                        <span className="material-symbols-outlined text-[16px]">description</span>
                        <span className="font-semibold">{msg.file.fileName}</span>
                      </div>
                    )}
                    {msg.content}
                  </div>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-xl bg-primary shrink-0 flex items-center justify-center text-secondary-fixed shadow-md">
                    <span className="material-symbols-outlined filled-icon text-[22px]">smart_toy</span>
                  </div>
                  <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-2xl rounded-tl-none shadow-sm flex flex-col gap-3 w-full">
                    {/* Uploaded File Banner */}
                    {msg.file && (
                      <div className="flex items-center gap-2.5 bg-secondary-container/40 border border-secondary/30 p-3 rounded-xl text-xs text-on-surface font-semibold">
                        <span className="material-symbols-outlined text-primary text-[20px] filled-icon">task_alt</span>
                        <span>📄 Document successfully analyzed: <strong className="text-primary">{msg.file.fileName}</strong></span>
                      </div>
                    )}

                    {/* Formatted AI Response */}
                    <div className="text-on-surface font-body-md leading-relaxed m-0 text-sm">
                      {formatText(msg.content)}
                    </div>

                    {/* Quick-Start Chips on initial greeting */}
                    {index === 0 && messages.length === 1 && (
                      <CategoryQuickStartChips onSelectCategory={handleQuickStartCategory} />
                    )}

                    {/* Lawyer Suggestion Cards */}
                    {msg.lawyers && (
                      <LawyerSuggestionCards
                        lawyers={msg.lawyers}
                        category={msg.category || sessionCategory || 'General Practice'}
                        isFallback={msg.isFallback}
                        onShowMore={() => handleShowMoreLawyers(index)}
                        hasMore={msg.hasMoreLawyers}
                        isLoadingMore={isLoadingMore}
                      />
                    )}
                  </div>
                </>
              )}
            </div>
          ))}

          {/* Streaming / Uploading Indicator */}
          {(isLoading || isUploading) && (
            <div className="flex gap-4 items-start max-w-[90%] self-start opacity-80 animate-fadeIn">
              <div className="w-10 h-10 rounded-xl bg-primary shrink-0 flex items-center justify-center text-secondary-fixed shadow-md">
                <span className="material-symbols-outlined filled-icon text-[22px]">smart_toy</span>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant px-5 py-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-primary rounded-full typing-dot"></div>
                  <div className="w-2 h-2 bg-primary rounded-full typing-dot"></div>
                  <div className="w-2 h-2 bg-primary rounded-full typing-dot"></div>
                </div>
                <span className="text-xs font-semibold text-on-surface-variant">
                  {isUploading ? "Uploading & analyzing legal document..." : "Consulting legal rules & Supabase directory..."}
                </span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Input Area */}
        <div className="px-6 py-5 border-t border-outline-variant bg-surface-container-lowest shadow-[0_-4px_16px_rgba(0,0,0,0.03)] shrink-0">
          <div className="max-w-4xl mx-auto relative group flex flex-col gap-2">
            
            {/* Attached File Preview Chip */}
            {selectedFile && (
              <div className="self-start flex items-center gap-2 bg-primary-container/80 text-on-primary-container px-3.5 py-1.5 rounded-full text-xs font-semibold border border-primary/20 shadow-2xs animate-fadeIn">
                <span className="material-symbols-outlined text-[16px]">attach_file</span>
                <span className="truncate max-w-[240px]">{selectedFile.name}</span>
                <span className="text-[10px] opacity-75">({Math.round(selectedFile.size / 1024)} KB)</span>
                <button
                  onClick={handleRemoveFile}
                  className="hover:bg-primary/20 rounded-full p-0.5 flex items-center justify-center transition-colors ml-1"
                  title="Remove attachment"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </div>
            )}

            <div className="relative bg-white dark:bg-surface-container border border-outline-variant rounded-2xl p-3 shadow-xs flex items-end gap-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary focus-within:shadow-md transition-all">
              
              {/* Hidden File Input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                className="hidden"
              />

              {/* Attach File Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || isUploading}
                title="Attach case file (PDF, PNG, JPG, DOCX)"
                className="p-2.5 text-on-surface-variant hover:text-primary hover:bg-surface-container-high rounded-xl transition-all flex items-center justify-center shrink-0 disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[22px]">attach_file</span>
              </button>

              {/* Textarea */}
              <textarea 
                ref={textareaRef}
                value={inputText}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                className="flex-1 border-none focus:ring-0 p-2 resize-none font-body-md text-on-surface placeholder:text-outline outline-none text-sm bg-transparent max-h-36" 
                placeholder={selectedFile ? "Add a message or instruction about this file (optional)..." : "Describe your legal issue, ask a question, or attach a case file (Press Enter to send)..."} 
                rows="1"
                disabled={isLoading || isUploading}
              ></textarea>

              {/* Send Button */}
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleSendMessage}
                  disabled={(isLoading || isUploading) || (!inputText.trim() && !selectedFile)}
                  className="bg-primary text-on-primary p-3 rounded-xl hover:bg-secondary transition-all active:scale-95 shadow-md flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
                  <span className="material-symbols-outlined text-[20px]">send</span>
                </button>
              </div>
            </div>
          </div>
          <p className="text-center text-[10px] text-outline mt-2.5 uppercase tracking-widest font-bold">
            Disclaimer: AI advice is for informational purposes and not a substitute for formal legal counsel from an advocate.
          </p>
        </div>
      </main>
    </div>
  );
};

export default AIAdvisor;
