/**
 * The global mute key (audio.md "Mixing", T-063): `M` toggles `audio().isMuted` anywhere except the Title scene (its
 * hidden `M` toggles mini-game auto-resolve) and while a text field takes input (NameInput, NumberInput, the save
 * export / import boxes). The change is read into the live region.
 */
import { audio, bindGlobalMuteKey } from '@/audio/AudioManager';
import { t } from '@/ui/copy';
import { textEntryActive } from '@/ui/keys';
import { announce } from './a11y';

/** True while the Title scene is showing (its own `M` hotkey wins there). */
export const onTitle = (): boolean => typeof document !== 'undefined' && document.body.dataset['scene'] === 'Title';

/** Install once at boot. Returns an unbind function. */
export function bindMuteKey(target: Window = window): () => void {
  const unbind = bindGlobalMuteKey('m', textEntryActive, { ignore: onTitle, target });
  let was = audio().isMuted;
  // Runs after the mute listener (registered first), so it sees the new state.
  const speak = (): void => {
    const now = audio().isMuted;
    if (now !== was) announce(t(now ? 'a11y.muted' : 'a11y.unmuted'));
    was = now;
  };
  target.addEventListener('keydown', speak);
  return () => {
    unbind();
    target.removeEventListener('keydown', speak);
  };
}
