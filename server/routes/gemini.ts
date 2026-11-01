import { Router } from 'express';
import { z } from 'zod';
import { ThinkingLevel, Type } from '@google/genai';
import {
  formatCleanChatReply,
  formatINR,
  parseNaturalLanguageVenueCommand,
  sanitizeInputText,
} from '../../src/utils/planningLogic';
import { GEMINI_MODELS, FALLBACK_CHAT_REPLY, getGeminiClient } from '../gemini';

const router = Router();

interface HistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

const chatSchema = z.object({
  message: z.string().min(1).max(1200),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .optional(),
  mode: z.enum(['general', 'deep-thinking', 'fast-lite']).optional(),
  eventContext: z.string().max(300).optional(),
});

const negotiateSchema = z.object({
  vendorName: z.string().min(1),
  category: z.string().min(1),
  quotedAmount: z.number().positive(),
  targetAmount: z.number().positive(),
  leverageNotes: z.array(z.string()).optional(),
  eventName: z.string().min(1),
  fastMode: z.boolean().optional(),
});

const themeIdeasSchema = z.object({
  category: z.string().min(1),
  guestCount: z.number().positive(),
  budgetCap: z.number().positive(),
  stylePrompt: z.string().min(1),
  fastMode: z.boolean().optional(),
});

const generateImageSchema = z.object({
  prompt: z.string().min(1),
  imageSize: z.enum(['1K', '2K', '4K']).optional(),
  aspectRatio: z.enum(['1:1', '3:4', '4:3', '9:16', '16:9']).optional(),
  title: z.string().min(1).optional(),
});

// 1. Chat Endpoint
router.post('/chat', async (req, res) => {
  const parseResult = chatSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid request body schema.', details: parseResult.error.format() });
  }

  const { history = [], mode = 'general', eventContext = '' } = parseResult.data;
  const message = sanitizeInputText(parseResult.data.message, 1200);
  const venueCommand = parseNaturalLanguageVenueCommand(message);

  const model =
    mode === 'deep-thinking'
      ? GEMINI_MODELS.ARGON
      : mode === 'fast-lite'
      ? GEMINI_MODELS.FAST_LITE
      : GEMINI_MODELS.STANDARD;

  const systemInstruction = `You are Aura, a senior executive event architect, wedding producer, and 3D spatial logistics strategist.
Current Event Context: ${sanitizeInputText(eventContext, 300)}
Always quote all financial figures in Indian Rupees (₹, e.g., ₹25,00,000). Never mention internal AI model names.
Write in clean, plain text only: NEVER use asterisks (*, **, ***) or Markdown formatting symbols.
If the user asked to change the 3D venue (indoor/outdoor, table arrangement, colors, lighting atmosphere, or table count), confirm that you have updated their 3D scene and offer brief spatial advice.`;

  try {
    const ai = getGeminiClient();
    const config: { systemInstruction: string; thinkingConfig?: { thinkingLevel: ThinkingLevel } } = {
      systemInstruction,
    };
    if (model === GEMINI_MODELS.ARGON) {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
    }

    const chat = ai.chats.create({
      model,
      config,
    });

    const contextPrefix =
      Array.isArray(history) && history.length > 0
        ? `Previous conversation summary:\n${(history as HistoryItem[])
            .slice(-4)
            .map((h) => `${h.role === 'user' ? 'Planner' : 'Aura'}: ${h.content}`)
            .join('\n')}\n\nCurrent Planner Request: ${message}`
        : message;

    const response = await chat.sendMessage({
      message: contextPrefix,
    });

    return res.json({
      reply: formatCleanChatReply(
        response.text || 'I have updated your event strategy and 3D floor plan.'
      ),
      venueCommand,
    });
  } catch (err: unknown) {
    if (err instanceof Error) {
      // handled
    }
    const fallbackReply = venueCommand?.summaryLabel
      ? `I have immediately updated your 3D Venue with ${venueCommand.summaryLabel}.\n\n• Spatial Sightlines: All banquet tables maintain a minimum 1.8m service aisle toward the ceremonial stage.\n• Budget Alignment: You can review or customize your Indian Rupee (₹) department allocations anytime in the Budget & Pay tab.`
      : FALLBACK_CHAT_REPLY;

    return res.json({
      reply: formatCleanChatReply(fallbackReply),
      venueCommand,
    });
  }
});

// 2. Negotiate Endpoint
router.post('/negotiate', async (req, res) => {
  const parseResult = negotiateSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid negotiate request schema.' });
  }

  const {
    vendorName,
    category,
    quotedAmount,
    targetAmount,
    leverageNotes = [],
    eventName,
    fastMode = false,
  } = parseResult.data;

  const model = fastMode ? GEMINI_MODELS.FAST_LITE : GEMINI_MODELS.ARGON;

  try {
    const ai = getGeminiClient();
    const prompt = `Create a high-leverage, polite, executive vendor negotiation counter-offer email and 3 tactical talking points in Indian Rupees (₹) for:
Event: ${eventName}
Vendor: ${vendorName} (${category})
Initial Quote: ${formatINR(Number(quotedAmount))}
Target Budget: ${formatINR(Number(targetAmount))}
Client Leverage Points: ${(leverageNotes || []).join('; ')}
Never mention any AI model names.`;

    const config: {
      systemInstruction: string;
      responseMimeType: string;
      responseSchema: unknown;
      thinkingConfig?: { thinkingLevel: ThinkingLevel };
    } = {
      systemInstruction:
        'You are a master hospitality contract negotiator in India. Use Indian Rupees (₹) exclusively. Output JSON with subjectLine, openingCounterOffer (number), emailBody, and tacticalTalkingPoints (array of 3 strings).',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          subjectLine: { type: Type.STRING },
          openingCounterOffer: { type: Type.NUMBER },
          emailBody: { type: Type.STRING },
          tacticalTalkingPoints: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
      },
    };

    if (model === GEMINI_MODELS.ARGON) {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
    }

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config,
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    return res.json(parsed);
  } catch {
    const opening = Math.round(Number(targetAmount || 400000) * 0.94);
    return res.json({
      subjectLine: `Partnership Terms & Scope Alignment — ${eventName} (${vendorName})`,
      openingCounterOffer: opening,
      emailBody: `Dear ${vendorName} Team,\n\nThank you for preparing the comprehensive ${category} proposal for ${eventName}. While your initial estimate stands at ${formatINR(
        Number(quotedAmount)
      )}, our approved department cap is ${formatINR(Number(targetAmount))}.\n\nIf we can align on an initial package structure of ${formatINR(
        opening
      )}—settling within our ${formatINR(
        Number(targetAmount)
      )} cap—we are ready to release an immediate 50% escrow deposit today. Key operational efficiencies we can commit to include: ${(
        leverageNotes || []
      ).join('; ')}.\n\nPlease let us know if we can finalize the revised addendum this week.\n\nWarm regards,\nProduction Desk — ${eventName}`,
      tacticalTalkingPoints: [
        `Anchor counter-offer at ${formatINR(opening)} to settle cleanly at ${formatINR(
          Number(targetAmount)
        )}.`,
        'Offer immediate escrow wire release upon contract signature.',
        'Trade off-peak load-in flexibility to waive overtime setup fees.',
      ],
    });
  }
});

// 3. Theme Ideas Endpoint
router.post('/theme-ideas', async (req, res) => {
  const parseResult = themeIdeasSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid theme ideas request schema.' });
  }

  const { category, guestCount, budgetCap, stylePrompt, fastMode = false } = parseResult.data;
  const model = fastMode ? GEMINI_MODELS.FAST_LITE : GEMINI_MODELS.STANDARD;

  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model,
      contents: `Generate a cohesive luxury event concept for a ${category} with ${guestCount} guests and a ${formatINR(
        Number(budgetCap)
      )} budget. Direction: ${stylePrompt}. Never mention AI model names.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            themeTitle: { type: Type.STRING },
            themeSubtitle: { type: Type.STRING },
            architecturalNotes: { type: Type.STRING },
            palette: { type: Type.ARRAY, items: { type: Type.STRING } },
            signatureMoments: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
        },
      },
    });
    const parsed = JSON.parse((response.text ?? '{}').trim());
    return res.json(parsed);
  } catch {
    return res.json({
      themeTitle: `Bespoke ${stylePrompt || 'Royal Courtyard'} Sanctuary`,
      themeSubtitle: `Curated spatial design for ${guestCount} guests within ${formatINR(
        Number(budgetCap)
      )} featuring tactile natural stonework, warm pin-spot lighting, and acoustic intimacy.`,
      architecturalNotes:
        'Arrange banquet tables in a radial amphitheater or royal U-shape around the central floral mandap with 2700K candlelight.',
      palette: ['#F5F2EB', '#D4AF37', '#0F5132', '#1E293B'],
      signatureMoments: [
        'Welcome saffron-rose botanical aperitif served in chilled brass-rimmed glassware',
        'Synchronized warm pin-spot dimmer transition prior to main family toast',
        'Zero-waste potted mogra centerpiece gifting station at departure',
      ],
    });
  }
});

// 4. Generate Image Endpoint
router.post('/generate-image', async (req, res) => {
  const parseResult = generateImageSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid generate image request schema.' });
  }

  const {
    prompt,
    imageSize = '1K',
    aspectRatio = '16:9',
    title = 'Bespoke Event Concept',
  } = parseResult.data;

  const validSize = imageSize;
  const validRatio = aspectRatio;

  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: GEMINI_MODELS.IMAGE,
      contents: {
        parts: [
          {
            text: `Editorial architectural event photography: ${prompt}. Natural golden hour lighting, tactile linen and stone textures, 8k commercial studio quality.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: validRatio,
          imageSize: validSize,
        },
      },
    });

    let imageUrl = '';
    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        const mime = part.inlineData.mimeType ?? 'image/png';
        imageUrl = `data:${mime};base64,${part.inlineData.data}`;
        break;
      }
    }

    if (imageUrl) {
      return res.json({
        imageUrl,
        resolution: validSize,
        aspectRatio: validRatio,
      });
    }
    throw new Error('No image part returned');
  } catch {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" width="1200" height="675">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0F172A" />
          <stop offset="55%" stop-color="#1E293B" />
          <stop offset="100%" stop-color="#334155" />
        </linearGradient>
        <radialGradient id="flare" cx="50%" cy="45%" r="45%">
          <stop offset="0%" stop-color="#C89D54" stop-opacity="0.55" />
          <stop offset="100%" stop-color="#C89D54" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="1200" height="675" fill="url(#bg)" />
      <circle cx="600" cy="300" r="340" fill="url(#flare)" />
      <g stroke="#C89D54" stroke-opacity="0.35" stroke-width="2" fill="none">
        <path d="M 160 520 L 160 210 Q 600 50 1040 210 L 1040 520 Z" />
        <path d="M 280 520 L 280 240 Q 600 110 920 240 L 920 520 Z" />
        <ellipse cx="600" cy="540" rx="280" ry="52" fill="#C89D54" fill-opacity="0.25" />
        <circle cx="600" cy="240" r="48" />
      </g>
      <rect x="50" y="45" width="760" height="115" rx="8" fill="#0F172A" fill-opacity="0.82" stroke="#C89D54" stroke-opacity="0.4" />
      <text x="80" y="92" fill="#F8FAFC" font-family="Georgia, serif" font-size="26" font-weight="bold">${title.replace(/[<>&"']/g, '')} (${validSize} · ${validRatio})</text>
      <text x="80" y="130" fill="#CBD5E1" font-family="sans-serif" font-size="15">${String(prompt).slice(0, 92).replace(/[<>&"']/g, '')}</text>
    </svg>`;
    return res.json({
      imageUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
      resolution: validSize,
      aspectRatio: validRatio,
    });
  }
});

export default router;
