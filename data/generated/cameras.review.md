# Author review of cameras.json

On 2026-09-05, the author confirmed that the CCTV links and coordinates in the accompanying cameras.json snapshot were manually reviewed and valid at the time of review. This note records the author's confirmation; it is not an independent live-stream verification or a guarantee of ongoing availability.

JSON does not support comments, so this note accompanies the data without modifying any coordinate or stream URL. Manual overrides preserve the reviewed channel positions during ingestion. Later regenerated data needs its own review; this statement applies to the snapshot in this commit.

Subsequent metadata normalization derives display names and road/area groups from the existing CCTV URLs and keeps previous names as search aliases. The normalization verifies that all reviewed coordinates, channel identities and stream URLs remain unchanged. It does not constitute a new live-availability or geographic review.
