/**
 * Tiny synthesized sound kit (Web Audio, no files).
 * Browsers only allow audio after the first tap/click/key, so the context is
 * created lazily and unlocked on the first interaction.
 */

let ctx: AudioContext | null = null
let master: GainNode | null = null
let noise: AudioBuffer | null = null
let muted = readMuted()
let lastTick = 0

function readMuted() {
  try { return localStorage.getItem("cabinet:muted") === "1" } catch { return false }
}

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.9
    master.connect(ctx.destination)
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  if (ctx.state === "suspended") void ctx.resume()
  return ctx
}

/** Call once at startup: unlocks audio on the first user gesture. */
export function primeAudio() {
  const unlock = () => { ac(); window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock) }
  window.addEventListener("pointerdown", unlock, { passive: true })
  window.addEventListener("keydown", unlock)
}

export const isMuted = () => muted
export function setMuted(m: boolean) {
  muted = m
  try { localStorage.setItem("cabinet:muted", m ? "1" : "0") } catch { /* storage blocked */ }
}

function ready() {
  if (muted) return null
  const c = ac()
  return c && c.state === "running" && master && noise ? c : null
}

/** Filtered noise burst with an attack/decay envelope. */
function burst(c: AudioContext, opts: {
  at?: number; dur: number; gain: number; type?: BiquadFilterType; freq: number; freqTo?: number; q?: number
}) {
  const t = c.currentTime + (opts.at ?? 0)
  const src = c.createBufferSource()
  src.buffer = noise!
  const f = c.createBiquadFilter()
  f.type = opts.type ?? "bandpass"
  f.frequency.setValueAtTime(opts.freq, t)
  if (opts.freqTo) f.frequency.exponentialRampToValueAtTime(opts.freqTo, t + opts.dur)
  f.Q.value = opts.q ?? 1
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(opts.gain, t + Math.min(0.006, opts.dur / 4))
  g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur)
  src.connect(f).connect(g).connect(master!)
  src.start(t, Math.random() * 0.5)
  src.stop(t + opts.dur + 0.02)
}

/** Short sine/triangle blip. */
function tone(c: AudioContext, opts: { at?: number; dur: number; gain: number; freq: number; freqTo?: number; type?: OscillatorType }) {
  const t = c.currentTime + (opts.at ?? 0)
  const o = c.createOscillator()
  o.type = opts.type ?? "sine"
  o.frequency.setValueAtTime(opts.freq, t)
  if (opts.freqTo) o.frequency.exponentialRampToValueAtTime(opts.freqTo, t + opts.dur)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(opts.gain, t + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur)
  o.connect(g).connect(master!)
  o.start(t)
  o.stop(t + opts.dur + 0.02)
}

export const sound = {
  /** Dial detent. `major` = landing on a letter. */
  tick(major = false) {
    const c = ready(); if (!c) return
    const now = performance.now()
    if (!major && now - lastTick < 22) return // don't machine-gun on fast flicks
    lastTick = now
    burst(c, { dur: major ? 0.022 : 0.012, gain: major ? 0.32 : 0.16, freq: major ? 2600 : 4200, q: 2.5 })
    if (major) tone(c, { dur: 0.03, gain: 0.07, freq: 1500, freqTo: 1100, type: "triangle" })
  },

  /** A folder lifts up out of the stack (paper swish + soft thump). */
  rise() {
    const c = ready(); if (!c) return
    // deliberately quiet: a faint brush of paper, felt more than heard
    burst(c, { dur: 0.14, gain: 0.035, freq: 1400, freqTo: 3200, type: "highpass", q: 0.5 })
    tone(c, { at: 0.02, dur: 0.06, gain: 0.018, freq: 210, freqTo: 170 })
  },

  /** A folder opens (longer paper slide, then a light two-note pop). */
  open() {
    const c = ready(); if (!c) return
    // one soft "thup" of a folder leaving the stack — noise and body start together
    burst(c, { dur: 0.16, gain: 0.06, freq: 1600, freqTo: 650, type: "lowpass", q: 0.6 })
    tone(c, { dur: 0.1, gain: 0.03, freq: 260, freqTo: 190 })
  },

  /** Folder closes (quick reverse swish). */
  close() {
    const c = ready(); if (!c) return
    burst(c, { dur: 0.18, gain: 0.14, freq: 900, freqTo: 2400, type: "lowpass", q: 0.7 })
    tone(c, { at: 0.08, dur: 0.08, gain: 0.08, freq: 220, freqTo: 150 })
  },

  /** Drawer rolling on its rails, ending in a soft clunk. */
  drawer(opening: boolean) {
    const c = ready(); if (!c) return
    const dur = 0.75
    for (let i = 0; i < 9; i++) {
      burst(c, { at: i * (dur / 10), dur: 0.05, gain: 0.05 + Math.random() * 0.03, freq: 380 + Math.random() * 160, q: 3 })
    }
    burst(c, { dur, gain: 0.05, freq: 900, freqTo: opening ? 500 : 1200, type: "lowpass" })
    tone(c, { at: dur, dur: 0.14, gain: 0.22, freq: 110, freqTo: 70 })
    burst(c, { at: dur, dur: 0.05, gain: 0.12, freq: 1200, q: 1.5 })
  },
}
