import { campaignStatus, type Order, type Payment } from '@artinu/shared';
import { db } from '@/database/db';
import { logger } from '@/utils/logger';

/**
 * WHAT IS STUCK RIGHT NOW.
 *
 * ── The gap this fills ──────────────────────────────────────────────────────
 *
 * The Console overview is a good dashboard: revenue, orders, trends, growth,
 * frames on walls. It answers "how is the business doing".
 *
 * It does not answer "what is waiting on me", and that turns out to be the
 * expensive question. Two customers submitted payment references on 29 August
 * and were still sitting at `verifying` eight days later — the money had
 * arrived, the orders could not advance, no invoice had ever been issued, and
 * nothing on any screen said so. A trend line cannot show you that. A count of
 * things that are stuck, sorted by how long they have been stuck, can.
 *
 * Everything here is derived from records that already exist. No new table, no
 * new column, no schema change — this is a different question asked of the same
 * data.
 *
 * ── The rule for what belongs ───────────────────────────────────────────────
 *
 * An item earns a place only if a person has to DO something and nothing else
 * will move it along. "Orders in printing" is progress and belongs on the
 * dashboard; "a payment nobody has checked" is a blockage and belongs here.
 */

export interface AttentionItem {
  /** Stable key so the client can route without parsing prose. */
  kind: 'payment_verification' | 'artist_application' | 'expired_campaign' | 'silent_artist';
  label: string;
  detail: string;
  count: number;
  /** Rupees involved, when the item is about money. */
  amount?: number;
  /** Days the oldest one has been waiting. Drives the ordering and the tone. */
  oldestDays?: number;
  /** Where in the Console to go and deal with it. */
  href: string;
  severity: 'urgent' | 'warning' | 'info';
}

const daysSince = (iso?: string | null): number | null => {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86_400_000);
};

/** Oldest first, so the number in the label is the worst case not the average. */
const oldestOf = (rows: { createdAt?: string | null }[]): number | undefined => {
  const ages = rows.map((r) => daysSince(r.createdAt)).filter((d): d is number => d !== null);
  return ages.length ? Math.max(...ages) : undefined;
};

export async function attentionItems(): Promise<AttentionItem[]> {
  const items: AttentionItem[] = [];

  /*
    Each block is independent and individually guarded.

    A table that does not exist yet — social_media_campaigns before migration
    016 — must cost this screen one card, not the whole screen. The overview is
    the first thing a CEO opens; it degrades, it does not fail.
  */

  // ── Money that has arrived and is waiting on a person ────────────────────
  try {
    const payments = (await db.payments.find({ where: { status: 'verifying' } })) as Payment[];
    if (payments.length > 0) {
      const oldest = oldestOf(payments) ?? 0;
      const amount = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      items.push({
        kind: 'payment_verification',
        label: 'Payments waiting to be verified',
        detail:
          oldest >= 2
            ? `The oldest has been waiting ${oldest} days. Until one is verified its order cannot advance and no invoice is issued.`
            : 'A customer has sent their payment reference and is waiting on confirmation.',
        count: payments.length,
        amount,
        oldestDays: oldest,
        href: '/console/payments',
        // Somebody has paid and is waiting. Nothing on this screen outranks it.
        severity: oldest >= 2 ? 'urgent' : 'warning',
      });
    }
  } catch (error) {
    logger.warn('Attention: could not read payments', error);
  }

  // ── Photographers waiting on a decision ──────────────────────────────────
  try {
    const applications = await db.applications.find({
      filter: (a) => a.status === 'submitted' || a.status === 'under_review',
    });
    if (applications.length > 0) {
      const oldest = oldestOf(applications) ?? 0;
      items.push({
        kind: 'artist_application',
        label: 'Artist applications to review',
        detail:
          oldest >= 7
            ? `The oldest has been waiting ${oldest} days.`
            : 'Photographers who have applied and not heard back.',
        count: applications.length,
        oldestDays: oldest,
        href: '/console/artists/applications',
        severity: oldest >= 7 ? 'warning' : 'info',
      });
    }
  } catch (error) {
    logger.warn('Attention: could not read applications', error);
  }

  // ── Campaigns still switched on after their end date ─────────────────────
  try {
    const campaigns = await db.socialMediaCampaigns.find({ where: { active: true } });
    const expired = campaigns.filter((c) => campaignStatus(c) === 'expired');
    if (expired.length > 0) {
      items.push({
        kind: 'expired_campaign',
        label: 'Campaigns past their end date',
        detail: 'Still switched on, so they no longer show but are not tidied away.',
        count: expired.length,
        href: '/social-media/campaigns',
        severity: 'info',
      });
    }
  } catch {
    // Table arrives with migration 016. Silent by design until then.
  }

  /*
    ── Photographers who joined and never uploaded ──────────────────────────

    The single problem this codebase names most often: people sign up and never
    upload. It is invisible on a dashboard because nothing happened — there is
    no row to count. Counting the absence is the only way to see it, and a
    verified account with no photographs after a week is somebody worth an
    email rather than a statistic.
  */
  try {
    const [artists, artworks] = await Promise.all([
      db.users.find({ where: { role: 'artist' } }),
      db.artworks.find(),
    ]);
    const hasWork = new Set(artworks.map((a) => a.artistId));
    const silent = artists.filter((user) => {
      if (hasWork.has(user.id)) return false;
      const age = daysSince(user.createdAt);
      // A week's grace: someone who joined yesterday is not a problem yet.
      return age !== null && age >= 7;
    });

    if (silent.length > 0) {
      items.push({
        kind: 'silent_artist',
        label: 'Artists who have never uploaded',
        detail: 'Registered over a week ago with no photographs yet. A nudge usually works.',
        count: silent.length,
        oldestDays: oldestOf(silent),
        href: '/console/users/artists',
        severity: 'info',
      });
    }
  } catch (error) {
    logger.warn('Attention: could not read artists', error);
  }

  // Urgent first, then by how long it has been waiting.
  const rank = { urgent: 0, warning: 1, info: 2 } as const;
  return items.sort(
    (a, b) => rank[a.severity] - rank[b.severity] || (b.oldestDays ?? 0) - (a.oldestDays ?? 0),
  );
}
