import { describe, it, expect } from 'vitest';
import { getShortTermMemory, getLongTermMemory, getTopArtists, getTopMood } from './MemorySummarizer.js';
import type { PlaybackHistoryItem } from '../types.js';

function createMockTrack(overrides: Partial<PlaybackHistoryItem> = {}): PlaybackHistoryItem {
  return {
    id: 'test-id',
    title: 'Test Title',
    artist: 'Test Artist',
    album: 'Test Album',
    previewUrl: null,
    artwork: 'test.jpg',
    moodTags: ['Relaxing'],
    energy: 50,
    explanation: 'Test Explanation',
    source: 'fallback',
    playedAt: new Date().toISOString(),
    ...overrides
  };
}

describe('MemorySummarizer', () => {
  it('should return empty string for empty history', () => {
    const prefs = { likes: [], dislikes: [], history: [], moodAffinity: {} };
    expect(getShortTermMemory(prefs)).toBe('');
    expect(getLongTermMemory(prefs)).toBe('');
  });

  it('should return mood text even if history is empty', () => {
    const prefs = { likes: [], dislikes: [], history: [], moodAffinity: { 'Relaxing': 15 } };
    expect(getLongTermMemory(prefs)).toBe('Their primary mood affinity is Relaxing.');
  });

  it('should aggregate short term memory for recent tracks', () => {
    const now = Date.now();
    const prefs = {
      likes: [], dislikes: [], moodAffinity: {},
      history: [
        createMockTrack({ artist: 'A', playedAt: new Date(now).toISOString(), feedback: 'dislike' }),
        createMockTrack({ artist: 'B', playedAt: new Date(now - 1000).toISOString() }),
        createMockTrack({ artist: 'C', playedAt: new Date(now - 24 * 60 * 60 * 1000).toISOString() }) // Too old
      ]
    };
    const shortTerm = getShortTermMemory(prefs, now);
    expect(shortTerm).toContain('listened to 2 songs');
    expect(shortTerm).toContain('skipped 1');
  });

  it('should aggregate long term memory for top artists and mood', () => {
    const prefs = {
      likes: [], dislikes: [],
      moodAffinity: { 'Relaxing': 10, 'Working': 20 },
      history: [
        createMockTrack({ artist: 'Artist A' }),
        createMockTrack({ artist: 'Artist B' }),
        createMockTrack({ artist: 'Artist B' }),
        createMockTrack({ artist: 'Artist B' }),
        createMockTrack({ artist: 'Artist C' }),
        createMockTrack({ artist: 'Artist C' }),
      ]
    };
    const longTerm = getLongTermMemory(prefs);
    expect(longTerm).toContain('Artist B');
    expect(longTerm).toContain('Artist C');
    expect(longTerm).toContain('Working');
  });

  it('should get top artists correctly including likes', () => {
    const prefs = {
      likes: ['Artist D', 'Artist D', 'Artist C'],
      dislikes: [], moodAffinity: {},
      history: [
        createMockTrack({ artist: 'Artist A' }),
        createMockTrack({ artist: 'Artist B' }),
        createMockTrack({ artist: 'Artist B' }),
        createMockTrack({ artist: 'Artist B' }),
        createMockTrack({ artist: 'Artist C' }),
        createMockTrack({ artist: 'Artist C' }),
      ]
    };
    const topArtists = getTopArtists(prefs);
    expect(topArtists).toEqual(['Artist B', 'Artist C']);
  });

  it('should get top mood correctly', () => {
    const prefs = {
      likes: [], dislikes: [], history: [],
      moodAffinity: { 'Relaxing': 10, 'Working': 20, 'Exercising': 5 }
    };
    const topMood = getTopMood(prefs);
    expect(topMood).toBe('Working');
  });
});
