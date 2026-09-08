import { DEFAULT_SLIDESHOW_SETTINGS, SPACE_TYPE_LABELS, type Cafe } from '@artinu/shared';
import {
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useHomepage } from '@/hooks/useHomepage';
import { Link } from 'react-router-dom';
import { ArrowLink, Container, Section, SectionHeading } from '@/components/layout/primitives';
import { EASE, Reveal, Stagger, StaggerItem } from '@/components/motion/reveal';
import { Typewriter } from '@/components/motion/typewriter';
import { Button } from '@/components/ui/button';
import { Photo } from '@/components/ui/photo';
import { CtaBand } from '@/features/public/components/CtaBand';
import {
  ArtworkCard,
  ArtworkCardSkeleton,
  ArtworkMasonry,
  useLightbox,
} from '@/features/public/components/ArtworkCard';
import { Lightbox } from '@/features/public/components/Lightbox';
import { IMAGES, SPACE_TYPE_IMAGES } from '@/lib/images';
import { qk } from '@/lib/query';
import { catalogService } from '@/services/catalog.service';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { preloadImage, resizedUpload } from '@/lib/imageOptimization';

/**
 * Customer quotes come from the database, and only from the database.
 *
 * Four invented testimonials used to live here as a "fallback" — named
 * businesses ("The Test Kitchen", "Lalit Boutique Hotel") with five-star
 * ratings that nobody had confirmed were ever said. Attributing a quote to a
 * real-sounding company is a claim that has to be true, and a fallback made it
 * ship by default. A manager PUTs the real list to
 * /api/content/homepage_testimonials; until then the section hides itself.
 */
interface Testimonial {
  name: string;
  /** Optional — a visitor speaking for themselves has no business to name. */
  business?: string;
  role?: string;
  quote: string;
  rating?: number;
  /** Short text for the disc — initials, or an emoji. Not an image URL. */
  avatar?: string;
  /** A photograph of the person, ideally with the work they are talking about. */
  photo?: string;
  /** Alt text for `photo`. Falls back to a description built from the name. */
  photoAlt?: string;
}

/** Initials for the avatar disc, derived rather than stored alongside the name. */
const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

/**
 * THE HOMEPAGE CAROUSEL.
 *
 * ── One photograph at a time ────────────────────────────────────────────────
 *
 * This used to draw five at once: the credited photograph in a middle column
 * with four supporting tiles stacked either side of it. That was built to solve
 * a real problem, which was that a portrait photograph in a full-bleed
 * landscape frame either lost most of itself to the crop or left flat colour
 * beside it. Filling the frame with more photographs solved the flat colour and
 * the cropping, and it was wrong anyway: a wall of five competing images is a
 * contact sheet, not a hero, and no single photograph is the subject.
 *
 * So it is one photograph now, and the crop problem is answered where it should
 * have been answered in the first place, which is in the selection. The API
 * sends six LANDSCAPE photographs whose proportions already suit a wide frame,
 * so there is nothing to letterbox and nothing to cut away. See
 * services/homepage-carousel.service.ts.
 *
 * ── Why the frame is fixed at 3:2 ───────────────────────────────────────────
 *
 * A frame that took each photograph's own ratio would fit all six perfectly and
 * would also change height six times a minute, shoving the whole page up and
 * down as the carousel advanced. A fixed frame costs a little of each
 * photograph instead. 3:2 is the classic photographic ratio and the commonest
 * one in this gallery, and the server only sends ratios between 1.3 and 2.05,
 * so the loss stays small and nothing is ever badly cut.
 *
 * ── What the browser no longer does ─────────────────────────────────────────
 *
 * It used to download every slide purely to read `naturalWidth` and work out
 * what shape it was. The server knows, because `artworks` records the
 * dimensions, so `width` and `height` arrive with the slide and the browser
 * measures nothing.
 */
function PhotographerShowcaseHero() {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  /** Which way the last move went, so the transition leaves the right way. */
  const [direction, setDirection] = React.useState(1);
  const [hovered, setHovered] = React.useState(false);

  const reduced = useReducedMotion();

  const { content, isLoading } = useHomepage();
  const slides = content.carousel;
  const settings = content.slideshow ?? DEFAULT_SLIDESHOW_SETTINGS;

  const total = slides?.length ?? 0;
  // The list can shrink under us when a manager hides a slide, and the index is
  // held in state — without this the render would reach past the end of it.
  const index = total > 0 ? Math.min(currentIndex, total - 1) : 0;

  const advance = React.useCallback(
    (step: number) => {
      if (total === 0) return;
      setDirection(step >= 0 ? 1 : -1);
      setCurrentIndex((prev) => (Math.min(prev, total - 1) + step + total) % total);
    },
    [total],
  );

  const goTo = (next: number) => {
    setDirection(next >= index ? 1 : -1);
    setCurrentIndex(next);
  };

  const autoPlaying = settings.autoPlay && total > 1 && !(settings.pauseOnHover && hovered);

  /*
    One timeout per slide rather than one repeating interval.

    Because `index` is a dependency, any move — the timer's own, an arrow, a
    hairline — tears this down and starts a fresh full dwell. That is the
    behaviour you want from a slideshow, and it is why stepping through by hand
    does not have to stop the autoplay to avoid an immediate jump.
  */
  React.useEffect(() => {
    if (!autoPlaying) return;
    const timer = setTimeout(() => advance(1), settings.intervalMs);
    return () => clearTimeout(timer);
  }, [autoPlaying, index, settings.intervalMs, advance]);

  /*
    The next photograph, fetched while this one is up.

    Only the next one. Preloading all six would have the hero competing with
    itself for bandwidth on first paint, and by the time the sixth is needed it
    has had five dwells to arrive.
  */
  React.useEffect(() => {
    if (total < 2) return;
    const next = slides[(index + 1) % total];
    if (!next) return;
    const link = preloadImage(resizedUpload(next.imageUrl, 1600, 78));
    document.head.appendChild(link);
    return () => link.remove();
  }, [slides, index, total]);

  // Left and right arrows move the carousel when it has focus, which is what a
  // keyboard user expects of anything calling itself a carousel.
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      advance(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      advance(1);
    }
  };

  /*
    Swipe, without a gesture library.

    A pointer that travels more than 48px horizontally is a swipe; anything less
    is a tap or a scroll. Vertical movement is left alone so the page still
    scrolls normally with a finger on the photograph.
  */
  const swipeFrom = React.useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    swipeFrom.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const from = swipeFrom.current;
    swipeFrom.current = null;
    if (!from) return;
    const dx = e.clientX - from.x;
    const dy = e.clientY - from.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) advance(dx < 0 ? 1 : -1);
  };

  /*
    Nothing at all until there is something real to show.

    The homepage payload is served from localStorage on a repeat visit, so this
    is only ever the very first load. A skeleton the height of the hero would be
    a grey slab in the most important frame on the site.
  */
  if (isLoading || total === 0) {
    return <section className="h-[60vh] min-h-[24rem] w-full bg-ink" aria-hidden />;
  }

  const slide = slides[index];
  const isFirstSlide = index === 0;
  const credit = slide.photographerName
    ? `Photograph by ${slide.photographerName}`
    : 'A photograph from the ARTINU collection';

  const sliding = settings.transition === 'slide' && !reduced;
  const kenBurns = settings.kenBurns && !reduced;
  const transitionSeconds = reduced ? 0.01 : settings.transitionMs / 1000;

  return (
    <section
      className="relative w-full select-none overflow-hidden bg-ink"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      tabIndex={0}
      aria-roledescription="carousel"
      aria-label="Featured photographs"
    >
      {/*
        The frame.

        4:3 on a phone, where a 3:2 would leave the photograph a thin band above
        the fold, and 3:2 from tablet up. The viewport cap stops a tall desktop
        window turning the hero into something you have to scroll past before
        you see anything else on the page.
      */}
      <div className="relative aspect-[4/3] max-h-[calc(100dvh-4.5rem)] w-full sm:aspect-[3/2]">
        <AnimatePresence initial={false}>
          <motion.div
            key={slide.id}
            className="absolute inset-0"
            initial={{ opacity: 0, x: sliding ? direction * 48 : 0 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: sliding ? direction * -48 : 0 }}
            transition={{
              opacity: { duration: transitionSeconds, ease: 'easeInOut' },
              x: { duration: transitionSeconds, ease: EASE },
            }}
          >
            {/*
              The slow zoom sits on the photograph itself and runs the length of
              the dwell. Given its own element rather than the layer above, so
              the cross-fade and the zoom cannot fight over one transform.
            */}
            <motion.div
              className="absolute inset-0 origin-center"
              initial={{ scale: 1 }}
              animate={{ scale: kenBurns ? 1.05 : 1 }}
              transition={{ duration: settings.intervalMs / 1000, ease: 'linear' }}
            >
              <Photo
                src={slide.imageUrl}
                alt={credit}
                hero
                priority={isFirstSlide}
                tone="bg-transparent"
                className="absolute inset-0 h-full w-full"
                imgClassName="h-full w-full object-cover object-center"
              />
            </motion.div>
          </motion.div>
        </AnimatePresence>

        {/*
          Just enough shadow along the bottom edge to hold white text over an
          unpredictable photograph. No wash across the middle of the image, and
          no panel behind the name — the photograph is the point.
        */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 hidden h-1/2 bg-gradient-to-t from-ink/85 via-ink/30 to-transparent sm:block"
          aria-hidden
        />

        {/* Which photograph is showing, announced once rather than on every frame. */}
        <p className="sr-only" aria-live="polite" aria-atomic>
          {`Photograph ${index + 1} of ${total}`}
          {slide.photographerName ? ` by ${slide.photographerName}` : ''}
        </p>

      </div>

      {/*
        The credit.

        Under the photograph on a phone, over it from tablet up.

        Overlaid at every size it was unreadable on mobile: a 4:3 frame on a
        393px screen is 295px tall, and a name, a location, a title, two arrows
        and six hairlines laid over the middle of that left the photograph as a
        dark strip behind text. Below the frame the type gets its own space on
        the ink the section already sits on, the arrows stop covering the
        picture, and nothing has to be cropped harder to make room.
      */}
      <Container className="relative z-20 bg-ink pb-7 pt-5 sm:pointer-events-none sm:absolute sm:inset-x-0 sm:bottom-0 sm:bg-transparent sm:pb-10 sm:pt-0">
          <div className="flex items-end justify-between gap-6">
            {/* ── Bottom left: whose photograph this is. ─────────────────── */}
            <div className="min-w-0 max-w-full">
              {slide.title ? (
                <p className="mb-1.5 truncate font-label text-[0.625rem] uppercase tracking-[0.18em] text-canvas/55">
                  {slide.title}
                </p>
              ) : null}

              {slide.photographerName ? (
                <>
                  <p className="truncate font-display text-2xl leading-tight text-canvas sm:text-3xl">
                    {slide.photographerName}
                  </p>
                  {slide.photographerLocation ? (
                    <p className="mt-1 truncate font-label text-[0.6875rem] uppercase tracking-[0.16em] text-canvas/60">
                      {slide.photographerLocation}
                    </p>
                  ) : null}
                </>
              ) : (
                <span />
              )}
            </div>

            {/* ── Bottom right: move, and where you are. ─────────────────── */}
            <div className="pointer-events-auto flex shrink-0 items-center gap-2 sm:gap-3">
              <span className="hidden font-label text-[0.6875rem] tabular-nums tracking-[0.16em] text-canvas/60 sm:inline">
                {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
              </span>

              <button
                type="button"
                onClick={() => advance(-1)}
                aria-label="Previous photograph"
                className="flex size-10 items-center justify-center rounded-full border border-canvas/25 text-canvas/80 transition-colors hover:border-canvas/60 hover:text-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas/70"
              >
                <ArrowLeft className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => advance(1)}
                aria-label="Next photograph"
                className="flex size-10 items-center justify-center rounded-full border border-canvas/25 text-canvas/80 transition-colors hover:border-canvas/60 hover:text-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas/70"
              >
                <ArrowRight className="size-4" aria-hidden />
              </button>
            </div>
          </div>

          {/*
            Position, as six hairlines rather than dots.

            Quieter than a dot row, and it reads as a progress bar, which is
            what it is. Each one is a target in its own right, so a visitor can
            jump straight to a photograph.
          */}
          <div className="pointer-events-auto mt-5 flex items-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Show photograph ${i + 1} of ${total}`}
                aria-current={i === index}
                className="group h-4 flex-1 focus-visible:outline-none"
              >
                <span
                  className={cn(
                    'block h-px w-full transition-all duration-500',
                    i === index
                      ? 'bg-canvas'
                      : 'bg-canvas/25 group-hover:bg-canvas/60 group-focus-visible:bg-canvas/60',
                  )}
                />
              </button>
            ))}
          </div>
      </Container>
    </section>
  );
}


function SpacesWeTransform() {
  /*
   * Each tile used to carry a `count` — "34 offices transformed", "28
   * restaurants transformed" — revealed on hover. The numbers were written by
   * hand and matched nothing in the database; the office figure was the largest
   * on the page and ARTINU has fewer offices than cafés. Invented traction is
   * the one claim a space owner can check.
   *
   * The tiles have since been stripped back to the photograph and its name.
   * Each one had accumulated a frosted-glass disc around a lucide glyph, a
   * serif label, a line of copy explaining what a café is, and a "Book a
   * consultation" row that slid up on hover — four pieces of furniture stacked
   * on a photograph that already said all of it. A coffee-cup icon beside the
   * word Café is decoration explaining a label, and "Warm corners for
   * conversation" is a caption for a picture of warm corners. The hover CTA was
   * the least useful of the four: the whole tile has always been that link.
   *
   * The hand-rolled stagger variants went with them. Reveal/Stagger already
   * carry this site's motion, including its reduced-motion behaviour, which the
   * bespoke copy here did not.
   */
  const spaceTypes = ['cafe', 'office', 'restaurant', 'hotel', 'home_decor'] as const;

  return (
    <Section tone="soft" size="compact" className="pt-0">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="Spaces We Transform"
            title={<>Where photography finds its <em className="editorial-italic">space</em>.</>}
            className="max-w-3xl"
          />
        </Reveal>

        <Stagger className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {spaceTypes.map((type) => (
            <StaggerItem key={type}>
              <Link
                to={`/lets-talk?type=${type}`}
                className="group block overflow-hidden rounded-md bg-ink"
              >
                <div className="relative aspect-[4/5] overflow-hidden">
                  <Photo
                    src={SPACE_TYPE_IMAGES[type] ?? IMAGES.cafeInterior}
                    alt={SPACE_TYPE_LABELS[type]}
                    className="h-full w-full"
                    imgClassName="h-full w-full object-cover transition-transform duration-700 ease-[var(--ease-out-soft)] group-hover:scale-[1.04]"
                  />
                  {/* Only as much wash as the label needs to stay legible over a
                      bright photograph. */}
                  <div
                    className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-ink/85 to-transparent"
                    aria-hidden
                  />
                  <p className="absolute inset-x-4 bottom-4 font-label text-[0.6875rem] uppercase tracking-[0.16em] text-canvas">
                    {SPACE_TYPE_LABELS[type]}
                  </p>
                </div>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </Container>
    </Section>
  );
}

/**
 * One quote, laid out around whether there is a photograph to show.
 *
 * With a photograph it is an editorial spread: the picture on the left at the
 * scale a photograph deserves on a photography company's homepage, the quote
 * set against it. Without one it stays the centred column it has always been,
 * so a quote typed into the console with no picture still looks deliberate.
 *
 * The attribution line is assembled rather than interpolated. It used to be
 * `{role}, {business}` in one expression, which reads correctly only when both
 * exist — the first real testimonial ARTINU received is from a visitor who is
 * neither a company nor a job title ("Siya's dad"), and that template renders
 * it as "Siya's dad, " with a comma dangling off the end.
 */
function TestimonialPanel({ entry }: { entry: Testimonial }) {
  const attribution = [entry.role, entry.business].map((part) => part?.trim()).filter(Boolean);

  const stars = entry.rating ? (
    <div
      className="flex flex-wrap items-center gap-1.5"
      aria-label={`Rated ${entry.rating} out of 5`}
    >
      {Array.from({ length: Math.round(entry.rating) }, (_, i) => (
        <span key={i} className="text-bronze" aria-hidden>
          ★
        </span>
      ))}
    </div>
  ) : null;

  const credit = (
    <div className="flex items-center gap-3">
      {!entry.photo && (
        <div className="flex size-12 items-center justify-center rounded-full bg-bronze-soft text-sm font-medium text-bronze">
          {entry.avatar || initialsOf(entry.name)}
        </div>
      )}
      <div className="text-left">
        <p className="font-medium text-ink">{entry.name}</p>
        {attribution.length > 0 && (
          <p className="text-sm text-muted">{attribution.join(' · ')}</p>
        )}
      </div>
    </div>
  );

  if (!entry.photo) {
    return (
      <div className="mx-auto max-w-4xl">
        {stars && <div className="mb-8 flex justify-center">{stars}</div>}
        <blockquote className="mx-auto max-w-3xl text-center">
          {/* Matched to the sizes in the photograph variant above — a quote
              should not grow just because there is no portrait beside it. */}
          <p
            className={cn(
              'font-display text-ink',
              entry.quote.length > 280
                ? 'text-[1rem] leading-[1.6] sm:text-[1.125rem] lg:text-[1.3125rem]'
                : 'text-[1.1875rem] leading-[1.45] sm:text-[1.5rem] lg:text-[1.75rem]',
            )}
          >
            &ldquo;{entry.quote}&rdquo;
          </p>
          <footer className="mt-8 flex flex-col items-center gap-2">{credit}</footer>
        </blockquote>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] lg:gap-14">
      <Photo
        src={entry.photo}
        alt={entry.photoAlt || `${entry.name}, photographed with the ARTINU work they are describing`}
        ratio="aspect-[3/4]"
        thumbnail
        sizes="(max-width: 1024px) 80vw, 360px"
        className="photo-edge mx-auto w-full max-w-[19rem] rounded-lg shadow-frame lg:max-w-none"
      />

      <blockquote>
        {stars && <div className="mb-6">{stars}</div>}
        {/*
          Display type sized to the quote, not one size for every quote.

          These run from about 150 characters to about 500. Set at a single
          large size, the short one looks like a pull quote and the long one
          becomes a wall of serif that overruns the photograph beside it.

          Both steps sit smaller than display type normally would: a long,
          reflective quote read at 24px is a paragraph pretending to be a
          headline, and it stops being something you actually read. Looser
          leading carries the smaller size.
        */}
        <p
          className={cn(
            'font-display text-ink',
            // Never below 16px on a phone: that is the point where a browser
            // starts treating text as something to zoom rather than read.
            entry.quote.length > 280
              ? 'text-base leading-[1.6] sm:text-[1.0625rem] lg:text-[1.1875rem]'
              : 'text-[1.125rem] leading-[1.45] sm:text-[1.375rem] lg:text-[1.5rem]',
          )}
        >
          &ldquo;{entry.quote}&rdquo;
        </p>
        <footer className="mt-8">{credit}</footer>
      </blockquote>
    </div>
  );
}

function TestimonialsCarousel() {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(true);
  /*
    Three seconds is brisk for a rail that auto-advances, so somebody who asked
    their system for less motion gets the first quote and the dots to move
    through it themselves rather than a paragraph replaced under them mid-read.
  */
  const reduced = useReducedMotion();

  // The only source. Nothing is shown until a manager has entered real quotes.
  // Arrives with the rest of the homepage in one request, and is remembered
  // between visits — which is what stops this section vanishing when the API is
  // cold. See hooks/useHomepage.ts.
  const { content } = useHomepage();
  const stored = content.testimonials as Testimonial[] | null | undefined;
  const TESTIMONIALS = React.useMemo(
    () => (Array.isArray(stored) ? stored.filter((entry) => entry?.quote && entry?.name) : []),
    [stored],
  );

  React.useEffect(() => {
    // A timer that advances a one-item list re-renders the same quote forever.
    // `=== 0` let that through; `<= 1` is the real condition.
    if (!isPlaying || reduced || TESTIMONIALS.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isPlaying, reduced, TESTIMONIALS.length]);

  // Nothing curated yet — the section stays off the page rather than inventing
  // praise. An empty testimonials rail is not a bug, it is an honest homepage.
  if (TESTIMONIALS.length === 0) return null;

  // A shorter curated list must not leave the index past the end.
  const activeIndex = currentIndex % TESTIMONIALS.length;

  return (
    <Section tone="sand" size="compact" className="pt-0">
      <Container>
        <Reveal>
          <SectionHeading
            /* Not "What Our Clients Say" — the people this section quotes are
               not all clients. The first is a father who found his daughter's
               photograph framed on a café wall. */
            eyebrow="In their words"
            title={
              <>
                Real walls. Real <em className="editorial-italic">people</em>.
              </>
            }
            className="max-w-3xl"
          />
        </Reveal>

        <div
          className="relative mt-14"
          onMouseEnter={() => setIsPlaying(false)}
          onMouseLeave={() => setIsPlaying(true)}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <TestimonialPanel entry={TESTIMONIALS[activeIndex]} />
            </motion.div>
          </AnimatePresence>

          {/*
            Navigation only when there is somewhere to navigate to.

            ARTINU has one real testimonial. A row of dots with a single dot,
            above a pair of arrows that both lead back to the quote already on
            screen, is three controls advertising that there is only one of
            something — which is the opposite of what the section is for.
          */}
          {TESTIMONIALS.length > 1 && (
            <>
              <div
                className="mt-10 flex justify-center gap-2"
                role="tablist"
                aria-label="Testimonial navigation"
              >
                {TESTIMONIALS.map((entry, index) => (
                  <button
                    key={entry.name + index}
                    onClick={() => setCurrentIndex(index)}
                    className={cn(
                      'h-2 w-2 rounded-full transition-all',
                      index === activeIndex ? 'w-8 bg-ink' : 'bg-line hover:bg-line-strong',
                    )}
                    role="tab"
                    aria-selected={index === activeIndex}
                    aria-label={`Go to testimonial ${index + 1}`}
                  />
                ))}
              </div>

              <div className="mt-6 flex justify-center gap-3">
                <button
                  onClick={() =>
                    setCurrentIndex((prev) => (prev - 1 + TESTIMONIALS.length) % TESTIMONIALS.length)
                  }
                  className="flex size-10 items-center justify-center rounded-full border border-line bg-canvas text-ink transition-all hover:bg-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze/40"
                  aria-label="Previous testimonial"
                >
                  <ArrowLeft className="size-5" />
                </button>
                <button
                  onClick={() => setCurrentIndex((prev) => (prev + 1) % TESTIMONIALS.length)}
                  className="flex size-10 items-center justify-center rounded-full border border-line bg-canvas text-ink transition-all hover:bg-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze/40"
                  aria-label="Next testimonial"
                >
                  <ArrowRight className="size-5" />
                </button>
              </div>
            </>
          )}
        </div>
      </Container>
    </Section>
  );
}

// ── Collaborations (manager-controlled) ─────────────────────────────────────

/**
 * The cafés, restaurants and studios ARTINU works with.
 *
 * This was a marquee: the list doubled and animated from 0% to -50% forever.
 * Three problems, all visible on the homepage. The two copies shared their
 * React keys, so every card was rendered twice under the same id. The -50%
 * assumes the row is exactly twice the width of the original list, which the
 * `gap-6` between cards and the `px-4` on the track make untrue, so the loop
 * jumped. And a moving target cannot be clicked, which mattered the moment a
 * collaboration had somewhere to link to.
 *
 * A grid instead: fixed card proportions, one baseline for every name, one for
 * every line of description, and a card that reads as a card whether there are
 * eight collaborations or one.
 */
function CollaborationsSection() {
  // One request for the whole homepage, remembered between visits. This section
  // disappearing on a cold API was the most visible symptom of the five-request
  // fan-out it replaces — see hooks/useHomepage.ts.
  const { content, isLoading } = useHomepage();
  const cafes = content.cafes;

  if (isLoading || !cafes || cafes.length === 0) {
    return null;
  }

  return (
    <Section tone="soft">
      <Container>
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
            <SectionHeading
              eyebrow="Collaborations"
              title={
                <>
                  The places our work <em className="editorial-italic">lives</em>.
                </>
              }
              className="max-w-2xl"
            />
            <ArrowLink to="/spaces">Bring ARTINU to your space</ArrowLink>
          </div>
        </Reveal>

        {/*
          One collaboration is a spread; several are a grid.

          ARTINU works with one café today, and a lone card in a three-column
          grid left two thirds of the row empty — which reads as a grid waiting
          to be filled rather than as a partner being shown off. A single
          partner gets the photographs at a size worth looking at, with the
          details set beside them. The grid returns on its own at two.
        */}
        {cafes.length === 1 ? (
          <Reveal className="mt-14">
            <CollaborationCard cafe={cafes[0]} featured />
          </Reveal>
        ) : (
          <Stagger className="mt-14 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {cafes.map((cafe) => (
              <StaggerItem key={cafe.id}>
                <CollaborationCard cafe={cafe} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </Container>
    </Section>
  );
}

/**
 * Extra photographs for a partner, in the order they should be shown.
 *
 * The `cafes` table holds a single `photoUrl`, so a partner with three
 * photographs has nowhere to put the other two. Until it can, they ship with
 * the site and are matched by name here.
 *
 * Deliberately a short, obvious list rather than something clever: adding a
 * partner means dropping files into assets/source/partners, running
 * `npm run images`, and adding one line. The first entry is what the card shows
 * on load.
 */
const PARTNER_GALLERIES: { match: RegExp; images: string[]; website?: string }[] = [
  {
    match: /nib\s*(&|and)\s*nosh/i,
    /*
      The branded card first, because that is the one that says whose wall this
      is. Then the six individual prints hanging there — each is one
      photographer's work with their credit plate, which is the whole point of
      the collaboration — and finally the two wider shots that put those frames
      in the room.
    */
    images: [
      '/image/partners/nib-and-nosh-card-1024.webp',
      '/image/partners/nib-and-nosh-frame-1-1024.webp',
      '/image/partners/nib-and-nosh-frame-2-1024.webp',
      '/image/partners/nib-and-nosh-frame-3-1024.webp',
      '/image/partners/nib-and-nosh-frame-4-1024.webp',
      '/image/partners/nib-and-nosh-frame-5-1024.webp',
      '/image/partners/nib-and-nosh-frame-6-1024.webp',
      '/image/partners/nib-and-nosh-interior-1-1024.webp',
      '/image/partners/nib-and-nosh-interior-2-1024.webp',
    ],
    website: 'https://nibandnoshcafe.com',
  },
];

const partnerFor = (name: string) => PARTNER_GALLERIES.find((entry) => entry.match.test(name));

const galleryFor = (name: string): string[] => partnerFor(name)?.images ?? [];

/**
 * Where a partner card links, with the database winning.
 *
 * `cafes.website_url` is the real home for this and is what a manager edits.
 * The fallback exists because that column does not exist on every deployment
 * yet — migration 009 adds it — and until it does, `websiteUrl` comes back
 * undefined and the card renders as a dead tile with no way to reach the
 * partner at all.
 *
 * Only ever consulted when the row has nothing, so the moment the column is
 * there and a manager sets a URL, theirs is used and this is ignored. It is a
 * bridge, not a source of truth: a partner added through the console that is
 * not in the list above still behaves exactly as before.
 */
const websiteFor = (cafe: Cafe): string | null =>
  cafe.websiteUrl?.trim() || partnerFor(cafe.name)?.website || null;

/**
 * One collaboration.
 *
 * The card links out only when a manager has entered the partner's URL in
 * Console → Homepage → Collaborations. Without one it is a card and nothing
 * more: a plausible-looking URL assembled from the name would send visitors to
 * a stranger's website, and it is not the kind of mistake anyone would catch
 * from the homepage. (The comment that used to sit here guessed at
 * "nibbannosh.com" as its example. The real address is nibandnoshcafe.com —
 * which is exactly the point.)
 *
 * The description line under the name carries the partner's own address. That
 * is a collaborator's address, not ARTINU's — the requirement to publish no
 * address is about this company, and telling someone where the café that hangs
 * our work actually is helps them go and see it.
 *
 * ── The photographs ─────────────────────────────────────────────────────────
 *
 * `cafe.photoUrl` is one image, which is all the `cafes` table stores. Where a
 * partner has more photographs shipped with the site, the card cycles through
 * them in place — same frame, same size, no controls. `PARTNER_GALLERIES` below
 * is the map; it is a stopgap until the table can hold a gallery of its own.
 */
function CollaborationCard({ cafe, featured = false }: { cafe: Cafe; featured?: boolean }) {
  const href = websiteFor(cafe);

  const gallery = galleryFor(cafe.name);
  const [shot, setShot] = React.useState(0);
  const reduced = useReducedMotion();

  React.useEffect(() => {
    if (gallery.length < 2 || reduced) return;
    const timer = setInterval(() => setShot((prev) => (prev + 1) % gallery.length), 4200);
    return () => clearInterval(timer);
  }, [gallery.length, reduced]);

  // Fall back to whatever the console has stored when there is no local set.
  const currentSrc = gallery.length > 0 ? gallery[shot % gallery.length] : cafe.photoUrl;

  // Shown rather than the raw URL: "nibandnoshcafe.com" reads as a destination,
  // "https://www.nibandnoshcafe.com/?utm=…" reads as a database field.
  const domain = React.useMemo(() => {
    if (!href) return null;
    try {
      return new URL(href).hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  }, [href]);

  const body = (
    <div
      className={cn(
        featured &&
          'grid items-center gap-8 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-14',
      )}
    >
      <div className="relative overflow-hidden rounded-lg">
        {/* One frame, one size. The photographs change inside it rather than the
            card resizing around them, which is why they are all generated at
            the same ratio. */}
        <Photo
          key={currentSrc}
          src={currentSrc}
          alt={`Framed ARTINU photographs on the wall at ${cafe.name}`}
          ratio="aspect-[4/5]"
          thumbnail
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="photo-edge rounded-lg animate-fade-in"
          imgClassName="transition-transform duration-[1.2s] ease-[var(--ease-out-soft)] group-hover:scale-[1.03]"
        />

        {/* Which of the partner's photographs is showing. Marks only, no
            controls — the card is a link, and a nested button inside it would
            be both a hit-target conflict and one more thing to explain. */}
        {gallery.length > 1 && (
          <div className="pointer-events-none absolute bottom-3 right-3 flex gap-1.5" aria-hidden>
            {gallery.map((src, i) => (
              <span
                key={src}
                className={cn(
                  'h-1 rounded-full transition-all duration-500',
                  i === shot % gallery.length ? 'w-4 bg-canvas' : 'w-1 bg-canvas/50',
                )}
              />
            ))}
          </div>
        )}
      </div>

      <div className={featured ? 'mt-2 md:mt-0' : 'mt-5'}>
        {featured && <p className="eyebrow mb-3">Where you can see the work</p>}
        {/*
          The arrow sits against the name, not off in the far corner.

          It used to be a bordered disc pushed to the right-hand edge of the
          card, far enough from the title that it read as decoration rather than
          as "this goes somewhere". Tucked in beside the name it does what an
          outbound arrow is for, and it slides on hover so the card says where
          it is going before you click it.
        */}
        <h3 className={cn(
          "flex items-baseline gap-1.5 font-display leading-snug text-ink",
          featured ? "text-2xl sm:text-3xl" : "text-xl",
        )}>
          <span className="min-w-0 truncate">{cafe.name}</span>
          {href && (
            <ArrowUpRight
              className="size-4 shrink-0 translate-y-px text-bronze transition-transform duration-300 ease-[var(--ease-out-soft)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden
            />
          )}
        </h3>

        {cafe.description && <p className="prose-quiet mt-1.5 text-sm">{cafe.description}</p>}

        {domain && (
          <span className="mt-2 block font-label text-[0.6875rem] uppercase tracking-[0.14em] text-bronze underline decoration-bronze/30 underline-offset-4 transition-colors group-hover:decoration-bronze">
            {domain}
          </span>
        )}
      </div>
    </div>
  );

  if (!href) {
    return <article className="group">{body}</article>;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze focus-visible:ring-offset-4 focus-visible:ring-offset-canvas-soft"
    >
      {body}
      <span className="sr-only">(opens {cafe.name} in a new tab)</span>
    </a>
  );
}

// ── Featured Collections Section (Manager-controlled) ─────────────────────────

/**
 * The photographs a manager has pinned to the homepage.
 *
 * A `featured_collections` row holds only a `collectionId` — a pointer at an
 * artwork. The section used to fetch those pointers and then render an
 * `ArtworkCardSkeleton` for each one, so a manager who featured six
 * photographs got six shimmering grey rectangles that never resolved into
 * anything: the loading state was the final state. The pointers are now
 * resolved into the real artworks and rendered as real cards, with the
 * lightbox the rest of the site uses.
 */
function FeaturedCollectionsSection() {
  // From the one homepage payload. This also removes a waterfall: the pointers
  // used to be a request of their own, and the gallery lookup below could not
  // start until it came back — two cold round trips in series.
  const { content, isLoading: loadingPointers } = useHomepage();
  const collections = content.featuredCollections;

  // `order` is what the console drag-and-drop writes; honour it here.
  const ids = React.useMemo(
    () =>
      (collections ?? [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((entry) => entry.collectionId)
        .filter(Boolean),
    [collections],
  );

  const { data: artworks, isLoading: loadingArtworks } = useQuery({
    queryKey: qk.gallery({ ids, pageSize: 24 }),
    queryFn: () => catalogService.gallery({ ids, pageSize: 24 }),
    enabled: ids.length > 0,
  });

  // Restore the manager's order — the gallery endpoint sorts by its own rules.
  const shown = React.useMemo(() => {
    const byId = new Map((artworks?.items ?? []).map((item) => [item.id, item]));
    return ids.map((id) => byId.get(id)).filter((item): item is NonNullable<typeof item> => !!item);
  }, [artworks, ids]);

  const lightbox = useLightbox(shown);

  if (loadingPointers || ids.length === 0) return null;

  return (
    <Section tone="soft">
      <Container>
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-6">
            {/* The eyebrow and the heading both read "Featured Collections",
                one directly above the other. */}
            <SectionHeading
              eyebrow="Featured"
              title="Photographs we are showing this month."
              className="max-w-2xl"
            />
            <ArrowLink to="/gallery">Browse the full gallery</ArrowLink>
          </div>
        </Reveal>

        <div className="mt-12">
          <ArtworkMasonry>
            {loadingArtworks
              ? ids.map((id, index) => <ArtworkCardSkeleton key={id} index={index} />)
              : shown.map((artwork, index) => (
                  <ArtworkCard
                    key={artwork.id}
                    artwork={artwork}
                    priority={index < 2}
                    showPrice={false}
                    onOpen={lightbox.open}
                  />
                ))}
          </ArtworkMasonry>
        </div>
      </Container>

      {lightbox.isOpen ? (
        <Lightbox
          artworks={shown}
          index={lightbox.index}
          onIndexChange={lightbox.setIndex}
          onClose={lightbox.close}
        />
      ) : null}
    </Section>
  );
}

/*
 * `CollaboratedSpacesCarousel` was removed.
 *
 * It was a second collaborations rail sitting directly beneath the grid above,
 * hardcoded with six named businesses — Blue Tokai, Third Wave Coffee,
 * Starbucks Reserve among them — over stock Unsplash photographs. None of it
 * came from the database, which meant the homepage claimed partnerships with
 * real, identifiable companies that ARTINU may never have worked with, and no
 * manager could correct it without a deploy.
 *
 * <CollaborationsSection /> above already renders this from the `cafes`
 * table, which the console can add to, edit, reorder and hide, and which the
 * artist workspace reads from too (requirements §7, §24, §40).
 */

export default function HomePage() {
  const { data: featured, isLoading } = useQuery({
    queryKey: qk.gallery({ sort: 'popular', pageSize: 8 }),
    queryFn: () => catalogService.gallery({ sort: 'popular', pageSize: 8 }),
  });

  const shown = featured?.items ?? [];
  const lightbox = useLightbox(shown);

  return (
    <>
      <PhotographerShowcaseHero />

      <Section tone="soft" size="compact">
        <Container size="prose" className="text-center">
          <blockquote className="mb-6">
            <p className="font-display text-xl md:text-2xl text-ink leading-relaxed">
              "Art is not what you see, but what you make others see."
            </p>
            <footer className="mt-3 text-sm font-medium tracking-wide text-subtle">
              — Edgar Degas
            </footer>
          </blockquote>
        </Container>
      </Section>

      {/* ── What is Artinu? ───────────────────────────────────────────── */}
      <Section tone="canvas" size="compact">
        <Container>
          <Reveal>
            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
              <div>
                <p className="eyebrow">WHAT IS ARTINU</p>
                <h2 className="mt-4 font-display text-[2rem] leading-[1.1] text-ink sm:text-[2.75rem]">
                  Purely an art of exhibit.
                </h2>
                <p className="prose-quiet mt-5">
                  Over 95% of artworks purchased for curation are displayed without us knowing who the
                  artist behind them is. Hardly do we find the artist&rsquo;s name, signature, or story
                  alongside the artwork.
                </p>
                <p className="prose-quiet mt-4">
                  Artinu is a platform where artworks are curated with proper recognition of the artists
                  behind them. Every artwork can carry the artist&rsquo;s details, allowing you to discover
                  their work, learn about them, and connect with them.
                </p>
                <p className="mt-8 font-display text-2xl italic text-ink sm:text-3xl">
                  We turn walls into stories.
                </p>
              </div>
              <Photo
                src="/image/what-is-artinu.webp"
                alt="A framed artwork curated by Artinu"
                ratio="aspect-square"
                className="rounded-xl photo-edge"
              />
            </div>
          </Reveal>
        </Container>
      </Section>

      {/* ── The Artinu cycle ──────────────────────────────────────────── */}
      <Section tone="canvas" size="compact">
        <Container>
          <Reveal>
            <p className="eyebrow text-center">THE ARTINU MODEL</p>
            <h2 className="mt-5 text-center text-[2rem] leading-[1.08] text-ink sm:text-[2.75rem]">
              Art doesn&rsquo;t have to stay in one place.
            </h2>
            <p className="prose-quiet mx-auto mt-6 max-w-2xl text-center">
              We don&rsquo;t sell artworks. We give them a place to be seen, and after a while make
              room for another story.
            </p>
          </Reveal>

          <div className="relative mt-12 lg:mt-16">
            {/* One continuous line — flows through the cycle, then curves back to CURATE (desktop) */}
            <svg
              className="pointer-events-none absolute inset-x-0 -top-7 hidden h-11 w-full lg:block"
              viewBox="0 0 1200 48"
              fill="none"
              preserveAspectRatio="none"
              aria-hidden
            >
              <path
                d="M 80 26
                   C 140 10, 200 42, 260 28
                   C 320 14, 380 42, 440 28
                   C 500 14, 560 42, 620 28
                   C 680 14, 740 42, 800 28
                   C 860 14, 920 42, 980 28
                   C 1020 20, 1100 26, 1100 38
                   C 1100 44, 1088 44, 1078 42
                   C 1040 34, 1000 20, 900 12
                   C 700 2, 400 2, 200 10
                   C 140 12, 90 16, 80 22
                   C 76 24, 78 26, 80 26
                   Z"
                stroke="var(--color-line-strong)"
                strokeWidth="1"
              />
              <path
                d="M 84 22 l 6 -9 m -6 9 l 9 2"
                stroke="var(--color-bronze)"
                strokeWidth="1.3"
              />
            </svg>

            <Stagger className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_2rem_1fr_2rem_0.9fr_2rem_1fr_2rem_1fr] lg:items-start lg:gap-0">
              <StaggerItem className="text-center">
                <p className="font-display text-5xl leading-none text-bronze/50">01</p>
                <p className="eyebrow mt-4">Curate</p>
                <p className="prose-quiet mt-2">An artwork is chosen for the space.</p>
              </StaggerItem>
              <StaggerItem className="relative mx-auto h-8 w-px bg-line-strong lg:h-px lg:w-10">
                <ChevronDown className="absolute -bottom-3 left-1/2 -translate-x-1/2 size-4 text-bronze lg:hidden" aria-hidden />
                <ChevronRight className="absolute -right-3 top-1/2 hidden -translate-y-1/2 size-4 text-bronze lg:block" aria-hidden />
              </StaggerItem>
              <StaggerItem className="text-center">
                <p className="font-display text-5xl leading-none text-bronze/50">02</p>
                <p className="eyebrow mt-4">Exhibit</p>
                <p className="prose-quiet mt-2">
                  It moves from a photographer&rsquo;s screen to a real wall.
                </p>
              </StaggerItem>
              <StaggerItem className="relative mx-auto h-8 w-px bg-line-strong lg:h-px lg:w-10">
                <ChevronDown className="absolute -bottom-3 left-1/2 -translate-x-1/2 size-4 text-bronze lg:hidden" aria-hidden />
                <ChevronRight className="absolute -right-3 top-1/2 hidden -translate-y-1/2 size-4 text-bronze lg:block" aria-hidden />
              </StaggerItem>
              <StaggerItem className="relative mx-auto w-full max-w-[13rem] sm:max-w-[14rem] lg:max-w-[15rem]">
                <Photo
                  src="/image/artinu-model.webp"
                  alt="An artwork on display in a real space"
                  ratio="aspect-[4/5]"
                  className="-rotate-1 rounded-sm shadow-frame photo-edge"
                />
                <p className="mt-4 text-center font-label text-[0.6875rem] uppercase tracking-[0.16em] text-subtle">
                  A collection in rotation
                </p>
              </StaggerItem>
              <StaggerItem className="relative mx-auto h-8 w-px bg-line-strong lg:h-px lg:w-10">
                <ChevronDown className="absolute -bottom-3 left-1/2 -translate-x-1/2 size-4 text-bronze lg:hidden" aria-hidden />
                <ChevronRight className="absolute -right-3 top-1/2 hidden -translate-y-1/2 size-4 text-bronze lg:block" aria-hidden />
              </StaggerItem>
              <StaggerItem className="text-center">
                <p className="font-display text-5xl leading-none text-bronze/50">03</p>
                <p className="eyebrow mt-4">Experience</p>
                <p className="prose-quiet mt-2">
                  People live around it, notice it, photograph it, and connect with the story behind it.
                </p>
              </StaggerItem>
              <StaggerItem className="relative mx-auto h-8 w-px bg-line-strong lg:h-px lg:w-10">
                <ChevronDown className="absolute -bottom-3 left-1/2 -translate-x-1/2 size-4 text-bronze lg:hidden" aria-hidden />
                <ChevronRight className="absolute -right-3 top-1/2 hidden -translate-y-1/2 size-4 text-bronze lg:block" aria-hidden />
              </StaggerItem>
              <StaggerItem className="text-center">
                <p className="font-display text-5xl leading-none text-bronze/50">04</p>
                <p className="eyebrow mt-4">Rotate</p>
                <p className="prose-quiet mt-2">
                  After 1–3 months, it makes room for another artwork.
                </p>
                <p className="eyebrow mt-7 text-bronze">Why rotate?</p>
                <p className="prose-quiet mx-auto mt-2 max-w-[16rem]">
                  A wall people see every day fades into the background. Rotation brings the artwork
                  back into the room, and gives someone new a chance to be seen.
                </p>
              </StaggerItem>
            </Stagger>

            <div className="mt-10 flex items-center justify-center gap-3 text-bronze">
              <RotateCcw className="size-5" aria-hidden />
              <p className="font-label text-[0.6875rem] uppercase tracking-[0.16em]">
                The cycle continues, back to curate
              </p>
            </div>

            {/* The cycle, complete */}
            <Reveal className="mx-auto mt-12 max-w-2xl text-center">
              <p className="prose-quiet mx-auto max-w-xl">
                An artwork gets its moment on the wall, then the wall makes room for another, and
                someone new gets seen.
              </p>
              <p className="mt-6 font-display text-2xl italic text-ink sm:text-3xl">
                More artists get a moment. More spaces get a new atmosphere.
              </p>
            </Reveal>
          </div>
        </Container>
      </Section>

      <SpacesWeTransform />

      <CollaborationsSection />

      <div
        className="py-16 sm:py-24"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(20, 18, 15, 0.55) 0%, rgba(20, 18, 15, 0.25) 50%, rgba(20, 18, 15, 0) 100%), url(/image/quote-section-bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <Container className="text-left">
          <blockquote className="max-w-2xl">
            <p className="font-display text-2xl md:text-4xl text-white leading-relaxed">
              "In every friendship group, there is always one friend chasing sunsets, climbing rooftops, and capturing moments.{" "}
              <span className="text-[#f2c14e]">Artinu was built for that friend.</span>"
            </p>
          </blockquote>
        </Container>
      </div>

      <FeaturedCollectionsSection />

      <TestimonialsCarousel />

      {lightbox.isOpen ? (
        <Lightbox
          artworks={shown}
          index={lightbox.index}
          onIndexChange={lightbox.setIndex}
          onClose={lightbox.close}
        />
      ) : null}

      <CtaBand
        eyebrow="Let's talk"
        title={
          <>
            Let&rsquo;s bring your space
            <br className="hidden sm:block" /> to life.
          </>
        }
        description="Tell us about your walls. We'll curate a collection, frame it, hang it, and keep it fresh."
        primary={{ label: 'Book a consultation', to: '/lets-talk' }}
        secondary={{ label: 'Explore the gallery', to: '/gallery' }}
        image={IMAGES.gallerywall}
      />
    </>
  );
}
