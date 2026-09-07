import { CONTACT } from '@artinu/shared';
import { FOLLOW_UPS } from '@/knowledge/artinu.knowledge';
import { isUnanswerable, retrieve, type RetrievedChunk } from '@/services/assistant/retrieval.service';
import { recordQuestion } from '@/services/assistant/questions.service';

/**
 * THE ANSWER LAYER — AND THERE IS NO MODEL IN IT.
 *
 * ── Why not ─────────────────────────────────────────────────────────────────
 *
 * A language model would need an API key ARTINU does not have and a bill
 * ARTINU would have to pay, on an endpoint any visitor can call. That settles
 * it on its own. But the interesting part is that removing it made the thing it
 * was there to guarantee — grounding — stronger rather than weaker.
 *
 * A model given retrieved context still writes the sentence. You constrain it
 * with a prompt, you fence the context, you set a temperature, and you are
 * still trusting it not to smooth "Bengaluru is the only city ARTINU works in"
 * into "we install across South India". Here the answer IS ARTINU's sentence.
 * It cannot become a claim nobody approved, because nothing rewrites it.
 *
 * That is why the knowledge chunks are written as prose a person would say
 * rather than as notes: they are not raw material for an answer, they are the
 * answer. Editing what the assistant says means editing the knowledge file, and
 * what you read there is exactly what a visitor gets.
 *
 * ── What is given up, honestly ──────────────────────────────────────────────
 *
 * It cannot rephrase to match how a question was asked, blend two chunks into
 * one bespoke paragraph, or handle a question nobody anticipated by reasoning
 * across the corpus. For a fifteen-chunk site help desk answering "what is
 * this", "what does it cost", "where do you work", that trade is worth making.
 *
 * If ARTINU ever wants the phrasing to adapt, `compose()` below is the seam:
 * it takes retrieved chunks and returns prose, and a model would slot in there
 * without touching the route, the retrieval or the UI.
 */

export interface AssistantReply {
  answer: string;
  suggestions: string[];
  /** Titles only. The visitor sees where it came from, never how it was found. */
  sources: { title: string }[];
}

export interface AssistantTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Always true now. Kept because the route and the client both branch on it, and
 * because it is the flag that would go back to checking a key if a model were
 * ever added — the shape of "is this available" should not change then.
 */
export const isAssistantConfigured = () => true;

/** What a visitor is told when ARTINU's material does not cover the question. */
const NO_ANSWER = `I don't have that on the site yet. The ARTINU team can tell you. Call ${CONTACT.phone} or email ${CONTACT.email}.`;

/** The openers, shown before anything is typed. Each is answerable from the corpus. */
export const STARTERS = [
  'What is ARTINU?',
  'How does it work?',
  'How much does it cost?',
  'Where do you work?',
  "I'm a photographer. How do I join?",
];

/**
 * How much better the best match has to be before a second chunk is dropped.
 *
 * "Price for my home" scores 41 and 40 on the home and business tariffs — two
 * genuinely different answers, and giving only one would be wrong. "How does it
 * work" scores 34 against 4, where the runner-up is noise. A ratio separates
 * those two cases better than any fixed score does.
 */
const SECOND_CHUNK_RATIO = 0.6;

/**
 * Turn retrieved chunks into the reply.
 *
 * At most two, joined by a blank line, because they are written as standalone
 * paragraphs and two is where an answer stops being an answer and starts being
 * the page it came from.
 */
function compose(chunks: RetrievedChunk[]): string {
  const [best, second] = chunks;
  if (second && second.score >= best.score * SECOND_CHUNK_RATIO) {
    return `${best.content}\n\n${second.content}`;
  }
  return best.content;
}

/**
 * Follow-ups for whatever was just answered, in order, without repeats.
 *
 * Taken from FOLLOW_UPS, which is hand-written per chunk, so every suggestion
 * is a question this corpus can answer. A visitor clicking through them can
 * never reach a dead end — which is not true of generated suggestions.
 */
function suggestFor(chunks: RetrievedChunk[]): string[] {
  const out: string[] = [];
  for (const chunk of chunks) {
    for (const question of FOLLOW_UPS[chunk.id] ?? []) {
      if (!out.includes(question)) out.push(question);
    }
    if (out.length >= 3) break;
  }
  return out.slice(0, 3);
}

/**
 * One question, one grounded answer.
 *
 * `history` carries the conversation so "how much does that cost" can resolve
 * against what was just discussed: retrieval runs on the previous question plus
 * the current one, because "that" retrieves nothing on its own.
 *
 * Async although nothing here awaits. The route awaits it, the client expects a
 * promise, and a model dropped into `compose()` later would make it genuinely
 * asynchronous — changing the signature then would ripple outward for no reason.
 */
export async function ask(
  question: string,
  history: AssistantTurn[] = [],
): Promise<AssistantReply> {
  const previousUser = [...history].reverse().find((turn) => turn.role === 'user')?.content ?? '';
  const chunks = retrieve(`${previousUser} ${question}`.trim());

  /*
    Nothing relevant means nothing is said.

    This is the whole hallucination defence and it is structural rather than
    instructed: with no chunk there is no text to return, so the only thing left
    is to say so and hand over the real phone number.
  */
  if (isUnanswerable(chunks)) {
    /*
      A refusal is the most valuable thing this assistant produces.

      It is a visitor who wanted something ARTINU's site does not explain, and
      logging it turns a dead end into a to-do list for the copy. Queued, never
      awaited — analytics must not sit between a visitor and their answer.
    */
    recordQuestion(question, false);
    return { answer: NO_ANSWER, suggestions: STARTERS.slice(0, 3), sources: [] };
  }

  recordQuestion(question, true);

  const used = chunks.slice(0, 2);

  return {
    answer: compose(chunks),
    suggestions: suggestFor(chunks),
    // De-duplicated by title: two chunks from one page cite that page once.
    sources: [...new Map(used.map((c) => [c.title, { title: c.title }])).values()],
  };
}
