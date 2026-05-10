import { describe, it, expect } from 'vitest';
import { NarratorAgent } from './NarratorAgent.js';

describe('NarratorAgent Prompts', () => {
  it('should request 3-4 sentences in the system prompt', () => {
    const agent = new NarratorAgent() as unknown as { getSystemPrompt: Function };
    const sysPrompt = agent.getSystemPrompt('classic', 'en-US');
    expect(sysPrompt).toContain('3-4 sentences');
    expect(sysPrompt).not.toContain('1-2 sentences');
  });

  it('should include track explanation and blend instructions in the user prompt', () => {
    const agent = new NarratorAgent() as unknown as { getUserPrompt: Function };
    const input: Parameters<NarratorAgent['generate']>[0] = {
      mood: 'Working',
      contextSummary: 'Focused afternoon',
      track: {
        id: '1', title: 'Song', artist: 'Artist', album: 'Album',
        previewUrl: null, artwork: '', moodTags: [], energy: 0,
        explanation: 'A deep electronic track about focus.',
        source: 'local'
      },
      history: []
    };
    const userPrompt = agent.getUserPrompt(input, 0, 'en-US');
    expect(userPrompt).toContain('A deep electronic track about focus.');
    expect(userPrompt).toContain('blend the provided track context with your own deep knowledge');
    expect(userPrompt).toContain('3-4 sentences');
  });
});
