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

  it('should include specific insight instructions per style', () => {
    const agent = new NarratorAgent() as unknown as { getSystemPrompt: Function };
    expect(agent.getSystemPrompt('classic', 'en-US')).toContain('career trajectory');
    expect(agent.getSystemPrompt('night', 'en-US')).toContain('lyrical meaning');
    expect(agent.getSystemPrompt('vibe', 'en-US')).toContain('cultural impact');
    expect(agent.getSystemPrompt('trivia', 'en-US')).toContain('recording process');
  });

  it('should return longer fallbacks (2-3 sentences)', () => {
    const agent = new NarratorAgent() as unknown as { getFallbackTemplate: Function };
    const track = { title: 'Test', artist: 'Tester', album: 'Album' } as any;
    const classicFallback = agent.getFallbackTemplate(track, 'classic', 'en-US');
    const sentences = classicFallback.split(/[.!?。！？]+/).filter((s: string) => s.trim().length > 0);
    expect(sentences.length).toBeGreaterThanOrEqual(2);
    // Spot check one of the new profound generic sentences
    expect(agent.getFallbackTemplate(track, 'night', 'en-US')).toMatch(/(mood|unwind|melody|atmosphere|conversation|soul|dreams|friend|peaceful|quiet)/i);
  });
});
