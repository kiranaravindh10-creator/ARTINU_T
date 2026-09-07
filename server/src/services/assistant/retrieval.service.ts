import { KNOWLEDGE, type KnowledgeChunk } from '@/knowledge/artinu.knowledge';

/**
 * FINDING THE RIGHT PIECES OF ARTINU'S OWN WORDS.
 *
 * ── Why there is no vector database here ────────────────────────────────────
 *
 * The knowledge base is fifteen chunks of a few sentences each. Embedding that
 * would mean a second API key, a network call on the critical path of every
 * question, an index to keep in step with the source, and a failure mode where
 * the assistant goes down because an embedding provider did. For a corpus this
 * size, scored term overlap with a synonym layer retrieves the same chunks and
 * costs a millisecond.
 *
 * The interface is the part that matters: `retrieve()` takes a question and
 * returns scored chunks. Swapping the body for embeddings later changes this
 * file and nothing else.
 *
 * ── The threshold is the point ──────────────────────────────────────────────
 *
 * `MIN_SCORE` is what makes the assistant able to say "I don't know". Retrieval
 * that always returns its best three chunks will hand the model something
 * irrelevant for an off-topic question, and a model given context will use it.
 * Returning nothing is what lets the answer be an honest refusal.
 */

export interface RetrievedChunk extends KnowledgeChunk {
  score: number;
}

/**
 * Words that carry no topic. Dropped so "what is the price" and "price" score
 * the same chunk equally well.
 */
const STOP = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'do', 'does', 'for', 'from', 'get',
  'has', 'have', 'how', 'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'that', 'the',
  'to', 'was', 'what', 'when', 'where', 'which', 'who', 'why', 'will', 'with', 'you', 'your',
  'we', 'us', 'our', 'about', 'tell', 'give', 'need', 'want', 'would', 'could', 'please',
]);

/**
 * What visitors say versus what the site says.
 *
 * A visitor asks "how much", the page says "rate"; they say "bangalore", the
 * FAQ says "Bengaluru". Without this the right chunk scores zero on the exact
 * questions people ask most.
 */
const SYNONYMS: Record<string, string[]> = {
  cost: ['price', 'pricing', 'rate', 'much', 'charge', 'fee', 'expensive', 'afford'],
  price: ['cost', 'pricing', 'rate', 'much', 'charge', 'fee'],
  much: ['cost', 'price', 'rate'],
  cheap: ['cost', 'price', 'rate'],
  bangalore: ['bengaluru'],
  bengaluru: ['bangalore'],
  photo: ['photograph', 'photography', 'picture', 'image', 'print'],
  photos: ['photograph', 'photography', 'picture', 'image', 'print'],
  picture: ['photograph', 'photo', 'image'],
  art: ['photograph', 'photography', 'artwork'],
  artwork: ['photograph', 'photography', 'art'],
  book: ['booking', 'enquiry', 'contact', 'survey', 'order'],
  booking: ['book', 'enquiry', 'contact', 'survey'],
  buy: ['order', 'purchase', 'rent', 'price'],
  rent: ['rental', 'monthly', 'subscription', 'price'],
  artist: ['photographer'],
  artists: ['photographer'],
  join: ['apply', 'register', 'photographer', 'signup'],
  apply: ['join', 'register', 'photographer'],
  paid: ['payment', 'commission', 'money', 'earn'],
  pay: ['payment', 'price', 'cost'],
  cancel: ['notice', 'commitment', 'contract', 'minimum'],
  contract: ['commitment', 'minimum', 'notice'],
  office: ['workspace', 'business'],
  home: ['house', 'apartment', 'residential', 'decor'],
  start: ['begin', 'process', 'started', 'first'],
  work: ['works', 'process', 'steps'],
};

/**
 * Crude suffix stripping, applied to the query and the corpus alike.
 *
 * Without it "located" misses a chunk keyworded "location", and "services"
 * misses "service" — both of which were real failures on the first run of the
 * question set. A full stemmer is not worth a dependency for a corpus this
 * size; folding the four suffixes English actually inflects with is enough,
 * and doing it to both sides means the two always meet in the middle.
 *
 * The length floor stops it mangling short words: "does" must not become "do".
 */
/*
  "swapp" back to "swap".

  English doubles the final consonant before "ed" and "ing", so stripping the
  suffix leaves a letter behind: swapped becomes swapp, running becomes runn.
  The corpus has "swap", so "how do the photos get swapped" matched nothing and
  the visitor was told to phone instead.
*/
const undouble = (word: string): string =>
  word.length > 2 && word[word.length - 1] === word[word.length - 2]
    ? word.slice(0, -1)
    : word;

const stem = (word: string): string => {
  if (word.length > 5 && word.endsWith('ing')) return undouble(word.slice(0, -3));
  if (word.length > 5 && word.endsWith('ed')) return undouble(word.slice(0, -2));
  /*
    A plural loses its "s" and nothing else.

    There used to be a rule above this one taking two characters off anything
    ending in "es", for "boxes" and "churches". It was wrong far more often
    than it was right, because most English words ending in "es" are a word
    ending in "e" with an "s" on it. "rates" became "rat" while the keyword
    "rate" stayed "rate", so asking about rates retrieved nothing at all, and
    "charges" became "charg" against a query of "charge". Both were silent:
    the question simply got the phone number instead of the price list.

    Taking one character is right for "rates", "charges", "services" and
    "photographs" alike. It is wrong for "boxes", which becomes "boxe" — but
    it is wrong on BOTH sides, so the query and the corpus still meet, which
    is the only property that matters here.
  */
  if (word.length > 3 && word.endsWith('s')) return word.slice(0, -1);
  return word;
};

const tokenise = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP.has(word))
    .map(stem)
    // Again after stemming: "whats" survives the first pass and only becomes
    // the stop word "what" once the plural is off.
    .filter((word) => !STOP.has(word));

/**
 * Each word of the question, with the words the site would use for it instead.
 *
 * Grouped BY WORD rather than flattened into one bag. The bag version scored a
 * word once per synonym that happened to appear, so "cancel", which has five,
 * was worth five times a word with none. It also made it impossible to ask how
 * much of the question a chunk actually covered, because the count was of
 * synonyms rather than of words the visitor typed.
 */
function expand(tokens: string[]): Set<string>[] {
  return [...new Set(tokens)].map(
    (token) => new Set([token, ...(SYNONYMS[token] ?? []).map(stem)]),
  );
}

/*
  Keywords outrank the body deliberately.

  A chunk's `keywords` are the questions it was written to answer, so a hit
  there is a much stronger signal than the same word appearing once in a
  paragraph. The title sits between the two.
*/
const KEYWORD_WEIGHT = 6;
const TITLE_WEIGHT = 3;
const BODY_WEIGHT = 1;

/**
 * Below this, the question is treated as unanswerable from ARTINU's material.
 *
 * Tuned against the real corpus: on-topic questions ("what is artinu", "how
 * much", "where are you") score well above it, while off-topic ones ("what is
 * the weather", "write me a poem") score at or near zero. Raising it makes the
 * assistant refuse things it could answer; lowering it lets a stray word drag
 * in a chunk and invites a confident answer built on nothing.
 */
const MIN_SCORE = 4;

/** How many chunks the model is given. Enough to answer, few enough to stay grounded. */
const TOP_K = 4;

export function retrieve(query: string, limit = TOP_K): RetrievedChunk[] {
  const words = expand(tokenise(query));
  if (words.length === 0) return [];

  const scored = KNOWLEDGE.map((chunk) => {
    const keywords = new Set(chunk.keywords.flatMap((k) => tokenise(k)));
    const title = new Set(tokenise(chunk.title));
    const body = new Set(tokenise(chunk.content));

    let score = 0;
    /*
      How many DIFFERENT words of the question this chunk accounts for.

      The score alone cannot tell the difference between a chunk that answers
      the question and a chunk that happens to share one word with it, because
      a single keyword hit is worth 6 and the floor is 4. "Do you sell
      cameras?" matched the word "sell" in the ownership chunk and was answered
      with the copyright policy. ARTINU does not sell cameras, and the correct
      reply was the phone number.
    */
    let matched = 0;
    for (const variants of words) {
      const hits = (where: Set<string>) => [...variants].some((v) => where.has(v));
      const before = score;
      // Scored once per word of the question, whichever of its forms landed.
      if (hits(keywords)) score += KEYWORD_WEIGHT;
      if (hits(title)) score += TITLE_WEIGHT;
      if (hits(body)) score += BODY_WEIGHT;
      if (score > before) matched += 1;
    }

    /*
      A whole keyword phrase appearing in the question is the strongest signal
      there is — "what is artinu" matching the keyword "what is artinu" should
      not have to win on single words alone.
    */
    const lower = query.toLowerCase();
    let phrase = false;
    for (const keyword of chunk.keywords) {
      if (keyword.includes(' ') && lower.includes(keyword)) {
        score += KEYWORD_WEIGHT * 2;
        phrase = true;
      }
    }

    return { ...chunk, score, matched, phrase };
  });

  /*
    One word in common is only an answer when that word was the whole question.

    "Can I cancel?" is a real question about the commitment and its only
    meaningful word is "cancel", so one match has to be enough. "Do you sell
    cameras?" has two, and matching just "sell" says nothing about cameras. The
    difference is not the score, which is 6 either way. It is whether the chunk
    accounts for what was actually asked.

    A matched keyword PHRASE is exempt: "how much does it cost" is specific
    enough on its own that it needs no corroboration.
  */
  const supported = (chunk: { matched: number; phrase: boolean }) =>
    chunk.phrase || chunk.matched >= 2 || words.length <= 1;

  return scored
    .filter((chunk) => chunk.score >= MIN_SCORE && supported(chunk))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** True when nothing in ARTINU's material is a plausible answer. */
export const isUnanswerable = (chunks: RetrievedChunk[]) => chunks.length === 0;
