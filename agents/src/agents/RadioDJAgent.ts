import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createOptionalModel } from "../lib/model.js";
import type { DJLanguage, MoodOption, DJStyle } from "../types.js";

// Define SongWiki type that matches backend's SongWiki structure
export interface SongWiki {
  id: string;
  title: string;
  artist: string;
  album: string;
  explanation?: string;
  djMaterial?: {
    intro?: string[];
    outro?: string[];
    vibe?: string[];
    funFact?: string[];
  };
  trivia?: string[];
}

export class RadioDJAgent {
  // Get time of day context
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

  // Get time-based tone description
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

  // Get DJ style description
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

  // Generate intro
  async generateIntro(
    song: SongWiki,
    mood: MoodOption,
    style: DJStyle,
    language: DJLanguage,
    contextSummary: string,
    memoryInsight?: string
  ): Promise<string> {
    const model = createOptionalModel();

    if (!model) {
      return this.getFallbackIntro(song, style, language);
    }

    const systemPrompt = this.getSystemPrompt(style, language);
    const userPrompt = this.getIntroUserPrompt(song, mood, contextSummary, memoryInsight, language);

    const result = await model.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt)
    ]);

    return typeof result.content === "string" ? result.content : JSON.stringify(result.content);
  }

  // Generate outro
  async generateOutro(
    song: SongWiki,
    style: DJStyle,
    language: DJLanguage,
    contextSummary: string,
    memoryInsight?: string
  ): Promise<string> {
    const model = createOptionalModel();

    if (!model) {
      return this.getFallbackOutro(song, style, language);
    }

    const systemPrompt = this.getSystemPrompt(style, language);
    const userPrompt = this.getOutroUserPrompt(song, contextSummary, memoryInsight, language);

    const result = await model.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt)
    ]);

    return typeof result.content === "string" ? result.content : JSON.stringify(result.content);
  }

  // Generate mid-track trivia
  async generateMidTrackTrivia(
    song: SongWiki,
    style: DJStyle,
    language: DJLanguage
  ): Promise<string> {
    const model = createOptionalModel();

    if (!model) {
      return this.getFallbackTrivia(song, style, language);
    }

    const systemPrompt = this.getSystemPrompt(style, language);
    const userPrompt = this.getTriviaUserPrompt(song, language);

    const result = await model.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt)
    ]);

    return typeof result.content === "string" ? result.content : JSON.stringify(result.content);
  }

  // System prompt
  private getSystemPrompt(style: DJStyle, language: DJLanguage): string {
    const timeTone = this.getTimeTone(language);
    const styleDesc = this.getStyleDescription(style, language);

    const prompts = {
      "zh-CN": `你是小龙，龙虾电台的DJ。你是三十出头的资深乐迷，说话自然得像朋友聊天一样，保持简短（只说1-2句），不要抢了音乐的风头。风格：${styleDesc}。语气：${timeTone}。`,
      "zh-HK": `你係小龍，龍蝦電臺嘅DJ。你係三十出頭嘅資深樂迷，說話自然得像朋友聊天一樣，保持簡短（只說1-2句），不要搶了音樂的風頭。風格：${styleDesc}。語氣：${timeTone}。`,
      "en-US": `You are Xiaolong, the DJ of Lobster Radio. You are a veteran music fan in your 30s, speak naturally like a friend talking, keep it short (1-2 sentences only), don't steal the show from the music. Style: ${styleDesc}. Tone: ${timeTone}.`
    };

    return prompts[language];
  }

  // Intro user prompt
  private getIntroUserPrompt(
    song: SongWiki,
    mood: MoodOption,
    contextSummary: string,
    memoryInsight: string | undefined,
    language: DJLanguage
  ): string {
    const basePrompts = {
      "zh-CN": `心情模式：${mood}\n上下文：${contextSummary}\n接下来播放：${song.artist}的《${song.title}》，收录在《${song.album}》\n歌曲背景：${song.explanation || "暂无"}`,
      "zh-HK": `心情模式：${mood}\n上下文：${contextSummary}\n接下來播放：${song.artist}嘅《${song.title}》，收錄喺《${song.album}》\n歌曲背景：${song.explanation || "暫無"}`,
      "en-US": `Mood mode: ${mood}\nContext: ${contextSummary}\nNow playing next: ${song.title} by ${song.artist}, from the album ${song.album}\nTrack context: ${song.explanation || "None"}`
    };

    let prompt = basePrompts[language];

    if (memoryInsight) {
      const insightPrompts = {
        "zh-CN": `\n\n小贴士：${memoryInsight}。请在你的旁白中自然地提到这一点。`,
        "zh-HK": `\n\n小貼士：${memoryInsight}。請在你的旁白中自然地提到這一點。`,
        "en-US": `\n\nProducer Note: ${memoryInsight}. Acknowledge this in your narration naturally.`
      };
      prompt += insightPrompts[language];
    }

    const requestPrompts = {
      "zh-CN": "\n\n请用1-2句自然的话介绍这首歌，不要太官方。",
      "zh-HK": "\n\n請用1-2句自然嘅說話介紹呢首歌，唔好太官方。",
      "en-US": "\n\nPlease introduce this song in 1-2 natural sentences, don't be too formal."
    };

    prompt += requestPrompts[language];

    return prompt;
  }

  // Outro user prompt
  private getOutroUserPrompt(
    song: SongWiki,
    contextSummary: string,
    memoryInsight: string | undefined,
    language: DJLanguage
  ): string {
    const basePrompts = {
      "zh-CN": `上下文：${contextSummary}\n刚播放完：${song.artist}的《${song.title}》，收录在《${song.album}》\n歌曲背景：${song.explanation || "暂无"}`,
      "zh-HK": `上下文：${contextSummary}\n剛播放完：${song.artist}嘅《${song.title}》，收錄喺《${song.album}》\n歌曲背景：${song.explanation || "暫無"}`,
      "en-US": `Context: ${contextSummary}\nWe just finished playing: ${song.title} by ${song.artist}, from the album ${song.album}\nTrack context: ${song.explanation || "None"}`
    };

    let prompt = basePrompts[language];

    if (memoryInsight) {
      const insightPrompts = {
        "zh-CN": `\n\n小贴士：${memoryInsight}。请在你的旁白中自然地提到这一点。`,
        "zh-HK": `\n\n小貼士：${memoryInsight}。請在你的旁白中自然地提到這一點。`,
        "en-US": `\n\nProducer Note: ${memoryInsight}. Acknowledge this in your narration naturally.`
      };
      prompt += insightPrompts[language];
    }

    const requestPrompts = {
      "zh-CN": "\n\n请用1-2句自然的话评论这首歌，然后自然过渡到下一首。",
      "zh-HK": "\n\n請用1-2句自然嘅說話評論呢首歌，然後自然過渡到下一首。",
      "en-US": "\n\nPlease comment on this song in 1-2 natural sentences, then transition naturally to the next track."
    };

    prompt += requestPrompts[language];

    return prompt;
  }

  // Trivia user prompt
  private getTriviaUserPrompt(song: SongWiki, language: DJLanguage): string {
    const prompts = {
      "zh-CN": `歌曲：${song.artist}的《${song.title}》\n专辑：《${song.album}》\n背景：${song.explanation || "暂无"}\n\n请分享一个关于这首歌的有趣冷知识或小故事，只用1句话。`,
      "zh-HK": `歌曲：${song.artist}嘅《${song.title}》\n專輯：《${song.album}》\n背景：${song.explanation || "暫無"}\n\n請分享一個關於呢首歌嘅有趣冷知識或小故事，只用1句話。`,
      "en-US": `Song: ${song.title} by ${song.artist}\nAlbum: ${song.album}\nContext: ${song.explanation || "None"}\n\nPlease share an interesting trivia or small story about this song, in just 1 sentence.`
    };

    return prompts[language];
  }

  // Fallback intro templates
  private getFallbackIntro(song: SongWiki, style: DJStyle, language: DJLanguage): string {
    const templates = {
      "zh-CN": {
        classic: [
          `接下来这首，${song.artist}的《${song.title}》，经典中的经典，一起听听。`,
          `${song.artist}的《${song.title}》，收录在《${song.album}》里，希望你喜欢。`
        ],
        night: [
          `夜深了，来听${song.artist}的《${song.title}》，旋律很舒服。`,
          `${song.artist}的《${song.title}》，适合现在安静的氛围，听听看。`
        ],
        vibe: [
          `来了！${song.artist}的《${song.title}》，节奏很棒，一起跟着动起来！`,
          `${song.artist}的《${song.title}》，超有感觉的一首歌，现在播放！`
        ],
        trivia: [
          `考考你，${song.artist}的《${song.title}》背后有个有趣的故事，听听看。`,
          `关于${song.artist}的《${song.title}》，有个小秘密，等下告诉你。`
        ]
      },
      "zh-HK": {
        classic: [
          `接下來呢首，${song.artist}嘅《${song.title}》，經典中嘅經典，一齊聽聽。`,
          `${song.artist}嘅《${song.title}》，收錄喺《${song.album}》入面，希望你鐘意。`
        ],
        night: [
          `夜靜了，來聽${song.artist}嘅《${song.title}》，旋律好舒服。`,
          `${song.artist}嘅《${song.title}》，適合而家安靜嘅氛圍，聽聽睇。`
        ],
        vibe: [
          `嚟啦！${song.artist}嘅《${song.title}》，節奏好正，一齊跟住郁！`,
          `${song.artist}嘅《${song.title}》，超有feel嘅一首歌，而家播放！`
        ],
        trivia: [
          `考下你，${song.artist}嘅《${song.title}》背後有個有趣嘅故事，聽聽睇。`,
          `關於${song.artist}嘅《${song.title}》，有個小秘密，等陣話你知。`
        ]
      },
      "en-US": {
        classic: [
          `Up next, ${song.title} by ${song.artist}, a true classic. Let's listen.`,
          `${song.title} by ${song.artist}, from ${song.album}. Hope you enjoy.`
        ],
        night: [
          `Late night vibes with ${song.title} by ${song.artist}, such a soothing melody.`,
          `${song.title} by ${song.artist}, perfect for this quiet moment. Give it a listen.`
        ],
        vibe: [
          `Here we go! ${song.title} by ${song.artist}, great rhythm, let's move!`,
          `${song.title} by ${song.artist}, such an amazing track. Playing now!`
        ],
        trivia: [
          `Did you know? ${song.title} by ${song.artist} has an interesting backstory.`,
          `There's a fun fact about ${song.title} by ${song.artist}, I'll share it with you.`
        ]
      }
    };

    const langTemplates = templates[language];
    const styleTemplates = langTemplates[style] || langTemplates.classic;
    return styleTemplates[Math.floor(Math.random() * styleTemplates.length)];
  }

  // Fallback outro templates
  private getFallbackOutro(song: SongWiki, style: DJStyle, language: DJLanguage): string {
    const templates = {
      "zh-CN": {
        classic: [
          `${song.artist}的《${song.title}》听完了，经典就是经典。接下来，换一首。`,
          `《${song.title}》听完了，希望你喜欢。接下来继续。`
        ],
        night: [
          `${song.artist}的《${song.title}》听完了，晚安。`,
          `《${song.title}》结束了，希望你有个好梦。`
        ],
        vibe: [
          `${song.artist}的《${song.title}》太带感了！接下来继续嗨！`,
          `《${song.title}》听完了，过瘾！下一首更精彩！`
        ],
        trivia: [
          `${song.artist}的《${song.title}》背后的故事真有趣。接下来，继续听歌。`,
          `关于《${song.title}》的小秘密你发现了吗？接下来，换一首。`
        ]
      },
      "zh-HK": {
        classic: [
          `${song.artist}嘅《${song.title}》聽完咗，經典就係經典。接下來，換一首。`,
          `《${song.title}》聽完咗，希望你鐘意。接下來繼續。`
        ],
        night: [
          `${song.artist}嘅《${song.title}》聽完咗，晚安。`,
          `《${song.title}》結束咗，希望你有個好夢。`
        ],
        vibe: [
          `${song.artist}嘅《${song.title}》太有feel啦！接下來繼續嗨！`,
          `《${song.title}》聽完咗，過癮！下一首更精彩！`
        ],
        trivia: [
          `${song.artist}嘅《${song.title}》背後嘅故事真有趣。接下來，繼續聽歌。`,
          `關於《${song.title}》嘅小秘密你發現咗嗎？接下來，換一首。`
        ]
      },
      "en-US": {
        classic: [
          `That was ${song.title} by ${song.artist}, a true classic. Next up, something new.`,
          `Hope you enjoyed ${song.title}. Let's continue.`
        ],
        night: [
          `That concludes ${song.title} by ${song.artist}. Good night.`,
          `${song.title} has ended. Wishing you sweet dreams.`
        ],
        vibe: [
          `${song.title} by ${song.artist} was amazing! Let's keep the energy going!`,
          `That was ${song.title}! Awesome! Next one will be even better!`
        ],
        trivia: [
          `The story behind ${song.title} by ${song.artist} is fascinating. Let's continue listening.`,
          `Did you catch that fun fact about ${song.title}? Next track coming up.`
        ]
      }
    };

    const langTemplates = templates[language];
    const styleTemplates = langTemplates[style] || langTemplates.classic;
    return styleTemplates[Math.floor(Math.random() * styleTemplates.length)];
  }

  // Fallback trivia templates
  private getFallbackTrivia(song: SongWiki, style: DJStyle, language: DJLanguage): string {
    const templates = {
      "zh-CN": [
        `这首歌${song.title}录了整整一个月才完成。`,
        `${song.artist}在录这首歌时，其实改了好几版歌词。`,
        `《${song.title}》的前奏其实是后来加进去的。`
      ],
      "zh-HK": [
        `呢首歌${song.title}錄咗成個月先完成。`,
        `${song.artist}喺錄呢首歌時，其實改咗好幾版歌詞。`,
        `《${song.title}》嘅前奏其實係後來加進去嘅。`
      ],
      "en-US": [
        `This song ${song.title} took an entire month to record.`,
        `${song.artist} actually changed the lyrics several times while recording this song.`,
        `The intro to ${song.title} was actually added later.`
      ]
    };

    const langTemplates = templates[language];
    return langTemplates[Math.floor(Math.random() * langTemplates.length)];
  }
}
