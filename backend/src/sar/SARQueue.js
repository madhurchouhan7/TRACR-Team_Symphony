class SARQueue {
    constructor({ concurrency = Number(process.env.GEMINI_CONCURRENCY || 2), logger = console } = {}) {
        this.concurrency = Math.max(1, concurrency);
        this.logger = logger;
        this.activeCount = 0;
        this.queue = [];
    }

    getDepth() {
        return this.queue.length;
    }

    enqueue(taskFn) {
        return new Promise((resolve, reject) => {
            this.queue.push({ taskFn, resolve, reject });
            this.#drain();
        });
    }

    #drain() {
        while (this.activeCount < this.concurrency && this.queue.length > 0) {
            const next = this.queue.shift();
            this.activeCount += 1;

            Promise.resolve()
                .then(() => next.taskFn())
                .then((result) => next.resolve(result))
                .catch((error) => next.reject(error))
                .finally(() => {
                    this.activeCount -= 1;
                    this.#drain();
                });
        }
    }
}

module.exports = SARQueue;
