import type { Preferences } from "../types.js";
export declare function getShortTermMemory(prefs: Preferences, now?: number): string;
export declare function getTopArtists(prefs: Preferences, count?: number): string[];
export declare function getTopMood(prefs: Preferences): string;
export declare function getLongTermMemory(prefs: Preferences): string;
