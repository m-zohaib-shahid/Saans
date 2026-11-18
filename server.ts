import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type, type GenerateContentResponse } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
// Order prioritizes reliable high-quota Flash models and falls back gracefully
const MODEL_CASCADE = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];

function createGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isRetryableModelError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('NOT_FOUND') ||
    msg.includes('404') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('503')
  );
}

async function generateWithFallback(
  ai: GoogleGenAI,
  params: Omit<Parameters<GoogleGenAI['models']['generateContent']>[0], 'model'>
): Promise<{ response: GenerateContentResponse; modelUsed: string }> {
  let lastErr: unknown;
  for (const model of MODEL_CASCADE) {
    try {
      const response = await ai.models.generateContent({
        ...params,
        model,
      });
      return { response, modelUsed: model };
    } catch (err) {
      lastErr = err;
      if (!isRetryableModelError(err)) {
        throw err;
      }
    }
  }
  throw lastErr;
}

async function generateStreamWithFallback(
  ai: GoogleGenAI,
  params: Omit<Parameters<GoogleGenAI['models']['generateContentStream']>[0], 'model'>
) {
  let lastErr: unknown;
  for (const model of MODEL_CASCADE) {
    try {
      const stream = await ai.models.generateContentStream({
        ...params,
        model,
      });
      return { stream, modelUsed: model };
    } catch (err) {
      lastErr = err;
      if (!isRetryableModelError(err)) {
        throw err;
      }
    }
  }
  throw lastErr;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    const hasKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
    res.json({ ok: true, geminiConfigured: hasKey });
  });

  // Feature A: Structured Today's Personalized Advice
  app.post('/api/ai/advice', async (req, res) => {
    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({ error: 'GEMINI_NOT_CONFIGURED' });
      return;
    }

    try {
      const { context, persona, language } = req.body as {
        context: string;
        persona: string;
        language: 'en' | 'ur';
      };

      const targetLang = language === 'ur' ? 'Urdu (Nastaliq script, natural polite Pakistani Urdu)' : 'English';

      const { response, modelUsed } = await generateWithFallback(ai, {
        contents: `LIVE LAHORE ENVIRONMENTAL DATA:\n${context}\n\nSELECTED PERSONA: ${persona}\nTARGET LANGUAGE: ${targetLang}\n\nGenerate personalized, practical smog safety advice strictly grounded ONLY in the live numbers above. Never invent any AQI, PM2.5, or weather figures.`,
        config: {
          systemInstruction:
            `You are Saans (سانس), Lahore's honest, evidence-based air quality advisor. ` +
            `Answer strictly using the live numbers provided in the prompt. Never fabricate numbers. ` +
            `Respond in ${targetLang}. Keep headlines sharp (max 12 words), provide 3-5 concrete actions tailored to the persona, ` +
            `specify mask ('none', 'surgical', or 'N95'), give clear window ventilation timing, identify the best outdoor time window from the hourly data, and explain reasoning concisely.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              verdict: {
                type: Type.STRING,
                description: 'Must be one of: Safe, Caution, Avoid outdoor, Stay indoors',
              },
              headline: {
                type: Type.STRING,
                description: 'One-sentence actionable verdict headline in the target language.',
              },
              actions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3 to 5 specific actions tailored to the persona in the target language.',
              },
              mask: {
                type: Type.STRING,
                description: 'Mask level: none, surgical, or N95',
              },
              ventilation: {
                type: Type.STRING,
                description: 'When and how to open/close windows based on hourly forecast.',
              },
              bestWindow: {
                type: Type.STRING,
                description: 'Best outdoor time window today based on provided hourly data.',
              },
              reasoning: {
                type: Type.STRING,
                description: 'Brief grounded explanation referencing actual live PM2.5, AQI, wind, or boundary layer.',
              },
            },
            required: ['verdict', 'headline', 'actions', 'mask', 'ventilation', 'bestWindow', 'reasoning'],
          },
        },
      });

      const raw = (response.text ?? '').trim();
      const parsed = JSON.parse(raw);
      res.json({ advice: parsed, modelUsed });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate AI advice';
      res.status(502).json({ error: message });
    }
  });

  // Feature B: Streaming Chat ("Ask Saans" + Symptom Checker mode)
  app.post('/api/ai/chat', async (req, res) => {
    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({ error: 'GEMINI_NOT_CONFIGURED' });
      return;
    }

    try {
      const { messages, context, persona, language, mode } = req.body as {
        messages: Array<{ role: 'user' | 'assistant'; content: string }>;
        context: string;
        persona: string;
        language: 'en' | 'ur';
        mode?: 'general' | 'health';
      };

      const historyText = (messages || [])
        .slice(-8)
        .map((m) => `${m.role === 'user' ? 'User' : 'Saans'}: ${m.content}`)
        .join('\n');

      const healthRule =
        mode === 'health'
          ? 'You are in Respiratory Health Symptom Triage mode. ALWAYS remind the user this is AI information, NOT medical advice, and recommend seeing a qualified doctor. If the user mentions red-flag symptoms (chest pain, blue lips, severe shortness of breath, wheezing that does not improve with inhaler, fainting, confusion), immediately advise urgent emergency medical care (Rescue 1122 / nearest ER).'
          : 'Remind users when appropriate that guidance is informational and not medical advice.';

      const systemInstruction =
        `You are Saans (سانس), Lahore's real-time smog assistant.\n` +
        `CRITICAL GROUNDING RULE: Only cite numbers from the LIVE DATA below. If a value is not in the data, say you do not have that measurement.\n` +
        `LANGUAGE RULE: Reply in the same language/script the user writes in (English, Urdu Nastaliq script, or Roman Urdu). If unclear, use ${language === 'ur' ? 'Urdu (Nastaliq script)' : 'English'}.\n` +
        `PERSONA: ${persona}.\n${healthRule}\nBe concise, practical, empathetic, and structured with short bullet points.`;

      const prompt = `LIVE DATA SNAPSHOT:\n${context}\n\nCONVERSATION:\n${historyText}\n\nRespond to the user's latest message directly.`;

      // Acquire stream first before committing SSE headers
      const { stream } = await generateStreamWithFallback(ai, {
        contents: prompt,
        config: { systemInstruction },
      });

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();

      let emittedChars = 0;
      for await (const chunk of stream) {
        const text = (chunk as GenerateContentResponse).text;
        if (text) {
          emittedChars += text.length;
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }
      if (emittedChars === 0) {
        res.write(`data: ${JSON.stringify({ error: 'EMPTY_STREAM_RESPONSE' })}\n\n`);
      } else {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      }
      res.end();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Streaming failed';
      if (!res.headersSent) {
        res.status(502).json({ error: message });
      } else {
        res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
        res.end();
      }
    }
  });

  // Feature C: Simplify into Simple Urdu ("Explain like I'm 10 / سادہ اردو میں سمجھائیں")
  app.post('/api/ai/simplify', async (req, res) => {
    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({ error: 'GEMINI_NOT_CONFIGURED' });
      return;
    }

    try {
      const { text, context } = req.body as { text: string; context: string };
      const { response } = await generateWithFallback(ai, {
        contents: `LIVE DATA:\n${context}\n\nTEXT TO SIMPLIFY:\n${text}\n\nRewrite this in very simple, everyday Urdu (سادہ اردو) that a 10-year-old child or grandparent can easily understand. Keep it to 3-4 short sentences. Do not invent any numbers.`,
        config: {
          systemInstruction:
            'You translate smog advice into warm, crystal-clear, very simple Urdu (Nastaliq script) suitable for a 10-year-old. Avoid technical jargon like PM2.5 or microgram unless explained simply as dirty dust in the air.',
        },
      });
      res.json({ simplified: (response.text ?? '').trim() });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Simplify failed';
      res.status(502).json({ error: message });
    }
  });

  // Feature D & School Parent Advisory: Generate shareable WhatsApp / Parent post
  app.post('/api/ai/share-post', async (req, res) => {
    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({ error: 'GEMINI_NOT_CONFIGURED' });
      return;
    }

    try {
      const { context, language, kind, decisionSummary } = req.body as {
        context: string;
        language: 'en' | 'ur' | 'bilingual';
        kind: 'community' | 'school';
        decisionSummary?: string;
      };

      const prompt =
        kind === 'school'
          ? `LIVE DATA:\n${context}\nSCHOOL DECISION RULE OUTPUT:\n${decisionSummary || ''}\n\nWrite a formal yet warm School Parent Advisory notice for WhatsApp/SMS in BOTH English and Urdu (clearly separated). Only cite the provided live numbers and decision.`
          : `LIVE DATA:\n${context}\n\nWrite a crisp, high-impact WhatsApp-ready Lahore smog update in ${
              language === 'ur' ? 'Urdu (Nastaliq)' : language === 'bilingual' ? 'Urdu & English' : 'English'
            } with 3 bullet takeaways (AQI, cigarette equivalent or WHO multiplier, best safe window). Strictly use the live numbers provided. Max 120 words.`;

      const { response } = await generateWithFallback(ai, {
        contents: prompt,
        config: {
          systemInstruction:
            'You write factual, calm, actionable public health updates for Lahore families and schools. Never exaggerate or invent numbers.',
        },
      });

      res.json({ post: (response.text ?? '').trim() });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Share post failed';
      res.status(502).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Saans server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
