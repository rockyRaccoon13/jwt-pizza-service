const config = require("./config");

const requests = {};
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
    if (req.path !== "/api/auth") {
      next();
      return;
    }

    const originalSend = res.send;

    res.send = function (body) {
      if (res.statusCode === 200) {
        userCount += 1;
      } else {
        //   console.log("LOGOUT SUCCESS");
        userCount -= 1;
      }

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

  Object.keys(requests).forEach((method) => {
    sendMetricToGrafana(
      "http_requests",
      requests[method],
      { method },
      "sum",
      "1"
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
        console.log(`Pushed ${metricName}`);
      }
    })
    .catch((error) => {
      console.error("Error pushing metrics (${}):", error);
    });
}

module.exports = { requestTracker, userTracker, authTracker };
