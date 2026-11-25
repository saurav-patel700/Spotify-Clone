import { spawn } from 'node:child_process';

const isWin = process.platform === 'win32';

function spawnWorkspaceDev(workspace) {
  if (isWin) {
    return spawn(
      'cmd.exe',
      ['/d', '/s', '/c', 'npm.cmd', `--workspace=${workspace}`, 'run', 'dev'],
      { stdio: 'inherit', shell: false }
    );
  }
  return spawn('npm', [`--workspace=${workspace}`, 'run', 'dev'], {
    stdio: 'inherit',
    shell: false,
  });
}

const server = spawnWorkspaceDev('server');
const client = spawnWorkspaceDev('client');

function shutdown() {
  server.kill();
  client.kill();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
