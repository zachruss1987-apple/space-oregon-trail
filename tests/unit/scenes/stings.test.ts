import { describe, expect, it } from 'vitest';
import { WAYPOINTS } from '@/content';
import { dangerSting, hazardArrival, LOSS_EVENT_IDS } from '@/scenes/stings';

describe('danger sting rules (T-063)', () => {
  it('loss events, crossing damage and deaths sting; gains, illness, clean crossings and travel do not', () => {
    expect(LOSS_EVENT_IDS.has('pirates')).toBe(true);
    expect(LOSS_EVENT_IDS.has('derelict')).toBe(false);
    expect(dangerSting([{ kind: 'event', id: 'pirates' }])).toBe(true);
    expect(dangerSting([{ kind: 'travel' }, { kind: 'death', id: 'scurvy' }])).toBe(true);
    expect(dangerSting([{ kind: 'hazard', id: 'damage' }])).toBe(true);
    expect(dangerSting([{ kind: 'hazard', id: 'clear' }])).toBe(false);
    expect(dangerSting([{ kind: 'event', id: 'derelict' }, { kind: 'condition', id: 'scurvy' }, { kind: 'travel' }])).toBe(false);
    expect(dangerSting([{ kind: 'event' }])).toBe(false);
    expect(dangerSting([])).toBe(false);
  });

  it('arriving at a hazard waypoint stings; stations and nothing do not', () => {
    const hazard = WAYPOINTS.find((w) => w.type === 'hazard')!;
    const station = WAYPOINTS.find((w) => w.type === 'station')!;
    expect(hazardArrival(hazard.index)).toBe(true);
    expect(hazardArrival(station.index)).toBe(false);
    expect(hazardArrival(null)).toBe(false);
  });
});
