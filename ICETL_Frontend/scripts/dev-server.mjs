import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';

const sassBinary = path.resolve('node_modules/sass/sass.js');
const ngBinary = path.resolve('node_modules/@angular/cli/bin/ng.js');

const children = [];
let shuttingDown = false;

function start(command, args, label) {
  const child = spawn(process.execPath, [command, ...args], {
    stdio: 'inherit',
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    const exitCode = typeof code === 'number' ? code : signal ? 1 : 0;

    if (exitCode !== 0) {
      console.error(`${label} exited with code ${exitCode}`);
      shutdown(exitCode);
    }
  });

  child.on('error', (error) => {
    console.error(`${label} failed to start:`, error);
    shutdown(1);
  });

  children.push(child);
  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }

  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

function isPortFree(port) {
  return new Promise((resolve) => {
    let pending = 2;
    let occupied = false;

    const finish = (isFree) => {
      if (!occupied && !isFree) {
        occupied = true;
      }

      pending -= 1;

      if (pending === 0) {
        resolve(!occupied);
      }
    };

    for (const host of ['127.0.0.1', '::1']) {
      const socket = net.createConnection({ host, port });

      socket.setTimeout(500);
      socket.on('connect', () => {
        socket.destroy();
        finish(false);
      });
      socket.on('error', () => finish(true));
      socket.on('timeout', () => {
        socket.destroy();
        finish(true);
      });
    }
  });
}

async function findAvailablePort(preferredPort, maxAttempts = 10) {
  for (let offset = 0; offset <= maxAttempts; offset += 1) {
    const port = preferredPort + offset;

    // Try the next port if 4200 is already occupied by another dev server.
    if (await isPortFree(port)) {
      return port;
    }
  }

  throw new Error(`No free port found starting at ${preferredPort}`);
}

start(
  sassBinary,
  ['--watch', 'src/assets/scss/styles.scss:src/assets/css/styles.css', '--source-map'],
  'sass',
);

const preferredPort = Number(process.env.PORT || 4200);
const servePort = await findAvailablePort(preferredPort);

console.log(`Starting Angular dev server on port ${servePort}`);

start(
  ngBinary,
  [
    'serve',
    '--configuration',
    'development',
    '--poll',
    '2000',
    '--port',
    String(servePort),
    '--prebundle=false',
  ],
  'ng serve',
);
