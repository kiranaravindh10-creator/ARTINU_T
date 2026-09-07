import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '@/config/env';
import { asyncHandler, validate } from '@/middleware/index';
import { logger } from '@/utils/logger';
import { ask, isAssistantConfigured, STARTERS } from '@/services/assistant/assistant.service';

/**
 * The website assistant's one endpoint.
 *
 * Public, because it answers questions a visitor asks before they have any
 * reason to have an account. That makes rate limiting and input bounds the only
 * things standing between it and someone using ARTINU's key to run their own
 * prompts, so both are here rather than left to the global limiter.
 */
export const assistantRouter = Router();

/**
 * Thirty questions a minute per IP.
 *
 * An answer costs a lookup over fifteen chunks, so this is about keeping a
 * script from hammering a public endpoint rather than about a bill — there is
 * no per-answer cost to protect. Loose enough that a fast reader clicking
 * through the suggested questions never meets it.
 */
const assistantLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "We've had a lot of questions at once. Please try again in a moment." },
  skip: () => env.isDevelopment,
});

const askSchema = z.object({
  // Bounded so a prompt cannot be smuggled in as a wall of text.
  message: z.string().trim().min(1, 'Ask a question').max(500),
  conversation: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(2000),
      }),
    )
    .max(20)
    .optional()
    .default([]),
});

/** What the panel shows before anything is typed. */
assistantRouter.get('/', (_req, res) => {
  res.json({ available: isAssistantConfigured(), starters: STARTERS });
});

assistantRouter.post(
  '/',
  assistantLimiter,
  validate(askSchema),
  asyncHandler(async (req, res) => {
    const { message, conversation } = req.valid as z.infer<typeof askSchema>;

    try {
      res.json(await ask(message, conversation));
    } catch (error) {
      /*
        Nothing internal reaches the browser.

        There is no external provider behind this any more, so a failure here
        would be our own bug — which is exactly the kind of thing whose stack
        trace should be in our logs and not in a visitor's network tab.
      */
      logger.error('Assistant failed', error);
      res.status(500).json({
        message: 'Something went wrong on my side. Try again, or contact the ARTINU team.',
      });
    }
  }),
);
