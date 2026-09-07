import { useQuery } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { adminService } from '@/services/admin.service';

/**
 * WHAT VISITORS ASKED, AND WHAT THE SITE COULD NOT ANSWER.
 *
 * ── Why the second list is the point ────────────────────────────────────────
 *
 * The top questions are mildly interesting: they tell you what people care
 * about, which you could mostly guess. The gaps are the ones worth reading.
 * Each is a visitor who wanted something ARTINU's website does not explain,
 * typed it, and was told "I don't have that". Fourteen of those on one question
 * is a paragraph the site is missing, reported by the people who needed it.
 *
 * Nothing here identifies anyone: the questions are stored without an IP, a
 * user, a session or a cookie, and grouped before they are counted.
 *
 * Empty until the assistant has been used, which is correct — a panel inventing
 * activity on a site nobody has visited yet would be the worst kind of dashboard.
 */
export function VisitorQuestions() {
  const { data } = useQuery({
    queryKey: ['admin', 'assistant-questions'],
    queryFn: () => adminService.assistantQuestions(),
    staleTime: 5 * 60_000,
  });

  if (!data || data.total === 0) return null;

  const answeredPct = data.total > 0 ? Math.round((data.answered / data.total) * 100) : 0;

  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line pb-2.5">
        <h2 className="eyebrow eyebrow-muted">What visitors asked</h2>
        <p className="text-xs text-subtle">
          {data.total} question{data.total === 1 ? '' : 's'} · {answeredPct}% answered · last 30 days
        </p>
      </div>

      <div className="grid gap-6 pt-5 lg:grid-cols-2">
        <div>
          <p className="mb-2.5 text-xs font-medium text-ink">Asked most</p>
          <ul className="space-y-1.5">
            {data.top.map((row) => (
              <li key={row.question} className="flex items-baseline gap-3 text-sm">
                <span className="w-6 shrink-0 font-label text-xs tabular-nums text-subtle">
                  {row.count}
                </span>
                <span className="min-w-0 flex-1 truncate text-ink-soft">{row.question}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-2.5 text-xs font-medium text-ink">
            {data.gaps.length > 0 ? 'The site does not answer these' : 'Nothing went unanswered'}
          </p>
          {data.gaps.length === 0 ? (
            <p className="text-sm text-muted">
              Every question a visitor asked was covered by what the site says.
            </p>
          ) : (
            <>
              <ul className="space-y-1.5">
                {data.gaps.map((row) => (
                  <li key={row.question} className="flex items-baseline gap-3 text-sm">
                    <span className="w-6 shrink-0 font-label text-xs tabular-nums text-warning">
                      {row.count}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-ink-soft">{row.question}</span>
                  </li>
                ))}
              </ul>
              {/* The action, stated plainly — this list is a to-do, not a metric. */}
              <p className="mt-3 flex items-start gap-2 text-xs text-muted">
                <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-subtle" aria-hidden />
                Adding these to the site — or to the assistant&rsquo;s knowledge — is what makes
                them stop being asked.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
