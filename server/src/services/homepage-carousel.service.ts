import type { Artwork, HeroSlide } from '@artinu/shared';
import { db } from '@/database/db';
import { withPhotographerNames } from '@/routes/contentManager.routes';

/**
 * WHICH SIX PHOTOGRAPHS THE HOMEPAGE OPENS WITH.
 *
 * ── Why this is not just "the hero slides" ──────────────────────────────────
 *
 * The homepage carousel shows one landscape photograph at a time. `hero_slides`
 * is the manager's own list and stays the first thing consulted, but it cannot
 * answer the question on its own for two reasons.
 *
 * It does not record a shape. A row is a url and a credit, with no width or
 * height, so nothing in that table can say whether a photograph is landscape.
 * Measured against the live database, all eleven rows DO correspond to an
 * `artworks` row, which does record `orientation`, `width` and `height` — so
 * the shape is recoverable by looking the image up rather than by downloading
 * it and measuring, which the browser was previously doing for every slide.
 *
 * And there are not enough of them. Of the eight active slides today, three are
 * landscape. A carousel that needs six would be two-thirds empty.
 *
 * So: the manager's landscape choices first, in the manager's order, then
 * topped up from the approved landscape photographs already in the gallery.
 * There are forty of those that clear the quality gates below.
 *
 * ── Nothing here is a new concept ───────────────────────────────────────────
 *
 * Every field consulted already exists and is already maintained: `isActive`
 * and `order` on a hero slide, `status`, `orientation`, `width`, `height` and
 * `featured` on an artwork. No migration, no new table, and no second idea of
 * what "featured" means.
 */

/** How many the homepage opens with. */
const TARGET = 6;

/*
  What makes a photograph good enough for the largest frame on the site.

  The width floor is about the only objective measure of "will this hold up
  across a 2560px screen".

  The ratio window is set by the frame rather than by the definition of
  landscape. The hero draws every photograph in one 3:2 frame, because a frame
  that changed height per slide would shove the rest of the page up and down as
  the carousel advanced. Given a fixed frame, how much of a photograph survives
  is decided entirely by how far its ratio sits from 1.5, so the window is the
  range that keeps the loss small: 1.3 costs about 13% of the width, 2.0 about
  25% of the height, and everything in between less than that. Both ends were
  checked against the live gallery, where the common camera ratios — 1.33, 1.5
  and 1.78 — all sit comfortably inside.

  Wider than 2.0 is a panorama. In a 3:2 frame it would lose more than a third
  of its height, which is not showing the photograph, so it stays in the
  gallery where it can be seen whole.
*/
const MIN_WIDTH = 1600;
const MIN_RATIO = 1.3;
const MAX_RATIO = 2.05;

export interface CarouselSlide {
  /** The artwork id, or the hero slide id when the slide has no artwork behind it. */
  id: string;
  imageUrl: string;
  width: number;
  height: number;
  /** The artwork's own title. Null for a hero slide with nothing behind it. */
  title: string | null;
  photographerId: string | null;
  photographerName: string | null;
  photographerLocation: string | null;
  /** True when a manager put this on the homepage explicitly. */
  curated: boolean;
}

const ratioOf = (a: { width: number; height: number }) => (a.width || 1) / (a.height || 1);

const isGoodLandscape = (a: Artwork) =>
  a.status === 'approved' &&
  a.orientation === 'landscape' &&
  a.width >= MIN_WIDTH &&
  ratioOf(a) >= MIN_RATIO &&
  ratioOf(a) <= MAX_RATIO;

/*
  Varied, but not different on every request.

  "Random" and "cached for sixty seconds" pull against each other, and a truly
  random pick would also mean the photographs changed under a visitor between
  the first paint from localStorage and the response landing. Rotating the pool
  by the hour gives a homepage that is not the same all week while staying
  identical for everyone inside a cache window.
*/
function rotateByHour<T>(items: T[]): T[] {
  if (items.length === 0) return items;
  const hoursSinceEpoch = Math.floor(Date.now() / 3_600_000);
  const start = hoursSinceEpoch % items.length;
  return [...items.slice(start), ...items.slice(0, start)];
}

/**
 * The six, resolved and credited.
 *
 * Takes the rows it needs as arguments so the homepage route can read them in
 * the same `Promise.all` as everything else rather than adding a round trip.
 */
export async function selectCarousel(
  activeSlides: HeroSlide[],
  artworks: Artwork[],
): Promise<CarouselSlide[]> {
  /*
    Every url an artwork is reachable by.

    A hero slide points at whichever copy existed when it was added: older rows
    hold the photographer's original, newer ones the 1600px variant. Indexing
    all three is what gets the match rate to eleven out of eleven.
  */
  const byUrl = new Map<string, Artwork>();
  for (const a of artworks) {
    for (const url of [a.imageUrl, a.thumbnailUrl, a.originalUrl]) {
      if (url) byUrl.set(url, a);
    }
  }

  const picked: CarouselSlide[] = [];
  const usedArtworkIds = new Set<string>();

  // 1. The manager's own list, in the manager's order, landscape only.
  for (const slide of activeSlides) {
    const art = byUrl.get(slide.imageUrl);
    if (!art || !isGoodLandscape(art)) continue;
    if (usedArtworkIds.has(art.id)) continue;
    usedArtworkIds.add(art.id);
    picked.push({
      id: art.id,
      // The slide's url, because that is the copy the manager chose.
      imageUrl: slide.imageUrl,
      width: art.width,
      height: art.height,
      title: art.title ?? null,
      photographerId: slide.photographerId ?? art.artistId ?? null,
      photographerName: null,
      photographerLocation: null,
      curated: true,
    });
    if (picked.length >= TARGET) break;
  }

  // 2. Topped up from the gallery. `featured` first, because that is the
  //    existing flag for "this one is worth showing", then the hourly rotation.
  if (picked.length < TARGET) {
    const pool = artworks.filter((a) => isGoodLandscape(a) && !usedArtworkIds.has(a.id));
    const featured = rotateByHour(pool.filter((a) => a.featured));
    const rest = rotateByHour(pool.filter((a) => !a.featured));

    for (const art of [...featured, ...rest]) {
      if (picked.length >= TARGET) break;
      usedArtworkIds.add(art.id);
      picked.push({
        id: art.id,
        imageUrl: art.imageUrl,
        width: art.width,
        height: art.height,
        title: art.title ?? null,
        photographerId: art.artistId ?? null,
        photographerName: null,
        photographerLocation: null,
        curated: false,
      });
    }
  }

  // One read for every credit, the same helper the hero slides already use.
  return withPhotographerNames(picked) as Promise<CarouselSlide[]>;
}

/** Read the artworks the selection needs. Separate so the route can parallelise it. */
export const carouselArtworks = () => db.artworks.find({ where: { status: 'approved' } });
