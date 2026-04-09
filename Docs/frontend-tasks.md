# Implementation Plan: Intelligent AML Framework (Frontend)

## Overview

Next.js 15 / React 19 frontend with Tailwind CSS dark mode, react-force-graph (WebGL), Socket.IO client, and REST API integration. Tasks are ordered for incremental delivery: project setup, auth, layout, real-time alert feed, graph visualizer, case management, SAR viewer, admin config, and final wiring.

All API base URL references use `NEXT_PUBLIC_API_URL` env var. Socket.IO connects to `NEXT_PUBLIC_WS_URL`.

## Tasks

- [ ] 1. Project setup
  - Initialize Next.js 15 project with App Router; install: tailwindcss, socket.io-client, react-force-graph, recharts, axios, zustand, react-hook-form, zod
  - Configure Tailwind CSS with dark mode class strategy; set base background to slate-950, text to slate-100
  - Add .env.local.example: NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WS_URL
  - Configure path aliases in tsconfig.json: @/components, @/lib, @/store, @/hooks
  - _Requirements: 10.5, 10.6_

- [ ] 2. Global state and API client (src/lib/ and src/store/)
  - [ ] 2.1 Implement axios API client (src/lib/api.ts): base URL from NEXT_PUBLIC_API_URL; request interceptor attaches Authorization: Bearer <token> from localStorage; response interceptor redirects to /login on 401
    - _Requirements: 12.1, 12.3_
  - [ ] 2.2 Implement Zustand auth store (src/store/authStore.ts): state { user, token, role }; actions login(token, user), logout(); persist token to localStorage; expose isAdmin() helper
    - _Requirements: 12.1_
  - [ ] 2.3 Implement Zustand alert store (src/store/alertStore.ts): state { alerts[], metrics }; actions addAlert(alert), updateAlert(alertId, patch), setMetrics(metrics); alerts sorted by risk_score descending
    - _Requirements: 10.1, 10.3_
  - [ ] 2.4 Implement Zustand graph store (src/store/graphStore.ts): state { nodes[], links[], highlightedCycle[], smurfingClusters[] }; actions addEdge(edge), setSubgraph(nodes, links), highlightCycle(path), clearHighlights()
    - _Requirements: 9.1, 9.2, 9.3_

- [ ] 3. Authentication pages (src/app/login/)
  - [ ] 3.1 Implement LoginPage (src/app/login/page.tsx): dark-themed form with username and password fields; POST /api/auth/login on submit; store JWT and user in authStore; redirect to /dashboard on success; display error message on 401
    - _Requirements: 12.1, 12.3_
  - [ ] 3.2 Implement AuthGuard component (src/components/AuthGuard.tsx): wrap protected routes; redirect to /login if no valid token in authStore; check token expiry client-side (decode JWT exp claim)
    - _Requirements: 12.3_
  - [ ] 3.3 Implement AdminGuard component (src/components/AdminGuard.tsx): render children only if role === ADMIN; show 403 message otherwise
    - _Requirements: 12.1_

- [ ] 4. Root layout and navigation (src/app/layout.tsx)
  - [ ] 4.1 Implement RootLayout: dark slate-950 background; sidebar navigation with links to Dashboard, Graph, Cases, Admin (Admin link visible only to ADMIN role); top bar showing current user, role badge, and logout button
    - _Requirements: 10.5_
  - [ ] 4.2 Implement Sidebar component (src/components/Sidebar.tsx): collapsible; active route highlighted; icons for each section; show live HIGH alert count badge on Dashboard link
    - _Requirements: 10.1, 10.5_
  - [ ] 4.3 Implement Socket.IO provider (src/components/SocketProvider.tsx): connect on mount using NEXT_PUBLIC_WS_URL and Bearer token; listen for alert:new, alert:updated, metrics:update events; dispatch to alertStore and graphStore; reconnect automatically on disconnect
    - _Requirements: 10.2, 10.3_

- [ ] 5. Investigation Command Center — Dashboard (src/app/dashboard/)
  - [ ] 5.1 Implement MetricsBar component: display three stat cards — total HIGH alerts, total MEDIUM alerts, current TPS; values sourced from alertStore.metrics updated via metrics:update Socket.IO event; cards use color coding (red for HIGH, amber for MEDIUM, blue for TPS)
    - _Requirements: 10.3_
  - [ ] 5.2 Implement AlertVolumeChart component: Recharts AreaChart showing alert count over past 24 hours by tier (LOW/MEDIUM/HIGH); data from metrics:update trend array; dark theme with slate grid lines
    - _Requirements: 10.3_
  - [ ] 5.3 Implement AlertFeed component (src/components/AlertFeed.tsx): virtualized list of alerts from alertStore sorted by risk_score descending; each row shows account ID, pattern_type badge (color-coded), risk_score, tier badge, timestamp; new HIGH alerts animate in with a red flash; clicking a row sets selectedAlert in local state and navigates to alert detail panel
    - _Requirements: 10.1, 10.2_
  - [ ] 5.4 Implement RiskScoreBreakdown component: horizontal stacked bar chart showing cycle, smurfing, behavioral, geo score contributions from alert.score_breakdown; labels show component name, score, and weight percentage; use Recharts BarChart
    - _Requirements: 7.4, 10.4_
  - [ ] 5.5 Implement AlertDetailPanel component: slide-in right panel on alert selection; shows pattern_type, risk_tier badge, risk_score, RiskScoreBreakdown, XAINarrative, and buttons to open graph view and create/view case
    - _Requirements: 10.4_
  - [ ] 5.6 Implement XAINarrative component: renders Gemini-generated alert.xai_narrative text; highlights numeric values (USD amounts, percentages, counts) in amber; shows "AI Generated" badge; displays is_partial warning banner if SAR is partial
    - _Requirements: 8.2, 8.3_

- [ ] 6. Network Graph Visualizer (src/app/graph/ and src/components/GraphVisualizer.tsx)
  - [ ] 6.1 Implement GraphVisualizer component using react-force-graph (ForceGraph2D with WebGL renderer): nodes are accounts sized by total_inbound_usd + total_outbound_usd; edges are transactions colored by risk_tier (green LOW, amber MEDIUM, red HIGH); directed arrows on edges showing fund flow direction
    - _Requirements: 9.1_
  - [ ] 6.2 Implement cycle highlight rendering: when graphStore.highlightedCycle is non-empty, render cycle nodes with pulsing cyan border and cycle edges with cyan color and increased width; non-cycle nodes and edges dimmed to 20% opacity
    - _Requirements: 9.2_
  - [ ] 6.3 Implement smurfing cluster rendering: when graphStore.smurfingClusters is non-empty, draw a convex hull boundary around cluster nodes using canvas overlay; cluster boundary color amber with dashed stroke
    - _Requirements: 9.3_
  - [ ] 6.4 Implement NodeDetailPanel (src/components/NodeDetailPanel.tsx): triggered on node click; slide-in panel showing account_id, risk_score badge, transaction_count, total_inbound_usd, total_outbound_usd, baseline summary (history_days, amount_mean, low_confidence flag), and scrollable list of connected transactions with timestamp, counterparty, amount, type
    - _Requirements: 9.4_
  - [ ] 6.5 Implement GraphFilterPanel component: filter controls for time range (date pickers), amount range (min/max inputs), transaction_type (multi-select), risk_tier (checkbox group), pattern_type (checkbox group); on filter change call GET /api/graph/subgraph/:accountId with query params and update graphStore; debounce 300ms
    - _Requirements: 9.5_
  - [ ] 6.6 Implement incremental graph update: SocketProvider listens for alert:new event; extract edge data (from, to, amount, timestamp, txId) from payload; call graphStore.addEdge() to append node/link without full refetch; if either node is in current subscribed subgraph emit graph:subscribe via Socket.IO
    - _Requirements: 9.1, 14.1 (backend task)_
  - [ ] 6.7 Implement graph page (src/app/graph/page.tsx): full-screen dark canvas with GraphVisualizer, GraphFilterPanel sidebar, and NodeDetailPanel overlay; account search input at top to load a specific account's subgraph via GET /api/graph/subgraph/:accountId
    - _Requirements: 9.5, 9.6_

- [ ] 7. Case Management (src/app/cases/)
  - [ ] 7.1 Implement CaseListPage (src/app/cases/page.tsx): paginated table of cases; columns: case_id, subject_account_id, state badge (color-coded), alert pattern_type, created_at; filter by state; click row navigates to case detail
    - _Requirements: 11.1_
  - [ ] 7.2 Implement CaseDetailPage (src/app/cases/[id]/page.tsx): shows case state badge, subject account, linked alert summary, RiskScoreBreakdown, XAINarrative; state transition buttons rendered based on current state and valid next states; disabled with tooltip if transition not permitted
    - _Requirements: 11.1, 11.4_
  - [ ] 7.3 Implement CaseStateTransition component: PATCH /api/cases/:id/state on button click; show reason_code dropdown (required); show confirmation modal before submitting; display error message if transition rejected by backend; refresh case on success
    - _Requirements: 11.2, 11.4_
  - [ ] 7.4 Implement CaseNotes component: chronological list of notes with author, timestamp, content; textarea + submit button to POST /api/cases/:id/notes; optimistic UI update on submit
    - _Requirements: 11.3_
  - [ ] 7.5 Implement SARPanel component within case detail: shows existing SAR draft if sar_draft_id present (subject_summary, activity_narrative, transaction_timeline, risk_indicators, recommended_filing_category); "Generate SAR" button calls POST /api/alerts/:id/sar; shows loading spinner while queued in SARQueue; displays is_partial warning if Gemini failed
    - _Requirements: 8.2, 8.4, 10.5 (backend SARQueue)_
  - [ ] 7.6 Implement SAR attachment gate: CLOSED_SAR_FILED transition button disabled and shows tooltip "Attach a completed SAR before closing" if no sar_draft_id on case; enabled once SAR is generated and attached
    - _Requirements: 11.5_

- [ ] 8. Admin Panel (src/app/admin/)
  - [ ] 8.1 Implement ThresholdConfigUI (src/app/admin/config/page.tsx): wrapped in AdminGuard; form showing all system_config parameters with current value, valid_range hint, and default_value; inputs validated client-side against valid_range before submit; PUT /api/admin/config on save; show success toast and error details on validation rejection
    - _Requirements: 14.1, 14.2, 14.4_
  - [ ] 8.2 Implement AuditLogViewer (src/app/admin/audit/page.tsx): wrapped in AdminGuard; paginated table with columns: timestamp, user_id, user_role, action_type, resource_id, outcome (SUCCESS green / FAILURE red); date-range filter inputs; GET /api/admin/audit with pagination and date params
    - _Requirements: 13.1, 13.2_

- [ ] 9. Shared UI components (src/components/ui/)
  - [ ] 9.1 Implement RiskTierBadge component: pill badge with color — red bg for HIGH, amber for MEDIUM, green for LOW; accepts tier string prop
    - _Requirements: 10.1_
  - [ ] 9.2 Implement PatternTypeBadge component: pill badge — purple for CIRCULAR_TRADING, orange for SMURFING, blue for BEHAVIORAL_ANOMALY
    - _Requirements: 10.1_
  - [ ] 9.3 Implement ConfirmModal component: reusable dark modal with title, message, confirm and cancel buttons; used by state transitions and destructive actions
    - _Requirements: 11.2_
  - [ ] 9.4 Implement Toast notification system: top-right toast stack; variants success (green), error (red), warning (amber), info (blue); auto-dismiss after 4 seconds
    - _Requirements: 14.1_
  - [ ] 9.5 Implement LoadingSpinner and SkeletonCard components for async data states; used across AlertFeed, CaseList, GraphVisualizer initial load
    - _Requirements: 10.6_
  - [ ] 9.6 Implement StatCard component: dark card with label, large numeric value, optional trend indicator (up/down arrow with percentage); used in MetricsBar
    - _Requirements: 10.3_

- [ ] 10. Responsive layout and performance
  - [ ] 10.1 Ensure Investigation Dashboard (AlertFeed + MetricsBar + AlertVolumeChart) is fully functional at 1920x1080 minimum resolution; test layout at 1440x900 and 2560x1440
    - _Requirements: 10.6_
  - [ ] 10.2 Implement react-force-graph canvas resize handler: graph fills available container width/height; re-renders on window resize without full remount
    - _Requirements: 9.6_
  - [ ] 10.3 Implement AlertFeed virtualization: use windowed list (react-window or built-in) for alert list exceeding 200 items to maintain smooth scroll performance
    - _Requirements: 10.1_

- [ ] 11. Integration wiring and end-to-end flow
  - [ ] 11.1 Wire SocketProvider alert:new handler: on receiving alert, call alertStore.addAlert(); if alert.cycle_detail exists call graphStore.highlightCycle(cycle_detail.cycle_path); if alert.smurfing_detail exists call graphStore update for smurfing cluster
    - _Requirements: 10.2, 9.2, 9.3_
  - [ ] 11.2 Wire alert selection flow: clicking alert in AlertFeed → AlertDetailPanel opens → "View in Graph" button loads subgraph for subject_account_id via GET /api/graph/subgraph/:accountId → GraphVisualizer renders with cycle/cluster highlights → "Open Case" button navigates to /cases or creates new case via POST /api/cases
    - _Requirements: 10.4, 9.1_
  - [ ] 11.3 Wire SAR generation flow: "Generate SAR" in SARPanel → POST /api/alerts/:id/sar → poll GET /api/cases/:id until sar_draft_id populated (or use alert:updated Socket.IO event) → render SAR sections in SARPanel → enable CLOSED_SAR_FILED transition
    - _Requirements: 8.2, 11.5_
  - [ ] 11.4 Verify full hero flow end-to-end: simulator running → alert:new received via Socket.IO → AlertFeed updates without page refresh → alert selected → graph renders with cycle highlighted → SAR generated → case closed
    - _Requirements: 10.2, 9.2, 8.2, 11.1_

- [ ] 12. Final checkpoint: ensure all pages render without errors
  - Test login → dashboard → graph → case → admin flow with a running backend
  - Verify dark theme consistency across all pages
  - Ensure all Socket.IO events update UI correctly without page refresh

## Notes

- All pages use dark mode by default (no light mode toggle needed for hackathon)
- react-force-graph must be dynamically imported with ssr: false (Next.js App Router requirement for canvas)
- Socket.IO client must connect only after JWT is available in authStore
- SARQueue depth is exposed in metrics:update — show it in MetricsBar as "SAR Queue" stat card
- Graph page account search defaults to the subject_account_id of the last selected alert
- Tasks marked with * are optional for faster MVP delivery
