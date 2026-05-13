# Contributing

## Workflow

We use feature branches and pull requests. All features go through code review before merging.

## LLM-Wiki Maintenance

When you add a new feature or refactor existing code:
1. Update the relevant wiki page(s) incrementally
2. Add an entry to [[log|log.md]] with the date and what changed
3. Don't worry about being perfect - we can always update incrementally later

The wiki is the first place any developer (or LLM) should look to understand how the system works. Keep it up to date.

## Code Style

- TypeScript for all new code
- Functional components with hooks for React
- One concept per file
- Extract shared utilities when duplication occurs
- We just refactored the narration audio creation to a shared utility - follow this pattern

## Testing

- Test your changes manually before requesting review
- Ensure audio works correctly (play/pause sync, volume sync, cleanup)
