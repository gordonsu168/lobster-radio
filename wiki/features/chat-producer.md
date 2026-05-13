# Chat with Producer

The "Producer Chat" (aka Chat Panel) lets users converse directly with the AI DJ to:
- Request skipping the current track
- Ask for different genres/moods
- Ask questions about the current track
- Give feedback about the music selection

## Architecture

**Location**: `frontend/src/components/ChatPanel.tsx`

### Key Points:

- **State management**: Chat messages are stored locally in the component state
- **Ref exposure**: Uses `useImperativeHandle` to expose methods to parent `RadioModePage`:
  - `sendSkipRequest()` - Programmatically send a skip request
  - `addAssistantMessage()` - Add a message from the AI (for narrations/trivia)
- **Stale closure fix**: We use functional updates for messages to avoid closure issues when sending multiple messages quickly

## Flow

1. User types a message and clicks "Send"
2. Message is added to chat history
3. Backend processes the message with the AI
4. AI reply is added to chat history
5. AI may trigger tool actions:
   - `skipRequested` → calls `onSkipRequested` callback → skips current track
   - `refreshRecommendations` → calls `onRefreshRequested` → refreshes recommendations

## The Skip Button Design

Originally, the "Skip" button immediately cut the music and any narration. This was jarring.

**New design** (since fbbc0207):
- Skip button doesn't immediately cut anything
- It just sends a "I want to skip this song" message to the AI DJ
- The AI DJ acknowledges the request and decides when to transition
- This sounds more natural, like a real radio station where the DJ talks before switching

Related: **[[architecture/ai-dj|AI DJ System]]**, **[[features/radio-mode|Radio Mode]]**
