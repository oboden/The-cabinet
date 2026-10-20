import { useEffect, useRef, type CSSProperties } from "react"
import { LETTERS, sheetCount, tabSlot, type Letter } from "@/lib/folders"

const STAGE_W = 560
const TAB_X = [14, 106, 198]

type Props = {
  open: boolean
  focused: Letter | null
  pulled: Letter | null
  onToggle: () => void
  onOpenFolder: (l: Letter) => void
}

export function Cabinet({ open, focused, pulled, onToggle, onOpenFolder }: Props) {
  const stageRef = useRef<HTMLDivElement>(null)

  // Scale the fixed-size 3D drawing to whatever width the column gives it.
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const s = Math.min(0.86, e.contentRect.width / STAGE_W)
      el.style.setProperty("--scale", s.toFixed(4))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={stageRef} className="cab-stage" data-open={open}>
      <div className="cab-camera">
        <div className="cab-world" data-focused={!!focused}>
          <div className="cab-rig">
            <div className="cab-face cab-floor" />

            <div className="cab-face cab-top" />
            <div className="cab-face cab-side" />
            <div className="cab-face cab-side cab-side--r" />
            <div className="cab-face cab-cav cab-cav--back" />
            <div className="cab-face cab-cav cab-cav--top" />
            <div className="cab-face cab-cav cab-cav--bottom" />
            <div className="cab-face cab-cav cab-cav--l" />
            <div className="cab-face cab-cav cab-cav--r" />
            <div className="cab-face cab-front" />

            <div className="cab-drawer">
              <div className="cab-face cab-d-floor" />
              <div className="cab-face cab-d-wall" />
              <div className="cab-face cab-d-wall cab-d-wall--r" />
              <div className="cab-face cab-d-rail" />
              <div className="cab-face cab-d-rail cab-d-rail--r" />
              <div className="cab-face cab-d-back" />

              <div className="cab-stack">
                {LETTERS.map((l, i) => (
                  <Folder
                    key={l}
                    letter={l}
                    index={i}
                    focused={focused === l}
                    pulled={pulled === l}
                    tabbable={open}
                    onOpen={onOpenFolder}
                  />
                ))}
              </div>

              <div className="cab-face cab-d-front-top" />
              <button
                type="button"
                className="cab-face cab-d-front"
                aria-expanded={open}
                aria-label={open ? "Close drawer" : "Open drawer"}
                onClick={onToggle}
              >
                <span className="cab-d-front-inner" />
                <span className="cab-d-label"><span>A — Z</span></span>
                <svg className="cab-d-handle" viewBox="0 0 120 52" aria-hidden="true">
                  {[30, 17, 4].map((y) => (
                    <rect key={y} x={10} y={y} width={100} height={18} rx={9}
                      fill="var(--sheet)" stroke="var(--ink)" strokeWidth={1.5} />
                  ))}
                </svg>
                <span className="cab-d-hint">{open ? "PUSH" : "PULL"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Folder({
  letter, index, focused, pulled, tabbable, onOpen,
}: {
  letter: Letter; index: number; focused: boolean; pulled: boolean; tabbable: boolean
  onOpen: (l: Letter) => void
}) {
  const tx = TAB_X[tabSlot(index)]
  const tab = `M${tx} 28.75 L${tx + 10} 4.25 Q${tx + 11} 2.25 ${tx + 13.5} 2.25 H${tx + 70.5} Q${tx + 73} 2.25 ${tx + 74} 4.25 L${tx + 84} 28.75`
  const outline = `M0.75 207.25 V34.75 Q0.75 28.75 6.75 28.75 H${tx} ${tab.slice(tab.indexOf("L"))} H289.25 Q295.25 28.75 295.25 34.75 V207.25`

  return (
    <button
      type="button"
      className="cab-folder"
      style={{ "--z": `${-(22 + index * 17)}px` } as CSSProperties}
      data-focused={focused}
      data-pulled={pulled}
      tabIndex={tabbable ? 0 : -1}
      aria-label={`Folder ${letter}, ${sheetCount(letter)} sheets`}
      onClick={() => onOpen(letter)}
    >
      <span className="f-paper" />
      <svg viewBox="0 0 296 208" width={296} height={208} aria-hidden="true">
        <path className="f-face" d={`${outline} Z`} />
        <path className="f-tab" d={`${tab} Z`} />
        <path d={outline} fill="none" stroke="var(--ink)" strokeWidth={1.5} strokeLinejoin="round" />
        <line x1={6} x2={290} y1={38} y2={38} stroke="var(--ink)" strokeOpacity={0.25} />
        <text className="f-label" x={tx + 42} y={21} textAnchor="middle">{letter}</text>
      </svg>
    </button>
  )
}
