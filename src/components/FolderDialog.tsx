import { useEffect, useRef, useState } from "react"
import { X } from "lucide-react"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { buzz, pad, sheetCount, type Letter } from "@/lib/folders"
import { cn } from "@/lib/utils"
import { useSoftScroll } from "@/lib/useSoftScroll"

type Props = { letter: Letter | null; onClose: () => void }

export function FolderDialog({ letter, onClose }: Props) {
  // keep the last letter while the close animation plays
  const [shown, setShown] = useState<Letter | null>(letter)
  useEffect(() => { if (letter) setShown(letter) }, [letter])

  return (
    <Dialog open={!!letter} onOpenChange={o => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        onOpenAutoFocus={e => {
          // land on the sheets (arrow keys scroll straight away) rather than ringing the close button
          e.preventDefault()
          ;(e.currentTarget as HTMLElement).querySelector<HTMLElement>("[data-sheets]")?.focus({ preventScroll: true })
        }}
        className={cn(
          "inset-0 top-0 left-0 block h-dvh w-full max-w-none translate-x-0 translate-y-0 rounded-none border-0 bg-transparent p-0 shadow-none sm:max-w-none",
          "duration-300 data-[state=open]:zoom-in-[.97] data-[state=closed]:zoom-out-[.97]"
        )}
      >
        {shown && <OpenFolder key={shown} letter={shown} />}
      </DialogContent>
    </Dialog>
  )
}

/** Distance from the sheet in view → how soft a contents entry looks. */
const soften = (d: number) => ({
  filter: d === 0 ? "none" : `blur(${Math.min(0.9 + d * 0.7, 3.4).toFixed(2)}px)`,
  opacity: d === 0 ? 1 : Math.max(0.28, 0.78 - d * 0.14),
})

function OpenFolder({ letter }: { letter: Letter }) {
  const n = sheetCount(letter)
  const sheets = Array.from({ length: n }, (_, i) => i + 1)
  const scroller = useRef<HTMLDivElement>(null)
  const strip = useRef<HTMLOListElement>(null)
  const stripItems = useRef<Record<number, HTMLButtonElement | null>>({})
  const [active, setActive] = useState(1)
  const prevActive = useRef(1)
  useEffect(() => {
    if (active !== prevActive.current) buzz(4) // a faint bump as each sheet passes (Android)
    prevActive.current = active
  }, [active])
  const first = useRef(true)

  // Which sheet is under the reading line
  useEffect(() => {
    const root = scroller.current
    if (!root) return
    const io = new IntersectionObserver(
      entries => entries.forEach(e => e.isIntersecting && setActive(Number((e.target as HTMLElement).dataset.n))),
      { root, rootMargin: "-45% 0px -50% 0px" }
    )
    root.querySelectorAll("[data-n]").forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [letter])

  // The contents strip keeps the current sheet centred
  useEffect(() => {
    const list = strip.current, item = stripItems.current[active]
    if (!list || !item) return
    // the list starts at the top; only scroll it when the current entry would fall out of view
    const top = item.offsetTop, bottom = top + item.offsetHeight
    const behavior = first.current ? "auto" : "smooth"
    if (top < list.scrollTop) list.scrollTo({ top, behavior })
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTo({ top: bottom - list.clientHeight, behavior })
    first.current = false
  }, [active])

  // our own scroll physics: flows freely, then eases into the nearest sheet
  const soft = useSoftScroll(scroller, "[data-n]", [letter])

  const go = (s: number) => {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-n="${s}"]`)
    if (el) soft.current.to(el)
    setActive(s)
  }


  const entry = (s: number) => {
    const d = Math.abs(s - active)
    return (
      <li key={s} className="shrink-0">
        <button
          ref={el => { stripItems.current[s] = el }}
          type="button"
          onClick={() => go(s)}
          aria-current={d === 0 ? "true" : undefined}
          aria-label={`Sheet ${s} of ${n}`}
          style={soften(d)}
          className={cn(
            "rounded-md px-2 py-1.5 text-left outline-none md:px-3 transition-[filter,opacity,color] duration-300 focus-visible:ring-2 focus-visible:ring-white/70",
            d === 0 ? "font-normal text-white" : "font-light text-white/60"
          )}
        >
          <span className={cn("text-[15px] tabular-nums whitespace-nowrap", d === 0 && "text-[17px]")}>
            <span className="max-md:hidden">Sheet </span>{pad(s)}
          </span>
        </button>
      </li>
    )
  }

  return (
    <div className="relative h-full">
      {/* sheets: the whole screen scrolls; nothing frames them */}
      <div
        ref={scroller}
        data-sheets
        tabIndex={-1}
        className="absolute inset-0 touch-none overflow-hidden outline-none"
      >
        <div className="mx-auto flex flex-col items-center gap-6 px-6 pt-[calc(env(safe-area-inset-top,0px)+108px)] pb-[45vh] pl-[68px] pr-5 md:gap-8 md:px-6 md:pt-[140px]">
          {sheets.map((s, i) => (
            <article
              key={s}
              data-n={s}
              aria-label={`Sheet ${s} of ${n}`}
              style={{ animationDelay: `${80 + i * 45}ms` }}
              className="relative aspect-[1/1.32] w-[min(340px,calc(100vw-96px))] shrink-0 rounded-[2px] bg-white shadow-[0_1px_2px_rgb(0_0_0/0.15),0_24px_48px_-20px_rgb(0_0_0/0.55)] animate-in fade-in-0 slide-in-from-bottom-6 fill-mode-both duration-500"
            >
              <span className="absolute bottom-3 right-3.5 text-[10px] tabular-nums text-ink/30">
                {letter}{pad(s)}
              </span>
            </article>
          ))}
        </div>
      </div>

      {/* top: folder name, close, and the contents — all on a dark progressive blur */}
      <header className="blur-top-dark pointer-events-none absolute inset-x-0 top-0 z-20 pb-10 pt-[calc(env(safe-area-inset-top,0px)+28px)] md:pt-[max(16px,env(safe-area-inset-top,0px))]">
        <div className="pointer-events-auto mx-auto flex max-w-[440px] items-center justify-between pl-[max(16px,env(safe-area-inset-left,0px))] pr-[max(16px,env(safe-area-inset-right,0px))]">
          <div className="flex items-baseline gap-2.5">
            <DialogTitle className="text-[17px] font-semibold tracking-[-0.02em] text-white">Folder {letter}</DialogTitle>
            <DialogDescription className="text-xs tabular-nums text-white/60">{n} sheets</DialogDescription>
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="size-9 rounded-md text-white/85 hover:bg-transparent hover:text-white focus-visible:ring-2 focus-visible:ring-white/60" aria-label={`Close folder ${letter}`}>
              <X className="size-5" strokeWidth={2} />
            </Button>
          </DialogClose>
        </div>

      </header>

      {/* contents: a vertical picker down the left edge */}
      <nav
        aria-label="Folder contents"
        className="absolute bottom-0 top-[calc(env(safe-area-inset-top,0px)+102px)] md:top-[136px] z-10 left-[max(4px,env(safe-area-inset-left,0px))] w-16 md:left-[max(24px,calc(50%-380px))] md:w-40 animate-in fade-in-0 slide-in-from-left-2 fill-mode-both duration-500"
        style={{ animationDelay: "120ms" }}
      >
        <ol
          ref={strip}
          className="relative flex h-full flex-col overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-10 [mask-image:linear-gradient(#000_80%,transparent)]"
        >
          {sheets.map(s => entry(s))}
        </ol>
      </nav>
    </div>
  )
}
