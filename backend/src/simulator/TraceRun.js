const mongoose = require("mongoose");
const { randomUUID } = require("crypto");

const Alert = require("../models/Alert");
const Transaction = require("../models/Transaction");

const API_BASE = process.env.API_BASE || "http://localhost:3000";
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/intelligent_aml";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fmt(value) {
  return typeof value === "number" ? Number(value.toFixed(2)) : value;
}

function explainAlert(alert) {
  if (alert.pattern_type === "SMURFING" && alert.smurfing_detail) {
    const s = alert.smurfing_detail;
    return [
      "SMURFING",
      `aggregate=${fmt(s.aggregate_amount)} >= ctr_threshold`,
      `all_individual_below_ctr=${s.individual_amounts.every((n) => n < 10000)}`,
      `tx_count=${s.transaction_count}`,
      `distinct_receivers=${s.distinct_receiver_count}`,
      `smurfing_score=${fmt(s.smurfing_score)}`,
    ].join(" | ");
  }

  if (alert.pattern_type === "CIRCULAR_TRADING" && alert.cycle_detail) {
    const c = alert.cycle_detail;
    return [
      "CIRCULAR_TRADING",
      `cycle_length=${c.cycle_length}`,
      `accounts=${(c.involved_accounts || []).join("->")}`,
      `fatf_flag=${Boolean(c.fatf_flag)}`,
      `cycle_score=${fmt(c.cycle_score)}`,
    ].join(" | ");
  }

  if (alert.pattern_type === "BEHAVIORAL_ANOMALY" && alert.behavioral_detail) {
    const anomalies = (alert.behavioral_detail.anomalies || []).map((a) => a.anomalyType).join(",");
    return [
      "BEHAVIORAL_ANOMALY",
      `anomalies=${anomalies || "none"}`,
      `low_confidence=${Boolean(alert.behavioral_detail.low_confidence)}`,
      `behavioral_score=${fmt(alert.score_breakdown?.behavioral_score || 0)}`,
    ].join(" | ");
  }

  return `${alert.pattern_type} | reason=detail_unavailable`;
}

async function ingest(tx) {
  const response = await fetch(`${API_BASE}/api/transactions/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(tx),
  });

  const body = await response.text();
  return { status: response.status, body };
}

function buildScenario(runId) {
  const now = Date.now();
  const iso = (offsetMs) => new Date(now + offsetMs).toISOString();

  const tx = (payload) => ({
    transaction_id: randomUUID(),
    currency: "USD",
    transaction_type: "WIRE",
    geolocation: { sender_country: "US", receiver_country: "US" },
    channel: "ONLINE",
    device_id: `DEV-${runId}`,
    is_synthetic: true,
    pattern_tag: null,
    ...payload,
  });

  return [
    tx({
      sender_account_id: `ACC-${runId}-A1`,
      receiver_account_id: `ACC-${runId}-B1`,
      amount: 300,
      timestamp: iso(0),
    }),
    tx({
      sender_account_id: `ACC-${runId}-SM`,
      receiver_account_id: `ACC-${runId}-R1`,
      amount: 4000,
      timestamp: iso(60 * 1000),
      pattern_tag: "SMURFING",
    }),
    tx({
      sender_account_id: `ACC-${runId}-SM`,
      receiver_account_id: `ACC-${runId}-R2`,
      amount: 3500,
      timestamp: iso(2 * 60 * 1000),
      pattern_tag: "SMURFING",
    }),
    tx({
      sender_account_id: `ACC-${runId}-SM`,
      receiver_account_id: `ACC-${runId}-R3`,
      amount: 3000,
      timestamp: iso(3 * 60 * 1000),
      pattern_tag: "SMURFING",
    }),
    tx({
      sender_account_id: `ACC-${runId}-C1`,
      receiver_account_id: `ACC-${runId}-C2`,
      amount: 2000,
      timestamp: iso(4 * 60 * 1000),
      pattern_tag: "CIRCULAR_TRADING",
    }),
    tx({
      sender_account_id: `ACC-${runId}-C2`,
      receiver_account_id: `ACC-${runId}-C3`,
      amount: 2100,
      timestamp: iso(5 * 60 * 1000),
      pattern_tag: "CIRCULAR_TRADING",
    }),
    tx({
      sender_account_id: `ACC-${runId}-C3`,
      receiver_account_id: `ACC-${runId}-C1`,
      amount: 2050,
      timestamp: iso(6 * 60 * 1000),
      pattern_tag: "CIRCULAR_TRADING",
    }),
  ];
}

async function main() {
  await mongoose.connect(MONGO_URI);

  const runId = String(Date.now()).slice(-8);
  const scenario = buildScenario(runId);

  console.log("TRACE RUN START");
  console.log(`run_id=${runId}`);
  console.log(`api_base=${API_BASE}`);

  for (const [idx, tx] of scenario.entries()) {
    const step = idx + 1;
    const result = await ingest(tx);
    await sleep(120);

    const persisted = await Transaction.findOne({ transaction_id: tx.transaction_id }).lean();
    const alerts = await Alert.find({ transaction_ids: tx.transaction_id }).sort({ created_at: 1 }).lean();

    console.log("-");
    console.log(`STEP ${step}`);
    console.log(`tx_id=${tx.transaction_id}`);
    console.log(`api_status=${result.status}`);
    console.log(`tx_sender=${tx.sender_account_id}`);
    console.log(`tx_receiver=${tx.receiver_account_id}`);
    console.log(`tx_amount=${fmt(tx.amount)}`);
    console.log(`tx_persisted=${Boolean(persisted)}`);
    console.log(`alerts_for_tx=${alerts.length}`);

    if (alerts.length > 0) {
      alerts.forEach((alert, i) => {
        console.log(`alert_${i + 1}_id=${alert.alert_id}`);
        console.log(`alert_${i + 1}_tier=${alert.risk_tier}`);
        console.log(`alert_${i + 1}_score=${fmt(alert.risk_score)}`);
        console.log(`alert_${i + 1}_why=${explainAlert(alert)}`);
      });
    }
  }

  const txIds = scenario.map((t) => t.transaction_id);
  const relatedAlerts = await Alert.find({ transaction_ids: { $in: txIds } }).lean();

  const byPattern = relatedAlerts.reduce((acc, item) => {
    acc[item.pattern_type] = (acc[item.pattern_type] || 0) + 1;
    return acc;
  }, {});

  console.log("-");
  console.log("TRACE RUN SUMMARY");
  console.log(`transactions_sent=${scenario.length}`);
  console.log(`related_alerts=${relatedAlerts.length}`);
  console.log(`alerts_by_pattern=${JSON.stringify(byPattern)}`);
  console.log("TRACE RUN END");

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("trace_run_failed", error.message);
  try {
    await mongoose.disconnect();
  } catch (_err) {
    // ignore
  }
  process.exit(1);
});
