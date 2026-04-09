"""
TRACR Synthetic Data Seeder
═══════════════════════════════════════════════════════════════════════════════
Run:  python seed_data.py
Deps: pip install pymongo bcrypt

What it seeds (idempotent — safe to run multiple times):
  • 2 users          admin / analyst       password: Password123!
  • 22 accounts      with mature 90-day baselines
  • 300 background   normal transactions    (last 90 days)
  • 18 smurfing txs  3 clusters             -> 3 smurfing alerts
  • 7 circular txs   chain-3 + chain-4      -> 2 cycle alerts
  • 1 behavioral tx  huge tx / new counterparty -> 1 MEDIUM alert
  • 4 alert docs     (pre-computed, mirrors engine output)
  • 2 case docs      OPEN + ESCALATED
  • 12 audit logs
  • 10 system-config keys

BUG NOTES (kept intentionally, tracked for fix):
  BUG-1  amountP90=0 false-positive in BehavioralProfiler.js L139
         → All seeded accounts have amount_p90 > 0, so detector fires correctly
           for the BEHAVIORAL_ANOMALY scenario. New runtime accounts still hit it.
  BUG-2  Double alert:new emit in RiskScorer.js L67 + DetectionOrchestrator.js L43
         → Not triggered here (no Socket.IO at seed time). Alert docs written once.
═══════════════════════════════════════════════════════════════════════════════
"""

import os
import random
import uuid
from datetime import datetime, timezone, timedelta

import bcrypt
from pymongo import MongoClient

# ── Config ────────────────────────────────────────────────────────────────────

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/intelligent_aml")
client    = MongoClient(MONGO_URI)
db        = client.get_default_database()

# ── Helpers ───────────────────────────────────────────────────────────────────

def uid() -> str:
    return str(uuid.uuid4())

def ri(lo, hi) -> int:
    return random.randint(lo, hi)

def rf(lo, hi) -> float:
    return round(random.uniform(lo, hi), 2)

def pick(lst):
    return random.choice(lst)

def days_ago(n: float) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=n)

def hours_ago(n: float) -> datetime:
    return datetime.now(timezone.utc) - timedelta(hours=n)

def now() -> datetime:
    return datetime.now(timezone.utc)

TX_TYPES  = ["WIRE", "ACH", "CASH", "CRYPTO"]
CHANNELS  = ["MOBILE", "BRANCH", "ATM", "ONLINE"]
COUNTRIES = ["US", "IN", "GB", "SG", "AE", "MX", "DE", "JP", "CA", "FR"]

# ── Fixed account IDs (consistent across all collections) ─────────────────────

ACCS = {
    # Normal background accounts
    "N1":  "ACC-N-001", "N2":  "ACC-N-002", "N3":  "ACC-N-003",
    "N4":  "ACC-N-004", "N5":  "ACC-N-005", "N6":  "ACC-N-006",
    "N7":  "ACC-N-007", "N8":  "ACC-N-008", "N9":  "ACC-N-009",
    "N10": "ACC-N-010",
    # Smurfing senders
    "SM1": "ACC-SM-001", "SM2": "ACC-SM-002", "SM3": "ACC-SM-003",
    # Smurfing receivers
    "SMR1": "ACC-SMR-001", "SMR2": "ACC-SMR-002", "SMR3": "ACC-SMR-003",
    "SMR4": "ACC-SMR-004", "SMR5": "ACC-SMR-005",
    # Circular-trading ring
    "C1": "ACC-C-001", "C2": "ACC-C-002", "C3": "ACC-C-003", "C4": "ACC-C-004",
    # Behavioral anomaly
    "BA": "ACC-BA-001",
}

# Pre-generate stable alert / case IDs so foreign keys are consistent
ALERT_IDS = {k: uid() for k in ("smurfing1", "smurfing2", "smurfing3", "circular1", "circular2", "behavioral")}
CASE_IDS  = {k: uid() for k in ("open", "escalated")}

USER_ADMIN   = "USER-ADMIN-001"
USER_ANALYST = "USER-ANALYST-001"

# ─────────────────────────────────────────────────────────────────────────────
# 1. SYSTEM CONFIG
# ─────────────────────────────────────────────────────────────────────────────

def seed_system_config():
    col = db["systemconfigs"]
    if col.count_documents({}) > 0:
        print("  system_config: already seeded, skipping")
        return

    configs = [
        {"config_key": "ctr_threshold",           "value": 10000, "default_value": 10000, "valid_range": {"min": 1000,  "max": 100000}, "description": "Structuring CTR threshold (USD)"},
        {"config_key": "rolling_window_hours",    "value": 24,    "default_value": 24,    "valid_range": {"min": 1,    "max": 168},    "description": "Rolling smurfing window (hours)"},
        {"config_key": "cycle_max_length",        "value": 6,     "default_value": 6,     "valid_range": {"min": 2,    "max": 12},     "description": "Max DFS cycle length"},
        {"config_key": "cycle_time_window_hours", "value": 72,    "default_value": 72,    "valid_range": {"min": 1,    "max": 720},    "description": "Max cycle time window (hours)"},
        {"config_key": "smurfing_tx_count_threshold", "value": 3, "default_value": 3,    "valid_range": {"min": 2,    "max": 50},     "description": "Min tx count for smurfing"},
        {"config_key": "score_weight_cycle",      "value": 0.35,  "default_value": 0.35,  "valid_range": {"min": 0,    "max": 1},      "description": "Cycle score weight"},
        {"config_key": "score_weight_smurfing",   "value": 0.30,  "default_value": 0.30,  "valid_range": {"min": 0,    "max": 1},      "description": "Smurfing score weight"},
        {"config_key": "score_weight_behavioral", "value": 0.20,  "default_value": 0.20,  "valid_range": {"min": 0,    "max": 1},      "description": "Behavioral score weight"},
        {"config_key": "score_weight_geo",        "value": 0.15,  "default_value": 0.15,  "valid_range": {"min": 0,    "max": 1},      "description": "Geo risk weight"},
        {"config_key": "fatf_high_risk_jurisdictions", "value": ["IR","KP","MM"], "default_value": ["IR","KP","MM"], "valid_range": {}, "description": "FATF high-risk country codes"},
    ]
    col.insert_many(configs)
    print(f"  system_config: seeded {len(configs)} keys")

# ─────────────────────────────────────────────────────────────────────────────
# 2. USERS
# ─────────────────────────────────────────────────────────────────────────────

def seed_users():
    col = db["users"]
    if col.count_documents({}) > 0:
        print("  users: already seeded, skipping")
        return

    pw_hash = bcrypt.hashpw(b"Password123!", bcrypt.gensalt(rounds=12)).decode()

    users = [
        {
            "user_id":       USER_ADMIN,
            "username":      "admin",
            "email":         "admin@tracr.local",
            "password_hash": pw_hash,
            "role":          "ADMIN",
            "created_at":    days_ago(30),
            "last_login":    hours_ago(2),
        },
        {
            "user_id":       USER_ANALYST,
            "username":      "analyst",
            "email":         "analyst@tracr.local",
            "password_hash": pw_hash,
            "role":          "ANALYST",
            "created_at":    days_ago(20),
            "last_login":    hours_ago(1),
        },
    ]
    col.insert_many(users)
    print(f"  users: seeded {len(users)}")

# ─────────────────────────────────────────────────────────────────────────────
# 3. ACCOUNTS  (all with mature baselines so BUG-1 doesn't false-fire here)
# ─────────────────────────────────────────────────────────────────────────────

def build_baseline(
    amount_mean=1200, amount_stddev=800, amount_p90=3500,
    daily_freq_mean=3.0, daily_freq_stddev=1.2,
    known_counterparties=None, history_days=None, low_confidence=False,
):
    return {
        "daily_freq_mean":    daily_freq_mean,
        "daily_freq_stddev":  daily_freq_stddev,
        "amount_mean":        amount_mean,
        "amount_stddev":      amount_stddev,
        # BUG-1 note: amount_p90 is intentionally > 0 for all seeded accounts.
        # New accounts created at runtime start with null → coerces to 0 → bug fires.
        "amount_p90":         amount_p90,
        "known_counterparties": known_counterparties or [],
        "type_distribution":    {"WIRE": 0.4, "ACH": 0.3, "CASH": 0.2, "CRYPTO": 0.1},
        "channel_distribution": {"MOBILE": 0.5, "ONLINE": 0.3, "BRANCH": 0.1, "ATM": 0.1},
        "geo_distribution":     {"US": 0.7, "IN": 0.1, "GB": 0.1, "SG": 0.1},
        "history_days":       history_days if history_days is not None else ri(60, 90),
        "low_confidence":     low_confidence,
    }


def seed_accounts():
    col = db["accounts"]
    if col.count_documents({}) > 0:
        print("  accounts: already seeded, skipping")
        return

    all_ids = list(ACCS.values())
    docs = []

    # ── 10 normal accounts ──────────────────────────────────────────────────
    for key in [f"N{i}" for i in range(1, 11)]:
        acc_id = ACCS[key]
        peers  = [a for a in all_ids if a != acc_id][:ri(5, 10)]
        docs.append({
            "account_id":         acc_id,
            "first_seen":         days_ago(ri(60, 90)),
            "last_seen":          now(),
            "total_inbound_usd":  rf(20000, 150000),
            "total_outbound_usd": rf(15000, 140000),
            "transaction_count":  ri(80, 300),
            "baseline":           build_baseline(known_counterparties=peers),
        })

    # ── 3 smurfing senders (legit history, about to go rogue) ───────────────
    for key in ["SM1", "SM2", "SM3"]:
        docs.append({
            "account_id":         ACCS[key],
            "first_seen":         days_ago(85),
            "last_seen":          now(),
            "total_inbound_usd":  rf(5000, 20000),
            "total_outbound_usd": rf(30000, 80000),
            "transaction_count":  ri(50, 120),
            "baseline": build_baseline(
                amount_mean=2500, amount_stddev=1000, amount_p90=5000,
                daily_freq_mean=2.0, daily_freq_stddev=0.8,
                known_counterparties=[ACCS["N1"], ACCS["N2"]],
                history_days=85,
            ),
        })

    # ── 5 smurfing receivers ─────────────────────────────────────────────────
    for key in ["SMR1", "SMR2", "SMR3", "SMR4", "SMR5"]:
        docs.append({
            "account_id":         ACCS[key],
            "first_seen":         days_ago(ri(30, 60)),
            "last_seen":          now(),
            "total_inbound_usd":  rf(10000, 40000),
            "total_outbound_usd": rf(5000, 15000),
            "transaction_count":  ri(20, 60),
            "baseline":           build_baseline(history_days=ri(30, 60)),
        })

    # ── 4 circular-trading ring accounts ────────────────────────────────────
    ring = [ACCS[k] for k in ["C1", "C2", "C3", "C4"]]
    for key in ["C1", "C2", "C3", "C4"]:
        docs.append({
            "account_id":         ACCS[key],
            "first_seen":         days_ago(75),
            "last_seen":          now(),
            "total_inbound_usd":  rf(50000, 200000),
            "total_outbound_usd": rf(50000, 200000),
            "transaction_count":  ri(100, 250),
            "baseline": build_baseline(
                amount_mean=8000, amount_stddev=3000, amount_p90=15000,
                # Ring accounts know each other → NEW_COUNTERPARTY won't fire for ring txs
                known_counterparties=ring,
                history_days=75,
            ),
        })

    # ── Behavioral anomaly account (low p90 so the big tx fires detector) ───
    docs.append({
        "account_id":         ACCS["BA"],
        "first_seen":         days_ago(90),
        "last_seen":          now(),
        "total_inbound_usd":  45000,
        "total_outbound_usd": 38000,
        "transaction_count":  95,
        "baseline": build_baseline(
            amount_mean=400, amount_stddev=200, amount_p90=900,  # p90=$900
            daily_freq_mean=1.5, daily_freq_stddev=0.6,
            known_counterparties=[ACCS["N1"], ACCS["N3"], ACCS["N5"]],
            history_days=90,
        ),
    })

    col.insert_many(docs)
    print(f"  accounts: seeded {len(docs)}")

# ─────────────────────────────────────────────────────────────────────────────
# 4. TRANSACTIONS
# ─────────────────────────────────────────────────────────────────────────────

def _base_tx(**kwargs) -> dict:
    """Return a complete transaction document. Caller may override any field."""
    return {
        "transaction_id":    uid(),
        "sender_account_id":    "ACC-UNKNOWN",
        "receiver_account_id":  "ACC-UNKNOWN",
        "amount_usd":        0,
        "amount_original":   0,
        "currency_original": "USD",
        "currency_normalized": True,
        "timestamp":         now(),
        "transaction_type":  "WIRE",
        "geolocation": {"sender_country": "US", "receiver_country": "US"},
        "channel":           "ONLINE",
        "device_id":         f"DEV-{ri(100000,999999)}",
        "is_synthetic":      True,
        "pattern_tag":       None,
        "schema_version":    1,
        "ingested_at":       now(),
        **kwargs,
    }


def seed_background_transactions():
    col = db["transactions"]
    if col.count_documents({"pattern_tag": None}) > 50:
        print("  background transactions: already seeded, skipping")
        return

    normal_ids = (
        [ACCS[f"N{i}"] for i in range(1, 11)]
        + [ACCS["BA"], ACCS["SM1"], ACCS["SM2"], ACCS["SM3"]]
    )

    txs = []
    for _ in range(300):
        sender = pick(normal_ids)
        receiver = pick([a for a in normal_ids if a != sender])
        amt = rf(50, 4999)
        txs.append(_base_tx(
            sender_account_id=sender,
            receiver_account_id=receiver,
            amount_usd=amt,
            amount_original=amt,
            timestamp=days_ago(ri(1, 90)) + timedelta(seconds=ri(0, 86399)),
            transaction_type=pick(TX_TYPES),
            geolocation={"sender_country": pick(COUNTRIES), "receiver_country": pick(COUNTRIES)},
            channel=pick(CHANNELS),
        ))

    col.insert_many(txs)
    print(f"  background transactions: seeded {len(txs)}")


def seed_smurfing_clusters():
    col = db["transactions"]
    if col.count_documents({"pattern_tag": "SMURFING"}) > 0:
        print("  smurfing clusters: already seeded, skipping")
        return

    base = hours_ago(6)
    txs  = []

    # ── Cluster 1: SM1 → SMR1/SMR2 (6 txs, aggregate $19 500, 2 receivers) ─
    c1_amounts  = [4200, 4100, 3900, 2800, 1900, 2600]
    c1_recv     = [ACCS["SMR1"], ACCS["SMR2"]]
    for i, amt in enumerate(c1_amounts):
        txs.append(_base_tx(
            sender_account_id=ACCS["SM1"],
            receiver_account_id=c1_recv[i % 2],
            amount_usd=amt, amount_original=amt,
            timestamp=base + timedelta(minutes=12 * i),
            transaction_type="CASH",
            geolocation={"sender_country": "US", "receiver_country": "US"},
            channel="BRANCH",
            device_id="DEV-SM1",
            pattern_tag="SMURFING",
        ))

    # ── Cluster 2: SM2 → SMR1/SMR3/SMR4 (8 txs, $24 500, 3 receivers)
    #               coordinated multiplier triggers (≥3 distinct receivers) ──
    c2_amounts = [3500, 3200, 2900, 3100, 2800, 3300, 2700, 3000]
    c2_recv    = [ACCS["SMR1"], ACCS["SMR3"], ACCS["SMR4"]]
    for i, amt in enumerate(c2_amounts):
        txs.append(_base_tx(
            sender_account_id=ACCS["SM2"],
            receiver_account_id=c2_recv[i % 3],
            amount_usd=amt, amount_original=amt,
            timestamp=base + timedelta(minutes=8 * i),
            transaction_type="ACH",
            geolocation={"sender_country": "US", "receiver_country": "US"},
            channel="ONLINE",
            device_id="DEV-SM2",
            pattern_tag="SMURFING",
        ))

    # ── Cluster 3: SM3 → SMR2/SMR5 (4 txs, $13 000, FATF country IR) ───────
    c3_amounts = [4500, 3000, 3500, 2000]
    c3_recv    = [ACCS["SMR2"], ACCS["SMR5"]]
    for i, amt in enumerate(c3_amounts):
        txs.append(_base_tx(
            sender_account_id=ACCS["SM3"],
            receiver_account_id=c3_recv[i % 2],
            amount_usd=amt, amount_original=amt,
            timestamp=base + timedelta(minutes=20 * i),
            transaction_type="WIRE",
            geolocation={"sender_country": "IR", "receiver_country": "US"},  # FATF
            channel="ONLINE",
            device_id="DEV-SM3",
            pattern_tag="SMURFING",
        ))

    col.insert_many(txs)
    print(f"  smurfing clusters: seeded {len(txs)} txs (3 clusters)")


def seed_circular_chains():
    col = db["transactions"]
    if col.count_documents({"pattern_tag": "CIRCULAR_TRADING"}) > 0:
        print("  circular chains: already seeded, skipping")
        return

    txs = []

    # ── Chain A: C1→C2→C3→C1 (length 3, no FATF) ───────────────────────────
    chain_a = [
        (ACCS["C1"], ACCS["C2"], 15000, 4.0, "US", "US"),
        (ACCS["C2"], ACCS["C3"], 14800, 3.0, "US", "US"),
        (ACCS["C3"], ACCS["C1"], 14600, 2.0, "US", "US"),
    ]
    for (src, dst, amt, h, sc, rc) in chain_a:
        txs.append(_base_tx(
            sender_account_id=src, receiver_account_id=dst,
            amount_usd=amt, amount_original=amt,
            timestamp=hours_ago(h),
            geolocation={"sender_country": sc, "receiver_country": rc},
            device_id="DEV-CYCLE-A",
            pattern_tag="CIRCULAR_TRADING",
        ))

    # ── Chain B: C1→C2→C3→C4→C1 (length 4, hop via MM = FATF) ─────────────
    chain_b = [
        (ACCS["C1"], ACCS["C2"], 25000, 8.0, "US", "AE"),
        (ACCS["C2"], ACCS["C3"], 24500, 6.0, "AE", "MM"),  # FATF hop
        (ACCS["C3"], ACCS["C4"], 24000, 4.0, "MM", "US"),
        (ACCS["C4"], ACCS["C1"], 23500, 2.0, "US", "US"),
    ]
    for (src, dst, amt, h, sc, rc) in chain_b:
        txs.append(_base_tx(
            sender_account_id=src, receiver_account_id=dst,
            amount_usd=amt, amount_original=amt,
            timestamp=hours_ago(h),
            geolocation={"sender_country": sc, "receiver_country": rc},
            device_id="DEV-CYCLE-B",
            pattern_tag="CIRCULAR_TRADING",
        ))

    col.insert_many(txs)
    print(f"  circular chains: seeded {len(txs)} txs (2 chains)")


def seed_behavioral_anomaly():
    col = db["transactions"]
    if col.count_documents({"sender_account_id": ACCS["BA"], "amount_usd": {"$gt": 10000}}) > 0:
        print("  behavioral anomaly tx: already seeded, skipping")
        return

    col.insert_one(_base_tx(
        sender_account_id=ACCS["BA"],
        receiver_account_id="ACC-UNKNOWN-999",   # not in known_counterparties
        amount_usd=18000, amount_original=18000,
        timestamp=hours_ago(1),
        transaction_type="WIRE",
        geolocation={"sender_country": "US", "receiver_country": "KP"},  # FATF
        channel="ONLINE",
        device_id="DEV-BA",
    ))
    print("  behavioral anomaly tx: seeded 1")

# ─────────────────────────────────────────────────────────────────────────────
# 5. ALERTS  (pre-computed — mirrors what the detection engine would produce)
# ─────────────────────────────────────────────────────────────────────────────

def seed_alerts():
    col = db["alerts"]
    if col.count_documents({}) > 0:
        print("  alerts: already seeded, skipping")
        return

    def score_breakdown(cycle=0, smurfing=0, behavioral=0, geo=0):
        return {
            "cycle_score":       cycle,
            "smurfing_score":    smurfing,
            "behavioral_score":  behavioral,
            "geographic_score":  geo,
            "cycle_weight":      0.35,
            "smurfing_weight":   0.30,
            "behavioral_weight": 0.20,
            "geographic_weight": 0.15,
        }

    alerts = [
        # ── Smurfing 1: SM1, 6 txs, 2 receivers, HIGH ──────────────────────
        {
            "alert_id":           ALERT_IDS["smurfing1"],
            "pattern_type":       "SMURFING",
            "subject_account_id": ACCS["SM1"],
            "involved_accounts":  [ACCS["SM1"], ACCS["SMR1"], ACCS["SMR2"]],
            "transaction_ids":    [],
            "risk_score":   72,
            "risk_tier":    "HIGH",
            "score_breakdown": score_breakdown(smurfing=78, behavioral=40),
            "smurfing_detail": {
                "pattern_type":               "SMURFING",
                "subject_account_id":         ACCS["SM1"],
                "transaction_count":          6,
                "aggregate_amount":           19500,
                "individual_amounts":         [4200, 4100, 3900, 2800, 1900, 2600],
                "distinct_receiver_count":    2,
                "time_span_hours":            1.2,
                "coordinated_multiplier_applied": False,
                "smurfing_score":             78,
                "base_smurfing_score":        78,
            },
            "cycle_detail":      None,
            "behavioral_detail": None,
            "created_at":        hours_ago(5),
            "updated_at":        hours_ago(5),
        },
        # ── Smurfing 2: SM2, 8 txs, 3 receivers, coordinated, HIGH ─────────
        {
            "alert_id":           ALERT_IDS["smurfing2"],
            "pattern_type":       "SMURFING",
            "subject_account_id": ACCS["SM2"],
            "involved_accounts":  [ACCS["SM2"], ACCS["SMR1"], ACCS["SMR3"], ACCS["SMR4"]],
            "transaction_ids":    [],
            "risk_score":   81,
            "risk_tier":    "HIGH",
            "score_breakdown": score_breakdown(smurfing=88, behavioral=40),
            "smurfing_detail": {
                "pattern_type":               "SMURFING",
                "subject_account_id":         ACCS["SM2"],
                "transaction_count":          8,
                "aggregate_amount":           24500,
                "individual_amounts":         [3500, 3200, 2900, 3100, 2800, 3300, 2700, 3000],
                "distinct_receiver_count":    3,
                "time_span_hours":            0.9,
                "coordinated_multiplier_applied": True,
                "smurfing_score":             88,
                "base_smurfing_score":        70,
            },
            "cycle_detail":      None,
            "behavioral_detail": None,
            "created_at":        hours_ago(4),
            "updated_at":        hours_ago(4),
        },
        # ── Smurfing 3: SM3, 4 txs, FATF country IR, HIGH ──────────────────
        {
            "alert_id":           ALERT_IDS["smurfing3"],
            "pattern_type":       "SMURFING",
            "subject_account_id": ACCS["SM3"],
            "involved_accounts":  [ACCS["SM3"], ACCS["SMR2"], ACCS["SMR5"]],
            "transaction_ids":    [],
            "risk_score":   79,
            "risk_tier":    "HIGH",
            "score_breakdown": score_breakdown(smurfing=65, geo=15),
            "smurfing_detail": {
                "pattern_type":               "SMURFING",
                "subject_account_id":         ACCS["SM3"],
                "transaction_count":          4,
                "aggregate_amount":           13000,
                "individual_amounts":         [4500, 3000, 3500, 2000],
                "distinct_receiver_count":    2,
                "time_span_hours":            1.0,
                "coordinated_multiplier_applied": False,
                "smurfing_score":             65,
                "base_smurfing_score":        65,
            },
            "cycle_detail":      None,
            "behavioral_detail": None,
            "created_at":        hours_ago(3.5),
            "updated_at":        hours_ago(3.5),
        },
        # ── Circular 1: Chain A (3-hop, no FATF), HIGH ──────────────────────
        {
            "alert_id":           ALERT_IDS["circular1"],
            "pattern_type":       "CIRCULAR_TRADING",
            "subject_account_id": ACCS["C1"],
            "involved_accounts":  [ACCS["C1"], ACCS["C2"], ACCS["C3"]],
            "transaction_ids":    [],
            "risk_score":   68,
            "risk_tier":    "MEDIUM",
            "score_breakdown": score_breakdown(cycle=60),
            "cycle_detail": {
                "pattern_type":    "CIRCULAR_TRADING",
                "involved_accounts": [ACCS["C1"], ACCS["C2"], ACCS["C3"]],
                "cycle_length":    3,
                "cycle_score":     60,
                "fatf_flag":       False,
                "detected_at":     hours_ago(2).isoformat(),
                "transaction_sequence": [
                    {"from": ACCS["C1"], "to": ACCS["C2"], "amount": 15000, "timestamp": hours_ago(4).isoformat()},
                    {"from": ACCS["C2"], "to": ACCS["C3"], "amount": 14800, "timestamp": hours_ago(3).isoformat()},
                    {"from": ACCS["C3"], "to": ACCS["C1"], "amount": 14600, "timestamp": hours_ago(2).isoformat()},
                ],
            },
            "smurfing_detail":   None,
            "behavioral_detail": None,
            "created_at":        hours_ago(2),
            "updated_at":        hours_ago(2),
        },
        # ── Circular 2: Chain B (4-hop, FATF MM+AE), HIGH ───────────────────
        {
            "alert_id":           ALERT_IDS["circular2"],
            "pattern_type":       "CIRCULAR_TRADING",
            "subject_account_id": ACCS["C1"],
            "involved_accounts":  [ACCS["C1"], ACCS["C2"], ACCS["C3"], ACCS["C4"]],
            "transaction_ids":    [],
            "risk_score":   88,
            "risk_tier":    "HIGH",
            "score_breakdown": score_breakdown(cycle=82, geo=15),
            "cycle_detail": {
                "pattern_type":    "CIRCULAR_TRADING",
                "involved_accounts": [ACCS["C1"], ACCS["C2"], ACCS["C3"], ACCS["C4"]],
                "cycle_length":    4,
                "cycle_score":     82,
                "fatf_flag":       True,
                "detected_at":     hours_ago(2).isoformat(),
                "transaction_sequence": [
                    {"from": ACCS["C1"], "to": ACCS["C2"], "amount": 25000, "timestamp": hours_ago(8).isoformat()},
                    {"from": ACCS["C2"], "to": ACCS["C3"], "amount": 24500, "timestamp": hours_ago(6).isoformat()},
                    {"from": ACCS["C3"], "to": ACCS["C4"], "amount": 24000, "timestamp": hours_ago(4).isoformat()},
                    {"from": ACCS["C4"], "to": ACCS["C1"], "amount": 23500, "timestamp": hours_ago(2).isoformat()},
                ],
            },
            "smurfing_detail":   None,
            "behavioral_detail": None,
            "created_at":        hours_ago(2),
            "updated_at":        hours_ago(2),
        },
        # ── Behavioral: BA sent $18k to unknown counterparty, MEDIUM ─────────
        {
            "alert_id":           ALERT_IDS["behavioral"],
            "pattern_type":       "BEHAVIORAL_ANOMALY",
            "subject_account_id": ACCS["BA"],
            "involved_accounts":  [ACCS["BA"], "ACC-UNKNOWN-999"],
            "transaction_ids":    [],
            "risk_score":   53,
            "risk_tier":    "MEDIUM",
            "score_breakdown": score_breakdown(behavioral=75, geo=15),
            "cycle_detail":      None,
            "smurfing_detail":   None,
            "behavioral_detail": {
                "subject_account_id": ACCS["BA"],
                "anomalies": [
                    {
                        "anomalyType":    "HIGH_VALUE_NEW_COUNTERPARTY",
                        "observedValue":  18000,
                        "baselineP90":    900,
                    }
                ],
                "low_confidence": False,
            },
            "created_at":  hours_ago(1),
            "updated_at":  hours_ago(1),
        },
    ]

    col.insert_many(alerts)
    print(f"  alerts: seeded {len(alerts)}")

# ─────────────────────────────────────────────────────────────────────────────
# 6. CASES
# ─────────────────────────────────────────────────────────────────────────────

def seed_cases():
    col = db["cases"]
    if col.count_documents({}) > 0:
        print("  cases: already seeded, skipping")
        return

    cases = [
        # OPEN case — smurfing1 alert, assigned to analyst
        {
            "case_id":            CASE_IDS["open"],
            "alert_id":           ALERT_IDS["smurfing1"],
            "subject_account_id": ACCS["SM1"],
            "state":              "OPEN",
            "state_history": [
                {
                    "from_state":  None,
                    "to_state":    "OPEN",
                    "reason_code": "INITIAL_CREATE",
                    "changed_by":  USER_ANALYST,
                    "changed_at":  hours_ago(3),
                }
            ],
            "notes":        [],
            "sar_draft_id": None,
            "assigned_to":  USER_ANALYST,
            "created_at":   hours_ago(3),
            "updated_at":   hours_ago(3),
        },
        # ESCALATED case — circular2 alert (FATF), fully progressed
        {
            "case_id":            CASE_IDS["escalated"],
            "alert_id":           ALERT_IDS["circular2"],
            "subject_account_id": ACCS["C1"],
            "state":              "ESCALATED",
            "state_history": [
                {"from_state": None,           "to_state": "OPEN",         "reason_code": "INITIAL_CREATE",  "changed_by": USER_ANALYST, "changed_at": hours_ago(6)},
                {"from_state": "OPEN",         "to_state": "UNDER_REVIEW", "reason_code": "ANALYST_REVIEW",  "changed_by": USER_ANALYST, "changed_at": hours_ago(5)},
                {"from_state": "UNDER_REVIEW", "to_state": "ESCALATED",    "reason_code": "FATF_JURISDICTION","changed_by": USER_ADMIN,   "changed_at": hours_ago(3)},
            ],
            "notes": [
                {
                    "author_user_id": USER_ANALYST,
                    "note": "4-hop circular trading confirmed. FATF jurisdiction (MM) in hop 2. Recommending immediate SAR filing.",
                    "timestamp": hours_ago(4),
                },
                {
                    "author_user_id": USER_ADMIN,
                    "note": "Escalated to compliance. Myanmar/UAE hop sequence matches typology seen in 3 prior cases this quarter.",
                    "timestamp": hours_ago(3),
                },
            ],
            "sar_draft_id": None,
            "assigned_to":  USER_ADMIN,
            "created_at":   hours_ago(6),
            "updated_at":   hours_ago(3),
        },
    ]

    col.insert_many(cases)
    print(f"  cases: seeded {len(cases)}")

# ─────────────────────────────────────────────────────────────────────────────
# 7. AUDIT LOGS
# ─────────────────────────────────────────────────────────────────────────────

def seed_audit_logs():
    col = db["auditlogs"]
    if col.count_documents({}) > 0:
        print("  audit logs: already seeded, skipping")
        return

    def log(user_id, user_role, action_type, resource_type, resource_id,
            outcome, ts, ip="127.0.0.1", metadata=None):
        return {
            "log_id":          uid(),
            "user_id":         user_id,
            "user_role":       user_role,
            "action_type":     action_type,
            "resource_type":   resource_type,
            "resource_id":     resource_id,
            "action_timestamp": ts,
            "outcome":         outcome,
            "ip_address":      ip,
            "metadata":        metadata or {},
        }

    logs = [
        log(USER_ADMIN,   "ADMIN",   "AUTH_LOGIN",      "AUTH",  "login",                "SUCCESS", hours_ago(6)),
        log(USER_ANALYST, "ANALYST", "AUTH_LOGIN",       "AUTH",  "login",                "SUCCESS", hours_ago(5)),
        log(USER_ANALYST, "ANALYST", "ALERT_VIEW",       "ALERT", ALERT_IDS["smurfing1"], "SUCCESS", hours_ago(4.8)),
        log(USER_ANALYST, "ANALYST", "CASE_CREATE",      "CASE",  CASE_IDS["open"],       "SUCCESS", hours_ago(4.7), metadata={"alert_id": ALERT_IDS["smurfing1"]}),
        log(USER_ANALYST, "ANALYST", "ALERT_VIEW",       "ALERT", ALERT_IDS["circular2"], "SUCCESS", hours_ago(4.5)),
        log(USER_ANALYST, "ANALYST", "CASE_CREATE",      "CASE",  CASE_IDS["escalated"],  "SUCCESS", hours_ago(4.4), metadata={"alert_id": ALERT_IDS["circular2"]}),
        log(USER_ANALYST, "ANALYST", "CASE_TRANSITION",  "CASE",  CASE_IDS["escalated"],  "SUCCESS", hours_ago(4.0), metadata={"from_state": "OPEN", "to_state": "UNDER_REVIEW"}),
        log(USER_ANALYST, "ANALYST", "NOTE_ADD",         "CASE",  CASE_IDS["escalated"],  "SUCCESS", hours_ago(3.8)),
        log(USER_ADMIN,   "ADMIN",   "CASE_TRANSITION",  "CASE",  CASE_IDS["escalated"],  "SUCCESS", hours_ago(3.0), metadata={"from_state": "UNDER_REVIEW", "to_state": "ESCALATED"}),
        log(USER_ADMIN,   "ADMIN",   "NOTE_ADD",         "CASE",  CASE_IDS["escalated"],  "SUCCESS", hours_ago(2.9)),
        log("badactor",   "UNKNOWN", "AUTH_FAIL",        "AUTH",  "login",                "FAILURE", hours_ago(2.0), ip="192.168.1.99", metadata={"reason": "user_not_found"}),
        log(USER_ADMIN,   "ADMIN",   "ALERT_VIEW",       "ALERT", "LIST",                 "SUCCESS", hours_ago(1.0)),
        log(USER_ANALYST, "ANALYST", "ALERT_VIEW",       "ALERT", ALERT_IDS["behavioral"],"SUCCESS", hours_ago(0.5)),
    ]

    col.insert_many(logs)
    print(f"  audit logs: seeded {len(logs)}")

# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def main():
    print(f"Connecting to: {MONGO_URI}")
    # verify connection
    client.admin.command("ping")
    print("Connected.\n")

    seed_system_config()
    seed_users()
    seed_accounts()
    seed_background_transactions()
    seed_smurfing_clusters()
    seed_circular_chains()
    seed_behavioral_anomaly()
    seed_alerts()
    seed_cases()
    seed_audit_logs()

    print("\n✅  Seed complete.")
    print("\nTest credentials:")
    print("  username: admin    password: Password123!  role: ADMIN")
    print("  username: analyst  password: Password123!  role: ANALYST")
    print("\nAlerts seeded:")
    print(f"  SMURFING   HIGH    SM1   alert_id={ALERT_IDS['smurfing1']}")
    print(f"  SMURFING   HIGH    SM2   alert_id={ALERT_IDS['smurfing2']}  (coordinated, 3 receivers)")
    print(f"  SMURFING   HIGH    SM3   alert_id={ALERT_IDS['smurfing3']}  (FATF country IR)")
    print(f"  CIRCULAR   MEDIUM  C1    alert_id={ALERT_IDS['circular1']}  (3-hop, no FATF)")
    print(f"  CIRCULAR   HIGH    C1    alert_id={ALERT_IDS['circular2']}  (4-hop, FATF MM+AE)")
    print(f"  BEHAVIORAL MEDIUM  BA    alert_id={ALERT_IDS['behavioral']} (high-value new counterparty)")
    print("\nBug status:")
    print("  BUG-1 (amountP90=0 false-positive): seeded accounts safe (p90 > 0).")
    print("           Fix: add `amountP90 > 0` guard in BehavioralProfiler.js L139.")
    print("  BUG-2 (double alert:new emit): not triggered by seeder.")
    print("           Fix: remove extra emit from RiskScorer.js L67.")

    client.close()


if __name__ == "__main__":
    main()
