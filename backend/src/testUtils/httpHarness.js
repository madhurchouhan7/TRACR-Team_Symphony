const express = require("express");

function createAppWithJson(router, prefix = "/") {
  const app = express();
  app.use(express.json());
  app.use(prefix, router);
  return app;
}

async function startServer(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const baseUrl = `http://127.0.0.1:${address.port}`;
      resolve({
        baseUrl,
        close: () =>
          new Promise((done) => {
            server.close(() => done());
          }),
      });
    });
  });
}

async function jsonRequest(baseUrl, path, { method = "GET", headers = {}, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let parsed = null;
  const text = await response.text();
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch (_) {
      parsed = text;
    }
  }

  return {
    status: response.status,
    body: parsed,
  };
}

module.exports = {
  createAppWithJson,
  startServer,
  jsonRequest,
};
