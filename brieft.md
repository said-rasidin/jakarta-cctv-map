# Jakarta Interactive CCTV Map Web App

## 1. Project Goal & Overview

Build a modern, user-friendly interactive web application that parses public CCTV streams from the **Jakarta CCTV portal** (`[https://jakcctv.jakarta.go.id/publik](https://jakcctv.jakarta.go.id/publik)`) and maps them as geospatial markers.

**Core Objective:** Replace the existing, hard-to-navigate grid view with a map interface that allows citizens to locate cameras geographically, search by area, and preview or open live video streams seamlessly.

---

## 2. Key Data & Technical Specs

* **Source Directory:** `[https://jakcctv.jakarta.go.id/publik](https://jakcctv.jakarta.go.id/publik)`
* **Embed URL Structure:**
`[https://dki-jkt.balitower.co.id:7028/](https://dki-jkt.balitower.co.id:7028/){CAMERA_ID}_{LOCATION_SLUG}/embed.html`
*(Example: `[https://dki-jkt.balitower.co.id:7028/502507_JKP_SATPOL-PP_JL.-JEND.-GATOT-SUBROTO-C11_CCTV-02/embed.html](https://dki-jkt.balitower.co.id:7028/502507_JKP_SATPOL-PP_JL.-JEND.-GATOT-SUBROTO-C11_CCTV-02/embed.html)`)*
* **Location Extraction Requirements:**
1. Extract camera metadata: `Camera ID`, `Agency/Provider` (e.g., Satpol PP, Dishub, Bali Tower), `Street Name / Location Name`, `Latitude`, and `Longitude`.
2. If exact coordinates are not supplied in the API/source, parse the location string (e.g., `"JL. JEND. GATOT SUBROTO"`) and geocode it using OpenStreetMap Nominatim / Mapbox to generate coordinates within Jakarta bounds.



---

## 3. UI/UX Requirements

### A. Map Interface

* **Base Map:** Leaflet.js / Mapbox GL JS with a clean dark or light tile set (e.g., CartoDB Positron/Dark Matter).
* **Center Point:** Default view centered on Jakarta (`-6.2088, 106.8456`) at Zoom level 12.
* **Marker Clustering:** Group dense clusters of cameras dynamically using `leaflet.markercluster` or Supercluster to avoid performance lag and visual clutter.

### B. Interactive Camera Popup & Modal

When a user clicks a map pin:

1. **Quick Popup:** Display a card with:
* Camera Name & Location (e.g., *Jl. Jend. Gatot Subroto C11*)
* Managing Agency tag (e.g., *Satpol PP / Bali Tower*)
* Action Buttons: **"Preview Live"** and **"Open Full Screen"**.


2. **Video Player Modal / Iframe Drawer:**
* Embed the camera link inside a responsive modal or floating preview window using an `<iframe>`.
* Include a direct link ("Open Source Link") in case the iframe encounters CORS or mixed-content (HTTP/HTTPS) issues.



### C. Controls & Search Bar

* **Search / Filter Bar:** Instant search by street name, district (e.g., *Menteng, Sudirman*), or camera ID.
* **Filter by Provider/Type:** Toggle cameras based on provider tags (e.g., *Balitower, Dishub, Satpol PP*).
* **Location Shortcut:** "Find Near Me" button to request user geolocation and zoom to nearby cameras.

---

## 4. Edge Cases & Reliability Strategy

1. **CORS / Mixed Content Handling:** Some legacy camera embeds use `http:` or specific ports (`:7028`). Ensure iframe source links support HTTPS or fallback to a clickable direct external link if browser security blocks the inline embed.
2. **Offline Stream Indicator:** If a video embed fails to load or returns a 404/timeout, display a friendly UI state: *"Stream currently unavailable. Click to open source page."*
3. **Performance Optimization:** Enable lazy loading for camera player embeds so video streams only load when a user clicks a pin.

---

## 5. Suggested Tech Stack

* **Frontend:** Next.js (React) or Vite + React
* **Styling:** Tailwind CSS + Shadcn UI
* **Mapping Library:** React-Leaflet or Mapbox GL JS
* **Icons:** Lucide-React