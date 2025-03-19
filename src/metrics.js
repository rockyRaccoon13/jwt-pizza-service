const config = require("./config");

const requests = {};

const endpointsLatency = {};

const invalidEndpoints = {};

const DEBUG = true;

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
        console.log(`Path: ${path}, Auth: ${req.requiresAuth}`);
        console.log("AUTH NOT REQUIRED");
        return;
      }

      console.log("AUTH REQUIRED");
      if (res.statusCode === 200) {
        console.log("AUTH Passed");
        authChecks.passesCount += 1;
      } else if (
        path === "/api/auth" ||
        res.statusCode === 403 ||
        res.statusCode === 401
      ) {
        console.log("AUTH Failed");

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
    requests[req.method] = (requests[req.method] || 0) + 1;
    // console.log(`${req.method}=${requests[req.method]}`);

    next();
  };
}

// This will periodically send metrics to Grafana
// const timer =
setInterval(() => {
  sendMetricToGrafana(
    "auth_checks",
    authChecks.failsCount,
    { passesAuth: "false" },
    "sum",
    "1"
  );
  sendMetricToGrafana(
    "auth_checks",
    authChecks.passesCount,
    { passesAuth: "true" },
    "sum",
    "1"
  );

  sendMetricToGrafana(
    "orders",
    pizzaOrders["successCount"],
    { success: "true" },
    "sum",
    "1"
  );

  sendMetricToGrafana(
    "orders",
    pizzaOrders["failureCount"],
    { success: "false" },
    "sum",
    "1"
  );

  sendMetricToGrafana("orderLatency", pizzaOrders["latency"], {}, "sum", "ms");

  sendMetricToGrafana("revenue", pizzaOrders["revenue"], {}, "sum", "bitcoin");

  Object.keys(invalidEndpoints).forEach((endpoint) => {
    sendMetricToGrafana(
      "invalid_endpoints_requests",
      invalidEndpoints[endpoint],
      { endpoint },
      "sum",
      "1"
    );
  });

  Object.keys(requests).forEach((method) => {
    sendMetricToGrafana(
      "http_requests",
      requests[method],
      { method },
      "sum",
      "1"
    );
  });

  Object.keys(endpointsLatency).forEach((endpoint) => {
    sendMetricToGrafana(
      "endpointLatency",
      endpointsLatency[endpoint],
      { endpoint },
      "sum",
      "ms"
    );
  });

  //   console.log(`User count: ${userCount}`);
  sendMetricToGrafana("user_count", userCount.toString(), {}, "sum", "1");

  const cpuUsage = getCpuUsagePercentage();
  const memoryUsage = getMemoryUsagePercentage();
  //   console.log(`CPU: ${cpuUsage}%`);
  //   console.log(`Memory: ${memoryUsage}%`);
  sendMetricToGrafana("cpu", cpuUsage, {}, "gauge", "%");
  sendMetricToGrafana("memory", memoryUsage, {}, "gauge", "%");
}, 1000);

function sendMetricToGrafana(metricName, metricValue, attributes, type, unit) {
  attributes = { ...attributes, source: config.metrics.source };

  const dataPointType = Number.isInteger(metricValue) ? "asInt" : "asDouble";
  const metric = {
    resourceMetrics: [
      {
        scopeMetrics: [
          {
            metrics: [
              {
                name: metricName,
                unit: unit,
                [type]: {
                  dataPoints: [
                    {
                      [dataPointType]: metricValue,
                      timeUnixNano: Date.now() * 1000000,
                      attributes: [],
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  };

  if (type === "sum") {
    metric.resourceMetrics[0].scopeMetrics[0].metrics[0][
      type
    ].aggregationTemporality = "AGGREGATION_TEMPORALITY_CUMULATIVE";
    metric.resourceMetrics[0].scopeMetrics[0].metrics[0][
      type
    ].isMonotonic = true;
  }

  Object.keys(attributes).forEach((key) => {
    metric.resourceMetrics[0].scopeMetrics[0].metrics[0][
      type
    ].dataPoints[0].attributes.push({
      key: key,
      value: { stringValue: attributes[key] },
    });
  });

  const body = JSON.stringify(metric);
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
      } else {
        if (DEBUG !== true) {
          console.log(`Pushed ${metricName}`);
        }
      }
    })
    .catch((error) => {
      console.error("Error pushing metrics (${}):", error);
    });
}

module.exports = {
  requestTracker,
  userTracker,
  authTracker,
  pizzaTracker,
  endpointLatencyTracker,
  invalidEndpointsTracker,
};
