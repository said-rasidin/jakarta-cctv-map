# Jakarta CCTV Map

An interactive map for finding and viewing public CCTV cameras across Jakarta.

The application turns Jakarta's official public CCTV directory into a searchable map. Users can search by road, district, agency, or camera ID; filter cameras by agency; find cameras near their current location; and preview supported live streams.

> **Live demo:** Coming soon. The application is planned for deployment on Vercel.

![Jakarta CCTV Map showing clustered public camera locations](docs/jakarta-cctv-map.png)

## Features

- Interactive Jakarta map with clustered camera markers
- Search by road, district, agency, or camera ID
- Agency-based camera filters
- Nearby-camera discovery using browser geolocation
- Multi-channel selection for supported camera locations
- On-demand live-stream previews and availability checks
- Opt-in, client-side YOLO26n object detection for the camera currently open
- Light and dark map styles

## Data sources

Camera metadata and stream links are collected only from the official [Jakarta Public CCTV](https://jakcctv.jakarta.go.id/publik) directory. The ingestion script extracts camera IDs, location names, agencies, and public iframe URLs from that page.

The official directory does not include map coordinates. The author has manually reviewed the CCTV links and coordinates in the committed [`data/generated/cameras.json`](data/generated/cameras.json) snapshot and confirmed them as valid at review time. This records the author's review, not a guarantee of future stream availability. Coordinates are manually maintained in [`data/manual/overrides.json`](data/manual/overrides.json), including per-channel positions. Channels at different coordinates appear as independent map plots even when they share a site name. There is no runtime dependency on Streetside or Molecool; external maps/catalogues may have been consulted during manual review.

Coordinates are resolved in this order:

1. A manually extracted and reviewed entry in [`data/manual/overrides.json`](data/manual/overrides.json)
2. A manually maintained coordinate from the last successfully generated dataset

Newly listed sites without a manual coordinate are placed in [`data/review/unresolved-locations.json`](data/review/unresolved-locations.json) and are not published on the map until reviewed.

Generated camera data is committed to [`data/generated/cameras.json`](data/generated/cameras.json), while locations that still need manual review are written to [`data/review/unresolved-locations.json`](data/review/unresolved-locations.json). The map tiles use OpenStreetMap data rendered by [CARTO](https://carto.com/attributions).

This project is an independent interface for publicly available data. Camera ownership, stream availability, and upstream data accuracy remain under the control of their respective providers. Review the upstream providers' terms before redistributing their data.

## High-level design

```mermaid
flowchart LR
    A[Jakarta Public CCTV] --> D[Ingestion pipeline]
    C[Manual coordinates] --> D
    D --> E[data/generated/cameras.json]
    E --> F[Next.js application]
    F --> G[React Leaflet map]
    F --> H[Stream health API]
    G --> I[Search, filters, nearby cameras, preview]
```

- **Data pipeline:** `tools/camera-data/ingest.ts` fetches and normalizes the official public directory, groups multiple channels at the same site, applies manually maintained coordinates, and writes a versioned JSON dataset.
- **Application:** Next.js loads the generated dataset at build time. The interactive React UI performs searching, filtering, distance sorting, and map interaction in the browser.
- **Map:** React Leaflet renders CARTO map tiles, while Supercluster groups dense camera markers for responsive navigation.
- **Streams:** Direct Bali Tower streams are loaded only when requested. A server-side API route checks approved stream hosts before the viewer reports availability.
- **AI experiment:** A direct HLS player samples at most one frame at a time and runs YOLO26n in a browser worker. Frames are not uploaded, recorded, or retained. WebGPU is preferred with a single-thread WASM fallback.
- **Automation:** GitHub Actions validates every change and refreshes the camera dataset daily. The refresh job keeps the last good dataset if an upstream source returns suspiciously little data.

## Project structure

The repository is a feature-oriented Next.js application. Runtime boundaries are explicit without requiring separate frontend, backend, and AI deployments:

```text
src/
  app/                 Next.js pages and thin API route adapters
  domain/cameras/      Shared camera contracts, validation, and pure logic
  features/cameras/    Camera explorer, map, viewer, hooks, and server checks
  features/detection/  Browser-side model catalog, post-processing, UI, and worker
  features/video/      Direct video playback
tools/
  camera-data/         Dataset ingestion and validation
  ai-models/           Build-time ONNX model export
  build/               Static runtime asset preparation
data/
  generated/           Generated camera dataset
  manual/              Human-reviewed source overrides
  review/              Unresolved records requiring review
```

The AI path remains client-side: the detection feature sends frames only to its local browser worker. The Python model exporter under `tools/ai-models` runs during model preparation and is not a production service.

## Run locally

### Requirements

- [Node.js](https://nodejs.org/) 22 or later
- npm

Install dependencies and start the development server:

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### CARTO map key

Request a **basemap API key** from [CARTO](https://carto.com/basemaps/apikey/) and set it in `.env` or `.env.local`:

```dotenv
CARTO_BASEMAP_API_KEY=your_basemap_key_here
```

Replace the placeholder with your real basemap key. The previous `CARTO_API_ACCESS_TOKEN` variable is accepted as an alias only if its value is a basemap key. An account API access token is a different credential; `CARTO_API_BASE_URL` is not used for basemap tiles. Neither variable needs a `NEXT_PUBLIC_` prefix.

Restart `npm run dev` after changing the environment. For Docker Compose, use `.env` (Compose does not automatically read `.env.local`) and run `docker compose up -d --force-recreate`. For Vercel, add `CARTO_BASEMAP_API_KEY` to the project environment and redeploy. Do not commit your key.

The server tile route appends the key to CARTO requests, preserves attribution, and caches successful PNG responses; the key is not sent to browser code. This adds tile traffic through the app/Vercel. A hard refresh may be needed for previously cached watermarked tiles. A key cannot fix an invalid or expired credential. Raster tiles remain in use; a future vector migration would require replacing the Leaflet raster layer.

The repository already contains a generated camera dataset, so an internet connection is not required to build the application itself. Map tiles and live camera streams still require network access at runtime.

### Optional local YOLO26n experiment

The separately licensed model is not committed or downloaded during a normal app install. To enable **Coba AI**, install the pinned Python export dependencies and generate the web asset:

```powershell
Copy-Item .env.example .env.local
# Set NEXT_PUBLIC_ENABLE_CCTV_AI=true in .env.local
py -m pip install -r tools/ai-models/requirements.txt
py tools/ai-models/export-yolo26n.py
npm run dev
```

The exporter creates content-hashed 320×320 ONNX assets plus a validated model catalog under `public/models/yolo26n`. By default it prepares FP16 and INT8 versions of nano, small, and medium. The camera viewer has separate model-size and precision controls and downloads only the selected model on the first **Coba AI** click. AI stops and its worker/session are released when disabled, hidden, switched, or closed. Review Ultralytics licensing and the camera operator's terms before deployment.

## How AI works

The AI mode is opt-in. It never loads a model, records video, or sends pixels to the application server until the viewer presses **Coba AI** for the currently open camera.

```mermaid
flowchart LR
    A[Open one CCTV stream] --> B[Direct HLS video element]
    B --> C[One sampled decoded frame]
    C --> D[Letterbox to model input]
    D --> E[Browser inference worker]
    E --> F[WebGPU preferred]
    E --> G[Single-thread WASM fallback]
    F --> H[Traffic-object boxes and counts]
    G --> H
    H --> I[Transparent local overlay]
    J[Viewer closed, paused, hidden, or switched] --> K[Cancel sampling and release worker]
```

![Client-side object detection running on a Jakarta CCTV stream](docs/object-detection.png)

Only one frame can be in inference at a time. As soon as it finishes, the worker samples the newest decoded frame instead of queueing old frames. It runs at up to roughly 10 FPS when the device is fast enough, while the one-job limit protects memory. The viewer shows measured inference latency and estimated FPS. The initial COCO labels shown are person, bicycle, car, motorcycle, bus, and truck. Results are ephemeral and experimental.

### Choose a YOLO26 experiment

Compose packages all three selectable model sizes in FP16 and INT8. The UI defaults to Nano FP16. Set these environment variables before `docker compose up --build`; use `--build` whenever the packaged selection changes.

| Setting | Values | Default | Notes |
| --- | --- | --- | --- |
| `AI_MODEL_VARIANT` | `all`, `nano`, `small`, `medium` | `all` | `all` enables the Nano/Small/Medium picker. A single value packages only that choice. |
| `AI_MODEL_PRECISION` | `all`, `fp32`, `fp16`, `int8` | `all` | `all` packages FP16 and INT8. INT8 uses COCO8 calibration. INT4 is not supported for YOLO26 ONNX. |
| `AI_MODEL_IMAGE_SIZE` | integer, e.g. `320`, `416`, `640` | `320` | A larger square input improves small-object detail at a memory/latency cost. |

PowerShell examples:

```powershell
# All sizes with both UI-selectable precisions
$env:AI_MODEL_VARIANT = "all"
$env:AI_MODEL_PRECISION = "all"
docker compose up --build

# Lowest-latency package for CPU/WASM
$env:AI_MODEL_VARIANT = "nano"
$env:AI_MODEL_PRECISION = "int8"
$env:AI_MODEL_IMAGE_SIZE = "320"
docker compose up --build
```

For the non-Docker exporter, pass the same selection explicitly:

```powershell
py tools/ai-models/export-yolo26n.py --variant all --precision all --imgsz 320
```

The two pickers select model size and precision independently. Nano FP16 is selected by default. Choose Nano INT8 for the lowest CPU/WASM latency; use Small or Medium only when the device can keep up. Turn AI off before changing models so the existing worker and model memory are released. INT4 appears as unavailable because the official YOLO26 ONNX exporter supports FP32, FP16, and INT8—not INT4.

### Production build

```bash
npm run build
npm start
```

### Docker

Build and run the production image with Docker Compose:

```bash
docker compose up --build
```

The application will be available at [http://localhost:3000](http://localhost:3000).

The Compose build automatically installs the pinned Python AI dependencies, exports the selectable YOLO26 catalog to content-hashed ONNX web assets, and copies the ONNX Runtime browser files. It then starts `npm run dev` with the AI experiment enabled, so no host Python or Node setup is needed for local verification. A regular `docker build .` still produces the optimized production image.

## Deploy to Vercel

The public deployment is not available yet. To create one:

1. Import this repository into [Vercel](https://vercel.com/).
2. Keep the detected Next.js framework settings and default build command.
3. Deploy the `main` branch.
4. Add the production URL to the **Live demo** section at the top of this README.

The scheduled GitHub Actions refresh is separate from Vercel and can update the committed dataset independently of a Vercel deployment.

## Refresh the camera data

Run:

```bash
npm run ingest
npm run validate-data
npm run validate-streams
```

Review unresolved locations after ingestion. Add verified coordinates to [`data/manual/overrides.json`](data/manual/overrides.json) using the camera site ID as the key, then run the ingestion again. Manual coordinates always take precedence over the previously generated dataset.

## Quality checks

Run the same checks used in continuous integration:

```bash
npm run validate-data
npm run lint
npm test
npm run build
```

`npm run validate-streams` performs network requests to upstream cameras and is therefore kept separate from the standard CI checks.

## Known limitations

- Public streams can be offline, slow, or blocked from embedding without notice.
- HLS playback and AI capture require full-chain CORS support; the viewer falls back to the public iframe and disables AI if direct playback fails.
- YOLO detections are experimental and may be wrong. They must not be used for enforcement or public-safety decisions.
- Manually extracted coordinates may be approximate and should be corrected through the review process.
- Nearby-camera discovery requires browser location permission.
- The application interface is currently in Indonesian, although this documentation is in English.
- Map tiles, camera catalogs, and streams depend on third-party services outside this project's control.

## Privacy

The application does not store a user's location. Browser geolocation is requested only after the user selects the nearby-camera feature and remains in client-side memory for that session.

Map tiles and camera streams are loaded from external providers. Those providers receive ordinary network information, such as the user's IP address, according to their own privacy policies. This project does not record or archive CCTV footage.

When explicitly enabled, object detection runs on the user's device for only the open camera. Frames and detections are not sent to this application's server or stored by the application.

## Contributing

Corrections and improvements are welcome. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the development workflow, data-correction process, and pull request checklist.

Please do not edit `data/generated/cameras.json` directly. For incorrect camera coordinates, add a verified correction to `data/manual/overrides.json` and regenerate the dataset.

## License and attribution

Except for third-party materials described below, this project is licensed under the [Creative Commons Attribution 4.0 International License](LICENSE.md).

Camera listings and public stream links come from the [Jakarta Public CCTV](https://jakcctv.jakarta.go.id/publik) directory. The underlying video and image feeds remain the property of their respective owners and are not covered by this project's license. OpenStreetMap, CARTO, dependencies, and other third-party materials remain subject to their own licenses and terms.
