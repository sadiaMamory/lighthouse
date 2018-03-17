/**
 * @license Copyright 2016 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const cli = require('../../lighthouse-cli/run');

const {server} = require(
    '../../lighthouse-cli/test/fixtures/static-server');

/**
 * Update the report fixtures, either the artifacts or the json
 * @param {{gather?: boolean, audit?: boolean}} opts
 */
async function update(opts) {
  // get an available port
  server.listen(0, 'localhost');
  const port = await new Promise(res => server.on('listening', () => res(server.address().port)));

  const artifactsPath = 'lighthouse-cli/test/sample_artifacts';

  const url = `http://localhost:${port}/dobetterweb/dbw_tester.html`;
  const flags = {
    output: 'json',
    outputPath: 'lighthouse-core/test/results/sample_v2.json',
    gatherMode: opts.gather ? artifactsPath : undefined,
    auditMode: opts.audit ? artifactsPath : undefined,
  };
  // @ts-ignore Remove when we fix Flags typing
  await cli.runLighthouse(url, flags, undefined);
  await new Promise(res => server.close(res));
}

/* eslint-disable no-console */
const args = process.argv.slice(2);
if (!args.length) {
  console.log('Run this with either -G (to refresh the artifacts) or -A (to refresh the json).');
  process.exit(1);
}

(async function() {
  if (args[0] === '-G') {
    console.log('Refreshing the artifact fixtures…');
    await update({gather: true});
  } else if (args[0] === '-A') {
    console.log('Refreshing the json fixture…');
    await update({audit: true});
  } else {
    console.error('Unknown flags');
  }
})();
