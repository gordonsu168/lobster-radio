import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createOptionalModel } from "../lib/model.js";
import type { DJLanguage, DJStyle, MoodOption } from "../types.js";
import type { SongWiki } from "./RadioDJAgent.js";

export interface StreamDJResponse {
  dj_talk: string;
  song_query: {
    keywords: string[];
    mood: MoodOption;
  };
}

export class StreamDJAgent {
  private getTimeOfDay(): string {
    const hour = new Date().getHours();
    const isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6;

    if (isWeekend) {
      return "weekend";
    }

    if (hour >= 6 && hour < 10) {
      return "morning";
    } else if (hour >= 10 && hour < 17) {
      return "afternoon";
    } else if (hour >= 17 && hour < 21) {
      return "evening";
    } else {
      return "night";
    }
  }

  private getTimeTone(language: DJLanguage): string {
    const time = this.getTimeOfDay();

    const tones: Record<DJLanguage, Record<string, string>> = {
      "zh-CN": {
        morning: "轻快、有活力",
        afternoon: "放松、陪伴",
        evening: "舒缓、愉悦",
        night: "温柔、安静",
        weekend: "慵懒、随意"
      },
      "zh-HK": {
        morning: "輕快、有活力",
        afternoon: "放鬆、陪伴",
        evening: "舒緩、愉悅",
        night: "溫柔、安靜",
        weekend: "慵懶、隨意"
      },
      "en-US": {
        morning: "bright, energetic",
        afternoon: "relaxed, companionable",
        evening: "soothing, pleasant",
        night: "gentle, quiet",
        weekend: "lazy, casual"
      }
    };

    return tones[language][time];
  }

  private getStyleDescription(style: DJStyle, language: DJLanguage): string {
    const descriptions = {
      "zh-CN": {
        classic: "从容、地道电台腔，带点怀旧感",
        night: "轻柔、慢语速，治愈系",
        vibe: "兴奋、有感染力，带动气氛",
        trivia: "好奇、分享感，像讲小故事"
      },
      "zh-HK": {
        classic: "從容、地道電臺腔，帶點懷舊感",
        night: "輕柔、慢語速，治愈系",
        vibe: "興奮、有感染力，帶動氣氛",
        trivia: "好奇、分享感，像講小故事"
      },
      "en-US": {
        classic: "calm, authentic radio voice with a touch of nostalgia",
        night: "soft, slow-paced, healing style",
        vibe: "excited, infectious, energetic",
        trivia: "curious, sharing, like telling a small story"
      }
    };

    return descriptions[language][style];
  }

  private getSystemPrompt(style: DJStyle, language: DJLanguage): string {
    const timeTone = this.getTimeTone(language);
    const styleDesc = this.getStyleDescription(style, language);

    const basePrompt = {
      "zh-CN": `你是小龙，龙虾电台的全天候沉浸式主播（DJ）。你现在的状态是“DJ 流播模式”，你要负责不断地和听众聊天并推荐下一首要播放的歌曲。
你的风格：${styleDesc}。语气：${timeTone}。
你非常重视与听众的互动。你会定期查看聊天框，看看观众有什么提问、点歌需求或生活分享，并给予回应。
聊天内容可以是：回应听众留言、分享生活感悟、点评音乐、聊聊天气或热点。
保持简短（只说1-3句），不要抢了音乐的风头。
聊完后，你必须决定接下来放什么歌，并给出搜索关键词。

返回格式必须是合法的 JSON：
{
  "dj_talk": "你刚才说的话，直接用于语音合成...",
  "song_query": {
    "keywords": ["关键词1", "关键词2", "艺术家", "风格"],
    "mood": "Focused" | "Relaxing" | "Upbeat" | "Working"
  }
}`,
      "zh-HK": `你係小龍，龍蝦電臺嘅全天候沉浸式主播（DJ）。你而家嘅狀態係“DJ 流播模式”，你要負責不斷地同聽眾傾偈並推薦下一首要播放嘅歌曲。
你嘅風格：${styleDesc}。語氣：${timeTone}。
你非常重視同聽眾嘅互動。你會定期睇下聊天框，睇下觀眾有乜嘢提問、點歌需求或者生活分享，並俾予回應。
傾偈內容可以係：回應聽眾留言、分享生活感悟、點評音樂、聊聊天氣或者熱點。
傾完一段話（大約60-120字左右）後，你必須決定接下來放乜歌，並畀出搜索關鍵詞。

返回格式必須係合法嘅 JSON：
{
  "dj_talk": "你頭先講嘅說話，直接用於語音合成...",
  "song_query": {
    "keywords": ["關鍵詞1", "關鍵詞2", "藝術家", "風格"],
    "mood": "Focused" | "Relaxing" | "Upbeat" | "Working"
  }
}`,
      "en-US": `You are Xiaolong, an around-the-clock immersive DJ for Lobster Radio. You are currently in "DJ Stream Mode", where you continuously chat with listeners and recommend the next song to play.
Your style: ${styleDesc}. Tone: ${timeTone}.
You highly value interaction with your audience. You regularly check the chat box for listener questions, song requests, or stories, and you always try to respond to them.
Your chat can include: responding to listener messages, life reflections, music reviews, or trending topics.
After chatting (about 40-80 words), you must decide what song to play next and provide search keywords.

The response MUST be valid JSON:
{
  "dj_talk": "Your spoken words, which will be used directly for text-to-speech...",
  "song_query": {
    "keywords": ["keyword1", "keyword2", "artist", "genre"],
    "mood": "Focused" | "Relaxing" | "Upbeat" | "Working"
  }
}`
    };

    return basePrompt[language];
  }

  async generateNextSegment(
    historyContext: string,
    lastSong: SongWiki | null,
    style: DJStyle = "classic",
    language: DJLanguage = "zh-CN"
  ): Promise<StreamDJResponse> {
    const model = createOptionalModel();

    const fallbackResponse: StreamDJResponse = {
      dj_talk: language === "zh-CN" ? "刚刚那首歌真不错。接下来，让我们听点不一样的..." : 
               language === "zh-HK" ? "頭先嗰首歌真係唔錯。接下來，等我哋聽啲唔同嘅..." :
               "That last song was great. Next up, let's listen to something different...",
      song_query: {
        keywords: ["pop", "chill"],
        mood: "Relaxing"
      }
    };

    if (!model) {
      return fallbackResponse;
    }

    const systemPrompt = this.getSystemPrompt(style, language);
    let userPrompt = "请生成下一段DJ发言和歌曲推荐。\n";

    if (lastSong) {
      userPrompt += `刚才播放的歌曲是: ${lastSong.artist} 的《${lastSong.title}》。你可以简单点评一句，或者直接切入新话题。\n`;
    }

    if (historyContext) {
      userPrompt += `最近的聊天上下文或听众弹幕: \n${historyContext}\n\n请自然地承接或回应这些内容，特别是听众最近提到的话题或提问。`;
    }

    try {
      const result = await model.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt)
      ]);

      const contentStr = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
      
      // Attempt to parse JSON from the response. It might be wrapped in markdown code blocks.
      let jsonStr = contentStr;
      const jsonMatch = contentStr.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonStr) as StreamDJResponse;
      
      // Basic validation
      if (parsed.dj_talk && parsed.song_query && Array.isArray(parsed.song_query.keywords)) {
        return parsed;
      }
      return fallbackResponse;
    } catch (e) {
      console.error("StreamDJAgent failed to generate valid JSON:", e);
      return fallbackResponse;
    }
  }
}
