import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const build = spawnSync(process.execPath, [resolve('node_modules/@angular/cli/bin/ng.js'), 'build', ...process.argv.slice(2)], {stdio:'inherit'});
if (build.status !== 0) process.exit(build.status ?? 1);
const demo = spawnSync(process.execPath, [resolve('scripts/build-demo.mjs')], {stdio:'inherit'});
process.exit(demo.status ?? 1);
