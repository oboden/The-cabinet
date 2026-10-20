import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import { FileText, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LETTERS, buzz, sheetCount, type Letter } from "@/lib/folders"
import { sound } from "@/lib/sound"
import { cn } from "@/lib/utils"

const CELL = 72        // px between letters — room to scroll through detents
const TICK = 9         // px between ticks (8 per letter)
const PER = CELL / TICK
const MAJOR = PER / 2  // the letter's own tick sits mid-cell

type Props = {
  value: Letter | null
  onChange: (l: Letter) => void
  onCommit: (l: Letter) => void
  onReset: () => void
  className?: string
}

/**
 * Horizontal tuning dial for A–Z, docked at the bottom.
 * Letters ride above the track and blur with distance from the indicator.
 */
export function LetterDial({ value, onChange, onCommit, onReset, className }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const letterEls = useRef<(HTMLSpanElement | null)[]>([])
  const target = useRef<number | null>(null)
  const targetTimer = useRef<number | undefined>(undefined)
  const raf = useRef<number | undefined>(undefined)
  const drag = useRef<{ x: number; left: number } | null>(null)
  const emitted = useRef<Letter | null>(null)
  const lastTick = useRef<number | null>(null)
  const valueRef = useRef(value)
  valueRef.current = value
  const [tick, setTick] = useState(0)

  const idxAt = () => {
    const el = ref.current
    return el ? Math.max(0, Math.min(25, Math.round(el.scrollLeft / CELL))) : 0
  }

  // Focus blur: sharp at the indicator, softer and fainter with distance
  const paint = useCallback(() => {
    const el = ref.current
    if (!el) return
    const x = el.scrollLeft
    letterEls.current.forEach((s, i) => {
      if (!s) return
      const d = Math.abs(i * CELL - x) / CELL // distance in letters
      const blur = Math.max(0, Math.min(4, (d - 0.15) * 2.6))
      s.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "none"
      s.style.opacity = String(Math.max(0.18, 1 - d * 0.32))
      s.style.transform = `scale(${(1.2 - Math.min(d, 1) * 0.2).toFixed(3)})`
    })
  }, [])

  const scrollToIndex = useCallback((i: number, smooth = true) => {
    const el = ref.current
    if (!el) return
    target.current = i
    window.clearTimeout(targetTimer.current)
    targetTimer.current = window.setTimeout(() => (target.current = null), 1000)
    el.scrollTo({ left: i * CELL, behavior: smooth ? "smooth" : "auto" })
  }, [])

  useLayoutEffect(paint, [paint])

  // Follow outside changes (search box, reset)
  useEffect(() => {
    if (value !== null && value === emitted.current) return
    emitted.current = null
    if (value === null) return // cleared: the dial stays where it is (Reset rewinds it)
    const i = LETTERS.indexOf(value)
    const el = ref.current
    if (el && Math.abs(el.scrollLeft - i * CELL) > 1) scrollToIndex(i)
  }, [value, scrollToIndex])

  const handleScroll = () => {
    if (raf.current) return
    raf.current = requestAnimationFrame(() => {
      raf.current = undefined
      const el = ref.current
      if (!el) return
      paint()
      const t = Math.round(el.scrollLeft / TICK)
      if (t !== lastTick.current) {
        // only a hand on the dial clicks; glides driven by search or the cabinet stay silent
        if (lastTick.current !== null && target.current === null) sound.tick(t % PER === 0)
        lastTick.current = t
        setTick(t)
      }
      const i = idxAt()
      if (target.current !== null) {
        if (i === target.current && Math.abs(el.scrollLeft - i * CELL) < 2) { target.current = null; window.clearTimeout(targetTimer.current) }
        return
      }
      if (LETTERS[i] !== valueRef.current) {
        emitted.current = LETTERS[i]
        valueRef.current = LETTERS[i]
        onChange(LETTERS[i])
        buzz()
      }
    })
  }

  const takeOver = () => { target.current = null; window.clearTimeout(targetTimer.current) }

  // Mouse drag (touch already scrolls natively)
  const onPointerDown = (e: PointerEvent) => {
    takeOver()
    if (e.pointerType !== "mouse" || !ref.current) return
    drag.current = { x: e.clientX, left: ref.current.scrollLeft }
    ref.current.style.scrollSnapType = "none"
    ref.current.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent) => {
    if (!drag.current || !ref.current) return
    ref.current.scrollLeft = drag.current.left - (e.clientX - drag.current.x)
  }
  const endDrag = () => {
    if (!drag.current || !ref.current) return
    drag.current = null
    ref.current.style.scrollSnapType = ""
    ref.current.scrollTo({ left: idxAt() * CELL, behavior: "smooth" })
  }

  const pick = (i: number) => {
    if (value && LETTERS[i] === value) return onCommit(value)
    onChange(LETTERS[i])
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const cur = value ? LETTERS.indexOf(value) : -1
    let next: number | null = null
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = Math.min(25, cur + 1)
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = Math.max(0, cur - 1)
    if (e.key === "Home") next = 0
    if (e.key === "End") next = 25
    if (next !== null) { e.preventDefault(); onChange(LETTERS[next]); return }
    if ((e.key === "Enter" || e.key === " ") && value) { e.preventDefault(); onCommit(value) }
  }

  const set = value !== null
  const lit = (g: number) => set && g <= tick + MAJOR // tick g is at or before the indicator

  return (
    <div data-keep-open className={cn("relative mx-auto w-full max-w-[400px]", className)}>
      {/* the dark track */}
      <div className="absolute inset-x-0 bottom-0 h-11 rounded-full bg-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.08),inset_0_-3px_0_rgb(0_0_0/0.45),0_14px_30px_-12px_rgb(20_20_19/0.5)]" />

      <div className="relative grid grid-cols-[44px_minmax(0,1fr)_44px] items-end">
        {/* readout: sheets in the focused folder */}
        <div className="flex h-11 items-center justify-center gap-0.5 text-white/90" aria-hidden="true">
          <FileText className={cn("size-3", set ? "text-signal-soft" : "text-white/35")} />
          <span className={cn("text-[13px] font-medium tabular-nums", set ? "text-signal-soft" : "text-white/35")}>
            {value ? sheetCount(value) : "–"}
          </span>
        </div>

        <div className="relative">
          {/* indicator */}
          <div className={cn(
            "pointer-events-none absolute bottom-[9px] left-1/2 z-10 h-[26px] w-[2px] -translate-x-1/2 rounded-full transition-colors",
            set ? "bg-signal-soft" : "bg-white/70"
          )} />

          <div
            ref={ref}
            role="slider"
            tabIndex={0}
            aria-label="Letter dial"
            aria-orientation="horizontal"
            aria-valuemin={1}
            aria-valuemax={26}
            aria-valuenow={value ? LETTERS.indexOf(value) + 1 : undefined}
            aria-valuetext={value ? `Folder ${value}, ${sheetCount(value)} sheets. Press Enter to open.` : "No folder selected"}
            onScroll={handleScroll}
            onWheel={takeOver}
            onTouchStart={takeOver}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={onKeyDown}
            className={cn(
              "flex snap-x snap-mandatory overflow-x-scroll overscroll-contain outline-none select-none",
              "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              "cursor-grab active:cursor-grabbing rounded-full",
              "focus-visible:[&_.dial-track]:ring-2 focus-visible:[&_.dial-track]:ring-signal-soft/60",
              "[mask-image:linear-gradient(90deg,transparent,#000_18%,#000_82%,transparent)]"
            )}
          >
            <div className="shrink-0" style={{ width: `calc(50% - ${CELL / 2}px)` }} aria-hidden="true" />
            {LETTERS.map((l, i) => (
              <div
                key={l}
                onClick={() => pick(i)}
                className="flex shrink-0 snap-center flex-col items-center"
                style={{ width: CELL }}
                aria-hidden="true"
              >
                {/* letter, outside the track */}
                <span className="grid h-8 place-items-center">
                  <span
                    ref={el => { letterEls.current[i] = el }}
                    className={cn(
                      "block text-[15px] font-semibold leading-none tracking-tight will-change-[filter,transform]",
                      set && i === LETTERS.indexOf(value!) ? "text-signal" : "text-ink"
                    )}
                  >
                    {l}
                  </span>
                </span>
                {/* ticks, inside the track */}
                <span className="dial-track relative h-11 w-full">
                  {Array.from({ length: PER }, (_, k) => {
                    const g = i * PER + k
                    const major = k === MAJOR
                    const active = major && set && LETTERS[i] === value
                    return (
                      <span
                        key={k}
                        className={cn(
                          "absolute top-1/2 w-px -translate-y-1/2 rounded-full transition-colors duration-100",
                          major ? (active ? "h-[18px] w-[2px] bg-signal-soft" : "h-3.5") : "h-2",
                          !active && (lit(g) ? "bg-signal-soft" : major ? "bg-white/45" : "bg-white/22")
                        )}
                        style={{ left: k * TICK }}
                      />
                    )
                  })}
                </span>
              </div>
            ))}
            <div className="shrink-0" style={{ width: `calc(50% - ${CELL / 2}px)` }} aria-hidden="true" />
          </div>
        </div>

        <div className="flex h-11 items-center justify-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => { onReset(); scrollToIndex(0); buzz(10) }}
            disabled={!value}
            aria-label="Reset dial"
            className="size-8 rounded-full text-white/85 hover:bg-white/10 hover:text-white disabled:opacity-30"
          >
            <RotateCcw className="size-[14px]" />
          </Button>
        </div>
      </div>
    </div>
  )
}
