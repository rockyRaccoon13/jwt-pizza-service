const MetricBuilder = require("./metrics/metricBuilder");
const config = require("./config");

const http_requests = {};

const endpointsLatency = {};

const invalidEndpoints = {};

let pizzaOrders = {
  successCount: 0,
  failureCount: 0,
  revenue: 0,
  latency: 0,
};

let userCount = 0;

const os = require("os");

const authChecks = {
  passesCount: 0,
  failsCount: 0,
};

function getCpuUsagePercentage() {
  const cpuUsage = os.loadavg()[0] / os.cpus().length;
  return cpuUsage.toFixed(2) * 100;
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
  return memoryUsage.toFixed(2);
}

function endpointLatencyTracker() {
  return (req, res, next) => {
    const path = req.path;
    const startTime = new Date();
    res.on("finish", () => {
      if (req.route) {
        const latency = new Date() - startTime;
        endpointsLatency[path] = latency;
        // console.log(req.route.path);
        // console.log(`Latency: ${latency}ms ${path}`);
        // console.log(endpointsLatency);
      }
    });

    next();
  };
}

function invalidEndpointsTracker() {
  return (req, res, next) => {
    const path = req.path;
    res.on("finish", () => {
      if (!req.route) {
        invalidEndpoints[path] = (invalidEndpoints[path] || 0) + 1;
      }
    });

    next();
  };
}

function userTracker() {
  return (req, res, next) => {
    if (req.path !== "/api/auth") {
      next();
      return;
    }

    const isAddUser = req.method === "POST" || req.method === "PUT";
    const originalSend = res.send;

    res.send = function (body) {
      if (res.statusCode === 200) {
        if (isAddUser) {
          //   console.log("LOGIN SUCCESS");
          userCount += 1;
        } else {
          //   console.log("LOGOUT SUCCESS");
          userCount -= 1;
        }
      } else {
        // console.log("LOGIN/Out FAILED");
      }

      res.send = originalSend; // Restore the original send method
      return res.send(body); // Call the original send method
    };

    next();
  };
}

function authTracker() {
  return (req, res, next) => {
    const path = req.path;

    res.on("finish", () => {
      if (req.requiresAuth !== true && path !== "/api/auth") {
        // console.log(`Path: ${path}, Auth: ${req.requiresAuth}`);
        // console.log("AUTH NOT REQUIRED");
        return;
      }

      // console.log("AUTH REQUIRED");
      if (res.statusCode === 200) {
        // console.log("AUTH Passed");
        authChecks.passesCount += 1;
      } else if (
        path === "/api/auth" ||
        res.statusCode === 403 ||
        res.statusCode === 401
      ) {
        // console.log("AUTH Failed");

        authChecks.failsCount += 1;
      }
    });

    next();
  };
}

function pizzaTracker() {
  return (req, res, next) => {
    const startTime = new Date();
    if (req.path !== "/api/order" && req.method !== "POST") {
      next();
      return;
    }

    const originalSend = res.send;
    res.send = function (body) {
      if (res.statusCode === 200) {
        pizzaOrders.successCount += 1;
        const orderTotal = body.order.items.reduce(
          (total, item) => total + item.price,
          0
        );
        pizzaOrders.revenue += orderTotal;
      } else {
        pizzaOrders.failureCount += 1;
      }

      pizzaOrders.latency = new Date() - startTime;

      res.send = originalSend; // Restore the original send method
      return res.send(body); // Call the original send method
    };

    next();
  };
}

function requestTracker() {
  return (req, res, next) => {
    http_requests[req.method] = (http_requests[req.method] || 0) + 1;
    // console.log(`${req.method}=${requests[req.method]}`);

    next();
  };
}

function httpMetrics(buf) {
  Object.keys(http_requests).forEach((method) => {
    buf.addMetric(
      "http_requests",
      http_requests[method],
      { method },
      "sum",
      "1"
    );
  });

  Object.keys(endpointsLatency).forEach((endpoint) => {
    buf.addMetric(
      "endpointLatency",
      endpointsLatency[endpoint],
      { endpoint },
      "sum",
      "ms"
    );
  });

  Object.keys(invalidEndpoints).forEach((endpoint) => {
    buf.addMetric(
      "invalid_endpoints_requests",
      invalidEndpoints[endpoint],
      { endpoint },
      "sum",
      "1"
    );
  });
}

function systemMetrics(buf) {
  const cpuUsage = getCpuUsagePercentage();
  const memoryUsage = getMemoryUsagePercentage();
  buf.addMetric("cpu", cpuUsage, {}, "gauge", "%");
  buf.addMetric("memory", memoryUsage, {}, "gauge", "%");
}

function userMetrics(buf) {
  buf.addMetric("user_count", userCount.toString(), {}, "sum", "1");
}

function purchaseMetrics(buf) {
  buf.addMetric(
    "orders",
    pizzaOrders["successCount"],
    { success: "true" },
    "sum",
    "1"
  );

  buf.addMetric(
    "orders",
    pizzaOrders["failureCount"],
    { success: "false" },
    "sum",
    "1"
  );

  buf.addMetric("orderLatency", pizzaOrders["latency"], {}, "sum", "ms");

  buf.addMetric("revenue", pizzaOrders["revenue"], {}, "sum", "bitcoin");
}

function authMetrics(buf) {
  buf.addMetric(
    "auth_checks",
    authChecks.failsCount,
    { passesAuth: "false" },
    "sum",
    "1"
  );
  buf.addMetric(
    "auth_checks",
    authChecks.passesCount,
    { passesAuth: "true" },
    "sum",
    "1"
  );
}

function sendMetricsPeriodically(period) {
  // const timer =
  setInterval(() => {
    try {
      const buf = new MetricBuilder();
      httpMetrics(buf);
      systemMetrics(buf);
      userMetrics(buf);
      purchaseMetrics(buf);
      authMetrics(buf);

      const metrics = buf.toString();
      // console.log("Pushing metrics");
      sendMetricsToGrafana(metrics);
    } catch (error) {
      console.log("Error sending metrics", error);
    }
  }, period);
}

function sendMetricsToGrafana(metricsJSON) {
  const body = metricsJSON;

  fetch(`${config.metrics.url}`, {
    method: "POST",
    body: body,
    headers: {
      Authorization: `Bearer ${config.metrics.apiKey}`,
      "Content-Type": "application/json",
    },
  })
    .then((response) => {
      if (!response.ok) {
        response.text().then((text) => {
          console.error(
            `Failed to push metrics data to Grafana: ${text}\n${body}`
          );
        });
      }
    })
    .catch((error) => {
      console.error("Error pushing metrics (${}):", error);
    });
}

sendMetricsPeriodically(1000);

module.exports = {
  requestTracker,
  userTracker,
  authTracker,
  pizzaTracker,
  endpointLatencyTracker,
  invalidEndpointsTracker,
};
