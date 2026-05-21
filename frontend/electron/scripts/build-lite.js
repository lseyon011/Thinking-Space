const path = require('path');
const { spawnSync } = require('child_process');

const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const result = spawnSync(npxCommand, ['tsc'], {
  cwd: path.join(__dirname, '..'),
  env: process.env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);
