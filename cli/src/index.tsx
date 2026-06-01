import React, { useState, useEffect, useRef } from 'react';
import { render, Box, Text, useInput, useApp, useStdout } from 'ink';
import { LobsterCoreXAgent, XPacket, AestheticDNA } from 'lobster-radio-agents';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// 加载环境变量
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const WORKSPACE_DIR = path.resolve(process.cwd(), 'workspace');
const SOUL_PATH = path.join(WORKSPACE_DIR, 'SOUL.md');
const USER_PATH = path.join(WORKSPACE_DIR, 'USER.md');

const Header = ({ dna, status }: { dna: AestheticDNA | null, status: string }) => {
  const dnaStr = dna ? 
    `L:${(dna.spectralMap.lowEnd*10).toFixed(0)} M:${(dna.spectralMap.midTexture*10).toFixed(0)} H:${(dna.spectralMap.highAir*10).toFixed(0)}` : 
    'SYNCING...';
  
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box backgroundColor="green" paddingX={1}>
        <Text color="black" bold> ⚡ DJ-X | LOCAL_AGENT | {dnaStr} | {(dna?.evolution.precision || 0).toFixed(4)} </Text>
      </Box>
      <Box backgroundColor="gray" paddingX={1}>
        <Text color="white"> STATUS: {status} | PRESS [ESC] TO EXIT </Text>
      </Box>
    </Box>
  );
};

const Terminal = () => {
  const [logs, setLogs] = useState<XPacket[]>([]);
  const [dna, setDna] = useState<AestheticDNA | null>(null);
  const [status, setStatus] = useState('IDLE');
  const [input, setInput] = useState('');
  const { exit } = useApp();
  const { stdout } = useStdout();
  
  const agentRef = useRef<LobsterCoreXAgent | null>(null);

  useEffect(() => {
    // 读取 Soul 和 User 配置 (Nanobot 风格)
    let soul = "";
    let userContext = "";
    try {
      if (fs.existsSync(SOUL_PATH)) soul = fs.readFileSync(SOUL_PATH, 'utf-8');
      if (fs.existsSync(USER_PATH)) userContext = fs.readFileSync(USER_PATH, 'utf-8');
    } catch (e) {
      // 忽略读取错误，使用默认人格
    }

    // 初始化 Agent
    agentRef.current = new LobsterCoreXAgent(undefined, soul, userContext);
    setDna(agentRef.current.getDna());
    addLog('Lobster-Core-X Online.', 'thought');
  }, []);

  const termHeight = stdout.rows || 24;
  const logHeight = termHeight - 8;

  const addLog = (content: string, type: XPacket['type'] = 'thought') => {
    setLogs(prev => [...prev, { 
      id: Math.random().toString(36).substring(7), 
      timestamp: Date.now(), 
      type, 
      content 
    }].slice(-1000));
  };

  const sendMessage = async (msg: string) => {
    if (!msg.trim()) return;
    const originalMsg = msg;
    setStatus('THINKING');
    setInput('');
    addLog(originalMsg, 'message');

    if (!agentRef.current) return;

    try {
      const responseLogs = await agentRef.current.chat(originalMsg);
      for (const packet of responseLogs) {
        if (packet.type === 'thought' || packet.type === 'action') {
          await new Promise(r => setTimeout(r, 100));
        }
        setLogs(prev => [...prev, packet].slice(-1000));
      }
      setDna(agentRef.current.getDna());
    } catch (e) {
      addLog(`Error: ${e instanceof Error ? e.message : 'Unknown'}`, 'error');
    } finally {
      setStatus('IDLE');
    }
  };

  useInput((char, key) => {
    if (key.escape) exit();
    if (key.return) { sendMessage(input); return; }
    if (key.backspace || key.delete) { setInput(prev => prev.slice(0, -1)); return; }
    if (char) setInput(prev => prev + char);
  });

  return (
    <Box flexDirection="column" paddingX={1} width="100%">
      <Header dna={dna} status={status} />

      <Box flexDirection="column" height={logHeight} overflowY="hidden">
        {logs.slice(-logHeight).map((log) => (
          <Box key={log.id}>
            <Text color="green" dimColor>[{new Date(log.timestamp).toLocaleTimeString([], {hour12: false})}] </Text>
            {log.type === 'message' ? (
              <Text bold color="white"> {log.content}</Text>
            ) : (
              <Text italic color={log.type === 'error' ? 'red' : log.type === 'action' ? 'yellow' : 'green'} dimColor={log.type === 'thought'}>
                {log.type === 'thought' ? '⚡ ' : log.type === 'action' ? '⚒ ' : ''}
                {log.content}
              </Text>
            )}
          </Box>
        ))}
        {status === 'THINKING' && <Text color="green" dimColor>...</Text>}
      </Box>

      <Box marginTop={1}>
        <Text color="green" bold>X@Breacher:~$ </Text>
        <Text color="white">{input}</Text>
        <Text color="green" bold>█</Text>
      </Box>
    </Box>
  );
};

render(<Terminal />);
