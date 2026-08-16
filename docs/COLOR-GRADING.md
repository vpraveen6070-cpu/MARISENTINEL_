# MARISENTINEL — Design System & Colour Grading Reference

All UI tokens and color grading live in `css/styles.css` and are unified across the platform and all consoles (Command, Field, Administrator, Landing, Login).

---

## 1. Core Palette Tokens

| Token | Hex | Role | Usage Examples |
| :--- | :--- | :--- | :--- |
| **Primary** | `#0F172A` | Deep Midnight Slate | Primary text, brand titles, dark headers, active nav items, primary buttons |
| **Secondary** | `#22C55E` | Fresh Emerald Green | Normal/safe vessel status, active zones, live telemetry feeds, success badges, field units |
| **Tertiary** | `#EF4444` | Vivid Crimson Red | Critical threat alerts, high risk score (80–100), emergency dispatches, danger actions |
| **Neutral** | `#F8FAFC` | Slate Canvas | Page background canvas, light panel fills, input backgrounds, subtle borders |

---

## 2. Base UI Tokens (`:root`)

| Variable | Value | Description |
| :--- | :--- | :--- |
| `--primary` | `#0f172a` | Main action buttons, dominant dark components |
| `--primary-hover` | `#1e293b` | Hover state for primary buttons |
| `--secondary` | `#22c55e` | Success states, verified indicators, secondary action accents |
| `--secondary-dark` | `#15803d` | Deep green chips, filled progress bars |
| `--tertiary` | `#ef4444` | Destructive buttons, high risk badges, critical alerts |
| `--bg-app` | `#f8fafc` | Main application canvas background |
| `--bg-card` | `#ffffff` | Panel and metric card backgrounds |
| `--bg-card-subtle` | `#f1f5f9` | Table headers, secondary buttons, sub-panels |
| `--border-color` | `#e2e8f0` | Standard component and table borders |
| `--border-strong` | `#cbd5e1` | Outlined buttons, active input borders |
| `--text-main` | `#0f172a` | Primary readability text |
| `--text-muted` | `#64748b` | Labels, timestamps, secondary captions |

---

## 3. Operational Threat & Risk Scoring (0–100 Score)

| Band | Score | Color | Hex Code | Operational Meaning |
| :--- | :---: | :--- | :--- | :--- |
| **Low / Normal** | `0–40` | 🟢 Green | `#22c55e` | Standard AIS tracking, normal transit |
| **Elevated** | `41–60` | 🟡 Amber | `#f59e0b` | Minor anomaly, increased tracking |
| **High** | `61–80` | 🟠 Orange | `#f97316` | Suspicious loitering/maneuver, prepare response |
| **Critical** | `81–100` | 🔴 Red | `#ef4444` | High threat, dark vessel, officer dispatch required |

---

## 4. Zone Classification

| Classification | Color | Hex Code |
| :--- | :--- | :--- |
| **Normal** | Green | `#22c55e` |
| **Monitoring** | Cyan | `#0284c7` |
| **Restricted** | Amber | `#f59e0b` |
| **High Risk** | Orange | `#f97316` |
| **Critical** | Red | `#ef4444` |

---

## 5. UI Controls & Component Styles

* **Primary Button** (`.btn-primary`): Background `#0f172a`, Text `#ffffff`
* **Secondary Button** (`.btn-secondary`): Background `#f1f5f9`, Border `#e2e8f0`, Text `#0f172a`
* **Inverted Button** (`.btn-inverted`): Background `#1e293b`, Text `#ffffff`
* **Outlined Button** (`.btn-outlined`): Background transparent, Border `#cbd5e1`, Text `#0f172a`
* **Success Button** (`.btn-success`): Background `#22c55e`, Text `#ffffff`
* **Danger Button** (`.btn-danger`): Background `#ef4444`, Text `#ffffff`
* **Typography**: **Inter** exclusively across all headlines, body copy, and UI controls. Tabular data uses **JetBrains Mono**.