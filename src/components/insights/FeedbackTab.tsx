import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, MessageSquareQuote, Percent, Star, Users } from 'lucide-react';
import type { FeedbackIntelligence, FeedbackRequest } from '../../types';
import { CampaignHistory, rateText } from '../feedback/FeedbackCampaigns';
import { Card, Delta, Empty, RateBar, Tile, WeeklyBars } from './InsightsUi';

/**
 * Insights → Feedback (formerly Feedback Intelligence): how delegates rate their sessions —
 * anonymous, every figure with its sample size, withheld below the minimum group size.
 */

const one = (n: number | null | undefined) => (n == null ? '—' : n.toFixed(1));

export function FeedbackView({ data, days, campaigns, canCreateCampaign, onCampaignsChanged }: {
  data: FeedbackIntelligence; days: number; campaigns: FeedbackRequest[] | null; canCreateCampaign: boolean; onCampaignsChanged: () => void;
}) {
  const cur = data.current;
  const prev = data.previous;
  const [allComments, setAllComments] = useState(false);
  const commentList = allComments ? data.comments.items : data.comments.items.slice(0, 8);
  const hasData = !!cur && cur.responses > 0;
  const weeks = data.trend.map((t) => ({
    label: `w/c ${new Date(t.weekStart).toLocaleDateString([], { day: 'numeric', month: 'short' })}`,
    value: t.overall,
    sub: `${t.responses} response${t.responses === 1 ? '' : 's'}`,
  }));

  return (
    <div className="space-y-6">
      {!hasData ? (
        <Card title="No session feedback in this period">
          <Empty title="Nothing to show yet">
            Delegates are invited to give feedback as each session ends. Results appear here once responses arrive.
            {cur ? ` ${cur.eligible} attended session${cur.eligible === 1 ? '' : 's'} in this period.` : ''}
          </Empty>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Tile label="Overall experience" icon={<Star size={18} />} color="amber"
              value={cur!.overall.average == null ? 'Withheld' : one(cur!.overall.average)} suffix={cur!.overall.average == null ? undefined : '/ 10'}
              basis={cur!.overall.average == null ? `Needs ${data.minResponses} responses` : `${cur!.overall.answered} answered`}
              delta={<Delta current={cur!.overall.average} previous={prev?.overall.average} unit="" days={days} />} />
            <Tile label="Response rate" icon={<Percent size={18} />} color="cyan" value={rateText(cur!.responseRate)}
              basis={`${cur!.responses} of ${cur!.eligible} attended sessions`} />
            {cur!.facilitator.answered > 0 && (
              <Tile label="Facilitator" icon={<Users size={18} />} color="blue" value={one(cur!.facilitator.average)} suffix="/ 10"
                basis={`${cur!.facilitator.answered} answered`} delta={<Delta current={cur!.facilitator.average} previous={prev?.facilitator.average} unit="" days={days} />} />
            )}
            {cur!.relevance.answered > 0 && (
              <Tile label="Relevance to their role" icon={<CheckCircle2 size={18} />} color="green" value={one(cur!.relevance.average)} suffix="/ 5"
                basis={`${cur!.relevance.answered} answered`} delta={<Delta current={cur!.relevance.average} previous={prev?.relevance.average} unit="" days={days} />} />
            )}
          </div>

          <div className="grid gap-6 xl:grid-cols-5 xl:items-start">
            <Card className="xl:col-span-3" title="Overall rating by week" subtitle="Average of the 0–10 overall score · hover for the number of responses">
              {weeks.filter((w) => w.value != null).length >= 2
                ? <WeeklyBars data={weeks} max={10} unit="" name="Overall" />
                : <Empty title="Not enough weeks yet">The weekly view appears once feedback has come in over two or more weeks.</Empty>}
            </Card>
            <Card className="xl:col-span-2" title="By course" subtitle={`Overall score per course · withheld below ${data.minResponses} responses`}>
              {data.courses.length === 0 ? <Empty title="No courses with feedback" /> : (
                <ul className="divide-y divide-gray-100 dark:divide-white/10">
                  {data.courses.map((c) => (
                    <li key={c.courseId} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 py-3">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{c.name}</span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">{c.code}{c.facilitatorName ? ` · ${c.facilitatorName}` : ''}</span>
                      </span>
                      <span className="text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{c.withheld ? 'Withheld' : `${one(c.overall)} / 10`}</span>
                      <span className="col-span-2 flex items-center gap-3">
                        <RateBar value={c.withheld ? null : c.overall} max={10} label={c.withheld ? 'Withheld' : `${one(c.overall)} out of 10`} />
                        <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">{c.responses}/{c.eligible} · {rateText(c.responseRate)}</span>
                      </span>
                      {!c.withheld && (c.facilitator != null || c.relevance != null) && (
                        <span className="col-span-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          {c.facilitator != null ? `Facilitator ${one(c.facilitator)} / 10` : ''}{c.facilitator != null && c.relevance != null ? ' · ' : ''}{c.relevance != null ? `Relevance ${one(c.relevance)} / 5` : ''}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {!!data.customQuestions?.length && (
            <Card title="Your school's questions" subtitle={`Rated 1–5 after each session · averages appear from ${data.minResponses} responses`}>
              <ul className="divide-y divide-gray-100 dark:divide-white/10">
                {data.customQuestions.map((q) => (
                  <li key={q.id} className="grid grid-cols-[1fr_minmax(100px,180px)_auto] items-center gap-4 py-3">
                    <span className="text-sm text-slate-800 dark:text-slate-200">{q.prompt}</span>
                    <RateBar value={q.average} max={q.max} label={q.average == null ? 'Withheld' : `${q.average.toFixed(1)} out of ${q.max}`} />
                    <span className="text-right tabular-nums">
                      <span className="block text-sm font-semibold text-slate-900 dark:text-white">{q.average == null ? 'Withheld' : `${q.average.toFixed(1)} / ${q.max}`}</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">{q.responses} response{q.responses === 1 ? '' : 's'}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="What delegates said" subtitle="Unattributed, in alphabetical order" action={<span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums"><MessageSquareQuote size={13} /> {data.comments.total}</span>}>
            {data.comments.withheld ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">Comments appear once at least {data.minResponses} delegates have responded, so no remark can be traced to one person.</p>
            ) : data.comments.items.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">No written comments in this period.</p>
            ) : (
              <>
                <ul className="grid gap-3 md:grid-cols-2">
                  {commentList.map((c, i) => (
                    <li key={i} className="rounded-xl bg-slate-50 dark:bg-white/5 px-4 py-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">“{c}”</li>
                  ))}
                </ul>
                <div className="mt-3 flex items-center gap-3 text-xs">
                  {data.comments.items.length > 8 && (
                    <button type="button" onClick={() => setAllComments((v) => !v)} className="font-medium text-blue-600 dark:text-blue-400 cursor-pointer">
                      {allComments ? 'Show fewer' : `Show ${data.comments.items.length - 8} more`}
                    </button>
                  )}
                  {data.comments.total > commentList.length && <span className="text-slate-500 dark:text-slate-400">Showing {commentList.length} of {data.comments.total}</span>}
                </div>
              </>
            )}
          </Card>
        </>
      )}

      {campaigns && campaigns.length > 0 && (
        <Card title="Feedback campaigns" subtitle="Surveys sent from Request Feedback, with their response rates"
          action={canCreateCampaign ? <Link to="/admin/request-feedback" className="text-xs font-medium text-blue-600 dark:text-blue-400">New campaign →</Link> : undefined}>
          <CampaignHistory requests={campaigns.slice(0, 10)} onChanged={onCampaignsChanged} />
        </Card>
      )}
    </div>
  );
}
