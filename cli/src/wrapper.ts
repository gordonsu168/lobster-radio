import { spawn } from 'node:child_process';
import readline from 'node:readline';

const API_BASE = 'http://localhost:4000/api/agent/x';

/**
 * Lobster-Core-X: ANSI Terminal Wrapper
 * 在 nanobot 官方 TUI 之上叠加状态栏
 */

// 渲染顶部的黑客状态栏
async function renderHeader() {
  try {
    const [resDna, resStatus] = await Promise.all([
      fetch(`${API_BASE}/init`, { method: 'POST' }).then(r => r.json()),
      fetch(`${API_BASE}/status`).then(r => r.json())
    ]);

    const dna = resDna.dna;
    const player = resStatus;

    const dnaStr = dna ? 
      `DNA: [L:${(dna.spectralMap.lowEnd*10).toFixed(0)} M:${(dna.spectralMap.midTexture*10).toFixed(0)} H:${(dna.spectralMap.highAir*10).toFixed(0)}]` : 
      'DNA: SYNCING...';
    
    const precStr = dna ? `PRECISION: ${(dna.evolution.precision * 100).toFixed(1)}%` : '';
    
    const playStr = player?.current ? 
      `${player.isPaused ? '⏸' : '▶'} ${player.current.title.slice(0, 45)}` : 
      'IDLE';

    const modeStr = player?.queue?.length > 5 ? 'LIVE_RADIO' : 'AGENT_CORE';

    const heartbeat = Math.floor(Date.now() / 1000) % 2 === 0 ? '⚡' : '  ';

    // ANSI: 移动到 (1,1), 清除行, 设置颜色
    process.stdout.write('\x1b[s'); // 保存当前光标
    process.stdout.write('\x1b[1;1H'); // 移动到第一行
    process.stdout.write('\x1b[48;5;22m\x1b[38;5;255m'); // 绿底白字
    process.stdout.write(` ⚡ PULSE-X ${heartbeat} | ${modeStr} | ${dnaStr} | ${precStr} `.padEnd(process.stdout.columns, ' '));
    
    process.stdout.write('\x1b[2;1H'); // 移动到第二行
    process.stdout.write('\x1b[48;5;234m\x1b[38;5;82m'); // 深灰底绿字
    process.stdout.write(` 📻 ${playStr} | ⚒ QUEUE: ${player?.queue?.length || 0} `.padEnd(process.stdout.columns, ' '));

    process.stdout.write('\x1b[3;1H'); // 移动到第三行
    process.stdout.write('\x1b[48;5;232m\x1b[38;5;240m'); // 黑底灰字
    process.stdout.write(` 指令提示: [/next 下一首] [/prev 上一首] [/pause 暂停] [/clear 清空] `.padEnd(process.stdout.columns, ' '));
    
    process.stdout.write('\x1b[0m'); // 重置颜色
    process.stdout.write('\x1b[u'); // 恢复光标
  } catch (e) {
    // 静默失败，不干扰 TUI
  }
}

function start() {
  // 清屏
  process.stdout.write('\x1b[2J\x1b[H');
  
  // 预留顶部 3 行空间 (向下滚动区域起始设为 4)
  process.stdout.write('\x1b[4;r'); 
  process.stdout.write('\x1b[4;1H');

  console.error("Starting Official Nanobot Kernel with Lobster-Core-X Wrapper...");

  // 启动 nanobot 进程
  const nanobot = spawn('nanobot', ['agent'], {
    stdio: 'inherit',
    env: process.env,
    shell: true
  });

  // 定时刷新状态栏
  const timer = setInterval(renderHeader, 1000);

  nanobot.on('exit', () => {
    clearInterval(timer);
    process.stdout.write('\x1b[r'); // 恢复全局滚动
    process.exit();
  });
}

start();
