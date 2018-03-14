/**
 * @license Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const ComputedArtifact = require('../computed-artifact');
const Node = require('../../../lib/dependency-graph/node');
const Simulator = require('../../../lib/dependency-graph/simulator/simulator');
const WebInspector = require('../../../lib/web-inspector');

class MetricArtifact extends ComputedArtifact {
  /**
   * @param {!Node} dependencyGraph
   * @param {function()=} condition
   * @return {!Set<string>}
   */
  static getScriptUrls(dependencyGraph, condition) {
    const scriptUrls = new Set();

    dependencyGraph.traverse(node => {
      if (node.type === Node.TYPES.CPU) return;
      if (node.record._resourceType !== WebInspector.resourceTypes.Script) return;
      if (condition && !condition(node)) return;
      scriptUrls.add(node.record.url);
    });

    return scriptUrls;
  }

  /**
   * @return {MetricCoefficients}
   */
  get COEFFICIENTS() {
    throw new Error('COEFFICIENTS unimplemented!');
  }

  /**
   * @param {!Node} dependencyGraph
   * @param {!TraceOfTabArtifact} traceOfTab
   * @return {!Node}
   */
  getOptimisticGraph(dependencyGraph, traceOfTab) { // eslint-disable-line no-unused-vars
    throw new Error('Optimistic graph unimplemented!');
  }

  /**
   * @param {!Node} dependencyGraph
   * @param {!TraceOfTabArtifact} traceOfTab
   * @return {!Node}
   */
  getPessimisticGraph(dependencyGraph, traceOfTab) { // eslint-disable-line no-unused-vars
    throw new Error('Pessmistic graph unimplemented!');
  }

  /**
   * @param {SimulationResult} simulationResult
   * @return {number}
   */
  getEstimateFromSimulation(simulationResult) {
    return simulationResult.timeInMs;
  }

  /**
   * @param {{trace: Object, devtoolsLog: Object}} data
   * @param {Object} artifacts
   * @return {Promise<MetricResult>}
   */
  async computeMetricWithGraphs(data, artifacts, extras) {
    const {trace, devtoolsLog} = data;
    const graph = await artifacts.requestPageDependencyGraph({trace, devtoolsLog});
    const traceOfTab = await artifacts.requestTraceOfTab(trace);
    const networkAnalysis = await artifacts.requestNetworkAnalysis(devtoolsLog);

    const optimisticGraph = this.getOptimisticGraph(graph, traceOfTab, extras);
    const pessimisticGraph = this.getPessimisticGraph(graph, traceOfTab, extras);

    // TODO(phulce): use rtt and throughput from config.settings instead of defaults
    const options = {
      additionalRttByOrigin: networkAnalysis.additionalRttByOrigin,
      serverResponseTimeByOrigin: networkAnalysis.serverResponseTimeByOrigin,
    };

    const optimisticEstimate = new Simulator(optimisticGraph, options).simulate();
    const pessimisticEstimate = new Simulator(pessimisticGraph, options).simulate();

    optimisticEstimate.timeInMs = this.getEstimateFromSimulation(
      optimisticEstimate,
      Object.assign({}, extras, {optimistic: true})
    );

    pessimisticEstimate.timeInMs = this.getEstimateFromSimulation(
      pessimisticEstimate,
      Object.assign({}, extras, {optimistic: false})
    );

    const timing =
      this.COEFFICIENTS.intercept +
      this.COEFFICIENTS.optimistic * optimisticEstimate.timeInMs +
      this.COEFFICIENTS.pessimistic * pessimisticEstimate.timeInMs;

    return {
      timing,
      optimisticEstimate,
      pessimisticEstimate,
      optimisticGraph,
      pessimisticGraph,
    };
  }

  /**
   * @param {{trace: Object, devtoolsLog: Object}} data
   * @param {Object} artifacts
   * @return {Promise<MetricResult>}
   */
  compute_(data, artifacts) {
    return this.computeMetricWithGraphs(data, artifacts);
  }
}

module.exports = MetricArtifact;

/**
 * @typedef MetricResult
 * @property {number} timing
 * @property {number} [timestamp]
 * @property {SimulationResult} [optimisticEstimate]
 * @property {SimulationResult} [pessimisticEstimate]
 * @property {!Node} [optimisticGraph]
 * @property {!Node} [pessimisticGraph]
 */

/**
 * @typedef MetricCoefficients
 * @property {number} intercept
 * @property {number} optimistic
 * @property {number} pessimistic
 */
