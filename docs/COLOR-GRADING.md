# MARISENTINEL — Colour Grading Reference

All UI colour lives in `src/styles.css` as semantic tokens (oklch). Operational
colours (risk, zones, map overlays) are fixed hex values inside the map and
chart layers so they stay identical on every theme.

## 1. Base UI tokens — light (`:root`)

| Token | Value (oklch) | Approx. hex | Used for |
| --- | --- | --- | --- |
| `--background` | `1 0 0` | `#ffffff` | page canvas |
| `--foreground` | `0.129 0.042 264.695` | `#020617` | primary text |
| `--card` / `--popover` | `1 0 0` | `#ffffff` | panels, dialogs |
| `--primary` | `0.208 0.042 265.755` | `#1e293b` | primary buttons, active nav |
| `--primary-foreground` | `0.984 0.003 247.858` | `#f8fafc` | text on primary |
| `--secondary` / `--muted` / `--accent` | `0.968 0.007 247.896` | `#f1f5f9` | subtle fills, hovers |
| `--muted-foreground` | `0.554 0.046 257.417` | `#64748b` | labels, captions, meta |
| `--destructive` | `0.577 0.245 27.325` | `#dc2626` | delete / critical actions |
| `--border` / `--input` | `0.929 0.013 255.508` | `#e2e8f0` | hairlines, field borders |
| `--ring` | `0.704 0.04 256.788` | `#94a3b8` | focus ring |
| `--radius` | `0.625rem` | — | base corner radius (sm/md/lg/xl derived) |

## 2. Base UI tokens — dark (`.dark`, the command-centre look)

| Token | Value (oklch) | Approx. hex | Used for |
| --- | --- | --- | --- |
| `--background` | `0.129 0.042 264.695` | `#020617` | deep navy canvas |
| `--foreground` | `0.984 0.003 247.858` | `#f8fafc` | primary text |
| `--card` / `--popover` / `--sidebar` | `0.208 0.042 265.755` | `#1e293b` | panels, sidebar, dialogs |
| `--primary` | `0.929 0.013 255.508` | `#e2e8f0` | primary buttons (inverted) |
| `--secondary` / `--muted` / `--accent` | `0.279 0.041 260.031` | `#334155` | raised surfaces, hovers |
| `--muted-foreground` | `0.704 0.04 256.788` | `#94a3b8` | labels, captions, meta |
| `--destructive` | `0.704 0.191 22.216` | `#f87171` | critical actions |
| `--border` | `1 0 0 / 10%` | white @10% | hairlines |
| `--input` | `1 0 0 / 15%` | white @15% | field borders |
| `--ring` | `0.551 0.027 264.364` | `#64748b` | focus ring |

## 3. Threat / risk grading (0–100 score)

Defined in `src/components/ms/MapCanvas.tsx` (`riskColor`) and mirrored in the
map legend on `/command/map`.

| Band | Score | Colour | Meaning |
| --- | --- | --- | --- |
| Low | 0–40 | `#5ce0c0` mint | passive observation |
| Elevated | 41–60 | `#f0b23c` amber | increase monitoring, verify AIS |
| High | 61–80 | `#f0743c` orange | investigate, prepare interception |
| Critical | 81–100 | `#f0466a` red | dispatch officer, escalate |

Marker sizing is part of the grade: markers are 14 px, growing to 18 px with a
2 px offset outline once risk passes 80.

## 4. Zone classification grading

`ZONE_COLOR` in `MapCanvas.tsx`; circles draw at 7% fill opacity, 1.6 px solid
stroke when active and a dashed 1 px stroke when inactive.

| Classification | Colour |
| --- | --- |
| Normal | `#4bd6b0` teal |
| Monitoring | `#6fc7f0` cyan |
| Restricted | `#f0b23c` amber |
| High Risk | `#f0743c` orange |
| Critical | `#f0466a` red |

## 5. Map overlay colours

| Layer | Colour | Treatment |
| --- | --- | --- |
| Incident pins | `#f0466a` | `!` glyph, 26 px disc, 13% tint + 1.5 px ring |
| Field officer pins | `#5ce0c0` | `F` glyph, same disc treatment |
| Route / focus line | `#6fc7f0` | 2.4 px, dash `8 6` |
| Vessel trail | risk colour of vessel | 1.6 px, 75% opacity, dash `5 5` |
| Weather / squall | `#6fc7f0` | dashed circle, 6% fill |
| Satellite footprint | `#a9b4ff` periwinkle | dashed rectangle, 4% fill |

## 6. Chart grading (`src/components/ms/Analytics.tsx`)

| Element | Value |
| --- | --- |
| Axis text / ticks | `oklch(0.7 0.028 240)`, 11 px |
| Grid lines | `oklch(0.38 0.045 248 / 30%)` |
| Tooltip surface | `oklch(0.22 0.038 250)` |
| Tooltip border | `oklch(0.38 0.045 248 / 60%)` |
| Tooltip text | `oklch(0.95 0.012 230)` |
| Series palette | `--chart-1` … `--chart-5` from `styles.css` |

Dark `--chart-*` series: `#7c5cf0` violet, `#2dd4a7` emerald, `#fbbf24` amber,
`#a855f7` purple, `#f43f5e` rose.

## 7. Accent used in controls

Layer-toggle checkboxes on `/command/map` use `accent-[oklch(0.72_0.13_205)]`
— a cyan sonar accent, the closest thing to a brand hue in the current grade.

## 8. Rules when extending the grade

- Never hardcode `text-white`, `bg-black`, or `bg-[#hex]` in components; add a
  token to `:root` and `.dark`, register it in `@theme inline`, then use the
  utility.
- Keep every token in `oklch`.
- Operational hexes (risk / zone / overlay) are intentionally theme-independent
  — change them in one place (`MapCanvas.tsx`) so map and legend stay in sync.