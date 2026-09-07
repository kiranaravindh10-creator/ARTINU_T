import { formatCurrency } from '@artinu/shared';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { adminService, type AttentionItem } from '@/services/admin.service';
import { cn } from '@/lib/utils';

/**
 * WHAT IS WAITING ON A PERSON.
 *
 * ── Why it sits above the numbers ───────────────────────────────────────────
 *
 * The rest of this page answers "how is the business doing". This answers "what
 * has stopped", and the two are not the same question — two customers paid on
 * 29 August and were still unverified eight days later while every chart on the
 * screen looked healthy, because a chart cannot show you an absence.
 *
 * So it goes first, and it disappears entirely when there is nothing stuck. A
 * panel that is always present becomes furniture; one that only appears when it
 * matters keeps meaning something.
 */

const TONE: Record<AttentionItem['severity'], string> = {
  urgent: 'border-danger/40 bg-danger-soft',
  warning: 'border-warning/40 bg-warning-soft',
  info: 'border-line bg-canvas-soft',
};

const DOT: Record<AttentionItem['severity'], string> = {
  urgent: 'bg-danger',
  warning: 'bg-warning',
  info: 'bg-subtle',
};

export function NeedsYou() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'attention'],
    queryFn: () => adminService.attention(),
    // Stale quickly: this is the one thing on the page that should not be old.
    staleTime: 30_000,
  });

  // Nothing while loading — a skeleton here would imply something is wrong.
  if (isLoading || !data) return null;

  if (data.length === 0) {
    return (
      <div className="mb-8 flex items-center gap-2.5 rounded-lg border border-line bg-canvas-soft px-4 py-3">
        <Check className="size-4 shrink-0 text-success" aria-hidden />
        <p className="text-sm text-muted">Nothing is waiting on anyone right now.</p>
      </div>
    );
  }

  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="eyebrow eyebrow-muted">Needs you</h2>
        <p className="text-xs text-subtle">
          {data.length} thing{data.length === 1 ? '' : 's'} waiting on a decision
        </p>
      </div>

      <div className="grid gap-2.5">
        {data.map((item) => (
          <Link
            key={item.kind}
            to={item.href}
            className={cn(
              'group flex items-center gap-4 rounded-lg border px-4 py-3.5 transition-colors',
              TONE[item.severity],
              'hover:border-line-strong',
            )}
          >
            <span className={cn('size-1.5 shrink-0 rounded-full', DOT[item.severity])} aria-hidden />

            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-medium text-ink">
                  {item.count} {item.label.toLowerCase()}
                </span>
                {/* The money is the part that makes someone act. */}
                {item.amount !== undefined && item.amount > 0 && (
                  <span className="font-label text-xs tabular-nums text-ink-soft">
                    {formatCurrency(item.amount)}
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-xs text-muted">{item.detail}</span>
            </span>

            <ArrowRight
              className="size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
