import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createOptionalModel } from "../lib/model.js";
import type { MoodOption, PlaybackHistoryItem, Track } from "../types.js";

interface NarratorInput {
  mood: MoodOption;
  contextSummary: string;
  track: Track;
  history: PlaybackHistoryItem[];
}

export class NarratorAgent {
  async generate(input: NarratorInput): Promise<string> {
    const model = createOptionalModel();
    const historyCount = input.history.length;

    if (!model) {
      const moodTag = input.track.moodTags?.[0] || "经典";
      const templates = [
        `嘿，欢迎回到龙虾电台。现在为你送上的是${input.track.artist}的《${input.track.title}》，这是一首${moodTag}的作品，希望能陪你度过这段${input.mood}的时光。`,
        `哈喽朋友们，正在播放的是${input.track.artist}演唱的《${input.track.title}》，收录在专辑《${input.track.album}》中。愿这首歌能陪你度过美好的一天。`,
        `欢迎收听龙虾电台。接下来这首歌，${input.track.artist}的《${input.track.title}》，相信很多人都听过。有时候，经典就是这样，不管过了多久，听到的瞬间还是会被打动。`,
        `正在播放：${input.track.title}，来自${input.track.artist}。这首歌收录在《${input.track.album}》专辑里，希望你喜欢。我们已经记录了${historyCount}次播放，龙虾电台正在慢慢了解你的音乐品味。`,
        `${input.track.title}，${input.track.artist}。有时候一首歌不需要太多言语，它本身就是最好的表达。龙虾电台，懂你的音乐。`
      ];
      return templates[Math.floor(Math.random() * templates.length)];
    }

    const result = await model.invoke([
      new SystemMessage(
        "You are Narrator Agent for a personal radio app. Write a short DJ script with warmth, one transition, and one contextual observation."
      ),
      new HumanMessage(
        `Mood: ${input.mood}\nContext: ${input.contextSummary}\nCurrent track: ${input.track.title} by ${input.track.artist}\nRecent plays: ${historyCount}`
      )
    ]);

    return typeof result.content === "string" ? result.content : JSON.stringify(result.content);
  }
}
