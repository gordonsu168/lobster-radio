import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createOptionalModel } from "../lib/model.js";
import type { MoodOption } from "../types.js";

interface MoodAnalyzerInput {
  selectedMood: MoodOption;
  timeOfDay: string;
  weatherApiKey?: string;
}

export class MoodAnalyzerAgent {
  async analyze(input: MoodAnalyzerInput): Promise<{ summary: string }> {
    const model = createOptionalModel();

    if (!model) {
      // 中文 fallback 模板
      const templates: Record<string, string[]> = {
        morning: [
          `朝早${input.selectedMood}模式，呢个时间段最适合听啲轻快嘅歌唤醒自己。`,
          `而家系早上，听众选择咗${input.selectedMood}模式，播啲有活力嘅歌开始美好嘅一日。`,
        ],
        afternoon: [
          `晏昼${input.selectedMood}模式，呢个时间段嚟首轻松嘅歌提下神啦。`,
          `下昼时间，${input.selectedMood}模式开启，俾啲音乐陪你度过下昼时光。`,
        ],
        evening: [
          `晚黑${input.selectedMood}模式，呢个时间最适合听啲舒缓嘅歌放松一下。`,
          `夜幕降临，听众开启咗${input.selectedMood}模式，等音乐陪你结束呢一日。`,
        ],
        "late night": [
          `深夜${input.selectedMood}模式，夜猫子专属时间，听啲慢歌放松心情。`,
          `夜深人静，${input.selectedMood}模式开启，呢个时间只属于你同音乐。`,
        ],
      };

      const timeTemplates = templates[input.timeOfDay] || templates.evening;
      return {
        summary: timeTemplates[Math.floor(Math.random() * timeTemplates.length)]
      };
    }

    const result = await model.invoke([
      new SystemMessage(
        `你系龙虾电台嘅心情分析师，用纯正粤语总结听众嘅收听状态，1-2句就得，亲切自然，似同朋友倾计。`
      ),
      new HumanMessage(
        `听众选择嘅心情模式：${input.selectedMood}\n时间段：${input.timeOfDay}\n有冇天气API：${Boolean(input.weatherApiKey)}\n\n请用粤语总结听众而家嘅收听状态，1-2句就得。`
      )
    ]);

    return {
      summary: typeof result.content === "string" ? result.content : JSON.stringify(result.content)
    };
  }
}
