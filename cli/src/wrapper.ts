import { spawn } from 'node:child_process';

const API_BASE = 'http://localhost:4000/api/agent/x';

let lastUserState = 'DETECTING...';

async function fetchUserState() {
  try {
    const res = await fetch(`${API_BASE}/state`);
    const state = await res.json();
    if (state.label) {
      lastUserState = state.label;
    }
  } catch (e) {
    lastUserState = 'OFFLINE';
  }
}

async function renderHeader() {
  try {
    const [resDna, resStatus] = await Promise.all([
      fetch(`${API_BASE}/init`, { method: 'POST' }).then(r => r.json()),
      fetch(`${API_BASE}/status`).then(r => r.json())
    ]);

    const dna = resDna.dna;
    const player = resStatus;

    const dnaStr = dna ?
      `DNA:[L:${(dna.spectralMap.lowEnd*10).toFixed(0)} M:${(dna.spectralMap.midTexture*10).toFixed(0)} H:${(dna.spectralMap.highAir*10).toFixed(0)}]` :
      'DNA:SYNCING...';

    const precStr = dna ? `PRECISION:${(dna.evolution.precision * 100).toFixed(1)}%` : '';
    let playStr = 'IDLE';
    if (player?.current) {
        const title = player.current.title;
        if (title.startsWith('🎙️:')) {
            playStr = `\x1b[38;5;11m${title.slice(0, 50)}\x1b[38;5;82m`;
        } else {
            playStr = `${player.isPaused ? '⏸' : '▶'} ${title.slice(0, 45)}`;
        }
    }

    const heartbeat = Math.floor(Date.now() / 1000) % 2 === 0 ? '⚡' : '  ';
    const activity = player?.lastActivity || 'READY';

    // 绘制 UI
    process.stdout.write('\x1b[s');
    process.stdout.write('\x1b[1;1H\x1b[48;5;22m\x1b[38;5;255m');
    process.stdout.write(` ⚡ DJ-X ${heartbeat} | LIVE_RADIO | ${dnaStr} | ${precStr} `.padEnd(process.stdout.columns, ' '));

    process.stdout.write('\x1b[2;1H\x1b[48;5;234m\x1b[38;5;82m');
    process.stdout.write(` 📻 ${playStr} | ⚒ QUEUE: ${player?.queue?.length || 0} `.padEnd(process.stdout.columns, ' '));

    process.stdout.write('\x1b[3;1H\x1b[48;5;232m\x1b[38;5;244m');
    process.stdout.write(` [${activity}] | 指令: [/next] [/pause] [/clear] [/now] `.padEnd(process.stdout.columns, ' '));

    process.stdout.write('\x1b[4;1H\x1b[48;5;233m\x1b[38;5;111m');
    process.stdout.write(` 👤 Gordon: ${lastUserState} `.padEnd(process.stdout.columns, ' '));

    process.stdout.write('\x1b[0m\x1b[u');
  } catch (e) {}
}

function start() {
  process.stdout.write('\x1b[2J\x1b[H\x1b[5;r\x1b[5;1H');

  const nanobot = spawn('nanobot', ['agent'], {
    stdio: ['inherit', 'inherit', 'ignore'],
    env: process.env,
    shell: true
  });

  // Fetch user state every 15 seconds
  fetchUserState();
  const stateTimer = setInterval(fetchUserState, 15000);

  const renderTimer = setInterval(renderHeader, 1000);

  nanobot.on('exit', () => {
    clearInterval(stateTimer);
    clearInterval(renderTimer);
    process.stdout.write('\x1b[r\x1b[2J\x1b[H');
    process.exit();
  });
}

start();
