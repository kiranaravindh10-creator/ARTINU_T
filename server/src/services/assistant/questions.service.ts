import { db } from '@/database/db';
import { logger } from '@/utils/logger';

/**
 * WHAT VISITORS ARE ASKING — AND WHAT ARTINU CANNOT ANSWER.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * The assistant refuses any question its knowledge base does not cover. Every
 * one of those refusals is a visitor who wanted something ARTINU's website does
 * not explain, and until now that signal went nowhere: they asked, they got
 * "I don't have that", they left, and nobody at ARTINU ever knew.
 *
 * That list is the most useful thing this feature produces. It is not analytics
 * for its own sake — it is a to-do list for the site, written by the people
 * trying to buy from it. Fourteen people asking something the FAQ does not
 * cover is worth more than any number of pageviews.
 *
 * ── What is stored, and what deliberately is not ────────────────────────────
 *
 * The question text, whether it was answered, and the day. That is all.
 *
 * No IP address, no user id, no session id, no cookie, nothing that links two
 * questions to the same person. The assistant is on a public page and people
 * type odd things into boxes; a log that could tie those to an individual is a
 * liability that buys nothing. Aggregate counts answer "what do visitors not
 * understand", which is the only question worth asking of this data.
 *
 * ── Where it lives ──────────────────────────────────────────────────────────
 *
 * In `ui_content`, the existing jsonb blob table the curated lists already use.
 * No migration, no new table, and it works on the live database the moment this
 * deploys — which matters, because a feature that needs a migration ARTINU has
 * not run yet is a feature nobody sees.
 */

const RECORD_ID = 'assistant_questions';

/** Kept for a rolling window. Old questions stop describing the current site. */
const MAX_ENTRIES = 400;

/** Long enough for a real question, short enough that nobody pastes a document. */
const MAX_LENGTH = 160;

export interface LoggedQuestion {
  /** The question as typed, trimmed and capped. */
  q: string;
  /** False when the assistant had to refuse — the interesting case. */
  answered: boolean;
  /** Date only, not a timestamp: enough to say "this week", too coarse to correlate. */
  day: string;
}

/*
  Buffered, then flushed.

  A write per question would mean a database write on a public endpoint, which
  is both an abuse lever and pointless churn — nobody reads this in real time.
  Questions accumulate in memory and go out at most every thirty seconds, so a
  burst costs one write.

  A restart loses at most thirty seconds of questions. For a signal read weekly
  that is an acceptable trade against the alternative, which is a table.
*/
let buffer: LoggedQuestion[] = [];
let flushTimer: NodeJS.Timeout | null = null;
const FLUSH_AFTER_MS = 30_000;

async function flush(): Promise<void> {
  if (buffer.length === 0) return;
  const pending = buffer;
  buffer = [];

  try {
    const record = await db.uiContent.byId(RECORD_ID);
    const existing: LoggedQuestion[] = Array.isArray(record?.data)
      ? (record!.data as LoggedQuestion[])
      : [];

    // Newest first, trimmed to the window.
    const next = [...pending.reverse(), ...existing].slice(0, MAX_ENTRIES);

    if (record) {
      await db.uiContent.update(RECORD_ID, { data: next, updatedAt: new Date().toISOString() });
    } else {
      await db.uiContent.insert({ id: RECORD_ID, data: next, updatedAt: new Date().toISOString() });
    }
  } catch (error) {
    /*
      Losing the log must never cost a visitor their answer.

      This runs after the reply has already been sent, so a failure here is
      invisible to them by design — it is logged for us and dropped.
    */
    logger.warn('Could not save assistant questions', error);
  }
}

/** Queue one question. Returns immediately; the write happens later. */
export function recordQuestion(question: string, answered: boolean): void {
  const q = question.trim().slice(0, MAX_LENGTH);
  if (!q) return;

  buffer.push({ q, answered, day: new Date().toISOString().slice(0, 10) });

  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flush();
    }, FLUSH_AFTER_MS);
    // Never hold the process open for an analytics write.
    flushTimer.unref?.();
  }
}

/**
 * Write whatever is buffered, now.
 *
 * Exported so a deploy does not silently drop the last half minute of
 * questions — and so a test can assert on what was written without waiting out
 * the timer.
 */
export async function flushQuestions(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flush();
}

export interface QuestionSummary {
  total: number;
  answered: number;
  /** The ones ARTINU could not answer — the to-do list for the site. */
  unanswered: number;
  /** Most asked, answered or not. */
  top: { question: string; count: number; answered: boolean }[];
  /** Most asked among the refusals, which is where the gaps are. */
  gaps: { question: string; count: number }[];
  since: string | null;
}

/** Group near-identical questions so "how much" and "How much?" count as one. */
const normalise = (q: string) =>
  q.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

/**
 * The rolling window, summarised.
 *
 * `days` narrows it — the default month is long enough to see a pattern and
 * short enough that a question answered by last week's copy change drops out.
 */
export async function summarise(days = 30): Promise<QuestionSummary> {
  const record = await db.uiContent.byId(RECORD_ID).catch(() => null);
  const all: LoggedQuestion[] = Array.isArray(record?.data) ? (record!.data as LoggedQuestion[]) : [];

  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const recent = all.filter((entry) => entry.day >= cutoff);

  const counts = new Map<string, { question: string; count: number; answered: boolean }>();
  for (const entry of recent) {
    const key = normalise(entry.q);
    const seen = counts.get(key);
    if (seen) {
      seen.count += 1;
      // If any instance went unanswered, the question is a gap.
      seen.answered = seen.answered && entry.answered;
    } else {
      counts.set(key, { question: entry.q, count: 1, answered: entry.answered });
    }
  }

  const ranked = [...counts.values()].sort((a, b) => b.count - a.count);

  return {
    total: recent.length,
    answered: recent.filter((e) => e.answered).length,
    unanswered: recent.filter((e) => !e.answered).length,
    top: ranked.slice(0, 8),
    gaps: ranked.filter((e) => !e.answered).slice(0, 8).map(({ question, count }) => ({ question, count })),
    since: recent.length > 0 ? recent[recent.length - 1].day : null,
  };
}
