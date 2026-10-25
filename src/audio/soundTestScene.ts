/** Dev preview (`?scene=soundtest`): list songs and SFX, number keys play them. Not part of the shipped flow. */
import Phaser from 'phaser';
import { markScene } from '../game/contract';
import { audio } from './AudioManager';
import { SFX } from './sfx';
import { SONG_IDS } from './songs';

export class SoundTestScene extends Phaser.Scene {
  private page: 'songs' | 'sfx' = 'songs';
  private text!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'SoundTest' });
  }

  create(): void {
    markScene('SoundTest');
    this.cameras.main.setBackgroundColor('#000000');
    this.text = this.add.text(12, 10, '', { fontFamily: 'monospace', fontSize: '14px', color: '#6f6', lineSpacing: 3 });
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e));
    this.render();
  }

  private items(): string[] {
    return this.page === 'songs' ? SONG_IDS : Object.keys(SFX);
  }

  private onKey(e: KeyboardEvent): void {
    const a = audio();
    void a.unlock();
    if (e.key === 'Tab') {
      e.preventDefault();
      this.page = this.page === 'songs' ? 'sfx' : 'songs';
    } else if (e.key === ' ') a.stopMusic();
    else if (e.key.toLowerCase() === 'm') a.toggleMute();
    else if (/^[0-9]$/.test(e.key)) {
      const id = this.items()[(Number(e.key) + 9) % 10];
      if (id) {
        if (this.page === 'songs') a.playMusic(id);
        else a.sfx(id);
      }
    }
    this.render();
  }

  private render(): void {
    const a = audio();
    const lines = [`SOUND TEST  [${this.page}]   Tab: switch  1-0: play  Space: stop music  M: mute`, `context: ${a.state}   music: ${a.playing ?? '-'}   muted: ${a.volumes.muted}`, ''];
    this.items().slice(0, 10).forEach((id, i) => lines.push(`${(i + 1) % 10}  ${id}`));
    this.text.setText(lines);
  }
}
