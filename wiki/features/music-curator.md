# Music Curator

## Overview

Generates personalized music recommendations based on:
- User's current mood
- User's like/dislike history
- Tags from previous tracks

## Flow

1. When radio starts or needs more tracks, requests recommendations from backend
2. Backend queries the music API for candidate tracks
3. Candidates are ranked based on user preferences
4. Ranked tracks are returned to frontend and added to the queue

## User Feedback Loop

- When user likes a track → we reinforce those tags/moods in future recommendations
- When user dislikes a track → we avoid similar tracks in future recommendations

Related: **[[features/memory-system|Memory System]]**
