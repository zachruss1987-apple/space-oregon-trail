/** Fake AudioContext for AudioManager/Synth tests: records every node and param call. */
import type { BufferLike, BufferSourceLike, CtxLike, FilterLike, GainLike, OscLike, ParamLike } from '@/audio/synth';

export interface Call {
  fn: string;
  v?: number;
  t: number;
}

export class FakeParam implements ParamLike {
  calls: Call[] = [];
  constructor(public value = 1) {}
  setValueAtTime(v: number, t: number) {
    this.value = v;
    this.calls.push({ fn: 'set', v, t });
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.value = v;
    this.calls.push({ fn: 'lin', v, t });
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    this.value = v;
    this.calls.push({ fn: 'exp', v, t });
  }
  cancelScheduledValues(t: number) {
    this.calls.push({ fn: 'cancel', t });
  }
}

export class FakeNode {
  connected: unknown[] = [];
  disconnected = false;
  connect(d: unknown) {
    this.connected.push(d);
    return d;
  }
  disconnect() {
    this.disconnected = true;
  }
}

export class FakeGain extends FakeNode implements GainLike {
  gain = new FakeParam(1);
}
export class FakeOsc extends FakeNode implements OscLike {
  type = 'sine';
  frequency = new FakeParam(440);
  detune = new FakeParam(0);
  wave: unknown = null;
  started: number[] = [];
  stopped: number[] = [];
  setPeriodicWave(w: unknown) {
    this.wave = w;
  }
  start(t = 0) {
    this.started.push(t);
  }
  stop(t = 0) {
    this.stopped.push(t);
  }
}
export class FakeBufSrc extends FakeNode implements BufferSourceLike {
  buffer: unknown = null;
  loop = false;
  playbackRate = new FakeParam(1);
  started: number[] = [];
  stopped: number[] = [];
  start(t = 0) {
    this.started.push(t);
  }
  stop(t = 0) {
    this.stopped.push(t);
  }
}
export class FakeFilter extends FakeNode implements FilterLike {
  type = 'lowpass';
  frequency = new FakeParam(350);
}

export class FakeCtx implements CtxLike {
  currentTime = 0;
  state = 'suspended';
  sampleRate = 8000;
  destination = new FakeNode();
  resumeCalls = 0;
  refuseResume = false;
  gains: FakeGain[] = [];
  oscs: FakeOsc[] = [];
  sources: FakeBufSrc[] = [];
  async resume() {
    this.resumeCalls++;
    if (!this.refuseResume) this.state = 'running';
  }
  createGain() {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  createOscillator() {
    const o = new FakeOsc();
    this.oscs.push(o);
    return o;
  }
  createBufferSource() {
    const s = new FakeBufSrc();
    this.sources.push(s);
    return s;
  }
  createBuffer(_c: number, len: number): BufferLike {
    const data = new Float32Array(len);
    return { getChannelData: () => data };
  }
  createPeriodicWave(real: Float32Array, imag: Float32Array) {
    return { real, imag };
  }
  createBiquadFilter() {
    return new FakeFilter();
  }
}

export class FakeStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

export const noTimer = { every: () => 1, cancel: () => undefined };
