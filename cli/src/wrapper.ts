import { spawn } from 'node:child_process';

const API_BASE = 'http://localhost:4000/api/agent/x';

let lastUserState = 'DETECTING...';
let lastTrackTitle = '';

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

        // 探测切歌并输出到控制台
        if (title !== lastTrackTitle) {
            process.stdout.write('\x1b[s'); // 保存光标
            if (title.startsWith('🎙️:')) {
                const text = title.slice(3).trim();
                process.stdout.write(`\n\x1b[38;5;11m【DJ-X 旁白】\x1b[0m ${text}\n\n`);
            } else {
                process.stdout.write(`\n\x1b[38;5;82m【正在播放】\x1b[0m ${title}\n`);
            }
            process.stdout.write('\x1b[u'); // 恢复光标
            lastTrackTitle = title;
        }
    }

    const heartbeat = Math.floor(Date.now() / 1000) % 2 === 0 ? '⚡' : '  ';

    // 绘制 UI
    process.stdout.write('\x1b[s');
    process.stdout.write('\x1b[1;1H\x1b[48;5;22m\x1b[38;5;255m');
    process.stdout.write(` ⚡ DJ-X ${heartbeat} | LIVE_RADIO | ${dnaStr} | ${precStr} `.padEnd(process.stdout.columns, ' '));

    process.stdout.write('\x1b[2;1H\x1b[48;5;234m\x1b[38;5;82m');
    const activity = player?.lastActivity || 'READY';
    process.stdout.write(` PLAY: ${playStr} | QUEUE: ${player?.queue?.length || 0} | STATUS: ${activity} `.padEnd(process.stdout.columns, ' '));

    process.stdout.write('\x1b[3;1H\x1b[48;5;232m\x1b[38;5;250m');
    const modes = ' [模式] /stream /chat ';
    process.stdout.write(modes.padEnd(process.stdout.columns, ' '));

    process.stdout.write('\x1b[4;1H\x1b[48;5;232m\x1b[38;5;244m');
    const controls = ' [控制] /play /next /pause /clear /now ';
    process.stdout.write(controls.padEnd(process.stdout.columns, ' '));

    process.stdout.write('\x1b[5;1H\x1b[48;5;233m\x1b[38;5;111m');
    process.stdout.write(` 👤 Gordon: ${lastUserState} `.padEnd(process.stdout.columns, ' '));

    process.stdout.write('\x1b[0m\x1b[u');
  } catch (e) {
    if (e instanceof Error && !e.message.includes('ECONNREFUSED')) {
      console.error('\r\x1b[KHeader Render Error:', e.message);
    }
  }
}

function start() {
  process.stdout.write('\x1b[2J\x1b[H\x1b[6;r\x1b[6;1H');

  const venvPath = process.env.VIRTUAL_ENV;
  const nanobotCmd = venvPath ? `${venvPath}/bin/nanobot` : 'nanobot';

  const nanobot = spawn(nanobotCmd, ['agent'], {
    stdio: ['inherit', 'inherit', 'inherit'],
    env: process.env
  });

  nanobot.on('error', (err) => {
    console.error('\r\x1b[KFailed to start nanobot:', err.message);
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
