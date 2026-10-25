import { describe, expect, it } from 'vitest';
import { BULLETIN_TEXT, CONDITION_LIST, DEATH_TEXT, EVENT_LIST, EVENT_TEXT, WAYPOINTS } from '@/content';

describe('writer text covers the sim ids', () => {
  it('every event id has an events.json key', () => {
    for (const e of EVENT_LIST) expect(EVENT_TEXT, e.id).toHaveProperty([e.id]);
  });

  it('every condition id has a deaths.json key and an illness onset line', () => {
    for (const c of CONDITION_LIST) {
      expect(DEATH_TEXT, c.id).toHaveProperty([c.id]);
      expect(EVENT_TEXT, c.id).toHaveProperty([`illness.${c.id}`]);
    }
  });

  it('non-condition death causes have deaths.json keys', () => {
    for (const k of ['starvation', 'hazard', 'drift', 'hull_fire', 'adrift']) expect(DEATH_TEXT).toHaveProperty([k]);
  });

  it('every waypoint id has a bulletin', () => {
    for (const w of WAYPOINTS) expect(BULLETIN_TEXT, w.id).toHaveProperty([w.id]);
  });
});
