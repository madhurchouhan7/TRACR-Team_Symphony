# Requirements Document

## Introduction

The **Intelligent AML Framework** is a next-generation financial crime detection platform targeting two primary money laundering typologies — **Smurfing (Structuring)** and **Circular Trading (Layering)** — which evade traditional rule-based AML systems. The framework combines a real-time synthetic transaction engine, graph-theoretic cycle detection, behavioral velocity analysis, a hybrid risk scoring engine, and Explainable AI (XAI) to generate professional Suspicious Activity Reports (SARs). A dark-themed Investigation Command Center provides compliance analysts and system administrators with a unified operational interface.

This document is prepared for national hackathon submission and is intended to serve as the authoritative technical specification governing system design, implementation, and evaluation.

---

## Glossary

- **AML**: Anti-Money Laundering — the set of laws, regulations, and procedures intended to prevent criminals from disguising illegally obtained funds as legitimate income.
- **SAR**: Suspicious Activity Report — a document filed by financial institutions with regulatory authorities (e.g., FinCEN) when suspicious financial behavior is detected.
- **Smurfing**: A money laundering technique (also called Structuring) in which large sums are broken into multiple smaller transactions, each below regulatory reporting thresholds, to avoid detection.
- **Circular_Trading**: A layering technique in which funds are transferred through a chain of accounts and ultimately returned to the originating account, obscuring the source of funds.
- **Layering**: The second stage of money laundering involving complex sequences of financial transactions designed to distance funds from their illicit origin.
- **Structuring**: The deliberate arrangement of financial transactions to evade Currency Transaction Report (CTR) filing requirements; synonymous with Smurfing in this context.
- **Non_Compliant_Transaction**: Any transaction or transaction pattern that violates AML regulatory requirements or triggers a risk threshold defined by this system.
- **Transaction_Graph**: A directed, weighted graph in which nodes represent financial accounts and edges represent individual transactions, with edge weight equal to transaction amount and edge direction representing fund flow.
- **Cycle**: A closed path in the Transaction_Graph where funds originating from a source account return to that same account through one or more intermediary accounts within a defined time window.
- **Velocity**: The rate of transaction activity for a given account, measured as the number of transactions per unit time (e.g., transactions per hour).
- **Risk_Score**: A composite numerical score in the range [0, 100] assigned to an account or transaction pattern, representing the estimated probability of money laundering activity.
- **Behavioral_Baseline**: A statistical profile of an account's historical transaction behavior, computed over a rolling 90-day window, capturing frequency, amount distribution, counterparty set, and geographic patterns.
- **Heuristic**: A practical detection rule derived from domain expertise and statistical observation, used to approximate optimal detection in the absence of ground-truth labels.
- **XAI**: Explainable Artificial Intelligence — techniques that produce human-interpretable justifications for algorithmic decisions.
- **DFS**: Depth-First Search — a graph traversal algorithm used here for cycle detection in the Transaction_Graph.
- **FATF**: Financial Action Task Force — the intergovernmental body that sets international standards for AML/CFT compliance; maintains a list of high-risk jurisdictions.
- **CTR_Threshold**: The regulatory reporting threshold (default: USD 10,000) above which financial institutions must file a Currency Transaction Report.
- **Transaction_Simulator**: The synthetic data engine responsible for generating realistic financial transaction streams for system testing and demonstration.
- **Detection_Engine**: The analysis subsystem responsible for executing cycle detection, smurfing detection, and behavioral anomaly scoring.
- **Risk_Scoring_Engine**: The subsystem that aggregates signals from the Detection_Engine into a unified Risk_Score.
- **SAR_Generator**: The AI subsystem that produces draft Suspicious Activity Reports using the Gemini 1.5 Flash language model.
- **Investigation_Dashboard**: The frontend application providing the Investigation Command Center interface for analysts and administrators.
- **Graph_Visualizer**: The frontend component rendering the interactive, force-directed Transaction_Graph.
- **RBAC**: Role-Based Access Control — a security model restricting system access based on assigned user roles.
- **Analyst**: A user role with read access to alerts and the ability to add case notes.
- **Admin**: A user role with full system access including user management and threshold configuration.

---

## Requirements

### Requirement 1: Synthetic Transaction Stream Generation

**User Story:** As a system demonstrator, I want the system to generate a continuous, realistic stream of synthetic financial transactions, so that the detection engine can be exercised and evaluated without requiring access to live financial data.

#### Acceptance Criteria

1. THE Transaction_Simulator SHALL generate synthetic transaction records containing the following fields: `transaction_id` (UUID v4), `sender_account_id`, `receiver_account_id`, `amount` (float, USD), `timestamp` (ISO 8601), `transaction_type` (enumerated: WIRE, ACH, CASH, CRYPTO), `geolocation` (ISO 3166-1 alpha-2 country codes for sender and receiver), `channel` (enumerated: MOBILE, BRANCH, ATM, ONLINE), and `device_id`.
2. WHEN the Transaction_Simulator is started, THE Transaction_Simulator SHALL emit a configurable number of transactions per second (default: 10 TPS, range: 1–1000 TPS) to the system's ingestion endpoint.
3. WHERE smurfing simulation is enabled, THE Transaction_Simulator SHALL inject synthetic Structuring patterns by generating clusters of 3–15 transactions from a single sender account, each with an amount between USD 1,000 and USD 9,999, directed at 2 or more distinct receiver accounts within a 60-minute window.
4. WHERE circular trading simulation is enabled, THE Transaction_Simulator SHALL inject synthetic Circular_Trading patterns by generating transaction chains of length 2–6 that return funds to the originating account within a configurable time window (default: 72 hours).
5. IF a generated transaction record is malformed or fails schema validation, THEN THE Transaction_Simulator SHALL log the error with a descriptive message and skip the malformed record without halting the stream.
6. THE Transaction_Simulator SHALL produce a statistically realistic distribution of transaction amounts, with the majority of transactions (≥ 70%) falling below USD 5,000 to simulate legitimate retail banking activity.

---

### Requirement 2: Transaction Data Ingestion and Normalization

**User Story:** As a backend engineer, I want all incoming transaction data to be validated, normalized, and persisted before analysis, so that the Detection_Engine operates on a consistent, high-quality data schema.

#### Acceptance Criteria

1. WHEN a transaction record is received by the ingestion endpoint, THE Detection_Engine SHALL validate the record against the canonical transaction schema within 50 milliseconds.
2. WHEN a valid transaction record is received, THE Detection_Engine SHALL persist the normalized record to the transaction data store and publish it to the analysis pipeline within 100 milliseconds of receipt.
3. IF a transaction record fails schema validation, THEN THE Detection_Engine SHALL route the record to a dead-letter queue and log the validation error with the original payload and a failure reason code.
4. THE Detection_Engine SHALL support concurrent ingestion of up to 1,000 transactions per second without degradation of the 100-millisecond persistence SLA defined in criterion 2.
5. THE Detection_Engine SHALL normalize all monetary amounts to USD using a configurable exchange rate table before persisting records involving non-USD currencies.

---

### Requirement 3: Transaction Graph Construction and Maintenance

**User Story:** As a detection engineer, I want all transactions to be modeled as a directed, weighted graph, so that graph-theoretic algorithms can identify relational patterns invisible to row-level analysis.

#### Acceptance Criteria

1. WHEN a transaction record is persisted, THE Detection_Engine SHALL create or update a corresponding directed edge in the Transaction_Graph, where the source node is the `sender_account_id`, the destination node is the `receiver_account_id`, and the edge weight is the normalized transaction `amount`.
2. THE Detection_Engine SHALL maintain node metadata for each account in the Transaction_Graph, including: total inbound volume, total outbound volume, transaction count, first-seen timestamp, and last-seen timestamp.
3. WHEN an account node is created in the Transaction_Graph for the first time, THE Detection_Engine SHALL initialize a Behavioral_Baseline record for that account with null historical statistics.
4. THE Detection_Engine SHALL support Transaction_Graph queries on subgraphs of up to 1,000 nodes with a query response time not exceeding 2,000 milliseconds.

---

### Requirement 4: Circular Trading Detection (Cycle Detection)

**User Story:** As a financial analyst, I want the system to automatically detect closed transaction loops in the fund flow network, so that I can identify Circular_Trading patterns that indicate layering activity.

#### Acceptance Criteria

1. WHEN a new transaction edge is added to the Transaction_Graph, THE Detection_Engine SHALL execute a DFS-based cycle detection algorithm to identify all Cycles of length 2 through N (configurable, default N = 6) that include the new edge.
2. WHEN a Cycle is detected, THE Detection_Engine SHALL verify that all transactions comprising the Cycle occurred within a configurable time window (default: 72 hours) before classifying the Cycle as a Circular_Trading pattern.
3. WHEN a Circular_Trading pattern is confirmed, THE Detection_Engine SHALL compute a cycle Risk_Score contribution using the following weighted factors: cycle length (shorter cycles weighted higher), total value circulated, time compression ratio (total cycle duration divided by minimum possible duration), and FATF high-risk jurisdiction involvement (binary flag, weight: +20 points).
4. WHEN a Circular_Trading pattern is confirmed, THE Detection_Engine SHALL generate an alert record containing: all participating account IDs, the ordered sequence of transactions forming the Cycle, the computed cycle Risk_Score contribution, and a timestamp.
5. IF the Transaction_Graph contains no path returning to the originating account within the configured time window, THEN THE Detection_Engine SHALL classify the transaction as non-circular and assign zero cycle Risk_Score contribution.
6. THE Detection_Engine SHALL complete cycle detection for any single new transaction edge within 500 milliseconds on a Transaction_Graph of up to 10,000 nodes.

---

### Requirement 5: Smurfing and Structuring Detection

**User Story:** As a financial analyst, I want the system to detect accounts engaged in Structuring behavior, so that I can identify Smurfing patterns designed to evade CTR reporting thresholds.

#### Acceptance Criteria

1. WHEN transactions are received, THE Detection_Engine SHALL continuously evaluate each sender account for Structuring behavior by computing the aggregate transaction amount across all outbound transactions within a configurable rolling time window (default: 24 hours).
2. WHEN a sender account's aggregate outbound transaction amount within the rolling window exceeds the CTR_Threshold (default: USD 10,000) AND each individual transaction in the window is below the CTR_Threshold, THEN THE Detection_Engine SHALL classify the account as exhibiting Structuring behavior and generate a smurfing alert.
3. WHEN a smurfing alert is generated, THE Detection_Engine SHALL record the number of transactions in the window, the aggregate amount, the individual transaction amounts, the distinct receiver account count, and the time span of the transaction cluster.
4. WHEN a sender account distributes transactions across 3 or more distinct receiver accounts within the rolling window while meeting the Structuring criteria in criterion 2, THE Detection_Engine SHALL apply a coordinated smurfing multiplier of 1.25 to the base smurfing Risk_Score contribution.
5. WHEN a sender account's transaction Velocity within any rolling 1-hour window exceeds 3 standard deviations above that account's historical mean hourly Velocity, THE Detection_Engine SHALL flag the account for velocity spike anomaly and include the spike magnitude in the alert record.
6. IF an account has fewer than 30 days of transaction history, THEN THE Detection_Engine SHALL apply population-level Velocity statistics as a substitute for the account-level Behavioral_Baseline when evaluating criterion 5.

---

### Requirement 6: Behavioral Baseline Profiling and Anomaly Detection

**User Story:** As a detection engineer, I want the system to maintain a longitudinal behavioral profile for each account, so that deviations from established norms can be detected independently of static thresholds.

#### Acceptance Criteria

1. THE Detection_Engine SHALL compute and maintain a Behavioral_Baseline for each account over a rolling 90-day window, capturing: mean and standard deviation of daily transaction frequency, mean and standard deviation of transaction amount, set of known counterparty account IDs, distribution of transaction types and channels, and geographic activity distribution by country code.
2. WHEN a new transaction is processed, THE Detection_Engine SHALL update the sender account's Behavioral_Baseline incrementally without requiring a full recomputation of the 90-day window.
3. WHEN a transaction amount exceeds the sender account's 90th percentile historical transaction amount AND the receiver account is not present in the sender's known counterparty set, THE Detection_Engine SHALL flag the transaction as a high-value new counterparty anomaly.
4. WHEN an account's transaction frequency in any rolling 24-hour window exceeds 3 standard deviations above the account's historical mean daily frequency, THE Detection_Engine SHALL generate a frequency anomaly alert with the observed frequency, historical mean, and standard deviation recorded.
5. IF an account's Behavioral_Baseline covers fewer than 30 days of history, THEN THE Detection_Engine SHALL annotate all anomaly scores for that account with a low-confidence flag indicating insufficient baseline data.

---

### Requirement 7: Hybrid Risk Scoring Engine

**User Story:** As a compliance officer, I want every flagged account or transaction pattern to receive a single, interpretable Risk_Score, so that I can prioritize investigations efficiently without manually correlating multiple signal sources.

#### Acceptance Criteria

1. THE Risk_Scoring_Engine SHALL compute a composite Risk_Score in the range [0, 100] for each alert by aggregating weighted contributions from: cycle detection score (weight: configurable, default 35%), smurfing/structuring score (weight: configurable, default 30%), behavioral anomaly score (weight: configurable, default 20%), and geographic risk score (weight: configurable, default 15%).
2. WHEN computing the geographic risk score component, THE Risk_Scoring_Engine SHALL assign elevated scores to transactions involving accounts in FATF-designated high-risk jurisdictions, with a maximum geographic contribution of 15 points.
3. WHEN a Risk_Score is computed, THE Risk_Scoring_Engine SHALL classify the alert into one of three tiers: LOW (score 0–39), MEDIUM (score 40–69), HIGH (score 70–100).
4. THE Risk_Scoring_Engine SHALL record the individual component scores and their weights alongside the composite Risk_Score in the alert record, enabling full score decomposition for XAI reporting.
5. WHEN the configurable weight parameters for Risk_Score components are modified by an Admin, THE Risk_Scoring_Engine SHALL apply the updated weights to all subsequent Risk_Score computations without requiring a system restart.
6. THE Risk_Scoring_Engine SHALL complete Risk_Score computation for a single alert within 100 milliseconds of receiving all component scores from the Detection_Engine.

---

### Requirement 8: Explainable AI SAR Generation

**User Story:** As a compliance investigator, I want the system to automatically generate a draft Suspicious Activity Report with a plain-English explanation of why an alert was raised, so that I can file regulatory reports efficiently and with full evidentiary justification.

#### Acceptance Criteria

1. WHEN an investigator requests SAR generation for a confirmed alert, THE SAR_Generator SHALL invoke the Gemini 1.5 Flash API with a structured prompt containing: the subject account details, the full transaction sequence comprising the alert, the Risk_Score decomposition, the detected pattern type (Smurfing, Circular_Trading, or Behavioral_Anomaly), and the Behavioral_Baseline deviation metrics.
2. WHEN the Gemini 1.5 Flash API returns a response, THE SAR_Generator SHALL produce a structured SAR draft containing: subject entity summary, detected activity narrative, timeline of key transactions, risk indicator enumeration with data-specific justifications, and recommended regulatory filing category.
3. WHEN generating the activity narrative, THE SAR_Generator SHALL include specific quantitative references from the alert data (e.g., "This account executed 12 transactions totaling USD 89,400 within 4 hours, compared to its 90-day baseline average of 3 transactions per week totaling USD 4,200").
4. IF the Gemini 1.5 Flash API returns an error or times out after 10 seconds, THEN THE SAR_Generator SHALL return a partial SAR template pre-populated with structured alert data, and log the API failure with the error code and timestamp.
5. THE SAR_Generator SHALL support export of completed SAR drafts in PDF format.
6. WHEN a SAR draft is generated, THE SAR_Generator SHALL record the generation timestamp, the invoking investigator's user ID, and the Gemini API request ID in the audit log.

---

### Requirement 9: Network Graph Visualization

**User Story:** As a financial analyst, I want to explore the transaction network as an interactive force-directed graph, so that I can visually identify suspicious fund flow patterns, clusters, and cycles that are difficult to perceive in tabular data.

#### Acceptance Criteria

1. THE Graph_Visualizer SHALL render the Transaction_Graph as an interactive, force-directed graph where nodes represent accounts, node size is proportional to total transaction volume, edges represent individual transactions, edge color encodes Risk_Score tier (green for LOW, amber for MEDIUM, red for HIGH), and edge direction indicates fund flow.
2. WHEN a Circular_Trading pattern is detected, THE Graph_Visualizer SHALL visually highlight all nodes and edges comprising the detected Cycle with a distinct visual treatment (e.g., pulsing border, contrasting color) to differentiate it from non-suspicious subgraphs.
3. WHEN a smurfing cluster is detected, THE Graph_Visualizer SHALL visually group the participating accounts and render the cluster with a distinct visual boundary.
4. WHEN an analyst clicks a node in the Graph_Visualizer, THE Graph_Visualizer SHALL display a detail panel showing: account ID, Risk_Score, transaction count, total inbound and outbound volume, Behavioral_Baseline summary, and a list of all connected transactions with timestamps and amounts.
5. THE Graph_Visualizer SHALL provide filter controls enabling analysts to restrict the displayed graph by: time range, transaction amount range, transaction type, Risk_Score tier, and detected pattern type.
6. THE Graph_Visualizer SHALL render an initial graph view for datasets of up to 100,000 nodes within 3,000 milliseconds of page load.
7. WHEN the analyst applies a filter, THE Graph_Visualizer SHALL update the rendered graph within 1,000 milliseconds.

---

### Requirement 10: Investigation Command Center Dashboard

**User Story:** As a financial analyst, I want a unified dark-themed dashboard that consolidates real-time alerts, the network graph, and case management tools, so that I can conduct end-to-end investigations from a single operational interface.

#### Acceptance Criteria

1. THE Investigation_Dashboard SHALL display a real-time alert feed showing incoming alerts ordered by Risk_Score descending, with each alert entry showing: account ID, detected pattern type, Risk_Score, tier classification, and timestamp.
2. WHEN a new HIGH-tier alert is generated, THE Investigation_Dashboard SHALL display the alert in the real-time feed within 2,000 milliseconds of alert generation without requiring a page refresh.
3. THE Investigation_Dashboard SHALL display aggregate operational metrics including: total active alerts by tier, alert volume trend over the past 24 hours, and the current system transaction ingestion rate.
4. WHEN an analyst selects an alert from the feed, THE Investigation_Dashboard SHALL display the associated subgraph in the Graph_Visualizer, the Risk_Score decomposition, the XAI narrative, and the case management panel for that alert.
5. THE Investigation_Dashboard SHALL implement a dark color theme with high-contrast text and visual elements to reduce analyst eye strain during extended monitoring sessions.
6. THE Investigation_Dashboard SHALL be fully functional on screen resolutions of 1920×1080 and above.

---

### Requirement 11: Case Lifecycle Management

**User Story:** As a compliance investigator, I want to manage the full lifecycle of a suspicious activity case from initial alert to regulatory filing or dismissal, so that all investigative actions are tracked and auditable.

#### Acceptance Criteria

1. THE Investigation_Dashboard SHALL support the following case states and transitions: `OPEN → UNDER_REVIEW → ESCALATED → CLOSED_SAR_FILED` and `OPEN → UNDER_REVIEW → CLOSED_DISMISSED`.
2. WHEN an investigator transitions a case to a new state, THE Investigation_Dashboard SHALL record the transition with the investigator's user ID, the new state, a mandatory reason code, and a timestamp.
3. WHEN an investigator adds a note to a case, THE Investigation_Dashboard SHALL persist the note with the author's user ID and timestamp, and display all case notes in chronological order.
4. THE Investigation_Dashboard SHALL prevent state transitions that violate the defined lifecycle sequence in criterion 1, and display a descriptive error message when an invalid transition is attempted.
5. WHEN a case is transitioned to `CLOSED_SAR_FILED`, THE Investigation_Dashboard SHALL require that a completed SAR draft is attached to the case record before the transition is permitted.

---

### Requirement 12: Role-Based Access Control and Authentication

**User Story:** As a system administrator, I want all system access to be governed by role-based permissions and secure authentication, so that sensitive financial investigation data is accessible only to authorized personnel.

#### Acceptance Criteria

1. THE Investigation_Dashboard SHALL enforce the following RBAC roles with the specified permissions: `ANALYST` (view alerts, add case notes, view graphs), `INVESTIGATOR` (all ANALYST permissions plus manage cases, generate SARs, export reports), `SUPERVISOR` (all INVESTIGATOR permissions plus escalate cases, modify detection thresholds), `ADMIN` (full system access including user management and audit log access).
2. WHEN a user attempts to access a resource or perform an action for which their assigned role lacks permission, THE Investigation_Dashboard SHALL return an authorization error and log the unauthorized access attempt with the user ID, attempted action, and timestamp.
3. WHEN a user session is authenticated, THE Investigation_Dashboard SHALL issue a JWT token with a maximum validity of 8 hours, after which the user SHALL be required to re-authenticate.
4. WHEN 3 consecutive failed authentication attempts are recorded for a single user account within a 10-minute window, THE Investigation_Dashboard SHALL temporarily lock the account for 15 minutes and notify the Admin role.
5. THE Investigation_Dashboard SHALL enforce Multi-Factor Authentication (MFA) for all users assigned the INVESTIGATOR, SUPERVISOR, or ADMIN roles.

---

### Requirement 13: Immutable Audit Trail

**User Story:** As a compliance officer, I want all system actions to be recorded in an immutable audit log, so that the system's decision-making process and all investigative actions can be reviewed by regulators.

#### Acceptance Criteria

1. THE Investigation_Dashboard SHALL record an audit log entry for every user action including: alert views, case state transitions, case note additions, SAR generation requests, threshold configuration changes, and user management operations.
2. WHEN an audit log entry is created, THE Investigation_Dashboard SHALL record: the acting user's ID and role, the action type, the affected resource ID, the action timestamp (UTC), and the outcome (SUCCESS or FAILURE).
3. THE Investigation_Dashboard SHALL prevent modification or deletion of audit log entries by any user role, including ADMIN.
4. WHEN an Admin requests an audit log export, THE Investigation_Dashboard SHALL generate a complete, chronologically ordered export of all audit entries within the requested date range in CSV format.

---

### Requirement 14: Detection Threshold Configuration

**User Story:** As a system administrator, I want to configure detection thresholds and risk score weights through the UI without code changes, so that the system can be tuned to evolving regulatory requirements and operational feedback.

#### Acceptance Criteria

1. WHEN an Admin modifies a detection parameter (CTR_Threshold, rolling time window, cycle length limit N, smurfing transaction count threshold, or Risk_Score component weights) through the configuration UI, THE Detection_Engine SHALL apply the updated parameters to all transactions processed after the configuration save, without requiring a system restart.
2. THE Investigation_Dashboard SHALL display the current value of all configurable parameters alongside their valid ranges and default values.
3. WHEN an Admin saves a configuration change, THE Investigation_Dashboard SHALL record the change in the audit log per Requirement 13, including the previous value and the new value of each modified parameter.
4. IF an Admin attempts to set a configuration parameter to a value outside its valid range, THEN THE Investigation_Dashboard SHALL reject the input and display a descriptive validation error specifying the valid range.

---

### Requirement 15: System Performance and Latency

**User Story:** As a system architect, I want the end-to-end processing pipeline to meet defined latency and throughput targets, so that the system can operate as a genuine real-time financial surveillance platform.

#### Acceptance Criteria

1. THE Detection_Engine SHALL process each transaction from ingestion to alert generation (where applicable) within 500 milliseconds at the 99th percentile under a sustained load of 100 transactions per second.
2. THE Detection_Engine SHALL maintain the 500-millisecond end-to-end latency SLA defined in criterion 1 while concurrently executing cycle detection, smurfing detection, and behavioral anomaly scoring for the same transaction.
3. THE Investigation_Dashboard SHALL load the initial dashboard view, including the alert feed and graph visualization, within 3,000 milliseconds on a standard broadband connection (≥ 10 Mbps).
4. WHILE the system is operating under peak load (1,000 TPS), THE Detection_Engine SHALL not drop or skip any ingested transaction records.
5. THE Detection_Engine SHALL achieve a false positive rate below 30% and a recall rate above 85% on the synthetic labeled validation dataset generated by the Transaction_Simulator.
