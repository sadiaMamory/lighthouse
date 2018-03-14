/**
 * @license Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const MetricArtifact = require('./metric');
const Node = require('../../../lib/dependency-graph/node');

class FirstContentfulPaint extends MetricArtifact {
  get name() {
    return 'FirstContentfulPaint';
  }

  /**
   * @return {MetricArtifact.MetricCoefficients}
   */
  get COEFFICIENTS() {
    return {
      intercept: 1440,
      optimistic: -1.75,
      pessimistic: 2.73,
    };
  }

  /**
   * @param {!Node} dependencyGraph
   * @param {!TraceOfTabArtifact} traceOfTab
   * @return {!Node}
   */
  getOptimisticGraph(dependencyGraph, traceOfTab) {
    const fcp = traceOfTab.timestamps.firstContentfulPaint;
    const blockingScriptUrls = MetricArtifact.getScriptUrls(dependencyGraph, node => {
      return (
        node.endTime <= fcp && node.hasRenderBlockingPriority() && node.initiatorType !== 'script'
      );
    });

    return dependencyGraph.cloneWithRelationships(node => {
      if (node.endTime > fcp) return false;
      // Include EvaluateScript tasks for blocking scripts
      if (node.type === Node.TYPES.CPU) return node.isEvaluateScriptFor(blockingScriptUrls);
      // Include non-script-initiated network requests with a render-blocking priority
      return node.hasRenderBlockingPriority() && node.initiatorType !== 'script';
    });
  }

  /**
   * @param {!Node} dependencyGraph
   * @param {!TraceOfTabArtifact} traceOfTab
   * @return {!Node}
   */
  getPessimisticGraph(dependencyGraph, traceOfTab) {
    const fcp = traceOfTab.timestamps.firstContentfulPaint;
    const blockingScriptUrls = MetricArtifact.getScriptUrls(dependencyGraph, node => {
      return node.endTime <= fcp && node.hasRenderBlockingPriority();
    });

    return dependencyGraph.cloneWithRelationships(node => {
      if (node.endTime > fcp) return false;
      // Include EvaluateScript tasks for blocking scripts
      if (node.type === Node.TYPES.CPU) return node.isEvaluateScriptFor(blockingScriptUrls);
      // Include all network requests that had render-blocking priority (even script-initiated)
      return node.hasRenderBlockingPriority();
    });
  }
}

module.exports = FirstContentfulPaint;
