# Thailand Budget Mind Map (Dark + Notes)

A lightweight, static web app to visualize Thailand’s national budget as a **radial mind map** with **drill‑down** and a **per‑ministry message box** (notes saved in browser).

- Dark theme
- Click a ministry to **center** (drill‑down)
- **Back** / **Reset** navigation
- **Notes panel** per node (localStorage; export/clear)
- **Download PNG** of the chart
- Load custom **JSON** (same schema as `data/th_budget_FY2025.json`)

## Quick start (GitHub Pages)
1. Push this folder to a public GitHub repo.
2. Enable **GitHub Pages** (root folder).  
3. Open `https://<your-username>.github.io/<repo-name>/`.

## Data schema
```json
{
  "name": "Thailand National Budget (FY2025)",
  "value": 3750000000000,    // THB (optional; if absent, auto-sum children)
  "desc": "optional text",    // optional description
  "children": [
    { "name": "Ministry of Education", "value": 600000000000, "children": [] }
  ]
}
```

> **Tip:** If you don’t know exact totals yet, leave `value` blank. You can also add second-level nodes under any ministry at any time.

## Where to edit values
- Put numbers into `data/th_budget_FY2025.json` (THB, number only, no commas).
- Or click **Load a custom JSON** and select a file from your computer (works offline).

## Notes
- Notes are stored per node path, e.g., `/Thailand National Budget (FY2025)/Ministry of Education`.
- They are **local to your browser** and **not uploaded** anywhere.

## License
MIT. Contributions welcome!
