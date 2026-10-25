/** Song registry. To add a song: create `songs/<id>.ts` exporting a `SongDef` and list it below. */
import { parseSong } from '../tracker';
import type { ParsedSong, SongDef } from '../types';
import { title } from './title';
import { travel } from './travel';
import { station } from './station';
import { danger } from './danger';
import { hazard } from './hazard';
import { dirge } from './dirge';
import { fanfare } from './fanfare';
import { salvage } from './mgSalvage';
import { thread } from './mgThread';
import { flare } from './mgFlare';
import { jingleClean } from './jingleClean';

export const SONG_DEFS: SongDef[] = [title, travel, station, danger, hazard, dirge, fanfare, salvage, thread, flare, jingleClean];

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
