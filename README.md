# Australian Research Block Grant Dashboard

A reproducible, static dashboard for exploring the distribution of Australian Research Block Grant (RBG) funding from 2017 to 2026.

## Research Question

> How has the distribution of Australian research block grant funding changed, and which universities have strengthened or weakened their position relative to the sector?

## Dashboard

[View the live dashboard](https://research-block-grant-dashboard-liart.vercel.app/)

The dashboard includes:

- headline indicators for sector concentration and the University of Technology Sydney (UTS);
- annual Top-Five Share, with the five largest providers recalculated independently each year;
- the five largest positive and negative institutional share movements from 2017 to 2026;
- an institution explorer for annual RSP, RTP, Total RBG and sector share; and
- contextual 2023–2024 Higher Degree by Research (HDR) completions for UTS.

## Data Sources

Both source workbooks were released by the Australian Government Department of Education in December 2025:

- [Research Block Grant allocations time series](https://www.education.gov.au/research-block-grants)
- [Higher Degree by Research student completions time series](https://www.education.gov.au/higher-education-statistics)

The original workbooks are stored unchanged in `data/raw/`. The RBG analysis uses grant years 2017–2026. HDR completions for 2023–2024 are shown only as context and are not treated as causing changes in RBG allocations.

## Metrics

**Total RBG:** RSP + RTP

**Provider Share:** 100 × provider Total RBG ÷ Total RBG across all eligible providers in the same grant year

**Top-Five Share:** The sum of the five highest provider shares, ranked independently within each year

**Share Movement:** 2026 provider share − 2017 provider share, expressed in percentage points and calculated only for HEP codes present in both endpoint years

HEP code is the primary institutional identifier. Provider names are trimmed only for display.

## Key Findings

1. The Top Five accounted for approximately 47.34% of RBG allocations in 2017 and 47.94% in 2026. The net increase of approximately 0.60 percentage points indicates persistent concentration with modest overall change.
2. Institutional positions moved more substantially. UTS increased from approximately 1.50% to 2.12% of sector allocations, a gain of approximately 0.62 percentage points.

## Repository Structure

```text
.
├── index.html                  # Single-page dashboard
├── css/styles.css              # Responsive visual design
├── js/
│   ├── dashboard.js            # Data loading and interactions
│   └── charts.js               # Plotly chart definitions
├── data/
│   ├── raw/                    # Unmodified source workbooks
│   └── processed/
│       ├── rbg_dashboard.csv   # Dashboard-ready RBG data
│       └── hdr_context.csv     # HDR context with suppression preserved
├── scripts/prepare_data.py     # Standard-library data preparation
└── figures/README.md           # Location for optional static exports
```

## Reproduction

Python 3 is the only local preparation dependency. The script reads `.xlsx` files directly with the Python standard library.

1. Place the two source workbooks in `data/raw/` with these filenames:
   - `Research block grants time series 2021-2026.xlsx`
   - `Higher degree by research student completions time series.xlsx`
2. From the repository root, prepare the dashboard data:

   ```bash
   python3 scripts/prepare_data.py
   ```

3. Start a local static server:

   ```bash
   python3 -m http.server 8000
   ```

4. Open `http://localhost:8000/` in a browser.

The preparation script validates required columns, numeric RSP/RTP values, unique HEP-code/year records, annual coverage, and the reconciliation of `RSP + RTP` to the workbook's supplied total. It does not replace suppressed HDR values such as `<5` with zero.

## Deployment

The dashboard is deployed on Vercel at [research-block-grant-dashboard-liart.vercel.app](https://research-block-grant-dashboard-liart.vercel.app/). The project has no backend or build step and uses relative paths, so it can also be hosted by any static-site service, including GitHub Pages.

## Limitations

- RBG allocations are formula-driven and should not be interpreted as a direct measure of research quality or efficiency.
- Institutions differ in discipline mix and research profile.
- The Australian Government provided exceptional additional RSP funding in 2021 in response to COVID-19-related financial pressures.
- Adelaide University begins as a new HEP code in 2026 following the merger of the University of Adelaide and the University of South Australia. The endpoint intersection rule excludes the new and predecessor HEP codes from mover rankings rather than reporting a misleading gain or loss.
- HDR completion data currently ends earlier than the RBG allocation series and is presented only as contextual information.
