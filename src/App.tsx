import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react"
import { ArrowUpRight, Search, Volume2, VolumeX, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { Cabinet } from "@/components/Cabinet"
import { LetterDial } from "@/components/LetterDial"
import { FolderDialog } from "@/components/FolderDialog"
import { LETTERS, firstLetter, sheetCount, type Letter } from "@/lib/folders"
import { isMuted, primeAudio, setMuted, sound } from "@/lib/sound"
import { cn } from "@/lib/utils"

const TOTAL_SHEETS = LETTERS.reduce((n, l) => n + sheetCount(l), 0)
const canHover = () => window.matchMedia("(hover: hover)").matches

export default function App() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [focused, setFocused] = useState<Letter | null>(null)
  const [pulled, setPulled] = useState<Letter | null>(null)
  const [openLetter, setOpenLetter] = useState<Letter | null>(null)
  const [query, setQuery] = useState("")
  const [muted, setMutedState] = useState(isMuted)
  const inputRef = useRef<HTMLInputElement>(null)
  const busy = useRef(false)

  // Centre the cabinet together with where its tray will reach, in the free space
  // between the search bar and the dial. It then never moves: only the tray slides.
  const formRef = useRef<HTMLFormElement>(null)
  const idleRef = useRef<HTMLDivElement>(null)
  const [idleShift, setIdleShift] = useState({ x: 0, y: 0 })
  const shiftRef = useRef(idleShift)
  shiftRef.current = idleShift
  const [placed, setPlaced] = useState(false) // no glide for the very first placement

  const parsed = firstLetter(query)

  useEffect(primeAudio, [])

  // A folder coming up makes its own sound, whatever raised it
  const prevFocused = useRef<Letter | null>(null)
  const quietRise = useRef(false) // set when a folder is opened straight from the cabinet
  useEffect(() => {
    if (focused && focused !== prevFocused.current && !quietRise.current) sound.rise()
    quietRise.current = false
    prevFocused.current = focused
  }, [focused])

  const setDrawer = (open: boolean) => {
    if (open !== drawerOpen) sound.drawer(open)
    setDrawerOpen(open)
  }

  // When the drawer is shut, pull it open first and only then raise the folder.
  const DRAWER_MS = 1050
  const pending = useRef<Letter | null>(null)
  const pendingTimer = useRef<number | undefined>(undefined)
  const clearPending = () => {
    window.clearTimeout(pendingTimer.current)
    pendingTimer.current = undefined
    pending.current = null
  }

  const focusLetter = (l: Letter | null) => {
    if (!l) { clearPending(); setFocused(null); return }
    if (drawerOpen && pendingTimer.current === undefined) { setFocused(l); return }
    pending.current = l // latest choice wins if more is typed while the drawer moves
    if (!drawerOpen) setDrawer(true)
    if (pendingTimer.current === undefined) {
      pendingTimer.current = window.setTimeout(() => {
        const next = pending.current
        clearPending()
        setFocused(next)
      }, DRAWER_MS)
    }
  }

  const openFolder = (l: Letter) => {
    if (busy.current || openLetter) return
    busy.current = true
    const pull = () => {
      if (focused !== l) quietRise.current = true // opening is its own sound
      setFocused(l)
      setPulled(l)
      sound.open()
      window.setTimeout(() => { setOpenLetter(l); busy.current = false }, 380)
    }
    if (!drawerOpen || pendingTimer.current !== undefined) {
      // drawer first, then the folder rises, then it comes out
      clearPending()
      if (!drawerOpen) setDrawer(true)
      window.setTimeout(() => { setFocused(l); window.setTimeout(pull, 420) }, DRAWER_MS)
    } else pull()
  }

  const closeFolder = () => {
    sound.close()
    setOpenLetter(null)
    // the folder drops all the way back into the drawer, nothing left standing
    window.setTimeout(() => { setPulled(null); focusLetter(null); setQuery("") }, 220)
  }

  const toggleDrawer = () => {
    if (drawerOpen) { clearPending(); setFocused(null); setQuery("") }
    setDrawer(!drawerOpen)
  }

  useLayoutEffect(() => {
    if (drawerOpen) return
    const measure = () => {
      const wrap = idleRef.current, form = formRef.current
      const dial = document.querySelector("[data-keep-open]")
      if (!wrap || !form || !dial) return
      let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity
      wrap.querySelectorAll(".cab-front, .cab-top, .cab-side, .cab-ghost").forEach(el => {
        const q = el.getBoundingClientRect()
        if (!q.width) return
        l = Math.min(l, q.left); r = Math.max(r, q.right); t = Math.min(t, q.top); b = Math.max(b, q.bottom)
      })
      if (!isFinite(l)) return
      // subtract whatever offset is applied right now (even mid-transition) to get the resting spot
      const m = new DOMMatrixReadOnly(getComputedStyle(wrap).transform === "none" ? undefined : getComputedStyle(wrap).transform)
      const restX = (l + r) / 2 - m.m41
      const restY = (t + b) / 2 - m.m42
      const midY = (form.getBoundingClientRect().bottom + dial.getBoundingClientRect().top) / 2
      // centred when it fits; on narrow screens keep the tray end on screen and let the cabinet's back run off the left
      const vw = window.innerWidth, w = r - l, edge = 10
      const x = Math.round(w <= vw - edge * 2 ? vw / 2 - restX : (vw - edge) - (r - m.m41))
      const y = Math.round(Math.max(0, midY - restY))
      const cur = shiftRef.current
      if (Math.abs(x - cur.x) > 1 || Math.abs(y - cur.y) > 1) setIdleShift({ x, y })
      requestAnimationFrame(() => setPlaced(true))
    }
    // re-measure once the cabinet has scaled itself to the column, and on any resize
    const raf = requestAnimationFrame(() => requestAnimationFrame(measure))
    const ro = new ResizeObserver(() => requestAnimationFrame(measure))
    const wrap = idleRef.current
    if (wrap) ro.observe(wrap)
    // after the drawer finishes sliding shut, take the final reading
    const onDone = (e: TransitionEvent) => { if (e.target !== wrap) measure() }
    wrap?.addEventListener("transitionend", onDone)
    const late = window.setTimeout(measure, 1200)
    window.addEventListener("resize", measure)
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); window.clearTimeout(late)
      wrap?.removeEventListener("transitionend", onDone)
      window.removeEventListener("resize", measure)
    }
  }, [drawerOpen])

  // A click anywhere that isn't the cabinet or a control pushes the drawer shut.
  useEffect(() => {
    if (!drawerOpen || openLetter) return
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null
      if (!t || busy.current) return
      if (t.closest(".cab-rig, form, button, input, a, [role=slider], [role=dialog], [data-keep-open]")) return
      toggleDrawer()
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  })

  const onQuery = (v: string) => {
    setQuery(v)
    const p = firstLetter(v)
    if (p === null || p === "invalid") focusLetter(null)
    else focusLetter(p)
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const l = pending.current ?? focused
    if (l) openFolder(l)
    else inputRef.current?.focus()
  }

  const toggleMute = () => {
    const m = !muted
    setMuted(m)
    setMutedState(m)
    if (!m) sound.tick(true)
  }

  // Typing anywhere goes to search; "/" focuses it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (openLetter || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement
      if (t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.getAttribute("role") === "slider") return
      if (e.key === "/") { e.preventDefault(); inputRef.current?.focus(); return }
      if (/^[a-z]$/i.test(e.key)) {
        e.preventDefault()
        inputRef.current?.focus({ preventScroll: true })
        onQuery(e.key)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const status =
    parsed === "invalid" ? (
      <>Nothing is filed under “{query.trim().charAt(0)}”. Folders run A to Z.</>
    ) : focused ? (
      <><b className="font-semibold text-signal">{focused}</b> is up · {canHover() ? "press Enter or click it" : "tap it"} to open</>
    ) : drawerOpen ? (
      <>Turn the dial or type to find a folder.</>
    ) : (
      <>Pull the drawer, turn the dial, or start typing.</>
    )

  return (
    <>
      <header className="blur-top sticky top-[env(safe-area-inset-top,0px)] z-30 pb-8 pt-4 pl-[max(16px,env(safe-area-inset-left,0px))] pr-[max(16px,env(safe-area-inset-right,0px))]">
        <div className="mx-auto grid max-w-[440px] gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-[17px] font-semibold tracking-[-0.02em]">The Cabinet</h1>
            <div className="flex items-center gap-2">
              <span className="text-xs tabular-nums text-graphite">26 folders · {TOTAL_SHEETS} sheets</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={toggleMute}
                aria-pressed={!muted}
                aria-label={muted ? "Turn sound on" : "Turn sound off"}
                className="rounded-full text-graphite hover:text-ink"
              >
                {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              </Button>
            </div>
          </div>

          <form ref={formRef} role="search" onSubmit={onSubmit} className="flex gap-1.5" autoComplete="off">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-graphite" />
              <label htmlFor="q" className="sr-only">Search folders by name</label>
              <Input
                id="q"
                ref={inputRef}
                type="search"
                enterKeyHint="go"
                spellCheck={false}
                value={query}
                onChange={e => onQuery(e.target.value)}
                onKeyDown={e => { if (e.key === "Escape") { onQuery(""); e.currentTarget.blur() } }}
                placeholder="Search folders"
                aria-invalid={parsed === "invalid" || undefined}
                className={cn(
                  "h-10 rounded-full border-ink/12 bg-wash/80 pl-9 pr-10 text-[15px] md:text-sm",
                  "shadow-none focus-visible:border-signal focus-visible:bg-white focus-visible:ring-signal/15"
                )}
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => { onQuery(""); inputRef.current?.focus() }}
                  aria-label="Clear search"
                  className="absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-graphite outline-none hover:bg-ink/5 focus-visible:ring-2 focus-visible:ring-signal"
                >
                  <X className="size-3.5" />
                </button>
              ) : (
                <Kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 border border-ink/10 bg-white max-sm:hidden">/</Kbd>
              )}
            </div>
            <Button type="submit" variant="ink" className="h-10 rounded-full px-4 text-sm">
              {focused ? <>Open {focused}<ArrowUpRight className="size-3.5" /></> : "Search"}
            </Button>
          </form>

          <p aria-live="polite" className="sr-only">{status}</p>
        </div>
      </header>

      <main className="-mt-6 pb-48 pl-[max(16px,env(safe-area-inset-left,0px))] pr-[max(16px,env(safe-area-inset-right,0px))]">
        <div
          ref={idleRef}
          className={cn("mx-auto max-w-[900px]", placed && "transition-transform duration-[1100ms] ease-[cubic-bezier(.62,0,.18,1)]")}
          style={{ transform: `translate(${idleShift.x}px, ${idleShift.y}px)` }}
        >
          <Cabinet
            open={drawerOpen}
            focused={focused}
            pulled={pulled}
            onToggle={toggleDrawer}
            onOpenFolder={openFolder}
          />
        </div>
      </main>

      <div className="blur-bottom fixed inset-x-0 bottom-0 z-30 pt-10 pb-[max(14px,env(safe-area-inset-bottom,0px))] pl-[max(12px,env(safe-area-inset-left,0px))] pr-[max(12px,env(safe-area-inset-right,0px))]">
        <LetterDial
          value={focused}
          onChange={l => { setQuery(""); focusLetter(l) }}
          onCommit={openFolder}
          onReset={() => { setQuery(""); focusLetter(null) }}
        />
      </div>

      <FolderDialog letter={openLetter} onClose={closeFolder} />
    </>
  )
}
