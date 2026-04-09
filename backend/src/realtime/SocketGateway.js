const { Server } = require("socket.io");
const Alert = require("../models/Alert");
const eventBus = require("../events/eventBus");

class SocketGateway {
  constructor({
    httpServer,
    alertModel = Alert,
    emitter = eventBus,
    sarQueue = null,
    corsOrigin = "*",
    logger = console,
  } = {}) {
    this.httpServer = httpServer;
    this.alertModel = alertModel;
    this.emitter = emitter;
    this.sarQueue = sarQueue;
    this.corsOrigin = corsOrigin;
    this.logger = logger;

    this.io = null;
    this.metricsInterval = null;
    this.txTimestamps = [];
    this.graphSubscriptions = new Map();

    this.boundOnAlertNew = this.onAlertNew.bind(this);
    this.boundOnAlertUpdated = this.onAlertUpdated.bind(this);
    this.boundOnTransactionSaved = this.onTransactionSaved.bind(this);
  }

  start() {
    this.io = new Server(this.httpServer, {
      cors: {
        origin: this.corsOrigin,
      },
    });

    this.io.on("connection", (socket) => {
      this.graphSubscriptions.set(socket.id, new Set());

      socket.on("graph:subscribe", ({ accountId }) => {
        const room = this.#roomForAccount(accountId);
        socket.join(room);
        this.graphSubscriptions.get(socket.id).add(accountId);
      });

      socket.on("graph:unsubscribe", ({ accountId }) => {
        const room = this.#roomForAccount(accountId);
        socket.leave(room);
        const subs = this.graphSubscriptions.get(socket.id);
        if (subs) {
          subs.delete(accountId);
        }
      });

      socket.on("disconnect", () => {
        this.graphSubscriptions.delete(socket.id);
      });
    });

    this.emitter.on("alert:new", this.boundOnAlertNew);
    this.emitter.on("alert:updated", this.boundOnAlertUpdated);
    this.emitter.on("transaction:saved", this.boundOnTransactionSaved);

    this.metricsInterval = setInterval(() => {
      this.pushMetrics().catch((error) => {
        this.logger.error("metrics_push_failed", { message: error.message });
      });
    }, 5000);
  }

  stop() {
    this.emitter.off("alert:new", this.boundOnAlertNew);
    this.emitter.off("alert:updated", this.boundOnAlertUpdated);
    this.emitter.off("transaction:saved", this.boundOnTransactionSaved);

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    if (this.io) {
      this.io.close();
      this.io = null;
    }
  }

  onAlertNew(alertPayload) {
    if (!this.io) {
      return;
    }

    this.io.emit("alert:new", alertPayload);
  }

  onAlertUpdated(payload) {
    if (!this.io) {
      return;
    }

    this.io.emit("alert:updated", payload);
  }

  onTransactionSaved(tx) {
    this.txTimestamps.push(Date.now());
    this.#trimTxTimestamps();

    if (!this.io) {
      return;
    }

    const update = {
      from: tx.sender_account_id,
      to: tx.receiver_account_id,
      amount: tx.amount_usd,
      timestamp: new Date(tx.timestamp).toISOString(),
      txId: tx.transaction_id,
    };

    this.io.to(this.#roomForAccount(tx.sender_account_id)).emit("graph:update", update);
    this.io.to(this.#roomForAccount(tx.receiver_account_id)).emit("graph:update", update);
  }

  async pushMetrics() {
    if (!this.io) {
      return;
    }

    this.#trimTxTimestamps();
    const tps = this.txTimestamps.length / 5;

    const alertCounts = await this.#alertCounts();

    const trend = await this.alertModel.aggregate([
      {
        $match: {
          created_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: {
            hour: { $dateToString: { format: "%Y-%m-%dT%H:00:00Z", date: "$created_at" } },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.hour": 1 } },
    ]);

    this.io.emit("metrics:update", {
      tps,
      alertCounts,
      trend,
      sarQueueDepth: this.sarQueue?.getDepth ? this.sarQueue.getDepth() : 0,
    });
  }

  async #alertCounts() {
    const grouped = await this.alertModel.aggregate([
      {
        $group: {
          _id: "$risk_tier",
          count: { $sum: 1 },
        },
      },
    ]);

    const counts = { LOW: 0, MEDIUM: 0, HIGH: 0 };
    for (const row of grouped) {
      counts[row._id] = row.count;
    }
    return counts;
  }

  #trimTxTimestamps() {
    const cutoff = Date.now() - 5000;
    this.txTimestamps = this.txTimestamps.filter((ts) => ts >= cutoff);
  }

  #roomForAccount(accountId) {
    return `graph:${accountId}`;
  }
}

module.exports = SocketGateway;
