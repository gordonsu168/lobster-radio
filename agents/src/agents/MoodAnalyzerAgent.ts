import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createOptionalModel } from "../lib/model.js";
import type { DJLanguage, MoodOption } from "../types.js";

interface MoodAnalyzerInput {
  selectedMood: MoodOption;
  timeOfDay: string;
  weatherApiKey?: string;
  language?: DJLanguage;
}

export class MoodAnalyzerAgent {
  async analyze(input: MoodAnalyzerInput): Promise<{ summary: string }> {
    const model = createOptionalModel();
    const language = input.language || "zh-HK";

    if (!model) {
      return { summary: this.getFallbackTemplate(input.selectedMood, input.timeOfDay, language) };
    }

    const systemPrompt = this.getSystemPrompt(language);
    const userPrompt = this.getUserPrompt(input, language);

    const result = await model.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt)
    ]);

    return {
      summary: typeof result.content === "string" ? result.content : JSON.stringify(result.content)
    };
  }

  private getFallbackTemplate(mood: MoodOption, timeOfDay: string, language: DJLanguage): string {
    const templates = {
      "zh-HK": {
        morning: [
          `朝早${mood}模式，呢个时间段最适合听啲轻快嘅歌唤醒自己。`,
          `而家系早上，听众选择咗${mood}模式，播啲有活力嘅歌开始美好嘅一日。`,
        ],
        afternoon: [
          `晏昼${mood}模式，呢个时间段嚟首轻松嘅歌提下神啦。`,
          `下昼时间，${mood}模式开启，俾啲音乐陪你度过下昼时光。`,
        ],
        evening: [
          `晚黑${mood}模式，呢个时间最适合听啲舒缓嘅歌放松一下。`,
          `夜幕降临，听众开启咗${mood}模式，等音乐陪你结束呢一日。`,
        ],
        "late night": [
          `深夜${mood}模式，夜猫子专属时间，听啲慢歌放松心情。`,
          `夜深人静，${mood}模式开启，呢个时间只属于你同音乐。`,
        ],
      },
      "zh-CN": {
        morning: [
          `早上${mood}模式，这个时间段最适合听些轻快的歌唤醒自己。`,
          `现在是早上，听众选择了${mood}模式，播些有活力的歌开始美好的一天。`,
        ],
        afternoon: [
          `下午${mood}模式，这个时间段来首轻松的歌提提神吧。`,
          `下午时间，${mood}模式开启，让音乐陪你度过下午时光。`,
        ],
        evening: [
          `晚上${mood}模式，这个时间最适合听些舒缓的歌放松一下。`,
          `夜幕降临，听众开启了${mood}模式，让音乐陪你结束这一天。`,
        ],
        "late night": [
          `深夜${mood}模式，夜猫子专属时间，听些慢歌放松心情。`,
          `夜深人静，${mood}模式开启，这个时间只属于你和音乐。`,
        ],
      },
      "en-US": {
        morning: [
          `Good morning! ${mood} mode is perfect for this time of day with some upbeat tunes to wake you up.`,
          `It's morning time, and you've selected ${mood} mode. Let's start your day with some energizing music.`,
        ],
        afternoon: [
          `Afternoon ${mood} mode - time for some relaxing tunes to refresh your mind.`,
          `It's afternoon, ${mood} mode is on. Let the music accompany you through the day.`,
        ],
        evening: [
          `Evening ${mood} mode - perfect time for some soothing songs to unwind.`,
          `As night falls, you've activated ${mood} mode. Let music help you wind down.`,
        ],
        "late night": [
          `Late night ${mood} mode - night owl special with some slow jams to relax.`,
          `Deep into the night, ${mood} mode is on. This time belongs to you and the music.`,
        ],
      },
    };

    const langTemplates = templates[language];
    const timeTemplates = langTemplates[timeOfDay as keyof typeof langTemplates] || langTemplates.evening;
    return timeTemplates[Math.floor(Math.random() * timeTemplates.length)];
  }

  private getSystemPrompt(language: DJLanguage): string {
    const prompts = {
      "zh-HK": "你系龙虾电台嘅心情分析师，用纯正粤语总结听众嘅收听状态，1-2句就得，亲切自然，似同朋友倾计。",
      "zh-CN": "你是龙虾电台的心情分析师，用普通话总结听众的收听状态，1-2句就好，亲切自然，像和朋友聊天一样。",
      "en-US": "You are a mood analyst for Lobster Radio. Summarize the listener's current state in 1-2 sentences, friendly and natural, like talking to a friend.",
    };
    return prompts[language];
  }

  private getUserPrompt(input: MoodAnalyzerInput, language: DJLanguage): string {
    const prompts = {
      "zh-HK": `听众选择嘅心情模式：${input.selectedMood}\n时间段：${input.timeOfDay}\n有冇天气API：${Boolean(input.weatherApiKey)}\n\n请用粤语总结听众而家嘅收听状态，1-2句就得。`,
      "zh-CN": `听众选择的心情模式：${input.selectedMood}\n时间段：${input.timeOfDay}\n是否有天气API：${Boolean(input.weatherApiKey)}\n\n请用普通话总结听众现在的收听状态，1-2句就好。`,
      "en-US": `Listener's mood mode: ${input.selectedMood}\nTime of day: ${input.timeOfDay}\nWeather API available: ${Boolean(input.weatherApiKey)}\n\nPlease summarize the listener's current state in 1-2 sentences.`,
    };
    return prompts[language];
  }
}
