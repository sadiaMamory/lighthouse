/**
 * @license Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const MetricArtifact = require('./metric');
const Node = require('../../../lib/dependency-graph/node');
const WebInspector = require('../../../lib/web-inspector');

// Any CPU task of 20 ms or more will end up being a critical long task on mobile
const CRITICAL_LONG_TASK_THRESHOLD = 20;

class ConsistentlyInteractive extends MetricArtifact {
  get name() {
    return 'ConsistentlyInteractive';
  }

  /**
   * @return {MetricArtifact.MetricCoefficients}
   */
  get COEFFICIENTS() {
    return {
      intercept: 1582,
      optimistic: 0.97,
      pessimistic: 0.49,
    };
  }

  /**
   * @param {!Node} dependencyGraph
   * @return {!Node}
   */
  getOptimisticGraph(dependencyGraph) {
    // Adjust the critical long task threshold for microseconds
    const minimumCpuTaskDuration = CRITICAL_LONG_TASK_THRESHOLD * 1000;

    return dependencyGraph.cloneWithRelationships(node => {
      // Include everything that might be a long task
      if (node.type === Node.TYPES.CPU) return node.event.dur > minimumCpuTaskDuration;
      // Include all scripts and high priority requests, exclude all images
      const isImage = node.record._resourceType === WebInspector.resourceTypes.Image;
      const isScript = node.record._resourceType === WebInspector.resourceTypes.Script;
      return (
        !isImage &&
        (isScript || node.record.priority() === 'High' || node.record.priority() === 'VeryHigh')
      );
    });
  }

  /**
   * @param {!Node} dependencyGraph
   * @return {!Node}
   */
  getPessimisticGraph(dependencyGraph) {
    return dependencyGraph;
  }

  /**
   * @param {SimulationResult} simulationResult
   * @param {Object} extras
   * @return {number}
   */
  getEstimateFromSimulation(simulationResult, extras) {
    const lastTaskAt = ConsistentlyInteractive.getLastLongTaskEndTime(simulationResult.nodeTiming);
    const minimumTime = extras.optimistic
      ? extras.fmpResult.optimisticEstimate.timeInMs
      : extras.fmpResult.pessimisticEstimate.timeInMs;
    return Math.max(minimumTime, lastTaskAt);
  }

  /**
   * @param {{trace: Object, devtoolsLog: Object}} data
   * @param {Object} artifacts
   * @return {Promise<MetricResult>}
   */
  async compute_(data, artifacts) {
    const fmpResult = await artifacts.requestFirstMeaningfulPaint(data, artifacts);
    const metricResult = await this.computeMetricWithGraphs(data, artifacts, {fmpResult});
    metricResult.timing = Math.max(metricResult.timing, fmpResult.timing);
    return metricResult;
  }

  /**
   * @param {!Map<!Node, {startTime, endTime}>} nodeTiming
   * @return {number}
   */
  static getLastLongTaskEndTime(nodeTiming, duration = 50) {
    return Array.from(nodeTiming.entries())
      .filter(
        ([node, timing]) =>
          node.type === Node.TYPES.CPU && timing.endTime - timing.startTime > duration
      )
      .map(([_, timing]) => timing.endTime)
      .reduce((max, x) => Math.max(max, x), 0);
  }
}

module.exports = ConsistentlyInteractive;
