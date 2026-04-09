# Design System Specification: The Architectural Analyst

## 1. Overview & Creative North Star
**Creative North Star: "The Ethereal Ledger"**
In the world of financial AML (Anti-Money Laundering), density often leads to clutter, and "security" often manifests as heavy, industrial grids. This design system rejects that premise. It is built on the philosophy of **The Ethereal Ledger**: an experience that feels as authoritative and precise as a high-end financial broadsheet, but as fluid and breathable as a modern editorial gallery.

We move beyond the "template" look by utilizing **Tonal Architecture**. Instead of using lines to box in data, we use light, depth, and sophisticated layering. The layout should feel like a series of organized, translucent panes floating in a high-light environment, where information is prioritized through optic weight rather than containment.

---

## 2. Colors & Surface Logic
This system leverages a sophisticated palette of Indigos and Violets, anchored by a "High-Light" neutral scale.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to define sections or containers. All spatial boundaries must be created through background color shifts. A `surface-container-low` card sitting on a `surface` background provides all the definition a professional eye requires. Lines are clutter; tone is structure.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Use the following tiers to create "nested" depth:
*   **Base Layer (`surface` / `#f7f9fb`):** The canvas of the application.
*   **Sectional Layer (`surface-container-low` / `#f2f4f6`):** Used for large content areas or sidebar backgrounds.
*   **Actionable Layer (`surface-container-lowest` / `#ffffff`):** Reserved for primary cards, data tables, and input areas. Placing a white card on a soft gray background creates a natural "pop" without heavy shadows.

### The "Glass & Gradient" Rule
To elevate the system above a standard SaaS kit:
*   **Glassmorphism:** For floating modals or dropdowns, use `surface_container_lowest` at 80% opacity with a `backdrop-blur` of 20px. 
*   **Signature Textures:** For high-value actions, use a "Micro-Gradient" from `primary` (#3525cd) to `primary_container` (#4f46e5). This subtle 15-degree shift provides a "jewel-like" finish to buttons that flat hex codes cannot replicate.

---

## 3. Typography: Editorial Precision
We use **Inter** exclusively, but we treat it with editorial intent. The goal is "Compact Readability."

*   **Display & Headlines:** Use `display-sm` and `headline-md` for high-level metric summaries. These should have a slight negative letter-spacing (-0.02em) to feel "tight" and authoritative.
*   **Data Titles:** `title-sm` (1rem) is your workhorse for card titles. It should always be `on_surface`.
*   **The Utility Scale:** AML dashboards require high density. Use `label-md` for table headers in all caps with +0.05em tracking to ensure legibility at small sizes.
*   **Hierarchy:** Contrast is achieved by pairing `on_surface` (primary text) with `on_surface_variant` (secondary/label text). Never use pure black.

---

## 4. Elevation & Depth
Depth in this design system is organic, mimicking how light hits fine paper.

*   **Tonal Layering:** The primary method of elevation. Stack `surface-container-lowest` (White) on top of `surface-container` (Pale Gray) to denote a "raised" element.
*   **Ambient Shadows:** For high-level floating elements (e.g., a "Risk Alert" modal), use an extra-diffused shadow: `0px 12px 32px rgba(79, 70, 229, 0.06)`. Note the use of a subtle Indigo tint in the shadow rather than gray; this keeps the "bright" feel of the dashboard.
*   **The Ghost Border:** If a boundary is strictly required for accessibility, use `outline_variant` at 15% opacity. It should be felt, not seen.
*   **The 8px Standard:** All containers, buttons, and input fields must use the `DEFAULT` (0.5rem / 8px) corner radius to maintain a professional, soft-yet-precise edge.

---

## 5. Components

### Buttons
*   **Primary:** Micro-gradient (`primary` to `primary_container`), `on_primary` text. No border.
*   **Secondary:** `surface_container_highest` background with `primary` text.
*   **Tertiary:** Ghost style. No background; `primary` text. Use for low-emphasis actions like "Cancel."

### Input Fields & Data Entry
*   **Style:** `surface_container_lowest` background. 
*   **Focus State:** A 2px "Ghost Border" using `primary` at 30% opacity.
*   **Error State:** Text and soft underline in `error` (#ba1a1a). No red boxes.

### Data Tables (The Core AML Tool)
*   **Rule:** Forbid divider lines. 
*   **Implementation:** Use a `surface_container_low` background on every second row (zebra striping) or simply utilize vertical white space (16px between rows). 
*   **Headers:** Use `label-sm` in `on_surface_variant`, all-caps.

### Chips (Risk Indicators)
*   **Positive (Clean):** `tertiary_fixed` background with `on_tertiary_fixed_variant` text.
*   **Alert (High Risk):** `error_container` background with `on_error_container` text.
*   **Shape:** Always `full` (pill) for chips to contrast against 8px cards.

---

## 6. Do's and Don'ts

### Do
*   **Do** embrace asymmetry. In a financial dashboard, not every card needs to be the same width. Let the data dictate the container size.
*   **Do** use "Negative Space" as a functional tool. More space between data points reduces the cognitive load of AML investigation.
*   **Do** use the `tertiary` (Teal) palette for "Safe" status indicators—it feels more modern than a standard "Success Green."

### Don't
*   **Don't** use 1px black or dark gray borders. It makes the interface look like a legacy banking app.
*   **Don't** use heavy dropshadows. If the elevation isn't clear through tonal shifting, your layout needs more white space, not more shadow.
*   **Don't** use pure `#000000` for text. It creates "visual vibration" on clean white backgrounds. Use `on_surface` (#191c1e).