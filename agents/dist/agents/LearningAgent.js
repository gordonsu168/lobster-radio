export class LearningAgent {
    async learn(input) {
        const likes = new Set(input.preferences.likes);
        const dislikes = new Set(input.preferences.dislikes);
        if (input.feedback === "like") {
            likes.add(input.trackId);
            dislikes.delete(input.trackId);
        }
        else {
            dislikes.add(input.trackId);
            likes.delete(input.trackId);
        }
        const moodAffinity = {
            ...input.preferences.moodAffinity,
            [input.mood]: (input.preferences.moodAffinity[input.mood] ?? 0) + (input.feedback === "like" ? 2 : -1)
        };
        const updatedHistory = input.preferences.history.map((item) => item.id === input.trackId ? { ...item, feedback: input.feedback } : item);
        return {
            likes: [...likes],
            dislikes: [...dislikes],
            history: updatedHistory,
            moodAffinity
        };
    }
}
