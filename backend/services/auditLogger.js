const fs = require("fs");
const path = require("path");

const logPath = path.join(__dirname, "..", "data", "audit.log");

function audit(event, data = {}) {
  const line = JSON.stringify({
    event,
    at: new Date().toISOString(),
    ...data,
  });
  fs.appendFileSync(logPath, `${line}\n`);
  console.log(`[AUDIT] ${event}`, data.orderId || data.email || "");
}

module.exports = { audit };
