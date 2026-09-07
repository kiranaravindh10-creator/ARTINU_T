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

/** The cheapest and dearest per-frame monthly rate in a tariff row. */
const band = (row: readonly number[]) =>
  `${rupees(row[row.length - 1])}–${rupees(row[0])}`;

export const KNOWLEDGE: KnowledgeChunk[] = [
  // ── What ARTINU is ────────────────────────────────────────────────────────
  {
    id: 'what-is-artinu',
    title: 'What ARTINU is',
    section: 'about',
    keywords: ['what is artinu', 'about', 'who are you', 'company', 'explain', 'service', 'services', 'offer', 'provide', 'do you do'],
    content:
      'ARTINU puts photography by local photographers onto the walls of real rooms — cafés, restaurants, hotels, offices and homes — printed, framed and credited to the photographer. The photographs change on a rotation, so a room does not stay the same all year. The idea is that good photography should not only live on a screen: someone waiting for a coffee sees the work, reads the photographer’s name off the wall, and the space gets something worth looking at.',
  },
  {
    id: 'who-its-for',
    title: 'Who ARTINU is for',
    section: 'about',
    keywords: ['who is it for', 'suitable', 'audience', 'customers', 'businesses', 'home'],
    content:
      'Two groups. Space owners — cafés, restaurants, hotels, offices and homes — who want real photography on their walls without buying and hanging it themselves. And photographers, who want their work printed, framed and seen in a real room rather than scrolled past in a feed.',
  },

  // ── How it works ──────────────────────────────────────────────────────────
  {
    id: 'how-it-works',
    title: 'How it works',
    section: 'process',
    keywords: ['how does it work', 'process', 'steps', 'get started', 'start', 'begin'],
    content:
      'Five steps. First we visit — about forty minutes in your space looking at your light and your walls, with nothing to sign. Within five days you see specific photographs on your specific walls, to scale, and you can swap anything you do not love. About two weeks from your approval we print, frame and install in one visit, and take the packaging away with us. After that the set changes on a rotation, approved from your phone, using the same frames and the same fixings. We stay for as long as you rotate — one number, one inbox, and cracked glass replaced without an invoice.',
  },
  {
    id: 'rotation',
    title: 'Rotation',
    section: 'process',
    keywords: ['rotation', 'change', 'swap', 'how often', 'refresh', 'rotate'],
    content: `The photographs change every ${ROTATION_PHRASE}. On rotation day we confirm a two-hour window first, usually before service or before the office fills. Two people arrive with the next set already printed and mounted, lift each photograph out of its frame, set the new one in, and take the old prints away for archiving. Frames, hangers and wall fixings stay exactly where they are — no new holes, no repainting. Most spaces are finished in ninety minutes and nothing has to close.`,
  },
  {
    id: 'installation',
    title: 'Installation',
    section: 'process',
    keywords: ['installation', 'install', 'hang', 'drill', 'fitting', 'mount', 'survey'],
    content:
      'A short site survey comes first, because drywall, brick, glass partitions and exposed concrete each need a different anchor. On the day: two people, drop cloths, a laser level and a vacuum. We drill, mount, level, wipe the glass down and take the packaging away. Three to twelve frames takes two to three hours. We work around your service hours — early mornings, Sundays, between lunch and dinner — at no extra charge.',
  },

  // ── Pricing, read from the constants the checkout prices from ─────────────
  {
    id: 'pricing-business',
    title: 'Pricing for businesses',
    section: 'pricing',
    keywords: ['price', 'pricing', 'cost', 'how much', 'rate', 'monthly', 'cafe', 'office', 'fee'],
    content: `For a business — café, restaurant, hotel or office — frames are rented monthly per frame, and the more frames you take the lower the rate on every frame. A3 frames run ${band(RENTAL_TARIFF.standard.a3.monthly)} per frame per month, and A4 frames ${band(RENTAL_TARIFF.standard.a4.monthly)}, with the lower end of each range applying once you take around a dozen. The rate is the same for every frame you take rather than stepping down one at a time. Month-to-month is the only commitment sold at the moment.`,
  },
  {
    id: 'pricing-home',
    title: 'Pricing for homes',
    section: 'pricing',
    keywords: ['home', 'house', 'home decor', 'apartment', 'price', 'cost', 'personal'],
    content: `Homes are priced from their own, cheaper book. A3 frames run ${band(RENTAL_TARIFF.home_decor.a3.monthly)} per frame per month and A4 frames ${band(RENTAL_TARIFF.home_decor.a4.monthly)}, with the better rate applying from four frames. The home tariff is month to month and has no commitment terms.`,
  },
  {
    id: 'pricing-whats-included',
    title: 'What the price includes',
    section: 'pricing',
    keywords: ['included', 'extra', 'delivery', 'installation cost', 'hidden', 'gst', 'tax', 'charges'],
    content: `Delivery is included in the quoted price and installation is not billed separately — the crew hangs the collection when it is delivered.${
      PRICING.GST_REGISTERED
        ? ` GST is charged at ${Math.round(PRICING.GST_RATE * 100)}%.`
        : ' No GST is added at the moment, so the price quoted is the price paid.'
    } Rates depend on frame size and how many frames you take, so for a figure for your own space it is best to speak to the team.`,
  },

  // ── For photographers ─────────────────────────────────────────────────────
  {
    id: 'for-photographers',
    title: 'For photographers',
    section: 'photographers',
    keywords: ['photographer', 'artist', 'join', 'apply', 'submit', 'upload', 'portfolio'],
    content:
      'Photographers apply through the site: create a profile, upload your best work, and the team reviews the application and comes back to you. Selected photographs are printed, framed and hung in a real room with your name beside them. It is also a way to be seen by space owners, curators and other photographers.',
  },
  {
    id: 'photographer-payment',
    title: 'What photographers receive',
    section: 'photographers',
    keywords: ['paid', 'payment', 'commission', 'earn', 'money', 'royalty', 'fee', 'compensation'],
    content:
      'What a photographer gets is their work printed, framed and hung on a real wall, credited to them, and told which wall it went to. On the display licence, the photographer keeps copyright at all times — it never transfers to ARTINU or to the space. For anything about money specifically, the team is the right place to ask.',
  },

  // ── Policies, from the published FAQ ──────────────────────────────────────
  {
    id: 'not-happy-with-a-photograph',
    title: 'If a photograph is not right',
    section: 'policies',
    keywords: ['dont like', 'not happy', 'change', 'swap', 'wrong', 'replace', 'unhappy'],
    content:
      'Nothing is final until you approve it. During curation you can swap any frame for another from the gallery, or send the team back to look again with what you did not like written down. After installation, if a photograph is not working in the room it is changed at your next rotation at no cost. If it is genuinely wrong for the wall — wrong scale, wrong tone, wrong light — say so within fourteen days and it is changed sooner.',
  },
  {
    id: 'ownership',
    title: 'Who owns the photographs',
    section: 'policies',
    keywords: ['own', 'ownership', 'copyright', 'rights', 'licence', 'license', 'resell'],
    content:
      'The photographer owns the copyright, always; it never transfers to ARTINU or to the space. The photographs inside the frames are licensed to you for display while they hang, which is why they come back at each swap. Nobody may reproduce, resell or merchandise the image beyond that display licence.',
  },
  {
    id: 'commitment',
    title: 'How long the commitment is',
    section: 'policies',
    keywords: ['commitment', 'contract', 'minimum', 'cancel', 'notice', 'term', 'lock in', 'quit'],
    content:
      'Rotation runs as a rolling subscription with a three-month minimum, which is one full cycle — long enough to see a refresh before deciding anything. After that, thirty days of notice ends it. The last set of photographs comes back to ARTINU, and the frames stay yours to fill with whatever you like.',
  },

  // ── Where ─────────────────────────────────────────────────────────────────
  {
    id: 'locations',
    title: 'Where ARTINU works',
    section: 'spaces',
    keywords: ['where', 'located', 'location', 'city', 'bengaluru', 'bangalore', 'chennai', 'area', 'serve', 'based'],
    content:
      'Bengaluru is where the crew, the print lab and the framers are, so installation and rotation there are entirely in-house and fastest. ARTINU also installs in Mysuru, Chennai, Hyderabad and Pune through partner crews, with a longer lead time on a first order — about three weeks rather than two. Anywhere else, describe the space and the team will be straight with you about whether they can serve it properly yet.',
  },
  {
    id: 'space-types',
    title: 'Kinds of space',
    section: 'spaces',
    keywords: ['cafe', 'restaurant', 'hotel', 'office', 'clinic', 'retail', 'what spaces', 'venue'],
    content:
      'Cafés, restaurants, hotels, offices and homes are the spaces ARTINU works with most, and each is approached differently — long walls and long stays in a café, low light and warm tone in a restaurant, a sequence that reads as one hand across a hotel floor. If your space is none of those, describe it and the team will tell you whether it suits.',
  },

  // ── Contact, read from CONTACT so it cannot go stale ──────────────────────
  {
    id: 'contact',
    title: 'Talking to ARTINU',
    section: 'contact',
    keywords: ['contact', 'phone', 'email', 'call', 'reach', 'talk', 'enquiry', 'book', 'visit'],
    content: `You can reach the team on ${CONTACT.phone} or at ${CONTACT.email}, or send an enquiry through the Let's Talk page on the site. Office hours are ${CONTACT.hours
      .map((h) => `${h.days} ${h.time}`)
      .join(', ')}. Booking a survey starts with that enquiry — someone comes and looks at the space first, and there is nothing to sign at that stage.`,
  },
];
