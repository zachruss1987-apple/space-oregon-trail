/** Death endings: the last words from the log, a beacon epitaph saved via makeBeacon/appendBeacon, return to title. */
import { session } from '@/game/session';
import { BEACONS, lastDeceased, makeBeacon } from '@/sim';
import { saveBeacon } from '@/ui/beaconStore';
import { t } from '@/ui/copy';
import { Menu } from '@/ui/Menu';
import { NameInput } from '@/ui/NameInput';
import { TextBox } from '@/ui/TextBox';
import { audio } from '@/audio/AudioManager';
import { addText } from '@/ui/text';
import { COLORS } from '@/ui/theme';
import { BaseScene } from './BaseScene';

export class DeathScene extends BaseScene {
  constructor() {
    super('Death');
  }

  protected override music(): string {
    return 'dirge';
  }

  create(): void {
    this.begin();
    const s = session.state;
    if (!s) return this.go('Title');
    this.heading(24, t('death.title'));
    audio().sfx('death.toll');
    // The fallen: each dead crew member's portrait (dead frame), and the memorial beacon.
    s.crew.forEach((c, i) => {
      if (!c.alive) this.add.image(40 + i * 40, 224, `portrait.${i + 1}`, 2).setOrigin(0, 0);
    });
    this.add.image(580, 248, 'beacon', 0).setOrigin(0.5, 1);
    const deaths = s.log.filter((e) => e.kind === 'death').slice(-2).map((e) => e.text);
    const ending = s.status === 'adrift' ? t('death.adrift') : t('death.allDead');
    new TextBox(this, 40, 64, 560, [...deaths, ending].join('\n\n'), { typewriter: true });
    addText(this, 40, 268, t('death.epitaphPrompt'), { color: COLORS.dim });
    const input = new NameInput(this, 40, 284, {
      maxLength: BEACONS.textMax,
      onCommit: (text) => {
        if (text.trim()) {
          saveBeacon(makeBeacon(s, lastDeceased(s) ?? s.crew[0]?.name ?? '', text));
          addText(this, 40, 308, t('death.beaconSaved'), { color: COLORS.dim });
          audio().sfx('beacon.chime');
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
