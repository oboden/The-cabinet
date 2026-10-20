# The Cabinet

A filing cabinet you can open, search and browse. A line-drawn 3D cabinet holds
26 folders (A–Z); a tuning dial at the bottom, or the search bar at the top,
raises a folder, and opening one shows its sheets.

## Run it

```bash
npm install
npm run dev      # local dev server
npm run build    # production build in dist/
```

Deploys to Vercel as a Vite project with no extra settings
(build command `npm run build`, output directory `dist`).

## How it's put together

| Part | File |
| --- | --- |
| Page, state and the order of events (drawer → folder rises → opens) | `src/App.tsx` |
| 3D cabinet (CSS 3D transforms, drawn as line art) | `src/components/Cabinet.tsx`, `src/cabinet.css` |
| A–Z dial with ticks, focus blur and sounds | `src/components/LetterDial.tsx` |
| Open folder: sheets + contents list | `src/components/FolderDialog.tsx` |
| Scroll physics for the sheets (eases into each sheet) | `src/lib/useSoftScroll.ts` |
| Synthesized sounds (Web Audio, no files) | `src/lib/sound.ts` |
| Folder data (letters, sheet counts) | `src/lib/folders.ts` |
| shadcn/ui components (Radix) | `src/components/ui/` |

Sheets are blank placeholders; `sheetCount()` in `src/lib/folders.ts` is where
real content would plug in.

### Tuning

- Cabinet angle: `--yaw` in `src/cabinet.css` (34° now).
- Sheet settle speed: `STIFF` in `src/lib/useSoftScroll.ts` (higher = quicker).
- Dial spacing: `CELL` / `TICK` in `src/components/LetterDial.tsx`.
- Sound levels: the `gain` values in `src/lib/sound.ts`.
