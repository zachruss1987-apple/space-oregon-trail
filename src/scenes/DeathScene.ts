/** Death endings: the last words from the log, a beacon epitaph saved via makeBeacon/appendBeacon, return to title. */
import { session } from '@/game/session';
import { BEACONS, makeBeacon } from '@/sim';
import { saveBeacon } from '@/ui/beaconStore';
import { t } from '@/ui/copy';
import { Menu } from '@/ui/Menu';
import { NameInput } from '@/ui/NameInput';
import { TextBox } from '@/ui/TextBox';
import { COLORS, textStyle } from '@/ui/theme';
import { BaseScene } from './BaseScene';

export class DeathScene extends BaseScene {
  constructor() {
    super('Death');
  }

  create(): void {
    this.begin();
    const s = session.state;
    if (!s) return this.go('Title');
    this.heading(24, t('death.title'), 20);
    const deaths = s.log.filter((e) => e.kind === 'death').slice(-2).map((e) => e.text);
    const ending = s.status === 'adrift' ? t('death.adrift') : t('death.allDead');
    new TextBox(this, 40, 70, 560, [...deaths, ending].join('\n\n'), { typewriter: true });
    this.add.text(40, 260, t('death.epitaphPrompt'), textStyle(COLORS.dim));
    const input = new NameInput(this, 40, 284, {
      maxLength: BEACONS.textMax,
      onCommit: (text) => {
        if (text.trim()) {
          saveBeacon(makeBeacon(s, s.crew[0]?.name ?? '', text));
          this.add.text(40, 308, t('death.beaconSaved'), textStyle(COLORS.dim));
        }
        this.finish();
      },
      onCancel: () => this.finish(),
    });
    this.router.set(input);
  }

  private finish(): void {
    const menu = new Menu(this, [{ label: t('death.continue') }], { x: 40, y: 344, onSelect: () => this.go('Title') });
    this.router.set(menu);
  }
}
