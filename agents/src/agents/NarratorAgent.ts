import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createOptionalModel } from "../lib/model.js";
import type { DJLanguage, MoodOption, PlaybackHistoryItem, Track } from "../types.js";

export type DJStyle = "classic" | "night" | "vibe" | "trivia";

interface NarratorInput {
  mood: MoodOption;
  contextSummary: string;
  track: Track;
  history: PlaybackHistoryItem[];
  style?: DJStyle;
  language?: DJLanguage;
}

export class NarratorAgent {
  async generate(input: NarratorInput): Promise<string> {
    const model = createOptionalModel();
    const historyCount = input.history.length;
    const style = input.style || "classic";
    const language = input.language || "zh-HK";

    if (!model) {
      return this.getFallbackTemplate(input.track, style, language);
    }

    const systemPrompt = this.getSystemPrompt(style, language);
    const userPrompt = this.getUserPrompt(input, historyCount, language);

    const result = await model.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt)
    ]);

    return typeof result.content === "string" ? result.content : JSON.stringify(result.content);
  }

  private getFallbackTemplate(track: Track, style: DJStyle, language: DJLanguage): string {
    const templates = {
      "zh-HK": {
        classic: [
          `欢迎返到龙虾电台，而家为你送上嘅系${track.artist}嘅《${track.title}》，收录喺大碟《${track.album}》入面，希望你钟意。`,
          `正在锁定龙虾电台，而家播紧嘅系${track.artist}嘅《${track.title}》，一齐嚟欣赏啦。`,
          `呢度系龙虾电台，接下来呢首歌，${track.artist}嘅《${track.title}》，希望可以陪你度过呢段美好时光。`,
          `${track.artist}嘅《${track.title}》，收录喺《${track.album}》入面，希望呢首歌可以陪住你。`,
        ],
        night: [
          `夜阑人静，等${track.artist}嘅《${track.title}》陪你度过呢个安静嘅夜晚。`,
          `而家系深夜时分，听听${track.artist}嘅《${track.title}》，好衬而家嘅心情。`,
          `夜啦，有歌陪你。${track.artist}嘅《${track.title}》，送俾夜猫子嘅你。`,
          `呢个夜晚，等《${track.title}》嘅旋律陪你放松一下。`,
        ],
        vibe: [
          `嚟啦嚟啦！就系而家！${track.artist}嘅《${track.title}》，跟住节奏一齐郁！`,
          `各位朋友！准备好未！${track.artist}嘅《${track.title}》，俾啲反应！`,
          `Let's go！接下来呢首歌你实识唱！${track.artist}嘅《${track.title}》！`,
          `就系呢个感觉！${track.artist}嘅《${track.title}》，一齐嚟啦！`,
        ],
        trivia: [
          `你知唔知？${track.artist}嘅《${track.title}》收录喺《${track.album}》呢张大碟入面，几得意下？`,
          `讲个冷知识俾你听，《${track.title}》系${track.artist}嘅代表作之一，估唔到吧？`,
          `同你分享下，《${track.title}》呢首歌出自${track.artist}嘅专辑《${track.album}》。学到嘢啦！`,
        ]
      },
      "zh-CN": {
        classic: [
          `欢迎回到龙虾电台，现在为你送上的是${track.artist}的《${track.title}》，收录在专辑《${track.album}》中，希望你喜欢。`,
          `正在收听龙虾电台，现在播放的是${track.artist}的《${track.title}》，一起来欣赏吧。`,
          `这里是龙虾电台，接下来这首歌，${track.artist}的《${track.title}》，希望能陪你度过这段美好时光。`,
          `${track.artist}的《${track.title}》，收录在《${track.album}》中，希望这首歌能陪伴你。`,
        ],
        night: [
          `夜深人静，让${track.artist}的《${track.title}》陪你度过这个安静的夜晚。`,
          `现在是深夜时分，听听${track.artist}的《${track.title}》，很适合现在的心情。`,
          `夜了，有歌陪你。${track.artist}的《${track.title}》，送给夜猫子的你。`,
          `这个夜晚，让《${track.title}》的旋律陪你放松一下。`,
        ],
        vibe: [
          `来了来了！就是现在！${track.artist}的《${track.title}》，跟着节奏一起动起来！`,
          `各位朋友！准备好了吗！${track.artist}的《${track.title}》，给点反应！`,
          `Let's go！接下来这首歌你一定会唱！${track.artist}的《${track.title}》！`,
          `就是这个感觉！${track.artist}的《${track.title}》，一起来吧！`,
        ],
        trivia: [
          `你知道吗？${track.artist}的《${track.title}》收录在《${track.album}》这张专辑中，挺有意思的吧？`,
          `给你讲个冷知识，《${track.title}》是${track.artist}的代表作之一，没想到吧？`,
          `和你分享一下，《${track.title}》这首歌出自${track.artist}的专辑《${track.album}》。学到了！`,
        ]
      },
      "en-US": {
        classic: [
          `Welcome back to Lobster Radio. Now playing ${track.title} by ${track.artist}, from the album ${track.album}. Hope you enjoy it.`,
          `You're tuned to Lobster Radio. Here's ${track.title} by ${track.artist}. Let's enjoy this together.`,
          `This is Lobster Radio. Coming up next, ${track.title} by ${track.artist}. Hope this brings you some good vibes.`,
          `${track.title} by ${track.artist}, from the album ${track.album}. Hope this song keeps you company.`,
        ],
        night: [
          `Late into the night, let ${track.title} by ${track.artist} accompany you through this quiet evening.`,
          `It's the late night hours. Here's ${track.title} by ${track.artist}, perfect for the mood right now.`,
          `Night time, music time. ${track.title} by ${track.artist}, for all you night owls out there.`,
          `This evening, let the melody of ${track.title} help you unwind.`,
        ],
        vibe: [
          `Here we go! Right now! ${track.title} by ${track.artist}, move to the beat!`,
          `Everyone! Are you ready! ${track.title} by ${track.artist}, let me hear you!`,
          `Let's go! You know this one! ${track.title} by ${track.artist}!`,
          `That's the vibe! ${track.title} by ${track.artist}, let's do this!`,
        ],
        trivia: [
          `Did you know? ${track.title} by ${track.artist} is from the album ${track.album}. Pretty cool, right?`,
          `Fun fact: ${track.title} is one of ${track.artist}'s signature tracks. Bet you didn't know that!`,
          `Let me share this with you: ${track.title} is from ${track.artist}'s album ${track.album}. Now you know!`,
        ]
      }
    };

    const langTemplates = templates[language];
    const styleTemplates = langTemplates[style] || langTemplates.classic;
    return styleTemplates[Math.floor(Math.random() * styleTemplates.length)];
  }

  private getSystemPrompt(style: DJStyle, language: DJLanguage): string {
    const styleDescriptions = {
      "zh-HK": {
        classic: "经典电台主持风格，亲切、专业，带一点点怀旧感。专注分享歌手嘅职业生涯发展、奖项同传奇成就。",
        night: "深夜治愈系，温柔、安静，适合夜晚收听。专注探讨歌词嘅深层含义、情感同歌曲嘅氛围背景。",
        vibe: "活力蹦迪风，热情、兴奋，带动听众情绪。专注分享歌曲嘅能量、制作技巧同文化影响力。",
        trivia: "冷知识科普风，有趣、有料，带一点点书卷气。专注挖掘冷门事实、录音过程同隐藏嘅细节。"
      },
      "zh-CN": {
        classic: "经典电台主持风格，亲切、专业，带一点怀旧感。专注分享歌手的职业生涯发展、奖项和传奇成就。",
        night: "深夜治愈系，温柔、安静，适合夜晚收听。专注探讨歌词的深层含义、情感和歌曲的氛围背景。",
        vibe: "活力派对风，热情、兴奋，带动听众情绪。专注分享歌曲的能量、制作技巧和文化影响力。",
        trivia: "冷知识科普风，有趣、有料，带一点书卷气。专注挖掘冷门事实、录音过程和隐藏的细节。"
      },
      "en-US": {
        classic: "Classic radio host style, warm, professional, with a touch of nostalgia. Focus on the artist's career trajectory, awards, and legacy.",
        night: "Late night healing vibes, gentle, quiet, perfect for nighttime listening. Focus on lyrical meaning, emotions, and the atmospheric background of the song.",
        vibe: "High-energy party mode, enthusiastic, exciting, pumping up the audience. Focus on the energy, production techniques, and cultural impact.",
        trivia: "Fun facts style, interesting, informative, with a touch of sophistication. Focus on deep-cut facts, recording process, and hidden details."
      }
    };

    const prompts = {
      "zh-HK": `你系龙虾电台嘅AI DJ，一个地道嘅香港电台主持。用纯正粤语讲嘢，语气要自然、亲切，似同朋友倾计一样。风格：${styleDescriptions["zh-HK"][style]}。旁白控制喺 3-4 句，唔好太长。`,
      "zh-CN": `你是龙虾电台的AI DJ，一个地道的电台主持人。用普通话说话，语气要自然、亲切，像和朋友聊天一样。风格：${styleDescriptions["zh-CN"][style]}。旁白控制在 3-4 句，不要太长。`,
      "en-US": `You are an AI DJ for Lobster Radio, an authentic radio host. Speak naturally and warmly, like talking to a friend. Style: ${styleDescriptions["en-US"][style]}. Keep it to 3-4 sentences, don't make it too long.`,
    };

    return prompts[language];
  }

  private getUserPrompt(input: NarratorInput, historyCount: number, language: DJLanguage): string {
    const prompts = {
      "zh-HK": `心情模式：${input.mood}\n上下文：${input.contextSummary}\n而家播放紧：${input.track.artist}嘅《${input.track.title}》，收录喺《${input.track.album}》\n歌曲背景：${input.track.explanation}\n听众已经听咗${historyCount}首歌\n\n请结合上面嘅歌曲背景同埋你自己对歌手历史、专辑上下文或制作秘密嘅深入了解，用纯正粤语讲一段深刻难忘嘅电台开场白，控制喺 3-4 句。`,
      "zh-CN": `心情模式：${input.mood}\n上下文：${input.contextSummary}\n现在播放：${input.track.artist}的《${input.track.title}》，收录在《${input.track.album}》\n歌曲背景：${input.track.explanation}\n听众已经听了${historyCount}首歌\n\n请结合上面的歌曲背景和你自己对歌手历史、专辑上下文或制作秘密的深入了解，用普通话说一段深刻难忘的电台开场白，控制在 3-4 句。`,
      "en-US": `Mood mode: ${input.mood}\nContext: ${input.contextSummary}\nNow playing: ${input.track.title} by ${input.track.artist}, from ${input.track.album}\nTrack Context: ${input.track.explanation}\nListener has heard ${historyCount} songs\n\nPlease blend the provided track context with your own deep knowledge of the artist's history, album context, or production secrets to create a profound and memorable radio intro in 3-4 sentences.`,
    };

    return prompts[language];
  }
}
