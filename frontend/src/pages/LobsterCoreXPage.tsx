import { useEffect, useRef, useState } from "react";
import { XPacket, AestheticDNA } from "../types";
import { CpuChipIcon, ShieldCheckIcon, BeakerIcon } from "@heroicons/react/24/outline";

export function LobsterCoreXPage() {
  const [packets, setPackets] = useState<XPacket[]>([]);
  const [dna, setDna] = useState<AestheticDNA | null>(null);
  const [inputText, setInputText] = useState("");
  const [isSniffing, setIsSniffing] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [packets]);

  const addPacket = (packet: XPacket) => {
    setPackets(prev => [...prev, packet]);
  };

  const addSystemPacket = (content: string, type: XPacket['type'] = 'thought') => {
    addPacket({
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
      type,
      content
    });
  };

  const initSystem = async () => {
    addSystemPacket("Initializing Lobster-Core-X Kernel...", "action");
    try {
      const res = await fetch("/api/agent/x/init", { method: "POST" });
      const data = await res.json();
      setDna(data.dna);
      addSystemPacket("System ready. DNA signature verified.", "thought");
    } catch (e) {
      addSystemPacket("Kernel panic: Failed to initialize.", "error");
    }
  };

  const startSniff = async () => {
    if (isSniffing) return;
    setIsSniffing(true);
    addSystemPacket("Executing Stealth Sniff Protocol...", "action");
    
    try {
      const res = await fetch("/api/agent/x/sniff", { method: "POST" });
      const data = await res.json();
      
      // Gradually add logs to terminal for effect
      for (const packet of data.logs) {
        await new Promise(r => setTimeout(r, 400 + Math.random() * 600));
        addPacket(packet);
      }
      
      setDna(data.dna);
    } catch (e) {
      addSystemPacket("Breach failed: Signal lost.", "error");
    } finally {
      setIsSniffing(false);
    }
  };

  const startDig = async () => {
    if (isSniffing) return;
    setIsSniffing(true);
    addSystemPacket("Executing Ghost Digging Protocol...", "action");

    try {
      const res = await fetch("/api/agent/x/dig", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seedTrack: "Recent NCM Target" })
      });
      const data = await res.json();

      for (const packet of data.logs) {
        await new Promise(r => setTimeout(r, 400 + Math.random() * 600));
        addPacket(packet);
      }

      setDna(data.dna);
      addSystemPacket(`Recovered ${data.tracks.length} orphan signals.`, "message");
    } catch (e) {
      addSystemPacket("Breach failed: Signal lost.", "error");
    } finally {
      setIsSniffing(false);
    }
  };

  useEffect(() => {
    initSystem();
  }, []);

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = inputText.trim().toLowerCase();
    if (!cmd) return;

    addPacket({
      id: Date.now().toString(),
      timestamp: Date.now(),
      type: 'message',
      content: `> ${inputText}`
    });
    setInputText("");

    if (cmd === 'sniff' || cmd === 'scan') {
      startSniff();
    } else if (cmd === 'dig') {
      startDig();
    } else if (cmd === 'help') {
      addSystemPacket("Available commands: sniff, scan, dig, dna, clear, status", "thought");
    } else if (cmd === 'clear') {
      setPackets([]);
    } else if (cmd === 'dna') {
      addSystemPacket(`DNA Precision: ${dna?.evolution.precision.toFixed(4) || "0.0000"}`, "thought");
    } else if (cmd === 'status') {
      addSystemPacket(`Status: ${isSniffing ? 'SNIFFING' : 'IDLE'} | Precision: ${dna?.evolution.precision.toFixed(4)} | Level: ${dna?.evolution.level}`, "thought");
    } else {
      addSystemPacket(`Unknown command: ${cmd}`, "error");
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] gap-6 bg-[#050505] p-6 rounded-[32px] border border-green-500/20 shadow-[0_0_50px_rgba(34,197,94,0.05)] font-mono overflow-hidden">
      
      {/* Header Info */}
      <header className="flex justify-between items-center border-b border-green-500/20 pb-4">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-green-500/10 rounded-lg">
            <CpuChipIcon className="h-6 w-6 text-green-500 animate-pulse" />
          </div>
          <div>
            <h1 className="text-green-500 font-bold tracking-widest uppercase text-xl">Lobster-Core-X</h1>
            <p className="text-green-500/40 text-xs">Aesthetic Breacher Kernel v1.0.0</p>
          </div>
        </div>
        
        <div className="flex gap-8 text-[10px]">
          <div className="flex flex-col items-end">
            <span className="text-green-500/30 uppercase">Precision</span>
            <span className="text-green-500 font-bold">{(dna?.evolution.precision || 0).toFixed(4)}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-green-500/30 uppercase">Level</span>
            <span className="text-green-500 font-bold">{dna?.evolution.level || 0}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-green-500/30 uppercase">Status</span>
            <span className="text-green-500 font-bold">{isSniffing ? 'SNIFFING' : 'IDLE'}</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 gap-6 overflow-hidden">
        
        {/* Terminal Window */}
        <div className="flex-1 flex flex-col bg-black/40 rounded-2xl border border-green-500/10 p-4 relative overflow-hidden">
          {/* Scanline Effect */}
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] z-10"></div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar-green space-y-2 pr-2">
            {packets.map((p) => (
              <div key={p.id} className="animate-in fade-in slide-in-from-left-2 duration-300">
                <span className="text-green-500/20 text-[10px] mr-2">
                  [{new Date(p.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
                </span>
                <span className={`
                  text-sm break-words
                  ${p.type === 'thought' ? 'text-green-500/60 italic' : ''}
                  ${p.type === 'action' ? 'text-green-400 font-bold' : ''}
                  ${p.type === 'message' ? 'text-white' : ''}
                  ${p.type === 'error' ? 'text-red-500 animate-pulse' : ''}
                `}>
                  {p.type === 'thought' && <span className="mr-2">⚡</span>}
                  {p.type === 'action' && <span className="mr-2">#</span>}
                  {p.content}
                </span>
              </div>
            ))}
            <div ref={terminalEndRef} />
          </div>

          <form onSubmit={handleCommand} className="mt-4 pt-4 border-t border-green-500/10 flex items-center gap-2">
            <span className="text-green-500 font-bold">X@Breacher:~$</span>
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              className="flex-1 bg-transparent border-none text-green-500 focus:outline-none text-sm caret-green-500 font-mono"
              autoFocus
              placeholder="Enter command..."
            />
          </form>
        </div>

        {/* DNA Visualization Panel */}
        <div className="w-80 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar-green">
          
          <div className="p-4 bg-green-500/5 rounded-2xl border border-green-500/10">
            <h3 className="text-xs font-bold text-green-500/40 uppercase tracking-widest mb-4 flex items-center gap-2">
              <BeakerIcon className="h-4 w-4" />
              Aesthetic_DNA
            </h3>
            
            {dna ? (
              <div className="space-y-4">
                {Object.entries(dna.spectralMap).map(([key, val]) => (
                  <div key={key}>
                    <div className="flex justify-between text-[10px] uppercase mb-1">
                      <span className="text-green-500/60">{key}</span>
                      <span className="text-green-500">{(val as number).toFixed(2)}</span>
                    </div>
                    <div className="h-1 w-full bg-green-500/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 transition-all duration-1000" 
                        style={{ width: `${(val as number) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-green-500/20 italic">Awaiting kernel sync...</p>
            )}
          </div>

          <div className="p-4 bg-green-500/5 rounded-2xl border border-green-500/10">
            <h3 className="text-xs font-bold text-green-500/40 uppercase tracking-widest mb-4 flex items-center gap-2">
              <ShieldCheckIcon className="h-4 w-4" />
              Evolution_Metrics
            </h3>
            {dna ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-green-500/60 uppercase">Entropy</span>
                  <span className="text-xs text-green-500">{(dna.evolution.entropyThreshold * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-green-500/60 uppercase">Autonomy</span>
                  <span className="text-xs text-green-500">{(dna.evolution.autonomyLevel * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-green-500/60 uppercase">Fatigue</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div 
                        key={i} 
                        className={`w-2 h-1 rounded-full ${i <= dna.evolution.fatigueIndex ? 'bg-red-500' : 'bg-green-500/20'}`} 
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-green-500/20 italic">Offline.</p>
            )}
          </div>

          <button
            onClick={startSniff}
            disabled={isSniffing}
            className="w-full py-3 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-xl text-green-500 text-xs font-bold tracking-widest uppercase transition-all disabled:opacity-30"
          >
            {isSniffing ? 'Scanning...' : 'Execute Sniff'}
          </button>
        </div>
      </div>
    </div>
  );
}
