import { Track, PlaybackHistoryItem } from "../types.js";
/**
 * Lobster-Core-X: Aesthetic DNA
 */
export interface AestheticDNA {
    spectralMap: {
        lowEnd: number;
        midTexture: number;
        highAir: number;
        analogHeat: number;
    };
    evolution: {
        precision: number;
        entropyThreshold: number;
        autonomyLevel: number;
        fatigueIndex: number;
        level: number;
    };
    anchors: {
        localRoots: string[];
        phantomNodes: string[];
        blackList: string[];
    };
}
export type XPacketType = 'thought' | 'action' | 'message' | 'error';
export interface XPacket {
    id: string;
    timestamp: number;
    type: XPacketType;
    content: string;
    metadata?: any;
}
/**
 * Lobster-Core-X Agent
 * 身份: The Breacher (破障者)
 * 一个真正的自主智能体，能够根据目标自主调用工具并进化。
 */
export declare class LobsterCoreXAgent {
    private dna;
    private logs;
    private model;
    constructor(initialDna?: AestheticDNA);
    private getInitialDna;
    private addLog;
    /**
     * 核心对话接口 (nanobot 风格)
     * 支持思维链和自主决策
     */
    chat(message: string): Promise<XPacket[]>;
    stealthSniff(localTracks: Track[], ncmHistory: PlaybackHistoryItem[]): Promise<XPacket[]>;
    ghostDig(seedTrack: string): Promise<Track[]>;
    getDna(): AestheticDNA;
    getLogs(): XPacket[];
}
