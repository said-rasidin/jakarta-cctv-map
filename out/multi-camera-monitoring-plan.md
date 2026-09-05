# Multi-camera traffic monitoring: review and implementation plan

Date: 2026-09-05. Status: implemented for local verification. See [implementation notes](monitoring-implementation-notes.md) for delivered behavior, live playlist observations, conservative deviations, and remaining physical-device performance checks. The sections below retain the design rationale and acceptance targets.

## Findings from the current application

CameraExplorer stores one selected site/channel and CameraViewer presents that site's channels as tabs. DirectVideoPlayer owns one HLS instance, prefers native HLS when supported, and falls back to a cross-origin iframe. It already destroys playback resources on unmount and uses short buffers. It does not expose wall-clock playback time, seekable ranges, or playback controls to a coordinator. Copying the whole viewer into each grid cell would duplicate dialogs, controls, and potentially expensive AI workers.

Use channel IDs as selection keys, not site IDs: two channels at one named site can have different reviewed coordinates. Preserve all current coordinates. Camera location does not establish viewing direction, lane coverage, or road connectivity. A grid helps a human follow traffic; it does not identify or automatically track a vehicle across cameras.

## Recommended user journey

1. Search `S. Parman` in the existing explorer. Each channel offers **Tambah ke monitor** in the results, map popup, and viewer. Selecting a site with multiple channels presents individually labeled choices.
2. A persistent selection tray shows numbered camera chips and **Buka monitor (N)**. Adding selections does not start video downloads. Duplicate additions are disabled with **Sudah ditambahkan** feedback.
3. Open a dedicated monitoring workspace with a compact camera picker beside the grid. Start with four tiles (2 × 2 on desktop); support six as an explicit expanded layout after device testing. Mobile starts with two active tiles and offers paging; inactive pages show paused placeholders.
4. Name the workspace **S. Parman — Utara ke Selatan**. Offer a latitude-based north-to-south initial order, labeled as a suggestion. Allow reverse order, drag reorder, and keyboard-accessible move earlier/later buttons. Do not infer the camera's viewing direction. Numbered map markers match tile order; avoid drawing a fake road route between points.
5. Save the workspace locally. Store only a version, name, ordered channel IDs, and layout in localStorage. Restore selections but require **Mulai monitor** before reconnecting streams. Missing IDs after a dataset refresh remain explicit unavailable slots that can be replaced.

Each tile shows a short street/site name plus channel label, video in an uncropped 16:9 frame, connection state, and time confidence. Actions: focus/fullscreen, retry, replace, remove. Keep unavailable tiles in place so the route order does not shift. Use text/icons as well as colors. One tile's failure must not interrupt others. All tiles start muted; allow audio on at most one.

The toolbar provides layout, pause/resume all, **Ke siaran terbaru**, and time mode. Fullscreen/focus reuses the existing player rather than opening a duplicate stream. Mobile controls must remain reachable without covering the footage.

## Time: two explicit modes

**Terbaru** (default): each camera follows its own safe live edge. Best for current road conditions and lowest practical delay. Simultaneous playback does not mean simultaneous capture. Show **Waktu antar kamera belum diselaraskan** when that is all we can establish.

**Selaraskan waktu** (optional): delay faster feeds to a common available program time when compatible timestamp metadata exists. Explain that this adds delay. Never promise frame-perfect synchronization or repair of an incorrect camera clock.

The HLS specification maps EXT-X-PROGRAM-DATE-TIME to the first media sample of a segment. This is optional source metadata, not proof the source clock is correct. See [RFC 8216 section 4.3.2.6](https://www.rfc-editor.org/rfc/rfc8216.html#section-4.3.2.6). hls.js exposes [playingDate](https://hlsjs.video-dev.org/api-docs/hls.js.hls.playingdate), which can be null. The same numeric video.currentTime in different streams is not a common timestamp.

### Proposed coordinator

- Player adapter reports channel ID, playback state, playingDate, monotonic sample time, segment timeline mappings, seekable ranges, and the safe live position. Convert each valid seekable range to program time per continuity region; do not assume one offset survives discontinuities.
- Eligible players need valid, advancing program dates and an overlapping seekable program-time interval. Compute its latest safe common point with a segment-aware safety margin. Anchor that point to performance.now() so the group timeline advances without following the local system clock.
- Seek eligible players to the common point once ready. Sample drift around once per second; proposed initial tolerances are no correction below 250 ms, gentle rate adjustment (0.97–1.03) for moderate drift, and a bounded seek for persistent drift above 2 s. These are tuning starting points, not measured guarantees. Avoid repeated seeks; show actual measured spread.
- Coordinate ownership of playbackRate and seeking: disable competing hls.js live catch-up while in aligned mode. Restore normal live settings on exit. [hls.js live controls](https://github.com/video-dev/hls.js/blob/master/docs/API.md) operate relative to a stream's edge; they do not automatically synchronize separate cameras.
- A stalled camera gets a reconnecting badge and, after a proposed 5 s grace period, leaves the sync group. Other tiles continue. Rejoining requires fresh metadata and overlap validation. No overlap means **Tidak ada rentang waktu bersama**, not an endless wait. The user may exclude the slow feed or return to Terbaru.
- Missing dates, implausible jumps, and cross-origin iframe fallback produce **Waktu tidak dapat diverifikasi**. Keep these cameras visible, explicitly outside the aligned group. Native HLS needs its own tested timing adapter; until that exists, mark it unsupported for alignment or use hls.js where supported.
- Show **Selaras menurut metadata · selisih X dtk**, not a generic green "synchronized" badge. A burned-in CCTV clock may differ from encoder program time. OCR is not part of the first release; it adds compute and does not establish clock accuracy. Even matching metadata cannot prove source clocks agree.

Before claiming support for real cameras, sample selected S. Parman media playlists read-only, including variants, and report PDT availability, window duration, discontinuities, CORS, and observable clock discrepancies over several refreshes. This research has not inspected live playlist timing, so actual synchronization coverage is still unknown.

## Implementation boundaries and performance

Create `features/monitoring` with workspace state, picker/tray, grid, tile, persistence, and a pure synchronization coordinator. Extend `features/video` with a player controller (play/pause, safe seek, rate, timing subscription, disposal). Reuse this player in the existing single viewer. Isolate state per tile and throttle timing UI updates to roughly 1 Hz.

Keep video delivery directly from existing approved upstream sources. No recording, transcoding service, or video proxy through Vercel. Use adaptive resolution capped to tile size where the upstream has variants; single-resolution feeds cannot be made cheaper by shrinking their CSS size. Start connections in a staggered queue, keep short bounded buffers, and destroy removed/off-page players. Four feeds roughly multiply bandwidth and decoding load by four; compressed buffer limits are not total RAM limits because decoded frames and GPU surfaces also consume memory.

Pause and stop HLS loading when the document is hidden; resume at live edge or explicitly rebuild the sync group. Native playback and iframes may require unloading to stop traffic. Visibility handling should use the [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API), not just window focus. Keep the set of active tiles visible and explicit on mobile.

AI defaults off in the grid. Initially allow one explicitly focused tile to own the existing inference worker/session; release ownership on tile switch or removal. Do not create one model instance per tile. Aligned mode may need a modest retained buffer, constrained by both upstream window and a memory budget; if this cannot accommodate the common point, declare alignment unavailable.

## Delivery and acceptance

Phase 1: selection tray, accessible ordered grid, per-tile errors, local saved workspaces, cleanup, mobile playback limits. Phase 2: player telemetry and honest time labels. Phase 3: opt-in alignment after real playlist inspection and synthetic timeline tests. Vector map migration is a separate task.

Test independent channel selection at shared sites, reorder without reconnecting, duplicate prevention, restoration with removed IDs, per-tile retries, focus without a second connection, and complete cleanup on navigation. Test synchronization with offset timelines, missing PDT, disjoint windows, discontinuities, stalls/rejoins, and conflicting live controllers. Use controlled HLS fixtures for reproducible tests rather than depending on live camera uptime.

On desktop and a representative low-end Android device, measure 1/2/4/6 feeds for startup, bandwidth, dropped frames, stalls, memory trend, and UI responsiveness for at least 15 minutes. Repeat add/remove cycles and background/foreground transitions. Record device/browser and actual results; do not promise a fixed RAM footprint beforehand. Validate keyboard flow, screen reader labels, 200% zoom, and mobile touch targets. Release four-tile default only after these checks; keep six optional if tests support it.
