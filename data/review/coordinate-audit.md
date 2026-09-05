# Coordinate review — 2026-09-05

Scope: all 29 existing sites only. No camera/channel additions, stream changes, runtime Streetside requests, or tokens saved.

Reference: https://streetside.mugnimaestra.dev/api/cameras (retrieved for manual review).
This is a metadata/map review, not visual verification of live camera footage. Coordinates are not certified survey positions.

## Corrected (provisional street-level validation)

700014 — Bendungan Hilir 003: exact name matches reference ID 10, but the reference coordinate is malformed and cannot safely replace the manually established current point (-6.207523, 106.803651). Reference address says `Jl. Mesjid 1 pertigaan Jl. Pejompongan`; camera pole/intersection still needs visual confirmation.

Map check: https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=-6.205554523&lon=106.8076439&zoom=18

## Exact name and coordinate match, landmark discrepancy

705084 — Senayan 001: reference ID 394 matches existing (-6.229418, 106.800027). Kept unchanged. Reference says Sisimangaraja / police observation post, Selong; OpenStreetMap identifies Jalan Pattimura, Selong. Exact camera identity agrees, but street/landmark verification is incomplete. Do not call this fully verified.

Map check: https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=-6.229418&lon=106.800027&zoom=18

## Unresolved — existing positions retained, not validated

| Existing IDs                                                                                                           | Reason                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 502535, 502645                                                                                                         | S. Parman C07/C08 cannot be mapped to reference 001–006 or JPO 001–002 by street name alone. Multiple distinct points.                                                                                                                                                                                                                                      |
| 501844, 502491, 502492, 502493, 501941                                                                                 | MH Thamrin agency/C codes are not the reference 001/002 identifiers. Reference point -6.195297, 106.823627 is only a candidate.                                                                                                                                                                                                                             |
| 503301                                                                                                                 | Tentara Pelajar C04 has two manually reviewed channel positions: CCTV-01 at (-6.218471, 106.791992) and CCTV-02 at (-6.210261518417967, 106.79639578465134). The map renders them as independent plots and opens the channel belonging to the selected plot. |
| 503675                                                                                                                 | Jati Baru Raya C02 resembles Jatibaru Raya 002 (reference 2438, -6.186921, 106.807942), but no shared site/channel identifier proves identity. Old point is suspicious; do not auto-match.                                                                                                                                                                  |
| 503343                                                                                                                 | KH Mas Mansyur C02 has several reference locations and spelling variants. Street match alone is insufficient.                                                                                                                                                                                                                                               |
| 700332                                                                                                                 | Kebon Melati 010 absent; 004/007/008/009 are different camera names.                                                                                                                                                                                                                                                                                        |
| 705979                                                                                                                 | Senayan 018 absent; do not replace with 001 or 003. Existing published coordinates retained. Manual override synchronized to published coordinates solely to prevent the next ingest from moving it, not as a new validation.                                                                                                                               |
| 503536, 502155, 502160, 503300, 503303, 502045, 504866, 502506, 502507, 501594, 502540, 501493, 501862, 502041, 501478 | No unambiguous matching camera name in the retrieved reference (Ladokgi, Gerbang Pemuda, Gatot Subroto, UOB, Sultan Agung, Pasar Tanah Abang, Panglima Polim, Taman Literasi).                                                                                                                                                                              |

Next evidence needed: shared provider site ID/channel mapping or a visible landmark in the existing official stream matched against a map. Do not infer camera identity from proximity, common road names, or similar numbering. The remaining 28 sites are not fully street/landmark validated.
