// Supabase Edge Function: gemini-proxy
//
// Audit issue #3 — the Gemini API key must never reach the browser bundle.
// This function holds the key as a server-side secret (GOOGLE_API_KEY) and
// proxies the two AI Advisor operations the frontend used to run in-browser:
//   mode: "chat"            -> multi-turn legal chat
//   mode: "analyzeDocument"  -> structured JSON analysis of an uploaded file
//
// Deploy:
//   supabase functions deploy gemini-proxy
//   supabase secrets set GOOGLE_API_KEY=<your key>
//
// The frontend calls this via `supabase.functions.invoke('gemini-proxy', { body: {...} })`
// (see src/services/aiAdvisor.service.js) — the anon key travels with that
// call as usual, but the Gemini key itself stays server-side.

import { GoogleGenerativeAI } from "npm:@google/generative-ai@0.21.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CHAT_MODELS = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash", "gemini-2.0-flash-001", "gemini-2.0-flash-lite"];
const DOC_MODELS = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash", "gemini-2.0-flash-001"];

const RATE_LIMIT_MAX_REQUESTS = 20;
const RATE_LIMIT_WINDOW_MINUTES = 60;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function checkRateLimit(supabaseAdmin: ReturnType<typeof createClient>, clientKey: string) {
  const { data, error } = await supabaseAdmin.rpc("check_ai_advisor_rate_limit", {
    p_client_key: clientKey,
    p_max_requests: RATE_LIMIT_MAX_REQUESTS,
    p_window_minutes: RATE_LIMIT_WINDOW_MINUTES,
  });
  if (error) {
    console.error("Rate limit check failed, failing open:", error.message);
    return true;
  }
  return data === true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("GOOGLE_API_KEY");
  if (!apiKey) {
    return jsonResponse({ error: "AI advisor is temporarily unavailable." }, 503);
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const allowed = await checkRateLimit(supabaseAdmin, clientIp);
  if (!allowed) {
    return jsonResponse({ error: "Too many requests. Please try again later." }, 429);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    if (payload.mode === "chat") {
      const history = Array.isArray(payload.history) ? payload.history : [];
      const message = String(payload.message || "");
      if (!message) return jsonResponse({ error: "Missing message." }, 400);

      let responseText: string | null = null;
      for (const modelName of CHAT_MODELS) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          try {
            const chat = model.startChat({ history });
            const result = await chat.sendMessage(message);
            responseText = result.response.text();
          } catch {
            const prompt = history.length > 0
              ? history.map((h: { role: string; parts: { text: string }[] }) => `${h.role}: ${h.parts?.[0]?.text ?? ""}`).join("\n") + `\nuser: ${message}`
              : message;
            const result = await model.generateContent(prompt);
            responseText = result.response.text();
          }
          if (responseText) break;
        } catch {
          // try next model
        }
      }

      if (!responseText) return jsonResponse({ text: null });
      return jsonResponse({ text: responseText });
    }

    if (payload.mode === "analyzeDocument") {
      const base64Data = String(payload.base64Data || "");
      const mimeType = String(payload.mimeType || "application/pdf");
      const userPrompt = String(payload.userPrompt || "");
      if (!base64Data) return jsonResponse({ error: "Missing file data." }, 400);

      const systemPrompt = `You are an expert AI Legal Assistant in Bangladesh. You have been given a legal document or case file uploaded by a user.
${userPrompt ? `The user also stated: "${userPrompt}"\n` : ""}
Analyze the document/image carefully and return a JSON object with EXACTLY the following structure (do NOT include markdown code fences or any other text outside the JSON):
{
  "documentType": "Short title of document (e.g. Land Sale Deed, Divorce Notice, Employment Agreement, FIR, Court Summons, etc.)",
  "keyFacts": [
    "Fact 1: Brief objective summary of key detail",
    "Fact 2: Brief objective summary of key detail",
    "Fact 3: Brief objective summary of key detail"
  ],
  "practiceArea": "One of: Criminal Law, Family Law, Property Law, Corporate Law, Civil Law, Labor Law, Constitutional Law, Immigration Law, Intellectual Property, Tax Law",
  "urgentIssues": "Specify any critical deadlines, court dates, notice periods, or immediate risks (or write 'None identified' if none)",
  "recommendedAction": "1-2 sentences explaining what immediate legal step or lawyer consultation is recommended."
}`;

      const inlinePart = { inlineData: { data: base64Data, mimeType } };

      let responseText: string | null = null;
      for (const modelName of DOC_MODELS) {
        try {
          const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: { responseMimeType: "application/json" },
          });
          const result = await model.generateContent([systemPrompt, inlinePart]);
          responseText = result.response.text();
          if (responseText) break;
        } catch (err) {
          console.warn(`Model ${modelName} failed for doc analysis:`, (err as Error).message);
        }
      }

      if (!responseText) return jsonResponse({ error: "Failed to analyze document." }, 502);

      try {
        const cleaned = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        return jsonResponse({ analysis: parsed });
      } catch {
        return jsonResponse({ analysis: null, raw: responseText });
      }
    }

    return jsonResponse({ error: "Unknown mode." }, 400);
  } catch (err) {
    console.error("gemini-proxy error:", err);
    return jsonResponse({ error: "AI advisor request failed." }, 500);
  }
});
