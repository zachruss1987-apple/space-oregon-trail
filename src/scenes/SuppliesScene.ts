/** Check supplies: full-screen hold and crew table (docs/design/ui.md). No day passes; Enter/Esc returns. */
import { CONDITIONS, ITEMS, PART_SPARE, type PartId, type SupplyKey } from '@/content';
import { announceScreen } from '@/game/a11y';
import { session } from '@/game/session';
import { brokenParts, daysOfRations, healthLabel, workingDrives, type Crew, type GameState } from '@/sim';
import { t } from '@/ui/copy';
import { Table } from '@/ui/Table';
import { addText } from '@/ui/text';
import { COLORS, fmt, money } from '@/ui/theme';
import { BaseScene } from './BaseScene';

const SUPPLY_ROWS: readonly SupplyKey[] = ['drives', 'rations', 'suits', 'charges', 'plates', 'pumps', 'gyros'];

/** Condition or cause id → display name. */
function causeName(id: string): string {
  return (CONDITIONS as Record<string, { name: string } | undefined>)[id]?.name ?? id.replace(/[_-]/g, ' ');
}

function supplyNote(s: GameState, key: SupplyKey): string {
  if (key === 'drives') {
    const offline = s.supplies.drives - workingDrives(s);
    return offline > 0 ? t('supplies.offline', { n: offline }) : '';
  }
  if (key === 'rations') {
    const days = daysOfRations(s);
    return Number.isFinite(days) ? t('supplies.days', { n: fmt(days) }) : '';
  }
  const part = (Object.keys(PART_SPARE) as PartId[]).find((p) => PART_SPARE[p] === key);
  return part && brokenParts(s).includes(part) ? t('supplies.broken', { part: part.toUpperCase() }) : '';
}

function crewStatus(c: Crew): string {
  if (!c.alive) return t('supplies.died', { cause: causeName(c.cause ?? '') });
  if (c.awayDays > 0) return t('supplies.away');
  const label = t(`status.health.${healthLabel(c.health)}`);
  const conds = c.conditions.slice(0, 2).map((x) => causeName(x.id)).join(', ');
  return conds ? `${label} - ${conds}` : label;
}

/** Portrait frame: 0 healthy, 1 sick (a condition or poor health), 2 dead or lost. */
function portraitFrame(c: Crew): number {
  if (!c.alive) return 2;
  return c.conditions.length > 0 || healthLabel(c.health) === 'Poor' || healthLabel(c.health) === 'Very poor' ? 1 : 0;
}

export class SuppliesScene extends BaseScene {
  constructor() {
    super('Supplies');
  }

  protected override music(): string {
    return 'travel';
  }

  create(): void {
    this.begin();
    const s = session.state;
    if (!s) return this.go('Title');
    addText(this, 16, 16, t('supplies.title'), { color: COLORS.bright, scale: 2 });
    addText(this, 300, 16, t('supplies.crew'), { color: COLORS.bright, scale: 2 });
    const rows = SUPPLY_ROWS.map((k) => [ITEMS[k].name, fmt(s.supplies[k]), supplyNote(s, k)]);
    rows.push([t('supplies.credits'), `${money(s.credits)} cr`, '']);
    new Table(this, 16, 52, [{ width: 14 }, { width: 6, right: true }, { width: 12 }], 22).setRows(rows);
    const spoken = [t('supplies.title'), ...rows.map((r) => r.filter(Boolean).join(' ')), t('supplies.crew')];
    // One portrait per crew slot (frame: healthy / sick / dead), then name and status beside it.
    s.crew.forEach((c, i) => {
      const y = 48 + i * 40;
      this.add.image(300, y, `portrait.${i + 1}`, portraitFrame(c)).setOrigin(0, 0);
      addText(this, 340, y + 6, c.name, { color: c.alive ? COLORS.bright : COLORS.dim });
      spoken.push(`${c.name}: ${crewStatus(c)}`);
      addText(this, 340, y + 20, crewStatus(c), { color: c.alive ? COLORS.text : COLORS.dim, wrap: 292 });
    });
    announceScreen(spoken);
    addText(this, 16, 376, t('supplies.return'), { color: COLORS.dim });
    this.router.push({
      onKey: (e) => {
        if ((e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') && !e.repeat) this.go('Travel');
      },
    });
  }
}
