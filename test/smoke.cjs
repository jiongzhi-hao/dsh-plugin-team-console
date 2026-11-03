const { spawnSync } = require('node:child_process');
const path = require('node:path');
const result = spawnSync(process.execPath, ['--test', path.join(__dirname, 'manager.test.mjs')], { stdio: 'inherit' });
process.exit(result.status ?? 1);
