/**
 * Corner mute indicator (art.md `ui.icon.mute`): shown while audio is muted (the `M` key) or still locked before the
 * first gesture (audio.md "Autoplay unlock"), hidden otherwise. Call `update()` each frame. The state is also spoken by
 * the mute key (src/game/muteKey.ts) and exposed as `__PROXIMA__.audio.volumes.muted`.
 */
import type Phaser from 'phaser';
import { audio } from '@/audio/AudioManager';

export interface MuteIcon {
  update(): void;
}

export function muteIcon(scene: Phaser.Scene, x: number, y: number, depth = 10): MuteIcon {
  const img = scene.add.image(x, y, 'ui.icon.mute', 0).setOrigin(0, 0).setDepth(depth);
  const update = (): void => {
    const a = audio();
    if (img.active) img.setVisible(a.isMuted || a.state === 'locked');
  };
  update();
  return { update };
}
