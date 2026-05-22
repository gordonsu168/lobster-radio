import { spawn } from 'node:child_process';

const API_BASE = 'http://localhost:4000/api/agent/x';

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
        // 如果是旁白，使用不同的前缀和颜色提示
        if (title.startsWith('🎙️:')) {
            playStr = `\x1b[38;5;11m${title.slice(0, 50)}\x1b[38;5;82m`; // 旁白用亮黄色
        } else {
            playStr = `${player.isPaused ? '⏸' : '▶'} ${title.slice(0, 45)}`;
        }
    }

    const heartbeat = Math.floor(Date.now() / 1000) % 2 === 0 ? '⚡' : '  ';
    const activity = player?.lastActivity || 'READY';

    // 绘制 UI
    process.stdout.write('\x1b[s'); // 保存
    process.stdout.write('\x1b[1;1H\x1b[48;5;22m\x1b[38;5;255m'); 
    process.stdout.write(` ⚡ PULSE-X ${heartbeat} | LIVE_RADIO | ${dnaStr} | ${precStr} `.padEnd(process.stdout.columns, ' '));
    
    process.stdout.write('\x1b[2;1H\x1b[48;5;234m\x1b[38;5;82m');
    process.stdout.write(` 📻 ${playStr} | ⚒ QUEUE: ${player?.queue?.length || 0} `.padEnd(process.stdout.columns, ' '));

    process.stdout.write('\x1b[3;1H\x1b[48;5;232m\x1b[38;5;244m');
    process.stdout.write(` [${activity}] | 指令: [/next] [/pause] [/clear] `.padEnd(process.stdout.columns, ' '));
    
    process.stdout.write('\x1b[0m\x1b[u'); // 恢复
  } catch (e) {}
}

function start() {
  process.stdout.write('\x1b[2J\x1b[H\x1b[4;r\x1b[4;1H');

  // 启动 nanobot，但将其 stderr 捕获或静默，防止日志泄露到屏幕
  const nanobot = spawn('nanobot', ['agent'], {
    stdio: ['inherit', 'inherit', 'ignore'], // 屏蔽 stderr
    env: process.env,
    shell: true
  });

  const timer = setInterval(renderHeader, 1000);

  nanobot.on('exit', () => {
    clearInterval(timer);
    process.stdout.write('\x1b[r\x1b[2J\x1b[H');
    process.exit();
  });
}

start();
