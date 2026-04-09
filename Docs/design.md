# Design Document: Intelligent AML Framework

## Overview

The Intelligent AML Framework is a real-time financial crime detection platform targeting Smurfing (Structuring) and Circular Trading (Layering) typologies. It combines a synthetic transaction engine, graph-theoretic DFS cycle detection, rolling-window behavioral velocity analysis, a hybrid risk scoring engine, and Explainable AI (XAI) SAR generation via Gemini 1.5 Flash. A dark-themed Investigation Command Center built on Next.js 15 provides compliance analysts and administrators with a unified operational interface featuring a WebGL-accelerated network graph.

### Hero Flow

```
Synthetic Data → Detection Engine (DFS Cycle + Rolling Window Smurfing)
              → Risk Scoring → Gemini AI Narrative → Visual Graph + Real-time Alert
```

### Design Goals

- Sub-500ms end-to-end latency from transaction ingestion to alert generation
- Modular, layered architecture enabling independent development of detection, scoring, and UI subsystems
- Full auditability via append-only audit log
- Explainability at every decision point via score decomposition and AI-generated narratives
- Achievable by a small team in 36 hours

### Key Design Decisions

- **In-memory adjacency list** for the hot-path Transaction_Graph (cycle detection), backed by MongoDB for persistence — avoids serialization overhead on the critical path
- **Rolling window state in memory** (per-account maps) for smurfing detection — enables O(1) window updates
- **Standard behavioral baselines** using batch mean/stddev computed over a rolling 90-day window stored in MongoDB — simple, correct, and easy to implement
- **Gemini 1.5 Flash** for SAR generation — low latency, structured output support, generous free tier
- **react-force-graph** for graph visualization — WebGL-accelerated, handles 100k nodes in the browser
- **Socket.IO** for real-time alert push — avoids polling, instant dashboard updates
- **HS256 JWT** with 8-hour expiry — simple, secure, no asymmetric key management overhead
- **Two RBAC roles only** (ANALYST, ADMIN) — covers all required permissions without unnecessary complexity


---

## Architecture

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER (Browser)                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Next.js 15 / React 19 — Investigation Command Center            │   │
│  │  ┌──────────────┐ ┌──────────────────────┐ ┌──────────────────┐ │   │
│  │  │ Alert Feed   │ │ Graph Visualizer      │ │ Case Mgmt /      │ │   │
│  │  │ (Socket.IO)  │ │ (react-force-graph    │ │ Config (REST)    │ │   │
│  │  │              │ │  WebGL)               │ │                  │ │   │
│  │  └──────────────┘ └──────────────────────┘ └──────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTPS / WSS
┌───────────────────────────────▼─────────────────────────────────────────┐
│                        API GATEWAY LAYER                                │
│  Express.js — JWT Middleware (HS256) → RBAC Middleware → Route Handlers │
│  Socket.IO Server (real-time alert broadcast)                           │
└──────┬──────────────┬──────────────┬──────────────┬─────────────────────┘
       │              │              │              │
┌──────▼──────┐ ┌─────▼──────┐ ┌────▼──────┐ ┌────▼──────────────────┐
│  Ingestion  │ │ Detection  │ │  Scoring  │ │  SAR Generator        │
│  Pipeline   │ │  Engine    │ │  Engine   │ │  (Gemini 1.5 Flash)   │
│             │ │            │ │           │ │                       │
│ Validate    │ │ DFS Cycle  │ │ Weighted  │ │ Prompt Builder        │
│ Normalize   │ │ Detection  │ │ Composite │ │ Gemini API Client     │
│ Persist     │ │ Smurfing   │ │ Score     │ │ SAR Formatter         │
│             │ │ Behavioral │ │ Tier      │ │                       │
└──────┬──────┘ └─────┬──────┘ └────┬──────┘ └────┬──────────────────┘
       │              │              │              │
┌──────▼──────────────▼──────────────▼──────────────▼─────────────────────┐
│                        DATA LAYER                                       │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  MongoDB                                                        │    │
│  │  transactions │ accounts │ alerts │ cases │ audit_logs │ users  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────────────┐       │
│  │  In-Memory State (Node.js process)                           │       │
│  │  Transaction Graph (adjacency list) │ Rolling Window Maps    │       │
│  └──────────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────┐
│                  Transaction Simulator (separate process)               │
│  Configurable TPS emitter → POST /api/transactions/ingest               │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility |
|---|---|
| Transaction Simulator | Generates synthetic transaction streams with configurable TPS and pattern injection |
| Ingestion Pipeline | Validates, normalizes, persists transactions; publishes to detection pipeline |
| Detection Engine | Executes DFS cycle detection, smurfing rolling-window analysis, behavioral anomaly scoring |
| Risk Scoring Engine | Aggregates detection signals into composite [0–100] Risk_Score with tier classification |
| SAR Generator | Builds structured prompts, calls Gemini 1.5 Flash, formats SAR drafts |
| API Gateway | JWT auth (HS256), RBAC enforcement (2 roles), REST routes, Socket.IO server |
| Investigation Dashboard | Real-time alert feed, WebGL graph visualization, case management, config UI |
| Audit Trail | Append-only audit log collection; records all state-mutating operations |


---

## Components and Interfaces

### Backend Components

#### 1. Ingestion Pipeline (`src/ingestion/`)

- `TransactionValidator` — JSON Schema validation against canonical transaction schema; rejects malformed records with a logged error, skips without halting the stream
- `TransactionNormalizer` — currency normalization to USD via exchange rate table; timestamp normalization to UTC ISO 8601
- `TransactionRepository` — MongoDB write; publishes normalized record to in-process event emitter for downstream detection

#### 2. Detection Engine (`src/detection/`)

- `GraphManager` — maintains in-memory adjacency list; exposes `addEdge(from, to, amount, timestamp, txId)`, `getNeighbors(nodeId)`, `getSubgraph(nodeId, depth)`
- `CycleDetector` — DFS-based cycle detection triggered on each new edge; configurable max cycle length N (default 6); **the technical centerpiece of the system**
- `SmurfingDetector` — per-account rolling window state machine; evaluates structuring criteria on each new transaction using a sorted list of `{timestamp, amount, receiverId}` entries
- `BehavioralProfiler` — computes mean and standard deviation of account transaction behavior over a rolling 90-day window using MongoDB aggregation; updates account baseline document on each transaction
- `DetectionOrchestrator` — coordinates parallel execution of all three detectors; collects signals and forwards to scoring engine

#### 3. Risk Scoring Engine (`src/scoring/`)

- `RiskScorer` — computes weighted composite score from detection signals; applies configurable weights
- `GeoRiskEvaluator` — looks up FATF high-risk jurisdiction list; returns geographic risk contribution (0–15 pts)
- `ThresholdConfig` — singleton holding current configurable parameters; updated via admin API without restart

#### 4. SAR Generator (`src/sar/`)

- `PromptBuilder` — constructs structured Gemini prompt from alert data, risk decomposition, and baseline metrics
- `GeminiClient` — wraps Gemini 1.5 Flash API with 10-second timeout and fallback to partial template on error
- `SARFormatter` — structures Gemini response into canonical SAR sections (subject summary, narrative, timeline, risk indicators, filing category)

#### 5. Auth & RBAC (`src/auth/`)

- `JWTMiddleware` — validates HS256 Bearer token; attaches decoded user payload to `req.user`; rejects expired tokens (8-hour expiry)
- `RBACMiddleware` — factory function `requireRole(...roles)` returning Express middleware; enforces 2-role model

#### 6. Audit Trail (`src/audit/`)

- `AuditLogger` — writes append-only entries to `audit_logs` collection; no update/delete operations in application code

### Frontend Components (`src/app/`)

| Component | Description |
|---|---|
| `AlertFeed` | Real-time list of alerts ordered by Risk_Score; Socket.IO subscription for instant updates without polling |
| `GraphVisualizer` | **react-force-graph WebGL canvas** — node/edge rendering with risk-tier color coding; filter panel; handles 100k nodes |
| `NodeDetailPanel` | Slide-in panel on node click; account stats, baseline summary, connected transactions |
| `CasePanel` | Case state machine UI; note editor; SAR attachment; lifecycle transition buttons |
| `RiskScoreBreakdown` | Stacked bar visualization of score component contributions |
| `XAINarrative` | Renders **Gemini-generated SAR narrative** with highlighted quantitative references |
| `MetricsDashboard` | Alert tier counts, 24h volume trend chart, current TPS gauge |
| `ThresholdConfigUI` | Admin-only form for all configurable parameters with validation and current/default display |
| `AuditLogViewer` | Paginated audit log table with date-range filter |
| `AuthPages` | Login form, session expiry redirect |

### Key REST API Endpoints

```
POST   /api/transactions/ingest          — receive transaction from simulator
GET    /api/transactions/:id             — fetch single transaction
GET    /api/alerts                       — list alerts (paginated, filterable)
GET    /api/alerts/:id                   — alert detail with score decomposition
POST   /api/alerts/:id/sar               — trigger SAR generation
GET    /api/graph/subgraph/:accountId    — fetch subgraph for visualization
GET    /api/accounts/:id/baseline        — fetch behavioral baseline
POST   /api/cases                        — create case from alert
GET    /api/cases/:id                    — case detail
PATCH  /api/cases/:id/state              — transition case state
POST   /api/cases/:id/notes              — add case note
GET    /api/admin/config                 — get current threshold config (ADMIN only)
PUT    /api/admin/config                 — update threshold config (ADMIN only)
GET    /api/admin/audit                  — query audit log (ADMIN only)
POST   /api/auth/login                   — authenticate, receive JWT
POST   /api/auth/logout                  — invalidate session
```

### WebSocket Events (Socket.IO)

```
Server → Client:
  alert:new          { alert }                        — new alert generated
  alert:updated      { alertId, patch }               — alert risk score or tier updated
  metrics:update     { tps, alertCounts, trend }      — periodic metrics push (5s interval)

Client → Server:
  graph:subscribe    { accountId }                    — subscribe to live graph updates for account
  graph:unsubscribe  { accountId }
```


---

## Data Models

### MongoDB Collections

#### `transactions`

```javascript
{
  _id: ObjectId,
  transaction_id: String,          // UUID v4, unique index
  sender_account_id: String,       // indexed
  receiver_account_id: String,     // indexed
  amount_usd: Number,              // normalized to USD
  amount_original: Number,
  currency_original: String,       // ISO 4217
  timestamp: Date,                 // indexed
  transaction_type: String,        // WIRE | ACH | CASH | CRYPTO
  geolocation: {
    sender_country: String,        // ISO 3166-1 alpha-2
    receiver_country: String
  },
  channel: String,                 // MOBILE | BRANCH | ATM | ONLINE
  device_id: String,
  is_synthetic: Boolean,
  pattern_tag: String,             // null | SMURFING | CIRCULAR_TRADING (simulator label)
  ingested_at: Date,
  schema_version: Number
}
// Indexes: transaction_id (unique), sender_account_id, receiver_account_id, timestamp
// Compound: { sender_account_id, timestamp } for rolling window queries
```

#### `accounts`

```javascript
{
  _id: ObjectId,
  account_id: String,              // unique index
  first_seen: Date,
  last_seen: Date,
  total_inbound_usd: Number,
  total_outbound_usd: Number,
  transaction_count: Number,
  baseline: {
    window_start: Date,            // 90 days ago
    window_end: Date,
    daily_freq_mean: Number,       // computed via MongoDB aggregation over rolling window
    daily_freq_stddev: Number,
    amount_mean: Number,
    amount_stddev: Number,
    amount_p90: Number,
    known_counterparties: [String],
    type_distribution: Object,     // { WIRE: 0.4, ACH: 0.3, ... }
    channel_distribution: Object,
    geo_distribution: Object,      // { US: 0.8, MX: 0.2 }
    history_days: Number,          // days of data in baseline
    low_confidence: Boolean        // true if history_days < 30
  },
  updated_at: Date
}
```

#### `alerts`

```javascript
{
  _id: ObjectId,
  alert_id: String,                // UUID v4, unique index
  pattern_type: String,            // CIRCULAR_TRADING | SMURFING | BEHAVIORAL_ANOMALY
  subject_account_id: String,      // indexed
  involved_accounts: [String],
  transaction_ids: [String],
  risk_score: Number,              // [0, 100]
  risk_tier: String,               // LOW | MEDIUM | HIGH
  score_breakdown: {
    cycle_score: Number,
    cycle_weight: Number,
    smurfing_score: Number,
    smurfing_weight: Number,
    behavioral_score: Number,
    behavioral_weight: Number,
    geo_score: Number,
    geo_weight: Number
  },
  cycle_detail: {                  // populated for CIRCULAR_TRADING
    cycle_path: [String],          // ordered account IDs
    cycle_length: Number,
    total_value_usd: Number,
    duration_hours: Number,
    fatf_involved: Boolean
  },
  smurfing_detail: {               // populated for SMURFING
    transaction_count: Number,
    aggregate_amount_usd: Number,
    individual_amounts: [Number],
    distinct_receivers: Number,
    window_hours: Number,
    coordinated_multiplier_applied: Boolean,
    velocity_spike: { observed: Number, mean: Number, stddev: Number }
  },
  behavioral_detail: {             // populated for BEHAVIORAL_ANOMALY
    anomaly_type: String,          // HIGH_VALUE_NEW_COUNTERPARTY | FREQUENCY_SPIKE
    observed_value: Number,
    baseline_mean: Number,
    baseline_stddev: Number,
    deviation_sigma: Number
  },
  xai_narrative: String,           // Gemini-generated narrative
  sar_draft_id: String,
  case_id: String,
  created_at: Date,                // indexed
  updated_at: Date
}
```

#### `cases`

```javascript
{
  _id: ObjectId,
  case_id: String,                 // UUID v4, unique index
  alert_id: String,
  subject_account_id: String,
  state: String,                   // OPEN | UNDER_REVIEW | ESCALATED | CLOSED_SAR_FILED | CLOSED_DISMISSED
  state_history: [{
    from_state: String,
    to_state: String,
    user_id: String,
    reason_code: String,
    timestamp: Date
  }],
  notes: [{
    note_id: String,
    author_user_id: String,
    content: String,
    created_at: Date
  }],
  sar_draft_id: String,            // required before CLOSED_SAR_FILED transition
  assigned_to: String,             // user_id
  created_at: Date,
  updated_at: Date
}
```

#### `sar_drafts`

```javascript
{
  _id: ObjectId,
  sar_id: String,                  // UUID v4
  alert_id: String,
  case_id: String,
  generated_by: String,            // user_id
  gemini_request_id: String,
  generated_at: Date,
  subject_summary: String,
  activity_narrative: String,
  transaction_timeline: [{
    timestamp: Date,
    from_account: String,
    to_account: String,
    amount_usd: Number,
    type: String
  }],
  risk_indicators: [String],
  recommended_filing_category: String,
  is_partial: Boolean              // true if Gemini API failed; pre-populated template returned
}
```

#### `audit_logs`

```javascript
{
  _id: ObjectId,                   // append-only — no update/delete in application code
  log_id: String,                  // UUID v4
  user_id: String,                 // indexed
  user_role: String,               // ANALYST | ADMIN
  action_type: String,             // ALERT_VIEW | CASE_TRANSITION | NOTE_ADD | SAR_GENERATE |
                                   // THRESHOLD_CHANGE | USER_MANAGE | AUTH_LOGIN | AUTH_FAIL | ...
  resource_type: String,
  resource_id: String,
  action_timestamp: Date,          // UTC, indexed
  outcome: String,                 // SUCCESS | FAILURE
  metadata: Object,                // action-specific payload (prev/new values for config changes, etc.)
  ip_address: String
}
// Indexes: user_id, action_timestamp, action_type
```

#### `users`

```javascript
{
  _id: ObjectId,
  user_id: String,                 // UUID v4, unique index
  username: String,                // unique index
  email: String,                   // unique index
  password_hash: String,           // bcrypt, cost factor 12
  role: String,                    // ANALYST | ADMIN
  created_at: Date,
  last_login: Date
}
```

#### `system_config`

```javascript
{
  _id: ObjectId,
  config_key: String,              // unique index, e.g. "ctr_threshold"
  value: Mixed,
  default_value: Mixed,
  valid_range: { min: Mixed, max: Mixed },
  description: String,
  updated_by: String,
  updated_at: Date
}
```


---

## Algorithm Design

### DFS Cycle Detection (Technical Centerpiece)

The cycle detector runs on every new edge addition to the in-memory Transaction_Graph. It uses an iterative DFS with a visited set and recursion stack to find all simple cycles of length 2 through N that include the newly added edge.

**Rationale for edge-triggered DFS**: Running full Johnson's algorithm on every transaction would be O(V+E)(C+1) where C is the number of cycles — too expensive at real-time ingestion rates. Instead, we run a bounded DFS from the new edge's destination node, looking only for paths that return to the source node within N hops and within the time window. This reduces the search space dramatically while guaranteeing detection of all cycles involving the new edge.

```
FUNCTION detectCycles(graph, newEdge, maxLength, timeWindowHours):
  source = newEdge.from
  dest   = newEdge.to
  cycles = []

  // DFS from dest, looking for paths back to source
  FUNCTION dfs(current, path, visitedSet, depth):
    IF depth > maxLength - 1:
      RETURN
    FOR EACH neighbor IN graph.getNeighbors(current):
      edge = graph.getEdge(current, neighbor)
      IF neighbor == source AND len(path) >= 1:
        // Found a cycle: source → ... → current → source
        cycle = [source] + path + [source]
        cycleEdges = [newEdge] + edgesAlongPath(path)
        IF allWithinTimeWindow(cycleEdges, timeWindowHours):
          cycles.append(cycle)
      ELSE IF neighbor NOT IN visitedSet:
        visitedSet.add(neighbor)
        dfs(neighbor, path + [neighbor], visitedSet, depth + 1)
        visitedSet.remove(neighbor)  // backtrack

  visitedSet = {source}
  dfs(dest, [dest], visitedSet, 1)
  RETURN cycles

FUNCTION allWithinTimeWindow(edges, windowHours):
  minTime = MIN(edge.timestamp FOR edge IN edges)
  maxTime = MAX(edge.timestamp FOR edge IN edges)
  RETURN (maxTime - minTime).hours <= windowHours
```

**Cycle Risk Score Contribution:**

```
FUNCTION computeCycleScore(cycle, edges):
  // Length factor: shorter cycles are more suspicious (max 40 pts)
  lengthScore = 40 * (1 - (cycle.length - 2) / (maxCycleLength - 2))

  // Value factor: higher circulated value = higher risk (max 30 pts)
  totalValue = SUM(edge.amount FOR edge IN edges)
  valueScore = MIN(30, 30 * totalValue / HIGH_VALUE_THRESHOLD)

  // Time compression: faster cycle = more suspicious (max 10 pts)
  durationHours = (maxTimestamp - minTimestamp).hours
  compressionRatio = durationHours / (cycle.length * MIN_REALISTIC_HOURS)
  compressionScore = 10 * (1 - MIN(1, compressionRatio))

  // FATF jurisdiction bonus
  fatfBonus = 20 IF anyFATFJurisdiction(cycle.accounts) ELSE 0

  RETURN MIN(100, lengthScore + valueScore + compressionScore + fatfBonus)
```

### Smurfing / Structuring Detection (Rolling Window)

Per-account rolling window state is maintained in a `Map<accountId, SortedList<{timestamp, amount, receiverId}>>`. On each new transaction, the window is trimmed and structuring criteria evaluated. This is an O(1) update with O(W) evaluation where W is the window size.

```
FUNCTION evaluateSmurfing(accountId, newTx, config):
  window = rollingWindows.get(accountId) OR []

  // Trim entries outside the rolling window
  cutoff = newTx.timestamp - config.windowHours * 3600 * 1000
  window = window.filter(tx => tx.timestamp >= cutoff)
  window.push({ timestamp: newTx.timestamp, amount: newTx.amount_usd,
                receiverId: newTx.receiver_account_id })
  rollingWindows.set(accountId, window)

  aggregateAmount = SUM(tx.amount FOR tx IN window)
  allBelowThreshold = ALL(tx.amount < config.ctrThreshold FOR tx IN window)
  distinctReceivers = COUNT_DISTINCT(tx.receiverId FOR tx IN window)

  IF aggregateAmount >= config.ctrThreshold AND allBelowThreshold:
    baseScore = computeSmurfingBaseScore(window, config)
    multiplier = 1.25 IF distinctReceivers >= 3 ELSE 1.0
    finalScore = MIN(100, baseScore * multiplier)
    EMIT smurfingAlert(accountId, window, finalScore, distinctReceivers)

FUNCTION computeSmurfingBaseScore(window, config):
  // More transactions = higher score (max 50 pts)
  txCountScore = MIN(50, 50 * len(window) / config.smurfingTxCountThreshold)
  // Closer to threshold = higher score (max 30 pts)
  aggregate = SUM(tx.amount FOR tx IN window)
  proximityScore = 30 * MIN(1, aggregate / (config.ctrThreshold * 1.5))
  // Time compression (max 20 pts)
  span = (MAX(tx.timestamp) - MIN(tx.timestamp)).hours
  compressionScore = 20 * (1 - MIN(1, span / config.windowHours))
  RETURN txCountScore + proximityScore + compressionScore
```

**Velocity Spike Detection:**

```
FUNCTION checkVelocitySpike(accountId, baseline, hourlyTxCount):
  IF baseline.history_days < 30:
    mean   = POPULATION_MEAN_HOURLY_TX
    stddev = POPULATION_STDDEV_HOURLY_TX
  ELSE:
    mean   = baseline.daily_freq_mean / 24
    stddev = baseline.daily_freq_stddev / 24

  IF stddev == 0: RETURN null
  zScore = (hourlyTxCount - mean) / stddev
  IF zScore > 3:
    RETURN { observed: hourlyTxCount, mean, stddev, zScore }
  RETURN null
```

### Standard Behavioral Baselines

Account behavioral baselines are computed using standard batch mean and standard deviation over the rolling 90-day window. On each transaction, the account's baseline document is updated via a MongoDB aggregation pipeline that computes statistics over the trailing 90-day window of that account's transactions. This is straightforward, correct, and requires no specialized online algorithm.

```
// Baseline update triggered after each transaction persist
FUNCTION updateBaseline(accountId):
  windowStart = now() - 90 * 24 * 3600 * 1000
  stats = db.transactions.aggregate([
    { $match: { sender_account_id: accountId, timestamp: { $gte: windowStart } } },
    { $group: {
        _id: null,
        amount_mean:       { $avg: "$amount_usd" },
        amount_stddev:     { $stdDevPop: "$amount_usd" },
        amount_p90:        { $percentile: { input: "$amount_usd", p: [0.9], method: "approximate" } },
        transaction_count: { $sum: 1 },
        known_counterparties: { $addToSet: "$receiver_account_id" }
    }}
  ])
  db.accounts.updateOne({ account_id: accountId }, { $set: { baseline: stats, updated_at: now() } })
```

### Key Processing Flow: Transaction Ingestion → Alert

```
Simulator / Client
    │
    ▼
POST /api/transactions/ingest
    │
    ├─► TransactionValidator (schema check)
    │       │ FAIL → log error, skip record, continue stream
    │       │ PASS ↓
    ├─► TransactionNormalizer (currency → USD, timestamp → UTC)
    │
    ├─► TransactionRepository.save() (MongoDB write)
    │
    ├─► GraphManager.addEdge()  ──────────────────────────────────┐
    │                                                             │
    ├─► DetectionOrchestrator.analyze(tx)  [parallel execution]  │
    │       ├─► CycleDetector.detect()  ◄────────────────────────┘
    │       │       └─► DFS on in-memory adjacency list
    │       ├─► SmurfingDetector.evaluate()
    │       │       └─► rolling window map (in-memory)
    │       └─► BehavioralProfiler.score()
    │               └─► account baseline from MongoDB
    │
    ├─► RiskScorer.compute(signals)
    │       └─► GeoRiskEvaluator.score(tx.geolocation)
    │
    ├─► AlertRepository.save(alert)
    │
    └─► Socket.IO broadcast: alert:new
            └─► Dashboard AlertFeed updates in real-time (no polling)
```


---

## Security Design

### Authentication Flow

```
POST /api/auth/login { username, password }
  → bcrypt.compare(password, user.password_hash)
  → IF valid: return { jwt_token, expires_in: 28800 }
  → IF invalid: log AUTH_FAIL to audit_log, return 401

JWT Payload: { user_id, role, iat, exp }
JWT Algorithm: HS256 (shared secret from environment variable)
Token validity: 8 hours (28800 seconds)
Password hashing: bcrypt, cost factor 12
```

### RBAC Permission Matrix

| Action | ANALYST | ADMIN |
|---|---|---|
| View alerts | ✓ | ✓ |
| Add case notes | ✓ | ✓ |
| View graphs | ✓ | ✓ |
| Manage cases | ✓ | ✓ |
| Generate SARs | ✓ | ✓ |
| Modify thresholds | | ✓ |
| User management | | ✓ |
| Audit log access | | ✓ |

### Audit Trail

- All state-mutating operations write an entry to `audit_logs` before returning a response
- Application code contains no update or delete operations on the `audit_logs` collection
- Entries include: user_id, user_role, action_type, resource_id, timestamp (UTC), outcome, ip_address
- The entry count in `audit_logs` is monotonically non-decreasing


---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Transaction Record Field Completeness

*For any* transaction record generated by the Transaction_Simulator, the record must contain all required fields (`transaction_id`, `sender_account_id`, `receiver_account_id`, `amount`, `timestamp`, `transaction_type`, `geolocation`, `channel`, `device_id`) with values conforming to their specified types and formats (UUID v4, ISO 8601, ISO 3166-1 alpha-2, enumerated values).

**Validates: Requirements 1.1**

---

### Property 2: Smurfing Pattern Structural Invariants

*For any* smurfing cluster generated by the Transaction_Simulator when smurfing simulation is enabled, the cluster must satisfy all of: transaction count in [3, 15], each individual amount in [1000, 9999] USD, all transactions from a single sender account, at least 2 distinct receiver accounts, and all transactions within a 60-minute window.

**Validates: Requirements 1.3**

---

### Property 3: Circular Trading Pattern Structural Invariants

*For any* circular trading pattern generated by the Transaction_Simulator when circular trading simulation is enabled, the transaction chain must return funds to the originating account, have chain length in [2, 6], and complete within the configured time window.

**Validates: Requirements 1.4**

---

### Property 4: Realistic Amount Distribution

*For any* batch of 1,000 or more transactions generated by the Transaction_Simulator without pattern injection, at least 70% of transaction amounts must be below USD 5,000.

**Validates: Requirements 1.6**

---

### Property 5: Invalid Records Not Persisted

*For any* transaction record that fails schema validation, the record must not be present in the `transactions` collection, the ingestion pipeline must continue processing subsequent records, and the error must be logged with the original payload and a failure reason code.

**Validates: Requirements 2.3**

---

### Property 6: Currency Normalization Correctness

*For any* transaction with a non-USD currency, the persisted `amount_usd` field must equal `amount_original * exchange_rate[currency]` where `exchange_rate` is the configured exchange rate table. Normalizing an already-normalized USD amount must return the same value (idempotent).

**Validates: Requirements 2.5**

---

### Property 7: Transaction Graph Update Correctness

*For any* transaction that is successfully ingested, the Transaction_Graph must contain a directed edge from `sender_account_id` to `receiver_account_id` with weight equal to `amount_usd`, and the sender node's `total_outbound_usd` and the receiver node's `total_inbound_usd` must each increase by exactly `amount_usd`, and both nodes' `transaction_count` must increase by 1.

**Validates: Requirements 3.1, 3.2**

---

### Property 8: New Account Baseline Initialization

*For any* account ID that appears in a transaction for the first time, a behavioral baseline record must be created for that account with `history_days = 0` and null statistical fields before the transaction is published to the analysis pipeline.

**Validates: Requirements 3.3**

---

### Property 9: Cycle Detection Completeness and Time Window Enforcement

*For any* directed graph containing a simple cycle of length L where 2 ≤ L ≤ N (configured max), the DFS cycle detector must identify the cycle when the completing edge is added. A cycle must only be classified as a Circular_Trading pattern if the time span between the earliest and latest transaction in the cycle is within the configured time window; cycles exceeding the time window must not generate alerts.

**Validates: Requirements 4.1, 4.2, 4.5**

---

### Property 10: Cycle Alert Completeness and Score Bounds

*For any* confirmed Circular_Trading pattern, the generated alert must contain all participating account IDs, the ordered transaction sequence, and a cycle risk score contribution in [0, 100] computed from cycle length, total value circulated, time compression ratio, and FATF jurisdiction flag. The FATF flag must add exactly 20 points (capped at 100).

**Validates: Requirements 4.3, 4.4**

---

### Property 11: Structuring Classification Correctness

*For any* sender account and any rolling time window, the account must be classified as exhibiting Structuring behavior if and only if: the aggregate of all outbound transactions in the window is ≥ CTR_Threshold AND every individual transaction in the window is < CTR_Threshold. No other condition must trigger a smurfing alert.

**Validates: Requirements 5.1, 5.2**

---

### Property 12: Coordinated Smurfing Multiplier

*For any* smurfing alert where the number of distinct receiver accounts in the rolling window is ≥ 3, the final smurfing risk score must equal `MIN(100, base_score * 1.25)`. For alerts with fewer than 3 distinct receivers, the multiplier must not be applied.

**Validates: Requirements 5.4**

---

### Property 13: Velocity Spike Detection at 3 Sigma

*For any* account with ≥ 30 days of history, if the observed hourly transaction count exceeds the account's historical mean hourly rate (derived from the rolling-window baseline) by more than 3 standard deviations, a velocity spike flag must be generated containing the observed count, historical mean, and standard deviation. Accounts with < 30 days of history must use population-level statistics for this comparison.

**Validates: Requirements 5.5, 5.6**

---

### Property 14: High-Value New Counterparty Anomaly Detection

*For any* transaction where `amount_usd` exceeds the sender account's 90th percentile historical transaction amount AND the `receiver_account_id` is not in the sender's `known_counterparties` set, the transaction must be flagged as a high-value new counterparty anomaly. Transactions meeting only one of the two conditions must not be flagged.

**Validates: Requirements 6.3**

---

### Property 15: Frequency Anomaly Detection at 3 Sigma

*For any* account where the transaction count in any rolling 24-hour window exceeds the account's historical mean daily frequency by more than 3 standard deviations, a frequency anomaly alert must be generated containing the observed frequency, historical mean, and standard deviation.

**Validates: Requirements 6.4**

---

### Property 16: Composite Risk Score Invariants

*For any* combination of component scores and configured weights, the composite Risk_Score must be in [0, 100], and the tier classification must be exactly: LOW for scores in [0, 39], MEDIUM for scores in [40, 69], and HIGH for scores in [70, 100]. The weighted sum formula must be: `score = cycle_score * cycle_weight + smurfing_score * smurfing_weight + behavioral_score * behavioral_weight + geo_score * geo_weight`, normalized to [0, 100].

**Validates: Requirements 7.1, 7.3**

---

### Property 17: Geographic Risk Score for FATF Jurisdictions

*For any* transaction involving at least one account in a FATF-designated high-risk jurisdiction, the geographic risk score component must be greater than zero and must not exceed 15 points. Transactions involving no FATF jurisdictions must receive a geographic score of 0.

**Validates: Requirements 7.2**

---

### Property 18: Score Decomposition Recorded in Alert

*For any* generated alert, the alert record must contain the individual component scores (cycle, smurfing, behavioral, geographic) and their corresponding weights alongside the composite Risk_Score, enabling full score reconstruction from components.

**Validates: Requirements 7.4**

---

### Property 19: Config Weight Changes Applied to Subsequent Scores

*For any* Risk_Score computed after a weight configuration change, the score must use the new weights. Risk_Scores computed before the change must not be retroactively modified.

**Validates: Requirements 7.5**

---

### Property 20: SAR Prompt Contains All Required Fields

*For any* SAR generation request, the prompt sent to the Gemini 1.5 Flash API must contain: subject account details, the full transaction sequence, the Risk_Score decomposition, the detected pattern type, and the behavioral baseline deviation metrics.

**Validates: Requirements 8.1**

---

### Property 21: SAR Draft Section Completeness

*For any* successfully generated SAR draft, the document must contain all five required sections: subject entity summary, detected activity narrative, timeline of key transactions, risk indicator enumeration with justifications, and recommended regulatory filing category.

**Validates: Requirements 8.2**

---

### Property 22: Audit Log Entry Completeness

*For any* user action (alert view, case transition, note addition, SAR generation, threshold change, user management, authentication event), an audit log entry must be created containing: acting user's ID and role, action type, affected resource ID, UTC timestamp, and outcome (SUCCESS or FAILURE). No user action must complete without a corresponding audit log entry.

**Validates: Requirements 8.6, 12.2, 13.1, 13.2**

---

### Property 23: Audit Log Append-Only Invariant

*For any* sequence of system operations, the total count of entries in the `audit_logs` collection must be monotonically non-decreasing. No update or delete operation on `audit_logs` must succeed from application code regardless of the requesting user's role.

**Validates: Requirements 13.3**

---

### Property 24: Case State Machine Validity

*For any* case, only the following state transitions must be permitted: `OPEN → UNDER_REVIEW`, `UNDER_REVIEW → ESCALATED`, `UNDER_REVIEW → CLOSED_DISMISSED`, `ESCALATED → CLOSED_SAR_FILED`, `ESCALATED → CLOSED_DISMISSED`. Any attempt to perform a transition not in this set must be rejected with an error. The transition to `CLOSED_SAR_FILED` must additionally be rejected if no SAR draft is attached to the case.

**Validates: Requirements 11.1, 11.4, 11.5**

---

### Property 25: RBAC Permission Enforcement

*For any* user with a given role (ANALYST or ADMIN) attempting any action, the system must permit the action if and only if the role has the required permission per the two-role RBAC matrix. Unauthorized attempts must be rejected with an authorization error and must not partially execute the requested action.

**Validates: Requirements 12.1**

---

### Property 26: JWT Expiry Enforcement

*For any* JWT token issued by the system, the token must be rejected as invalid after 8 hours (28800 seconds) from its `iat` claim. Tokens with a valid HS256 signature but expired `exp` claim must not grant access to any protected resource.

**Validates: Requirements 12.3**

---

### Property 27: Config Validation Rejects Out-of-Range Values

*For any* configuration parameter and any value outside its defined valid range, the system must reject the update and return a descriptive validation error specifying the valid range. The configuration must remain unchanged after a rejected update.

**Validates: Requirements 14.4**

---

### Property 28: Detection Accuracy on Labeled Dataset

*For any* labeled synthetic dataset generated by the Transaction_Simulator with known ground-truth labels, the Detection_Engine must achieve a false positive rate below 30% and a recall rate above 85% when evaluated against the ground-truth labels.

**Validates: Requirements 15.5**


---

## Error Handling

### Ingestion Pipeline

- **Schema validation failure**: log error with original payload and reason code; skip record; continue stream. No DLQ — simplicity over complexity.
- **MongoDB write failure**: retry once with 100ms backoff; on second failure log critical error and return 503 to caller
- **Currency normalization failure** (unknown currency code): default to original amount, flag `currency_normalized: false` on the record

### Detection Engine

- **CycleDetector timeout** (>500ms for a single edge): abort DFS, log warning with graph size, emit no cycle alert for that edge
- **SmurfingDetector state corruption**: reinitialize rolling window for affected account from MongoDB on next transaction
- **BehavioralProfiler aggregation failure**: use `low_confidence: true` flag and population-level statistics as fallback

### SAR Generator

- **Gemini API error or timeout (>10s)**: return partial SAR template pre-populated with structured alert data; set `is_partial: true`; log API failure with error code and timestamp
- **Gemini response malformed**: attempt best-effort section extraction; fall back to partial template

### Authentication

- **Invalid credentials**: return 401; write AUTH_FAIL audit log entry
- **Expired JWT**: return 401 with `{ error: "token_expired" }`; client redirects to login
- **Missing JWT**: return 401 with `{ error: "unauthorized" }`

### WebSocket

- **Client disconnect**: Socket.IO handles reconnection automatically; server maintains subscription state per socket
- **Alert broadcast failure**: log warning; alert is still persisted in MongoDB and visible on next page load

---

## Testing Strategy

### Dual Testing Approach

Both unit tests and property-based tests are required. They are complementary:
- **Unit tests** verify specific examples, integration points, and error conditions
- **Property-based tests** verify universal properties across randomly generated inputs

### Property-Based Testing

**Library**: `fast-check` (TypeScript/JavaScript) for backend; `@fast-check/jest` integration

**Configuration**: minimum 100 runs per property test

**Tag format** (comment above each test):
```
// Feature: intelligent-aml-framework, Property N: <property_text>
```

Each correctness property in this document must be implemented by exactly one property-based test. Key property tests:

| Property | Test Description |
|---|---|
| P1 | Generate random simulator output; assert all required fields present with correct types |
| P2 | Generate random smurfing clusters; assert structural invariants hold |
| P3 | Generate random circular trading chains; assert return-to-origin and length bounds |
| P4 | Generate large transaction batches; assert ≥70% below $5000 |
| P5 | Generate malformed records; assert none appear in transactions collection |
| P6 | Generate random currency/amount pairs; assert normalization formula and idempotence |
| P7 | Generate random transactions; assert graph edge and node volume invariants |
| P9 | Generate random graphs with known cycles; assert DFS finds all cycles within time window |
| P11 | Generate random account/window combinations; assert structuring classification iff-condition |
| P12 | Generate smurfing alerts with random receiver counts; assert multiplier applied iff ≥3 receivers |
| P13 | Generate accounts with random baselines; assert velocity spike flagged iff z-score > 3 |
| P16 | Generate random component scores and weights; assert composite in [0,100] and tier correct |
| P24 | Generate random case state sequences; assert only valid transitions permitted |
| P25 | Generate random user/action pairs; assert RBAC permits iff role has permission |
| P26 | Generate JWTs with random issue times; assert expired tokens rejected |
| P27 | Generate random config values; assert out-of-range values rejected and config unchanged |

### Unit Tests

Unit tests focus on:
- **Specific examples**: known smurfing patterns, known cycle graphs, known SAR prompts
- **Integration points**: ingestion → detection → scoring pipeline end-to-end with a fixed transaction set
- **Error conditions**: Gemini API timeout fallback, MongoDB write failure retry, invalid JWT formats
- **Edge cases**: accounts with exactly 30 days of history (boundary for population vs. account-level stats), cycles of exactly length 2 and exactly length N, transactions at exactly CTR_Threshold

### Frontend Testing

- **Component tests** (React Testing Library): AlertFeed renders Socket.IO events, NodeDetailPanel displays correct account data, ThresholdConfigUI rejects invalid ranges
- **Graph visualization**: smoke test that react-force-graph renders without error for a known dataset
- **E2E** (Playwright, optional for hackathon): hero flow from transaction ingestion to alert appearing in dashboard

