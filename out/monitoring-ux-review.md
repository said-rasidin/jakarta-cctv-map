# Monitoring UX review — 5 September 2026

Implementation update: the Atur/Pantau split is now applied. Settings use a collapsible inline panel (not a modal drawer), preserving grid/player identity and allowing direct tile arrangement. Starting playback closes settings on every viewport. The toolbar has one concise group status with expandable details; selected visible cameras form its denominator. Tile timing/details and fullscreen are secondary, focus is separate from AI, preview labels are short, and pagination is hidden for a single page. Desktop video height is bounded for multi-row viewing; mobile retains two-player paging. Settings/reorder preserve live video elements in browser regression tests. Physical-device usability testing remains outstanding.

Scope: review of the current workspace/tile code and desktop/mobile screenshots from the preceding browser checks. This is a heuristic review, not a user study. The redesign below is proposed, not implemented in this review. Automatic synchronization is implemented separately.

## Findings, in priority order

1. **High: setup competes with observation.** Name editing, save, picker, road filters, ordering, layout and timing controls remain visible while watching. On desktop the picker permanently consumes 280 px. The primary task is comparing traffic movement, not configuring a workspace.
2. **High: repeated information competes with video.** A numbered list repeats camera names already on tiles; each tile repeats connection status, timing explanations, focus, fullscreen and options. The long instructions and warning panel push video down, particularly on mobile.
3. **Medium: normal states resemble warnings.** Yellow explanatory timing text is always prominent. Reserve strong warning styling for actionable failures; distinguish “not verifiable” from “offline.” Never imply a valid clock just because metadata exists.
4. **Medium: continuously changing timing text can distract.** Keep one concise group status, stable dimensions and tabular digits. Do not announce every one-second drift update in a screen-reader live region; announce state transitions only.
5. **Medium: controls need clearer hierarchy.** “Fokus / AI” mixes two tasks. Focus should enlarge a view; AI should remain a separate explicit opt-in inside that view. Keep drag handles and a keyboard-accessible move alternative discoverable.

## Research and interpretation

- [NN/G: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) recommends showing important actions first and moving advanced options to an obvious secondary area. Application here: an **Atur** drawer, not a permanent configuration panel. This is a design inference, not evidence of measured improvement for this app.
- [NN/G: Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) supports visible system status, recognition over recall and minimalist presentation. Application: keep camera identity and failures visible; remove repeated explanations, not essential labels. Do not replace every button with an unexplained icon.
- [Axis: Video analytic overlays](https://newsroom.axis.com/en-us/blog/video-analytic-overlays) discusses information overload and preserving an actionable view. Application: minimal metadata outside the picture, overlays only where helpful. This is vendor guidance rather than an independent CCTV usability trial.

## Proposed product layout

```text
S. Parman     4 kamera · Sinkron sebagian ⓘ     [Atur] [Jeda] [Peta]
┌──────────────────────────┬──────────────────────────┐
│ 1 · S. Parman C07 · 01  ⋯ │ 2 · S. Parman C07 · 02  ⋯ │
│                          │                          │
│          VIDEO           │          VIDEO           │
│                          │                          │
└──────────────────────────┴──────────────────────────┘
```

- **Atur:** add/replace cameras, road search, name, save, layout, ordering and manual timing override in one drawer. Initial empty workspace opens it. Starting monitoring closes it on desktop and mobile; reopening it must not restart streams.
- **Pantau:** compact toolbar, grid, pagination only when needed. One primary Start/Pause action. Short camera identity remains visible and reveals full name on focus/tap. Preserve stable tile positions; never auto-sort during playback.
- Tile actions: visible focus action and accessible overflow menu for fullscreen, retry, move, replace/remove and source. Drag handle shown in arrangement mode; no hover-only access on mobile.
- Group status: “Menyelaraskan”, “Sinkron 4/4”, or “Sinkron sebagian 3/4”. Details disclose drift, excluded cameras, added delay and metadata limitations. Count against visible selected cameras, including failed/iframe players, not just registered HLS controllers.
- Per-tile exception: short “Terputus · Coba lagi” or “Waktu tidak tersedia”. Routine technical details go inside the details panel.
- Preview: keep a short “Pratinjau” label; explain freshness once in details. Do not auto-refresh or represent it as live.
- Avoid flashing alerts, unnecessary motion and alarm sounds. Color supports text/icons, never substitutes for them. Maintain visible keyboard focus and touch targets of at least 44 px.

## Automatic synchronization implemented now

Default is **Sinkron otomatis**, sampled about once per second while monitoring is visible. The initial target is the minimum advancing program timestamp, bounded to a shared playable interval. The target then advances monotonically rather than chasing a fresh minimum every second. Adjacent fragment ranges are merged; actual gaps remain excluded. Small drift uses bounded playback-rate adjustment; large drift uses cooldown-limited seeks. “Ke siaran terbaru” does not turn synchronization off. Manual **Terbaru** remains an opt-out.

[hls.js playingDate](https://hlsjs.video-dev.org/api-docs/hls.js.hls.playingdate) derives the displayed program date from HLS timing metadata. Independent video `currentTime` values are not comparable clocks. Missing metadata, stalls, non-overlapping buffers and source-clock errors prevent guaranteed synchronization; iframe/native fallback cannot be forced into alignment. “Background” means automatic browser coordination, not continued hidden-tab streaming or server processing.

## Validation for the proposed redesign

Compare the current and proposed UI on the same device/streams with representative users: create a four-camera road view, reverse it, find an offline feed, focus one camera, and explain whether times are aligned. Record completion time, errors, help requests and perceived effort. Specifically test recognition of partial sync; cleaner visuals must not create false confidence.

Acceptance targets (not measured results): grid begins below one compact toolbar in Pantau; no duplicated camera list or instructional paragraph there; every action keyboard/touch accessible; opening settings/reordering never recreates an active player; failures remain visible; no loss of saved arrangement. Test physical mobile devices and longer viewing sessions before claiming reduced cognitive load.
