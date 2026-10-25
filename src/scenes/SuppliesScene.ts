/** Check supplies: full-screen hold and crew table (docs/design/ui.md). No day passes; Enter/Esc returns. */
import { CONDITIONS, ITEMS, PART_SPARE, type PartId, type SupplyKey } from '@/content';
import { session } from '@/game/session';
import { brokenParts, daysOfRations, healthLabel, workingDrives, type Crew, type GameState } from '@/sim';
import { t } from '@/ui/copy';
import { Table } from '@/ui/Table';
import { COLORS, fmt, money, textStyle } from '@/ui/theme';
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

export class SuppliesScene extends BaseScene {
  constructor() {
    super('Supplies');
  }

  create(): void {
    this.begin();
    const s = session.state;
    if (!s) return this.go('Title');
    this.add.text(16, 16, t('supplies.title'), textStyle(COLORS.bright));
    this.add.text(300, 16, t('supplies.crew'), textStyle(COLORS.bright));
    const rows = SUPPLY_ROWS.map((k) => [ITEMS[k].name, fmt(s.supplies[k]), supplyNote(s, k)]);
    rows.push([t('supplies.credits'), `${money(s.credits)} cr`, '']);
    new Table(this, 16, 44, [{ width: 14 }, { width: 6, right: true }, { width: 12 }], 22).setRows(rows);
    const crewRows = s.crew.map((c) => ({ cells: [c.name, crewStatus(c)], color: c.alive ? COLORS.text : COLORS.dim }));
    new Table(this, 300, 44, [{ width: 12 }, { width: 26 }], 22).setRows(crewRows);
    this.add.text(16, 370, t('supplies.return'), textStyle(COLORS.dim));
    this.router.push({
      onKey: (e) => {
        if ((e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') && !e.repeat) this.go('Travel');
      },
    });
  }
}
