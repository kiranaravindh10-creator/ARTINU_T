import { CONTACT, PRICING, RENTAL_TARIFF, ROTATION_INTERVALS } from '@artinu/shared';

/**
 * "month" or "N months", derived exactly as SpacesPage derives it for the
 * public copy — so the assistant and the page cannot disagree about how often
 * a wall changes.
 */
const ROTATION_PHRASE =
  ROTATION_INTERVALS.length === 1
    ? ROTATION_INTERVALS[0] === 1
      ? 'month'
      : `${ROTATION_INTERVALS[0]} months`
    : 'rotation';

/**
 * WHAT THE ASSISTANT IS ALLOWED TO KNOW.
 *
 * ── Where every word here came from ─────────────────────────────────────────
 *
 * Each chunk is transcribed from ARTINU's own site or computed from the
 * constants the site itself prices from. Nothing is written from general
 * knowledge about photography businesses, and nothing is inferred:
 *
 *   · the six FAQs          → the FAQS array in features/public/pages/SpacesPage
 *   · the five steps        → the STEPS array in the same file
 *   · the photographer path → features/public/pages/JoinPage
 *   · rates                 → RENTAL_TARIFF in shared/src/constants
 *   · what is not charged   → PRICING in the same file
 *   · phone, email, hours   → CONTACT in the same file
 *
 * The last three are READ FROM THE CONSTANTS rather than copied, so a rate
 * change or a new phone number reaches the assistant on the next deploy
 * instead of leaving it quoting a number the checkout no longer charges. That
 * is the single most important property of this file: the assistant cannot
 * drift from the site, because for anything numeric it is reading the site's
 * own source of truth.
 *
 * ── Adding to it ────────────────────────────────────────────────────────────
 *
 * Add a chunk. Keep it to one idea, give it keywords a visitor would actually
 * type, and only write what the site already says. If ARTINU has not published
 * it, it does not belong here — the assistant saying "I don't have that" is a
 * correct answer, and a plausible invention is not.
 */

export interface KnowledgeChunk {
  id: string;
  /** Shown to the visitor as the source, so it has to read like a page name. */
  title: string;
  section: 'about' | 'spaces' | 'photographers' | 'pricing' | 'process' | 'contact' | 'policies';
  /** Words a visitor might use that the body itself may not contain. */
  keywords: string[];
  content: string;
}

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/*
  The cheapest and dearest per-frame monthly rate in a tariff row.

  Joined with the word "to" rather than an en dash. A range written
  "₹274.92–₹429" is how a spreadsheet says it. "₹274.92 to ₹429" is how a
  person says it out loud, and this text is read as speech rather than scanned
  as a table.
*/
const band = (row: readonly number[]) =>
  `${rupees(row[row.length - 1])} to ${rupees(row[0])}`;

/*
  HOW THIS IS WRITTEN, AND WHY IT READS THE WAY IT DOES.

  Every sentence below is spoken back to a visitor word for word. There is no
  model in the path to smooth it over, so the punctuation written here is the
  punctuation they see, and the wrong punctuation is most of what makes an
  answer feel machine-written.

  Three rules for anything added to this file.

  No em dashes and no en dashes. The em dash is the clearest single tell that a
  sentence was generated, and nine times out of ten it is doing the work of a
  full stop. Use the full stop.

  No semicolons. Nobody speaks a semicolon. Write two sentences, or a comma and
  the word "and".

  Straight apostrophes only. A file that mixes the curly kind with the straight
  kind looks assembled from two sources, because it was.

  And one rule about rhythm rather than punctuation: vary the sentence length.
  Three long balanced clauses in a row is the cadence people read as
  machine-written even when every word in it is true. A short sentence after a
  long one is what breaks it.
*/
export const KNOWLEDGE: KnowledgeChunk[] = [
  // ── What ARTINU is ────────────────────────────────────────────────────────
  {
    id: 'what-is-artinu',
    title: 'What ARTINU is',
    section: 'about',
    /*
      Three keywords have been removed from this chunk for the same reason.

      'do you do' went first: it matched "do you do weddings?" and "do you do
      portraits?" and scored them as though somebody had asked what ARTINU is.
      'offer' and 'provide' were the same mistake one step later. "Do you offer
      photography courses?" matched 'offer' here and got a description of the
      company, when ARTINU does not run courses and the honest answer is the
      team's phone number.

      All three match the SHAPE of a question rather than its subject, and the
      subject is the only thing that says which answer is right. 'what services'
      stays because it is a phrase, and a phrase that long is asking this
      chunk's actual question.
    */
    keywords: ['what is artinu', 'what services', 'about', 'who are you', 'company', 'explain', 'service', 'services'],
    content:
      "ARTINU puts photography by local photographers on the walls of real rooms. Cafés, restaurants, hotels, offices and homes. Every photograph is printed, framed and credited to the person who took it, and the set changes on a rotation, so a room does not stay the same all year. The thinking behind it is simple. Good photography should not only live on a screen. Someone waiting for a coffee sees the work, reads the photographer's name off the wall, and the space gets something worth looking at.",
  },
  {
    id: 'who-its-for',
    title: 'Who ARTINU is for',
    section: 'about',
    keywords: ['who is it for', 'who is this for', 'suitable', 'audience', 'customers', 'businesses', 'home'],
    content:
      "Two groups. The first is space owners who want real photography on their walls without buying and hanging it themselves, so cafés, restaurants, hotels, offices and homes. The second is photographers, who want their work printed, framed and seen in a real room instead of scrolled past in a feed.",
  },

  // ── How it works ──────────────────────────────────────────────────────────
  {
    id: 'how-it-works',
    title: 'How it works',
    section: 'process',
    keywords: ['how does it work', 'process', 'steps', 'get started', 'start', 'begin'],
    content:
      "There are five steps. First we visit, which is about forty minutes in your space looking at your light and your walls, and there is nothing to sign. Within five days you see specific photographs on your specific walls, to scale, and you can swap anything you do not love. About two weeks after you approve, we print, frame and install in one visit, and we take the packaging away with us. After that the set changes on a rotation and you approve it from your phone, using the same frames and the same fixings. We stay for as long as you rotate. One number, one inbox, and cracked glass replaced without an invoice.",
  },
  {
    id: 'rotation',
    title: 'Rotation',
    section: 'process',
    keywords: ['rotation', 'change', 'swap', 'how often', 'refresh', 'rotate'],
    content: `The photographs change every ${ROTATION_PHRASE}. On rotation day we confirm a two-hour window first, usually before service or before the office fills. Two people arrive with the next set already printed and mounted. They lift each photograph out of its frame, set the new one in, and take the old prints away for archiving. Frames, hangers and wall fixings stay exactly where they are, so there are no new holes and no repainting. Most spaces are finished in ninety minutes, and nothing has to close.`,
  },
  {
    id: 'installation',
    title: 'Installation',
    section: 'process',
    keywords: ['installation', 'install', 'hang', 'drill', 'fitting', 'mount', 'survey', 'involve', 'wall', 'walls', 'fix', 'anchor'],
    content:
      "A short site survey comes first, because drywall, brick, glass partitions and exposed concrete each need a different anchor. On the day it is two people, drop cloths, a laser level and a vacuum. We drill, mount, level, wipe the glass down and take the packaging away. Three to twelve frames takes two to three hours. We work around your service hours at no extra charge, so early mornings, Sundays, or the gap between lunch and dinner are all fine.",
  },

  // ── Pricing, read from the constants the checkout prices from ─────────────
  {
    id: 'pricing-business',
    title: 'Pricing for businesses',
    section: 'pricing',
    keywords: ['price', 'pricing', 'cost', 'how much', 'rate', 'monthly', 'cafe', 'office', 'fee'],
    content: `For a business, so a café, restaurant, hotel or office, frames are rented monthly per frame. The more frames you take, the lower the rate on every frame. A3 frames run ${band(RENTAL_TARIFF.standard.a3.monthly)} per frame per month, and A4 frames ${band(RENTAL_TARIFF.standard.a4.monthly)}. The lower end of each range applies once you take around a dozen, and that rate then applies to every frame you take rather than stepping down one at a time. Month to month is the only commitment sold at the moment.`,
  },
  {
    id: 'pricing-home',
    title: 'Pricing for homes',
    section: 'pricing',
    keywords: ['home', 'house', 'home decor', 'apartment', 'price', 'cost', 'personal'],
    content: `Homes are priced from their own book, which is cheaper. A3 frames run ${band(RENTAL_TARIFF.home_decor.a3.monthly)} per frame per month and A4 frames ${band(RENTAL_TARIFF.home_decor.a4.monthly)}. The better rate applies from four frames. The home tariff is month to month and has no commitment terms.`,
  },
  {
    id: 'pricing-whats-included',
    title: 'What the price includes',
    section: 'pricing',
    keywords: ['included', 'extra', 'delivery', 'installation cost', 'hidden', 'gst', 'tax', 'charges'],
    content: `Delivery is included in the quoted price, and installation is not billed separately, because the crew hangs the collection when it is delivered.${
      PRICING.GST_REGISTERED
        ? ` GST is charged at ${Math.round(PRICING.GST_RATE * 100)}%.`
        : ' No GST is added at the moment, so the price quoted is the price paid.'
    } Rates depend on frame size and how many frames you take. For a figure for your own space, it is best to speak to the team.`,
  },

  // ── For photographers ─────────────────────────────────────────────────────
  {
    id: 'for-photographers',
    title: 'For photographers',
    section: 'photographers',
    keywords: ['photographer', 'artist', 'join', 'apply', 'submit', 'upload', 'portfolio'],
    content:
      "Photographers apply through the site. You create a profile, upload your best work, and the team reviews the application and comes back to you. Selected photographs are printed, framed and hung in a real room with your name beside them. It is also a way to be seen by space owners, curators and other photographers.",
  },
  {
    id: 'photographer-payment',
    title: 'What photographers receive',
    section: 'photographers',
    keywords: ['paid', 'payment', 'commission', 'earn', 'money', 'royalty', 'fee', 'compensation'],
    content:
      "What a photographer gets is their work printed, framed and hung on a real wall, credited to them, and they are told which wall it went to. On the display licence, the photographer keeps copyright at all times. It never transfers to ARTINU or to the space. For anything about money specifically, the team is the right place to ask.",
  },

  // ── Policies, from the published FAQ ──────────────────────────────────────
  {
    id: 'not-happy-with-a-photograph',
    title: 'If a photograph is not right',
    section: 'policies',
    keywords: ['dont like', 'not happy', 'change', 'swap', 'wrong', 'replace', 'unhappy'],
    content:
      "Nothing is final until you approve it. During curation you can swap any frame for another from the gallery, or send the team back to look again with what you did not like written down. After installation, if a photograph is not working in the room, it is changed at your next rotation at no cost. If it is genuinely wrong for the wall, meaning the wrong scale, the wrong tone or the wrong light, say so within fourteen days and it is changed sooner.",
  },
  {
    id: 'ownership',
    title: 'Who owns the photographs',
    section: 'policies',
    keywords: ['own', 'ownership', 'copyright', 'rights', 'licence', 'license', 'resell', 'buy', 'purchase', 'outright', 'keep', 'sell'],
    content:
      "The photographer owns the copyright, always. It never transfers to ARTINU or to the space. The photographs inside the frames are licensed to you for display while they hang, which is why they come back at each swap. Nobody may reproduce, resell or merchandise the image beyond that display licence.",
  },
  {
    id: 'commitment',
    title: 'How long the commitment is',
    section: 'policies',
    keywords: ['commitment', 'contract', 'minimum', 'cancel', 'notice', 'notice period', 'period', 'term', 'lock in', 'quit'],
    content:
      "Rotation runs as a rolling subscription with a three-month minimum. That is one full cycle, which is long enough to see a refresh before you decide anything. After that, thirty days of notice ends it. The last set of photographs comes back to ARTINU, and the frames stay yours to fill with whatever you like.",
  },

  // ── Where ─────────────────────────────────────────────────────────────────
  {
    id: 'locations',
    title: 'Where ARTINU works',
    section: 'spaces',
    keywords: ['where', 'where do you work', 'which cities', 'located', 'location', 'city', 'cities', 'bengaluru', 'bangalore', 'chennai', 'hyderabad', 'mysuru', 'pune', 'area', 'serve', 'based'],
    content:
      "Bengaluru is where the crew, the print lab and the framers are, so installation and rotation there are entirely in-house and fastest. ARTINU also installs in Mysuru, Chennai, Hyderabad and Pune through partner crews. A first order in those cities takes longer, about three weeks rather than two. Anywhere else, describe the space and the team will be straight with you about whether they can serve it properly yet.",
  },
  {
    id: 'space-types',
    title: 'Kinds of space',
    section: 'spaces',
    keywords: ['cafe', 'restaurant', 'hotel', 'office', 'clinic', 'retail', 'what spaces', 'venue'],
    content:
      "Cafés, restaurants, hotels, offices and homes are the spaces ARTINU works with most, and each one is approached differently. A café has long walls and long stays. A restaurant has low light and a warm tone. Across a hotel floor it has to be a sequence that reads as one hand. If your space is none of those, describe it and the team will tell you whether it suits.",
  },

  // ── Contact, read from CONTACT so it cannot go stale ──────────────────────
  {
    id: 'contact',
    title: 'Talking to ARTINU',
    section: 'contact',
    keywords: ['contact', 'phone', 'phone number', 'number', 'email', 'email address', 'address', 'call', 'reach', 'talk', 'enquiry', 'book', 'visit'],
    content: `You can reach the team on ${CONTACT.phone} or at ${CONTACT.email}, or send an enquiry through the Let's Talk page on the site. Office hours are ${CONTACT.hours
      .map((h) => `${h.days} ${h.time}`)
      .join(', ')}. Booking a survey starts with that enquiry. Someone comes and looks at the space first, and there is nothing to sign at that stage.`,
  },
];

/**
 * What to offer next, per chunk.
 *
 * Hand-written rather than generated, and that is the point: every question
 * below is one this corpus can actually answer, so a visitor following the
 * suggestions can never walk into a dead end. Generating them would mean
 * offering questions nobody has written an answer to.
 *
 * Each entry avoids pointing back at the chunk the visitor just read.
 */
export const FOLLOW_UPS: Record<string, string[]> = {
  'what-is-artinu': ['How does it work?', 'How much does it cost?', 'Where do you work?'],
  'who-its-for': ['How does it work?', 'How much does it cost?', "I'm a photographer. How do I join?"],
  'how-it-works': ['How much does it cost?', 'What happens on rotation day?', 'What does installation involve?'],
  rotation: ['How much does it cost?', 'How long is the commitment?', "What if I don't like a photograph?"],
  installation: ['What happens on rotation day?', 'How much does it cost?', 'Where do you work?'],
  'pricing-business': ['What does the price include?', 'How long is the commitment?', 'How does it work?'],
  'pricing-home': ['What does the price include?', 'How does it work?', 'Where do you work?'],
  'pricing-whats-included': ['How much does it cost?', 'How long is the commitment?', 'How do I get started?'],
  'for-photographers': ['Do photographers get paid?', 'Who owns the photographs?', 'How does it work?'],
  'photographer-payment': ['Who owns the photographs?', 'How do I join as a photographer?', 'How does it work?'],
  'not-happy-with-a-photograph': ['What happens on rotation day?', 'How long is the commitment?', 'How much does it cost?'],
  ownership: ['Do photographers get paid?', 'What happens on rotation day?', 'How does it work?'],
  commitment: ['How much does it cost?', 'What happens on rotation day?', 'How do I get started?'],
  locations: ['How does it work?', 'How much does it cost?', 'What does installation involve?'],
  'space-types': ['How much does it cost?', 'How does it work?', 'Where do you work?'],
  contact: ['How does it work?', 'How much does it cost?', 'Where do you work?'],
};
