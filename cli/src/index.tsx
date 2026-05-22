import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput, useApp, useStdout } from 'ink';
import { XPacket, AestheticDNA } from 'lobster-radio-agents';

const API_BASE = 'http://localhost:4000/api/agent/x';

interface PlayerState {
  current: { title: string; path: string } | null;
  queue: { title: string; path: string }[];
  isPaused: boolean;
  precision: number;
}

const DNAVisualizer = ({ dna }: { dna: AestheticDNA | null }) => (
  <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} minWidth={25}>
    <Text bold color="cyan">🧬 DNA</Text>
    {dna ? (
      <Box flexDirection="column">
        {Object.entries(dna.spectralMap).map(([key, val]) => (
          <Box key={key} justifyContent="space-between">
            <Text color="cyan" dimColor>{key.slice(0, 3).toUpperCase()}: </Text>
            <Text color="cyan">{'█'.repeat(Math.floor((val as number) * 6)).padEnd(6, '░')}</Text>
          </Box>
        ))}
      </Box>
    ) : <Text dimColor italic>Scanning...</Text>}
  </Box>
);

const PlayerPanel = ({ state }: { state: PlayerState | null }) => (
  <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={1} minWidth={30} flexGrow={1}>
    <Text bold color="green">📻 CONSOLE</Text>
    <Box marginTop={1}>
      <Text color="white" bold wrap="truncate">
        {state?.current ? `${state.isPaused ? '⏸' : '▶'} ${state.current.title}` : 'IDLE'}
      </Text>
    </Box>
    <Box flexDirection="column" marginTop={1}>
      <Text color="white" dimColor>QUEUE ({state?.queue.length || 0})</Text>
      {state?.queue.slice(0, 3).map((item, i) => (
        <Text key={i} color="green" dimColor wrap="truncate" fontSize={10}>
          {i + 1}. {item.title}
        </Text>
      ))}
    </Box>
  </Box>
);

const Terminal = () => {
  const [logs, setLogs] = useState<XPacket[]>([]);
  const [dna, setDna] = useState<AestheticDNA | null>(null);
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [status, setStatus] = useState('IDLE');
  const [input, setInput] = useState('');
  const { exit } = useApp();
  const { stdout } = useStdout();
  
  // 动态计算高度，防止重复打印
  const termHeight = stdout.rows || 24;
  const logHeight = Math.max(5, termHeight - 15);

  const addLog = (content: string, type: XPacket['type'] = 'thought') => {
    setLogs(prev => [...prev.slice(-(logHeight + 5)), { id: Math.random().toString(), timestamp: Date.now(), type, content }]);
  };

  const refreshState = async () => {
    try {
      const res = await fetch(`${API_BASE}/init`, { method: 'POST' });
      const data = await res.json();
      setDna(data.dna);
    } catch (e) {}
  };

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/status`);
        if (res.ok) {
            const data = await res.json();
            setPlayer(data);
        }
      } catch (e) {}
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const sendMessage = async (msg: string) => {
    if (!msg.trim()) return;
    setStatus('THINKING');
    setInput('');
    addLog(msg, 'message');
    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
      });
      const data = await res.json();
      for (const packet of data.logs) {
        if (packet.type === 'thought' || packet.type === 'action') await new Promise(r => setTimeout(r, 200));
        setLogs(prev => [...prev.slice(-(logHeight + 5)), packet]);
      }
      setDna(data.dna);
    } catch (e) { addLog('Signal Lost.', 'error'); } finally { setStatus('IDLE'); }
  };

  useEffect(() => {
    refreshState();
    addLog('Lobster-Core-X Online.', 'thought');
  }, []);

  useInput((char, key) => {
    if (key.escape) exit();
    if (key.return) { sendMessage(input); return; }
    if (key.backspace || key.delete) { setInput(prev => prev.slice(0, -1)); return; }
    if (char) setInput(prev => prev + char);
  });

  return (
    <Box flexDirection="column" paddingX={1} width="100%">
      {/* Header */}
      <Box borderStyle="single" borderColor="green" paddingX={1} justifyContent="space-between">
        <Box>
            <Text bold color="green">🦞 LOBSTER-CORE-X</Text>
            <Text color="white" dimColor ml={2}>[{status}]</Text>
        </Box>
        <Text color="yellow">PRECISION: {(dna?.evolution.precision || 0).toFixed(4)}</Text>
      </Box>

      {/* Body */}
      <Box marginTop={1} height={logHeight + 8}>
        {/* Left: Logs */}
        <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={1} flexGrow={1} marginRight={1}>
          <Box flexDirection="column" flexGrow={1} overflowY="hidden">
            {logs.map((log) => (
              <Box key={log.id}>
                <Text color="green" dimColor>[{new Date(log.timestamp).toLocaleTimeString([], {hour12: false})}] </Text>
                <Text color={log.type === 'error' ? 'red' : log.type === 'action' ? 'yellow' : log.type === 'thought' ? 'green' : 'white'} 
                      italic={log.type === 'thought'} dimColor={log.type === 'thought'}>
                  {log.type === 'thought' ? '⚡ ' : log.type === 'action' ? '⚒ ' : '> '}
                  {log.content}
                </Text>
              </Box>
            ))}
            {status === 'THINKING' && <Text color="green" dimColor animate="pulse">... 破译中 ...</Text>}
          </Box>
        </Box>

        {/* Right: Panels */}
        <Box width={30} flexDirection="column">
            <DNAVisualizer dna={dna} />
            <PlayerPanel state={player} />
        </Box>
      </Box>

      {/* Input */}
      <Box marginTop={1} paddingX={1} borderStyle="single" borderColor="green">
        <Text color="green" bold>X@Breacher:~$ </Text>
        <Text color="white">{input}</Text>
        <Text color="green" bold>█</Text>
      </Box>
      <Box justifyContent="flex-end" paddingX={1}>
          <Text dimColor>[Esc] Exit | [Enter] Send</Text>
      </Box>
    </Box>
  );
};

render(<Terminal />);
