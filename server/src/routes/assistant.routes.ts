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
 * Twelve questions a minute per IP.
 *
 * A person reading answers asks a few; anything near this ceiling is a script.
 * Deliberately far tighter than the global 300/min, because every request here
 * costs a model call — the global limiter protects the server, this protects
 * the bill.
 */
const assistantLimiter = rateLimit({
  windowMs: 60_000,
  limit: 12,
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

    if (!isAssistantConfigured()) {
      res.status(503).json({ message: 'The assistant is unavailable right now.' });
      return;
    }

    try {
      res.json(await ask(message, conversation));
    } catch (error) {
      /*
        The provider's error never reaches the browser.

        A rate-limit body, a model name or a stack trace would tell a visitor
        nothing useful and tell an attacker what is behind this endpoint. It is
        logged in full for us and answered with one sentence for them.
      */
      logger.error('Assistant failed', error);
      res.status(502).json({
        message: 'Something went wrong on my side. Try again, or contact the ARTINU team.',
      });
    }
  }),
);
