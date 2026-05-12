import type { Preferences } from "../types.js";
export declare class MemoryAgent {
    summarize(prefs: Preferences): Promise<string | null>;
}
