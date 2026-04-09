# Implementation Plan: Intelligent AML Framework (Backend)

## Overview

Node.js + Express.js backend with MongoDB, Socket.IO, and Gemini 1.5 Flash. Tasks are ordered for incremental delivery: models, detection pipeline, scoring, SAR, auth, API routes, real-time layer, simulator, wiring.

## Tasks

- [x] 1. Project setup and infrastructure
  - Initialize Node.js project with package.json; install: express, mongoose, socket.io, jsonwebtoken, bcrypt, uuid, @google/generative-ai, fast-check, jest
  - Create src/ directory tree: ingestion/, detection/, scoring/, sar/, auth/, audit/, routes/, simulator/, models/
  - Add .env.example: MONGO_URI, JWT_SECRET, GEMINI_API_KEY, PORT
  - Configure jest.config.js for unit and property-based tests
  - _Requirements: 15.1_

- [x] 2. Mongoose data models (src/models/)
  - [x] 2.1 Create Transaction model: transaction_id (UUID v4, unique), sender_account_id, receiver_account_id, amount_usd, amount_original, currency_original, timestamp, transaction_type (WIRE/ACH/CASH/CRYPTO), geolocation, channel, device_id, is_synthetic, pattern_tag, ingested_at, schema_version; compound index { sender_account_id, timestamp }
    - _Requirements: 2.1, 2.2, 3.1_
  - [x] 2.2 Create Account model: account_id (unique), volume counters, transaction_count, first_seen, last_seen, nested baseline subdocument (daily_freq_mean, daily_freq_stddev, amount_mean, amount_stddev, amount_p90, known_counterparties, type_distribution, channel_distribution, geo_distribution, history_days, low_confidence)
    - _Requirements: 3.2, 3.3, 6.1_
  - [x] 2.3 Create Alert model: alert_id (UUID v4, unique), pattern_type, subject_account_id, involved_accounts, transaction_ids, risk_score, risk_tier, score_breakdown, cycle_detail, smurfing_detail, behavioral_detail, xai_narrative, sar_draft_id, case_id
    - _Requirements: 4.4, 5.3, 7.4_
  - [x] 2.4 Create Case model: case_id, alert_id, subject_account_id, state (OPEN/UNDER_REVIEW/ESCALATED/CLOSED_SAR_FILED/CLOSED_DISMISSED), state_history array, notes array, sar_draft_id, assigned_to
    - _Requirements: 11.1, 11.2, 11.3_
  - [x] 2.5 Create SARDraft model: sar_id, alert_id, case_id, generated_by, gemini_request_id, generated_at, subject_summary, activity_narrative, transaction_timeline, risk_indicators, recommended_filing_category, is_partial
    - _Requirements: 8.2_
  - [x] 2.6 Create AuditLog model: log_id, user_id, user_role, action_type, resource_type, resource_id, action_timestamp, outcome, metadata, ip_address; indexes on user_id, action_timestamp, action_type
    - _Requirements: 13.1, 13.2_
  - [x] 2.7 Create User model: user_id, username (unique), email (unique), password_hash (bcrypt cost 12), role (ANALYST/ADMIN), created_at, last_login
    - _Requirements: 12.1_
  - [x] 2.8 Create SystemConfig model: config_key (unique), value, default_value, valid_range, description, updated_by, updated_at; seed default documents for all threshold parameters on startup if collection is empty
    - _Requirements: 14.1, 14.2_

- [x] 3. Ingestion pipeline (src/ingestion/)
  - [x] 3.1 Implement TransactionValidator: JSON Schema validation against canonical transaction schema; return { valid, errors } without throwing; log failure reason code with original payload
    - _Requirements: 2.1, 2.3_
  - [x] 3.2 Implement TransactionNormalizer: currency-to-USD conversion using configurable exchange rate table from ThresholdConfig; timestamp normalization to UTC ISO 8601; flag currency_normalized: false on unknown currency codes
    - _Requirements: 2.5_
  - [x] 3.3 Implement TransactionRepository: save(normalizedTx) writes to MongoDB transactions collection; retry once with 100ms backoff on write failure; emit transaction:saved on Node.js EventEmitter after successful write
    - _Requirements: 2.2, 2.4_
  - [x]* 3.4 Write property test for TransactionValidator (Property 5): generate random malformed records; assert none appear in transactions collection and pipeline continues
    - **Property 5: Invalid Records Not Persisted**
    - **Validates: Requirements 2.3**
  - [x]* 3.5 Write property test for TransactionNormalizer (Property 6): generate random currency/amount pairs; assert amount_usd = amount_original * exchange_rate; assert idempotence on USD input
    - **Property 6: Currency Normalization Correctness**
    - **Validates: Requirements 2.5**

- [x] 4. In-memory graph manager (src/detection/GraphManager.js)
  - [x] 4.1 Implement GraphManager class with adjacency list Map<nodeId, Map<neighborId, EdgeData[]>>; implement addEdge(from, to, amount, timestamp, txId) creating nodes if absent and appending edge metadata; implement bootstrap(lastNHours): on server startup query MongoDB transactions collection for all records within the last N hours and call addEdge() for each to pre-populate the in-memory graph before the first live transaction arrives
    - _Requirements: 3.1, 3.2_
  - [x] 4.2 Implement getNeighbors(nodeId) returning array of { neighborId, edges }; implement getSubgraph(nodeId, depth) using BFS up to specified depth returning { nodes, edges }
    - _Requirements: 3.4_
  - [x] 4.3 Implement getEdge(from, to) returning all edges between two nodes; implement getNodeMeta(nodeId) returning total_inbound_usd, total_outbound_usd, transaction_count, first_seen, last_seen
    - _Requirements: 3.2_
  - [x]* 4.4 Write property test for graph update correctness (Property 7): every ingested transaction produces a directed edge with correct weight and updated node volume counters
    - **Property 7: Transaction Graph Update Correctness**
    - **Validates: Requirements 3.1, 3.2**
  - [x] 4.5 Implement GraphManager.pruneOldEdges(): remove all edges whose timestamp is older than the configured max time window (cycle_time_window_hours from ThresholdConfig); schedule via setInterval every 15 minutes; update node volume counters after pruning to reflect only active edges
    - _Requirements: 3.1, 4.2_

- [x] 5. DFS cycle detector (src/detection/CycleDetector.js)
  - [x] 5.1 Implement detectCycles(graph, newEdge, maxLength, timeWindowHours): iterative DFS from newEdge.to searching for paths back to newEdge.from within maxLength-1 hops; collect all simple cycles including the new edge; abort and log warning if execution exceeds 500ms
    - _Requirements: 4.1, 4.6_
  - [x] 5.2 Implement allWithinTimeWindow(edges, windowHours): return true only if (maxTimestamp - minTimestamp) in hours <= windowHours; cycles failing this check must not generate alerts
    - _Requirements: 4.2, 4.5_
  - [x] 5.3 Implement computeCycleScore(cycle, edges): length score (max 40 pts, shorter = higher), value score (max 30 pts), time compression score (max 10 pts), FATF bonus (+20 pts); return MIN(100, sum)
    - _Requirements: 4.3_
  - [x] 5.4 Implement FATF jurisdiction lookup: anyFATFJurisdiction(accountIds, graph) returns boolean; load FATF high-risk country list from config or hardcode
    - _Requirements: 4.3, 7.2_
  - [x]* 5.5 Write property test for cycle detection completeness (Property 9): generate random graphs with known cycles; assert DFS finds all cycles of length 2-N within time window; cycles outside window produce no alerts
    - **Property 9: Cycle Detection Completeness and Time Window Enforcement**
    - **Validates: Requirements 4.1, 4.2, 4.5**
  - [x]* 5.6 Write property test for cycle score bounds (Property 10): cycle risk score always in [0, 100]; FATF flag adds exactly 20 pts capped at 100; alert contains all participating accounts and ordered transaction sequence
    - **Property 10: Cycle Alert Completeness and Score Bounds**
    - **Validates: Requirements 4.3, 4.4**

- [x] 6. Smurfing / rolling window detector (src/detection/SmurfingDetector.js)
  - [x] 6.1 Implement per-account rolling window state Map<accountId, Array<{timestamp, amount, receiverId}>>; implement evaluateSmurfing(accountId, newTx, config): trim entries outside config.windowHours, push new entry, compute aggregateAmount and allBelowThreshold
    - _Requirements: 5.1, 5.2_
  - [x] 6.2 Emit smurfing signal only when aggregateAmount >= config.ctrThreshold AND allBelowThreshold === true; no other condition triggers alert
    - _Requirements: 5.2_
  - [x] 6.3 Implement computeSmurfingBaseScore(window, config): tx count score (max 50 pts), proximity score (max 30 pts), time compression score (max 20 pts)
    - _Requirements: 5.3_
  - [x] 6.4 Apply coordinated multiplier: if distinctReceivers >= 3 then finalScore = MIN(100, baseScore * 1.25); record coordinated_multiplier_applied boolean in signal
    - _Requirements: 5.4_
  - [x] 6.5 Implement checkVelocitySpike(accountId, baseline, hourlyTxCount): use account-level mean/stddev if history_days >= 30 else population-level constants (POPULATION_MEAN_HOURLY_TX, POPULATION_STDDEV_HOURLY_TX); return { observed, mean, stddev, zScore } if zScore > 3 else null
    - _Requirements: 5.5, 5.6_
  - [x]* 6.6 Write property test for structuring classification (Property 11): account classified as structuring iff aggregate >= CTR_Threshold AND all individual < CTR_Threshold
    - **Property 11: Structuring Classification Correctness**
    - **Validates: Requirements 5.1, 5.2**
  - [x]* 6.7 Write property test for coordinated multiplier (Property 12): multiplier applied iff distinct receivers >= 3; final score = MIN(100, base * 1.25)
    - **Property 12: Coordinated Smurfing Multiplier**
    - **Validates: Requirements 5.4**
  - [x]* 6.8 Write property test for velocity spike (Property 13): spike flagged iff z-score > 3; population stats used when history_days < 30
    - **Property 13: Velocity Spike Detection at 3 Sigma**
    - **Validates: Requirements 5.5, 5.6**

- [x] 7. Behavioral profiler (src/detection/BehavioralProfiler.js)
  - [x] 7.1 Implement updateBaseline(accountId): MongoDB aggregation over trailing 90-day window using $avg, $stdDevPop, $percentile (p90) on amount_usd, $addToSet for known_counterparties; compute history_days; set low_confidence: true if history_days < 30; upsert accounts document
    - _Requirements: 6.1, 6.2, 6.5_
  - [x] 7.2 Implement scoreAnomaly(tx, account): check high-value new counterparty (amount_usd > baseline.amount_p90 AND receiver NOT IN known_counterparties); check frequency anomaly (rolling 24h count > mean + 3 * stddev); return { anomalyType, observedValue, baselineMean, baselineStddev, deviationSigma } or null
    - _Requirements: 6.3, 6.4_
  - [x] 7.3 Implement initializeBaseline(accountId): create account document with history_days: 0 and null statistical fields before first transaction is published downstream
    - _Requirements: 3.3_
  - [x] 7.4 Ensure BehavioralProfiler uses POPULATION_MEAN and POPULATION_STDDEV_DAILY constants for frequency anomaly scoring when account.baseline.history_days < 30; do not use null or zero as fallback — always produce a valid z-score comparison regardless of account age
    - _Requirements: 5.6, 6.5_
  - [x]* 7.5 Write property test for new account baseline initialization (Property 8): first-seen account gets baseline record with history_days = 0 before transaction reaches analysis pipeline
    - **Property 8: New Account Baseline Initialization**
    - **Validates: Requirements 3.3**
  - [x]* 7.6 Write property test for high-value new counterparty detection (Property 14): flagged iff BOTH conditions met; transactions meeting only one condition must not be flagged
    - **Property 14: High-Value New Counterparty Anomaly Detection**
    - **Validates: Requirements 6.3**
  - [x]* 7.7 Write property test for frequency anomaly (Property 15): alert generated iff 24h count > mean + 3 standard deviations
    - **Property 15: Frequency Anomaly Detection at 3 Sigma**
    - **Validates: Requirements 6.4**

- [x] 8. Detection orchestrator (src/detection/DetectionOrchestrator.js)
  - [x] 8.1 Implement analyze(tx): run CycleDetector.detect(), SmurfingDetector.evaluate(), and BehavioralProfiler.scoreAnomaly() in parallel via Promise.all; collect all signals into a unified DetectionResult object
    - _Requirements: 15.2_
  - [x] 8.2 Wire orchestrator to transaction:saved EventEmitter event from TransactionRepository; call GraphManager.addEdge() before dispatching to detectors; forward DetectionResult to RiskScorer
    - _Requirements: 4.1, 5.1, 6.1_
  - [x]* 8.3 Write unit tests for orchestrator: verify parallel execution, correct signal aggregation, and that graph edge is added before detection runs

- [x] 9. Risk scoring engine (src/scoring/)
  - [x] 9.1 Implement ThresholdConfig singleton (src/scoring/ThresholdConfig.js): load all system_config documents from MongoDB on startup into in-memory cache; expose get(key) and reload() methods; reload() refreshes cache from DB without restart
    - _Requirements: 7.5, 14.1_
  - [x] 9.2 Implement GeoRiskEvaluator: FATF high-risk jurisdiction list; score(geolocation) returns value in [0, 15]; non-FATF transactions return 0
    - _Requirements: 7.2_
  - [x] 9.3 Implement RiskScorer.compute(detectionResult, geolocation): weighted composite score = cycle_score * cycle_weight + smurfing_score * smurfing_weight + behavioral_score * behavioral_weight + geo_score * geo_weight; normalize to [0, 100]; classify tier LOW (0-39) MEDIUM (40-69) HIGH (70-100); record all component scores and weights in score_breakdown
    - _Requirements: 7.1, 7.3, 7.4_
  - [x] 9.4 Persist alert document to MongoDB alerts collection after scoring; emit alert:new Socket.IO event with full alert payload
    - _Requirements: 4.4, 7.4_
  - [x]* 9.5 Write property test for composite score invariants (Property 16): score always in [0, 100]; tier classification matches defined ranges; weighted sum formula correct
    - **Property 16: Composite Risk Score Invariants**
    - **Validates: Requirements 7.1, 7.3**
  - [x]* 9.6 Write property test for geographic risk score (Property 17): FATF jurisdictions produce score > 0 and <= 15; non-FATF produces 0
    - **Property 17: Geographic Risk Score for FATF Jurisdictions**
    - **Validates: Requirements 7.2**
  - [x]* 9.7 Write property test for score decomposition (Property 18): every alert record contains all component scores and weights enabling full score reconstruction
    - **Property 18: Score Decomposition Recorded in Alert**
    - **Validates: Requirements 7.4**
  - [x]* 9.8 Write property test for config weight changes (Property 19): scores computed after weight change use new weights; prior scores unchanged
    - **Property 19: Config Weight Changes Applied to Subsequent Scores**
    - **Validates: Requirements 7.5**

- [x] 10. SAR generator (src/sar/)
  - [x] 10.1 Implement PromptBuilder.build(alert, account): construct structured Gemini prompt containing subject account details, full transaction sequence, score_breakdown, pattern_type, and behavioral baseline deviation metrics; include specific quantitative references (observed vs. baseline amounts and frequencies)
    - _Requirements: 8.1, 8.3_
  - [x] 10.2 Implement GeminiClient.generate(prompt): call Gemini 1.5 Flash API via @google/generative-ai; enforce 10-second timeout using Promise.race; on error or timeout return { partial: true, error }; log API failure with error code and timestamp
    - _Requirements: 8.4_
  - [x] 10.3 Implement SARFormatter.format(geminiResponse, alert): parse Gemini response into five sections: subject_summary, activity_narrative, transaction_timeline, risk_indicators, recommended_filing_category; on malformed response attempt best-effort extraction then fall back to partial template with is_partial: true
    - _Requirements: 8.2, 8.4_
  - [x] 10.4 Wire SAR generation: persist SARDraft to MongoDB; write SAR_GENERATE audit log entry with generated_at, generated_by (user_id), gemini_request_id
    - _Requirements: 8.6_
  - [x] 10.5 Implement SARQueue: in-memory queue with configurable concurrency limit (default: 2 concurrent Gemini requests); incoming SAR generation requests are enqueued and processed sequentially when at capacity; prevents HTTP 429 rate-limit errors from Gemini API; expose queue depth in metrics:update Socket.IO event
    - _Requirements: 8.4_
  - [x]* 10.6 Write property test for SAR prompt completeness (Property 20): prompt always contains all five required data fields
    - **Property 20: SAR Prompt Contains All Required Fields**
    - **Validates: Requirements 8.1**
  - [x]* 10.7 Write property test for SAR draft section completeness (Property 21): successfully generated SAR contains all five required sections
    - **Property 21: SAR Draft Section Completeness**
    - **Validates: Requirements 8.2**
  - [x]* 10.8 Write unit test for Gemini timeout fallback: mock API to delay > 10s; assert is_partial: true returned and API failure logged

- [x] 11. Auth middleware (src/auth/)
  - [x] 11.1 Implement JWTMiddleware: extract Bearer token from Authorization header; verify HS256 signature using JWT_SECRET env var; attach decoded { user_id, role } to req.user; return 401 { error: "token_expired" } for expired tokens; return 401 { error: "unauthorized" } for missing or invalid tokens
    - _Requirements: 12.1, 12.3_
  - [x] 11.2 Implement RBACMiddleware factory requireRole(...roles): check req.user.role against allowed roles; return 403 and write AUTH_FAIL audit log entry on unauthorized access attempt
    - _Requirements: 12.1, 12.2_
  - [x]* 11.3 Write property test for JWT expiry enforcement (Property 26): tokens rejected after 8 hours from iat; valid-signature expired tokens grant no access to any protected resource
    - **Property 26: JWT Expiry Enforcement**
    - **Validates: Requirements 12.3**
  - [x]* 11.4 Write property test for RBAC enforcement (Property 25): action permitted iff role has permission per RBAC matrix; unauthorized attempts rejected and do not partially execute
    - **Property 25: RBAC Permission Enforcement**
    - **Validates: Requirements 12.1**

- [x] 12. Audit logger (src/audit/AuditLogger.js)
  - [x] 12.1 Implement AuditLogger.log({ userId, userRole, actionType, resourceType, resourceId, outcome, metadata, ipAddress }): insert-only write to audit_logs collection; generate log_id (UUID v4); set action_timestamp to UTC now; no update or delete operations on this collection anywhere in application code
    - _Requirements: 13.1, 13.2, 13.3_
  - [x]* 12.2 Write property test for audit log append-only invariant (Property 23): entry count in audit_logs is monotonically non-decreasing across any sequence of operations
    - **Property 23: Audit Log Append-Only Invariant**
    - **Validates: Requirements 13.3**
  - [x]* 12.3 Write property test for audit log entry completeness (Property 22): every user action produces an entry with all required fields (user_id, role, action_type, resource_id, UTC timestamp, outcome)
    - **Property 22: Audit Log Entry Completeness**
    - **Validates: Requirements 8.6, 13.1, 13.2**

- [x] 13. REST API route handlers (src/routes/)
  - [x] 13.1 Implement auth routes (src/routes/auth.js):
    - POST /api/auth/login: validate credentials, bcrypt.compare against password_hash, issue HS256 JWT (8h expiry), write AUTH_LOGIN audit entry; return 401 and write AUTH_FAIL audit entry on invalid credentials
    - POST /api/auth/logout: write AUTH_LOGOUT audit entry; return 200
    - _Requirements: 12.1, 12.3, 13.1_
  - [x] 13.2 Implement transaction routes (src/routes/transactions.js):
    - POST /api/transactions/ingest: call TransactionValidator then TransactionNormalizer then TransactionRepository.save(); return 202 on success, 400 with error details on validation failure; no auth required
    - GET /api/transactions/:id: fetch by transaction_id; apply JWTMiddleware
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 13.3 Implement alert routes (src/routes/alerts.js):
    - GET /api/alerts: paginated (page, limit), filterable by risk_tier, pattern_type, subject_account_id, date range; apply JWTMiddleware; write ALERT_VIEW audit entry
    - GET /api/alerts/:id: full alert detail including score_breakdown; apply JWTMiddleware; write ALERT_VIEW audit entry
    - POST /api/alerts/:id/sar: enqueue SAR generation via SARQueue; apply JWTMiddleware; write SAR_GENERATE audit entry
    - _Requirements: 7.4, 8.1, 8.6, 13.1_
  - [x] 13.4 Implement graph and account routes (src/routes/graph.js):
    - GET /api/graph/subgraph/:accountId: call GraphManager.getSubgraph(accountId, depth); depth defaults to 2 max 4; apply JWTMiddleware
    - GET /api/accounts/:id/baseline: fetch account document and return baseline subdocument; apply JWTMiddleware
    - _Requirements: 3.4, 6.1_
  - [x] 13.5 Implement case routes (src/routes/cases.js):
    - POST /api/cases: create case from alert_id; initial state OPEN; apply JWTMiddleware; write CASE_CREATE audit entry
    - GET /api/cases/:id: full case detail with state_history and notes; apply JWTMiddleware
    - PATCH /api/cases/:id/state: validate transition against allowed state machine; require sar_draft_id attached before CLOSED_SAR_FILED; write CASE_TRANSITION audit entry with from_state and to_state in metadata
    - POST /api/cases/:id/notes: append note with author_user_id and timestamp; write NOTE_ADD audit entry
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 13.1_
  - [x] 13.6 Implement admin routes (src/routes/admin.js); apply JWTMiddleware + requireRole('ADMIN') to all:
    - GET /api/admin/config: return all system_config documents
    - PUT /api/admin/config: validate each value against valid_range; reject out-of-range with descriptive error; update MongoDB; call ThresholdConfig.reload(); write THRESHOLD_CHANGE audit entry with previous and new values
    - GET /api/admin/audit: paginated audit log query with date-range filter; return chronologically ordered entries
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 13.1_
  - [x]* 13.7 Write property test for config validation (Property 27): out-of-range config values rejected; config unchanged after rejected update
    - **Property 27: Config Validation Rejects Out-of-Range Values**
    - **Validates: Requirements 14.4**
  - [x]* 13.8 Write property test for case state machine (Property 24): only valid transitions permitted; CLOSED_SAR_FILED rejected without attached SAR draft
    - **Property 24: Case State Machine Validity**
    - **Validates: Requirements 11.1, 11.4, 11.5**

- [x] 14. Socket.IO real-time layer
  - [x] 14.1 Initialize Socket.IO server attached to the Express HTTP server; configure CORS; implement alert:new broadcast called from RiskScorer after alert is persisted; payload: full alert object including the specific new edge data (from, to, amount, timestamp, txId) that triggered the alert for incremental frontend graph updates without requiring a full subgraph refetch
    - _Requirements: 10.2_
  - [x] 14.2 Implement alert:updated broadcast called when alert risk_score or risk_tier is patched; payload: { alertId, patch }
    - _Requirements: 10.2_
  - [x] 14.3 Implement metrics:update periodic push: setInterval every 5 seconds; compute { tps, alertCounts: { LOW, MEDIUM, HIGH }, trend, sarQueueDepth } from in-memory counters and MongoDB aggregation; broadcast to all connected clients
    - _Requirements: 10.3_
  - [x] 14.4 Implement graph:subscribe and graph:unsubscribe client-to-server events: maintain per-socket subscription map; on graph:subscribe { accountId } join socket to room graph:${accountId}; broadcast live graph updates to room when new edges are added for subscribed accounts
    - _Requirements: 10.2_
  - [x]* 14.5 Write unit tests for Socket.IO events: mock socket client; assert alert:new emitted with edge data after alert persist; assert metrics:update fires on 5s interval

- [x] 15. Transaction simulator (src/simulator/)
  - [x] 15.1 Implement base transaction generator: produce records with all required fields (transaction_id UUID v4, sender_account_id, receiver_account_id, amount float, timestamp ISO 8601 UTC, transaction_type WIRE/ACH/CASH/CRYPTO, geolocation ISO 3166-1 alpha-2, channel, device_id); amount distribution >= 70% below USD 5000
    - _Requirements: 1.1, 1.6_
  - [x] 15.2 Implement configurable TPS emitter: setInterval-based loop posting to POST /api/transactions/ingest; default 10 TPS configurable range 1-1000; log and skip malformed records without halting
    - _Requirements: 1.2, 1.5_
  - [x] 15.3 Implement smurfing pattern injector: when enabled generate clusters of 3-15 transactions from single sender, each amount in [1000, 9999] USD, >= 2 distinct receivers, all within 60-minute window; tag with pattern_tag: "SMURFING"
    - _Requirements: 1.3_
  - [x] 15.4 Implement circular trading pattern injector: when enabled generate transaction chains of length 2-6 returning funds to originating account within configurable time window (default 72h); tag with pattern_tag: "CIRCULAR_TRADING"
    - _Requirements: 1.4_
  - [x]* 15.5 Write property test for transaction field completeness (Property 1): all required fields present with correct types and formats (UUID v4, ISO 8601, ISO 3166-1 alpha-2, enumerated values)
    - **Property 1: Transaction Record Field Completeness**
    - **Validates: Requirements 1.1**
  - [x]* 15.6 Write property test for smurfing pattern structural invariants (Property 2): tx count in [3,15], amounts in [1000,9999], single sender, >= 2 receivers, within 60-minute window
    - **Property 2: Smurfing Pattern Structural Invariants**
    - **Validates: Requirements 1.3**
  - [x]* 15.7 Write property test for circular trading structural invariants (Property 3): chain returns to origin, length in [2,6], within configured time window
    - **Property 3: Circular Trading Pattern Structural Invariants**
    - **Validates: Requirements 1.4**
  - [x]* 15.8 Write property test for realistic amount distribution (Property 4): in any batch of >= 1000 transactions without pattern injection, >= 70% of amounts below USD 5000
    - **Property 4: Realistic Amount Distribution**
    - **Validates: Requirements 1.6**

- [x] 16. System config and ThresholdConfig singleton
  - [x] 16.1 Implement ThresholdConfig.initialize(): on server startup load all system_config documents from MongoDB into in-memory cache; expose get(key) returning current value; expose reload() to refresh cache from DB without restart; ThresholdConfig.get() must be called at evaluation time not cached in closures
    - _Requirements: 14.1_
  - [x] 16.2 Seed default config documents via startup script if collection is empty: ctr_threshold (10000), rolling_window_hours (24), cycle_max_length (6), cycle_time_window_hours (72), smurfing_tx_count_threshold (3), score_weight_cycle (0.35), score_weight_smurfing (0.30), score_weight_behavioral (0.20), score_weight_geo (0.15); include valid_range and default_value for each
    - _Requirements: 14.2_

- [x] 17. Checkpoint: core pipeline complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 18. Integration wiring: server entry point (src/server.js)
  - [x] 18.1 Create src/server.js: connect to MongoDB via Mongoose; call ThresholdConfig.initialize(); call GraphManager.bootstrap(lastNHours) to pre-populate in-memory graph; schedule GraphManager.pruneOldEdges() every 15 minutes; mount all route handlers under /api; attach Socket.IO to HTTP server; start listening on PORT env var
    - _Requirements: 15.1_
  - [x] 18.2 Wire TransactionRepository transaction:saved event to DetectionOrchestrator.analyze() then RiskScorer.compute() then alert persist then Socket.IO alert:new broadcast with edge data; ensure full pipeline runs end-to-end for a single transaction
    - _Requirements: 15.1, 15.2_
  - [x] 18.3 Wire BehavioralProfiler.updateBaseline() call after each TransactionRepository.save() completes; ensure initializeBaseline() is called for first-seen accounts before publishing to analysis pipeline
    - _Requirements: 3.3, 6.2_
  - [x]* 18.4 Write integration test for full ingestion-to-alert pipeline: POST a known smurfing transaction set; assert alert persisted with correct pattern_type, risk_tier, and score_breakdown; assert alert:new Socket.IO event emitted with edge data
    - _Requirements: 15.1, 15.2_

- [x] 19. Final checkpoint: ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with * are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Property tests use fast-check with minimum 100 runs per property
- All property test files must include the tag comment: // Feature: intelligent-aml-framework, Property N: <property_text>
- ThresholdConfig.get() must be called at evaluation time (not cached in closures) so hot-reload works without restart
- The simulator runs as a separate Node.js process and does not share in-memory state with the main server
- SARQueue default concurrency is 2; increase via GEMINI_CONCURRENCY env var if API quota allows
- GraphManager.bootstrap() lastNHours defaults to cycle_time_window_hours config value (72h)
