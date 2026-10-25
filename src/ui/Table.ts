/** Fixed-width text table (supplies, map, score). Columns are padded in characters. */
import Phaser from 'phaser';
import { col, COLORS, LINE_HEIGHT, textStyle } from './theme';

export interface Column {
  /** Width in characters. */
  width: number;
  /** Right-align (numbers). */
  right?: boolean;
}

/** A row: cells, plus an optional color for the whole row. */
export interface TableRow {
  cells: readonly string[];
  color?: string;
}

export class Table {
  private readonly lines: Phaser.GameObjects.Text[] = [];

  constructor(private readonly scene: Phaser.Scene, private readonly x: number, private readonly y: number, private readonly columns: readonly Column[], private readonly lineHeight = LINE_HEIGHT) {}

  /** Format one row to a string. */
  format(cells: readonly string[]): string {
    return this.columns.map((c, i) => col(cells[i] ?? '', c.width, c.right)).join(' ').trimEnd();
  }

  setRows(rows: readonly (TableRow | readonly string[])[], header?: readonly string[]): void {
    this.destroy();
    let y = this.y;
    if (header) {
      this.lines.push(this.scene.add.text(this.x, y, this.format(header), textStyle(COLORS.dim)));
      y += this.lineHeight;
    }
    for (const r of rows) {
      const row: TableRow = 'cells' in r ? r : { cells: r };
      this.lines.push(this.scene.add.text(this.x, y, this.format(row.cells), textStyle(row.color ?? COLORS.text)));
      y += this.lineHeight;
    }
  }

  /** Bottom edge of the last row. */
  get bottom(): number {
    return this.y + this.lines.length * this.lineHeight;
  }

  destroy(): void {
    this.lines.forEach((l) => l.destroy());
    this.lines.length = 0;
  }
}
