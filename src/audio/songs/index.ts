/** Song registry. To add a song: create `songs/<id>.ts` exporting a `SongDef` and list it below. */
import { parseSong } from '../tracker';
import type { ParsedSong, SongDef } from '../types';
import { title } from './title';
import { travel } from './travel';

export const SONG_DEFS: SongDef[] = [title, travel];

export const SONG_IDS: string[] = SONG_DEFS.map((s) => s.id);

const cache = new Map<string, ParsedSong>();

/** Parsed song by id (cached). Throws on unknown id or a parse error. */
export function getSong(id: string): ParsedSong {
  let s = cache.get(id);
  if (!s) {
    const def = SONG_DEFS.find((d) => d.id === id);
    if (!def) throw new Error(`unknown song "${id}"`);
    s = parseSong(def);
    cache.set(id, s);
  }
  return s;
}
