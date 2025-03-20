const config = require("../config.js");

class MetricBuilder {
  constructor() {
    this.metrics = [];
  }

  addMetric(name, value, attributes, type, unit) {
    attributes = { ...attributes, source: config.metrics.source };
    this.metrics.push({ name, value, attributes, type, unit });
  }

  toString() {
    const metric = {
      resourceMetrics: [
        {
          scopeMetrics: [
            {
              metrics: [],
            },
          ],
        },
      ],
    };

    for (const { name, value, attributes, type, unit } of this.metrics) {
      const dataPointType = Number.isInteger(value) ? "asInt" : "asDouble";
      metric.resourceMetrics[0].scopeMetrics[0].metrics.push({
        name,
        unit,
        [type]: {
          dataPoints: [
            {
              [dataPointType]: value,
              timeUnixNano: Date.now() * 1000000,
              attributes: [],
            },
          ],
        },
      });

      if (type === "sum") {
        metric.resourceMetrics[0].scopeMetrics[0].metrics[
          metric.resourceMetrics[0].scopeMetrics[0].metrics.length - 1
        ][type].aggregationTemporality = "AGGREGATION_TEMPORALITY_CUMULATIVE";
        metric.resourceMetrics[0].scopeMetrics[0].metrics[
          metric.resourceMetrics[0].scopeMetrics[0].metrics.length - 1
        ][type].isMonotonic = true;
      }

      Object.keys(attributes).forEach((key) => {
        metric.resourceMetrics[0].scopeMetrics[0].metrics[
          metric.resourceMetrics[0].scopeMetrics[0].metrics.length - 1
        ][type].dataPoints[0].attributes.push({
          key: key,
          value: { stringValue: attributes[key] },
        });
      });
    }
    return JSON.stringify(metric);
  }
}

module.exports = MetricBuilder;
