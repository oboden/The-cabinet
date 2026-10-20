import { useEffect, useRef, type RefObject } from "react"

/**
 * Owns the scrolling of a container so it can glide into "snap" points
 * without the stop-then-move jerk of native scroll snapping.
 *
 * - Motion is a critically damped spring: it keeps the speed you let go with
 *   and eases into the target with no overshoot.
 * - Wheel/trackpad: the target follows the wheel; once input pauses the
 *   target moves to the nearest snap point, and the spring simply bends there.
 * - Touch: the content tracks the finger 1:1; on release the flick is
 *   projected forward and the nearest snap point to that landing is chosen.
 */
export function useSoftScroll(
  ref: RefObject<HTMLElement | null>,
  snapSelector: string,
  deps: unknown[] = []
) {
  const api = useRef<{ to: (el: HTMLElement) => void; step: (dir: 1 | -1) => void }>({ to: () => {}, step: () => {} })

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches

    const STIFF = 110                      // lower = softer, slower arrival
    const DAMP = 2 * Math.sqrt(STIFF)      // critical: no bounce
    let x = root.scrollTop, v = 0, target = x
    let raf = 0, last = 0
    let idle: number | undefined

    const max = () => Math.max(0, root.scrollHeight - root.clientHeight)
    const clamp = (n: number) => Math.max(0, Math.min(max(), n))
    const snaps = () =>
      [...root.querySelectorAll<HTMLElement>(snapSelector)].map(el =>
        clamp(el.offsetTop - (root.clientHeight - el.offsetHeight) / 2)
      )
    const nearest = (p: number) => {
      const pts = snaps()
      if (!pts.length) return clamp(p)
      return pts.reduce((a, b) => (Math.abs(b - p) < Math.abs(a - p) ? b : a))
    }

    const frame = (now: number) => {
      const dt = Math.min(0.034, (now - last) / 1000 || 0.016)
      last = now
      // semi-implicit Euler, two sub-steps for stability on slow frames
      for (let i = 0; i < 2; i++) {
        const h = dt / 2
        v += (STIFF * (target - x) - DAMP * v) * h
        x += v * h
      }
      root.scrollTop = x
      if (Math.abs(target - x) < 0.3 && Math.abs(v) < 3) {
        x = target; v = 0; root.scrollTop = x; raf = 0
        return
      }
      raf = requestAnimationFrame(frame)
    }
    const run = () => {
      if (reduce) { x = target; v = 0; root.scrollTop = x; return }
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame) }
    }
    const halt = () => { cancelAnimationFrame(raf); raf = 0 }
    /**
     * Where to come to rest: any deliberate movement away from the sheet you
     * started on carries on to the next one in that direction (or further,
     * for a long scroll); only a small nudge falls back.
     */
    const resolve = (p: number, from: number) => {
      const pts = snaps()
      const gap = pts.length > 1 ? Math.abs(pts[1] - pts[0]) || 400 : 400
      const d = p - from
      if (Math.abs(d) < gap * 0.15) return from // a nudge: settle back
      const dir = Math.sign(d)
      const ahead = pts.filter(s => (s - from) * dir > 1)
      if (!ahead.length) return clamp(p)
      return ahead.reduce((a, b) => (Math.abs(b - p) < Math.abs(a - p) ? b : a))
    }
    let anchor: number | null = null // the sheet a gesture started from

    const settleSoon = (ms = 140) => {
      window.clearTimeout(idle)
      idle = window.setTimeout(() => {
        target = resolve(target, anchor ?? nearest(target))
        anchor = null
        run()
      }, ms)
    }

    // ---- wheel / trackpad
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return // pinch-zoom
      e.preventDefault()
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? root.clientHeight : 1
      if (anchor === null) anchor = nearest(target)
      target = clamp(target + e.deltaY * unit)
      run()
      settleSoon()
    }

    // ---- touch
    let touch: { y: number; x0: number; samples: [number, number][] } | null = null
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      window.clearTimeout(idle)
      halt()
      v = 0
      target = x = root.scrollTop
      anchor = nearest(x)
      touch = { y: e.touches[0].clientY, x0: x, samples: [[performance.now(), x]] }
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!touch) return
      e.preventDefault()
      x = target = clamp(touch.x0 - (e.touches[0].clientY - touch.y))
      root.scrollTop = x
      const now = performance.now()
      touch.samples.push([now, x])
      while (touch.samples.length > 2 && now - touch.samples[0][0] > 90) touch.samples.shift()
    }
    const onTouchEnd = () => {
      if (!touch) return
      const s = touch.samples
      const [t0, p0] = s[0], [t1, p1] = s[s.length - 1]
      const vel = t1 - t0 > 8 && performance.now() - t1 < 60 ? ((p1 - p0) / (t1 - t0)) * 1000 : 0 // px/s
      touch = null
      v = vel
      target = resolve(x + vel * 0.28, anchor ?? nearest(x)) // where the flick would land, rounded to a sheet
      anchor = null
      run()
    }

    // ---- keys
    const step = (dir: 1 | -1) => {
      const pts = snaps()
      const cur = nearest(target)
      const i = pts.indexOf(cur)
      target = pts[Math.max(0, Math.min(pts.length - 1, i + dir))] ?? cur
      run()
    }
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowDown", "PageDown", " "].includes(e.key)) { e.preventDefault(); step(1) }
      else if (["ArrowUp", "PageUp"].includes(e.key)) { e.preventDefault(); step(-1) }
      else if (e.key === "Home") { e.preventDefault(); target = 0; run() }
      else if (e.key === "End") { e.preventDefault(); target = max(); run() }
    }

    const onResize = () => { target = nearest(target); run() }

    root.addEventListener("wheel", onWheel, { passive: false })
    root.addEventListener("touchstart", onTouchStart, { passive: true })
    root.addEventListener("touchmove", onTouchMove, { passive: false })
    root.addEventListener("touchend", onTouchEnd)
    root.addEventListener("touchcancel", onTouchEnd)
    root.addEventListener("keydown", onKey)
    window.addEventListener("resize", onResize)

    api.current = {
      to: el => { window.clearTimeout(idle); target = clamp(el.offsetTop - (root.clientHeight - el.offsetHeight) / 2); run() },
      step,
    }

    return () => {
      halt(); window.clearTimeout(idle)
      root.removeEventListener("wheel", onWheel)
      root.removeEventListener("touchstart", onTouchStart)
      root.removeEventListener("touchmove", onTouchMove)
      root.removeEventListener("touchend", onTouchEnd)
      root.removeEventListener("touchcancel", onTouchEnd)
      root.removeEventListener("keydown", onKey)
      window.removeEventListener("resize", onResize)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return api
}
