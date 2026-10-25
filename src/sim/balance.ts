/** Monte Carlo balance harness (pure): runs seeded auto-played games per profession x window x policy and tabulates them. */
import { PROFESSION_ORDER, WINDOW_ORDER, type DifficultyId, type ProfessionId, type WindowId } from '@/content';
import { DEFAULT_POLICY, runPolicy, type PolicyOptions } from './policy';

/** Policy names, in report order. */
export type PolicyName = 'cautious' | 'balanced' | 'greedy';

/** The three harness policies. `balanced` is the reference policy (identical to the playthrough test). */
export const POLICIES: Readonly<Record<PolicyName, PolicyOptions>> = {
  cautious: { ...DEFAULT_POLICY, restBelowHealth: 70, lowRationDays: 15, extraKit: { drives: 1, plates: 1, pumps: 1, gyros: 1 } },
  balanced: DEFAULT_POLICY,
  greedy: { ...DEFAULT_POLICY, thrust: 'hard', restBelowHealth: 30, lowRationDays: 5 },
};
export const POLICY_ORDER: readonly PolicyName[] = ['cautious', 'balanced', 'greedy'];

/** Matrix request. */
export interface MatrixSpec {
  seeds: number;
  professions?: readonly ProfessionId[];
  windows?: readonly WindowId[];
  policies?: readonly PolicyName[];
  /** Difficulty for every run (default spacer). */
  difficulty?: DifficultyId;
}

/** Percentiles of a distribution. */
export interface Dist { p10: number; p50: number; p90: number }

/** One matrix cell. */
export interface CellResult {
  profession: ProfessionId;
  window: WindowId;
  policy: PolicyName;
  runs: number;
  winRate: number;
  arrived: number;
  dead: number;
  adrift: number;
  meanDays: number;
  medianDays: number;
  /** Death-cause counts over every crew death in the cell. */
  causes: Record<string, number>;
  /** Score distribution over arrived runs (zeros if none). */
  score: Dist;
  /** Mean credits left at arrival (0 if none arrived). */
  meanCredits: number;
}

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Nearest-rank percentile of a sorted array. */
export function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))]!;
}

/** Play `seeds` games (seeds 1..N) for one cell. */
export function runCell(profession: ProfessionId, window: WindowId, policy: PolicyName, seeds: number, difficulty: DifficultyId = 'spacer'): CellResult {
  const days: number[] = [];
  const scores: number[] = [];
  const credits: number[] = [];
  const causes: Record<string, number> = {};
  let arrived = 0, dead = 0, adrift = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const r = runPolicy(seed, { profession, window, policy: POLICIES[policy], difficulty });
    days.push(r.days);
    for (const c of r.causes) causes[c] = (causes[c] ?? 0) + 1;
    if (r.status === 'arrived') {
      arrived++;
      scores.push(r.score);
      credits.push(r.final.credits);
    } else if (r.status === 'dead') dead++;
    else adrift++;
  }
  const sd = [...days].sort((a, b) => a - b);
  const ss = scores.sort((a, b) => a - b);
  return {
    profession, window, policy, runs: seeds, winRate: seeds ? arrived / seeds : 0, arrived, dead, adrift,
    meanDays: mean(days), medianDays: percentile(sd, 50), causes,
    score: { p10: percentile(ss, 10), p50: percentile(ss, 50), p90: percentile(ss, 90) }, meanCredits: mean(credits),
  };
}

/** Run the full matrix (policy x profession x window). */
export function runMatrix(spec: MatrixSpec): CellResult[] {
  const out: CellResult[] = [];
  for (const policy of spec.policies ?? POLICY_ORDER)
    for (const profession of spec.professions ?? PROFESSION_ORDER)
      for (const window of spec.windows ?? WINDOW_ORDER) out.push(runCell(profession, window, policy, spec.seeds, spec.difficulty));
  return out;
}

/** Pool cells into one aggregate (run-weighted). */
export function pool(cells: CellResult[]): { runs: number; winRate: number; meanDays: number; causes: Record<string, number> } {
  const runs = cells.reduce((a, c) => a + c.runs, 0);
  const causes: Record<string, number> = {};
  for (const c of cells) for (const [k, n] of Object.entries(c.causes)) causes[k] = (causes[k] ?? 0) + n;
  return {
    runs,
    winRate: runs ? cells.reduce((a, c) => a + c.arrived, 0) / runs : 0,
    meanDays: runs ? cells.reduce((a, c) => a + c.meanDays * c.runs, 0) / runs : 0,
    causes,
  };
}

const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;
const row = (cols: (string | number)[]): string => `| ${cols.join(' | ')} |`;
const table = (head: string[], rows: (string | number)[][]): string =>
  [row(head), row(head.map(() => '---')), ...rows.map(row)].join('\n');

/** Markdown report: per policy, by profession, by window, and death causes. */
export function formatMarkdown(cells: CellResult[], meta: { seeds?: number; difficulty?: DifficultyId } = {}): string {
  const policies = [...new Set(cells.map((c) => c.policy))];
  const professions = [...new Set(cells.map((c) => c.profession))];
  const windows = [...new Set(cells.map((c) => c.window))];
  const parts: string[] = ['# Balance report', ''];
  if (meta.difficulty && meta.difficulty !== 'spacer') parts.push(`Difficulty: ${meta.difficulty}.`, '');
  if (meta.seeds) {
    parts.push(`${meta.seeds} seeded games per cell (seeds 1..${meta.seeds}). Targets (M5): farmer ~30%, executive ~60%, mean 130-170 days, no death cause > 35%.`, '');
  }
  for (const policy of policies) {
    const pc = cells.filter((c) => c.policy === policy);
    const all = pool(pc);
    const total = Object.values(all.causes).reduce((a, b) => a + b, 0);
    parts.push(`## Policy: ${policy}`, '', `Overall: win ${pct(all.winRate)}, mean ${all.meanDays.toFixed(1)} days over ${all.runs} runs.`, '');
    parts.push('### By profession', '', table(
      ['Profession', 'Win', 'Mean days', 'Median days', 'Arrived', 'Dead', 'Adrift', 'Score p10 / p50 / p90', 'Mean credits'],
      professions.map((p) => {
        const cs = pc.filter((c) => c.profession === p);
        const a = pool(cs);
        const n = (k: 'arrived' | 'dead' | 'adrift'): number => cs.reduce((x, c) => x + c[k], 0);
        const arr = cs.filter((c) => c.arrived);
        const sc = (k: keyof Dist): number => Math.round(mean(arr.map((c) => c.score[k])));
        const cr = arr.reduce((x, c) => x + c.meanCredits * c.arrived, 0) / Math.max(1, n('arrived'));
        return [p, pct(a.winRate), a.meanDays.toFixed(1), mean(cs.map((c) => c.medianDays)).toFixed(0), n('arrived'), n('dead'), n('adrift'),
          `${sc('p10')} / ${sc('p50')} / ${sc('p90')}`, cr.toFixed(0)];
      }),
    ), '');
    parts.push('### By launch window (win / mean days)', '', table(
      ['Window', ...professions],
      windows.map((w) => [w, ...professions.map((p) => {
        const c = pc.find((x) => x.profession === p && x.window === w);
        return c ? `${pct(c.winRate)} / ${c.meanDays.toFixed(0)}` : '-';
      })]),
    ), '');
    const causes = Object.entries(all.causes).sort((a, b) => b[1] - a[1]);
    parts.push('### Death causes (all crew deaths)', '', table(['Cause', 'Deaths', 'Share'], causes.map(([k, n]) => [k, n, pct(n / total)])), '');
  }
  return parts.join('\n');
}
