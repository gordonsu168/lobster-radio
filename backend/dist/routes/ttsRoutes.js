import { Router } from "express";
import { synthesizeSpeech } from "../services/ttsService.js";
export const ttsRouter = Router();
ttsRouter.post("/", async (req, res) => {
    const { text, voice, provider, emotion, apiKey, language } = req.body;
    const payload = await synthesizeSpeech(text, voice, { provider, emotion, apiKey, language });
    res.json(payload);
});
// 获取支持的情绪列表
ttsRouter.get("/emotions", (req, res) => {
    res.json({
        emotions: [
            { id: "normal", name: "正常", description: "标准语调" },
            { id: "happy", name: "开心", description: "欢快、愉悦的语气" },
            { id: "sad", name: "悲伤", description: "低沉、悲伤的语气" },
            { id: "angry", name: "愤怒", description: "激动、有力的语气" },
            { id: "calm", name: "平静", description: "放松、舒缓的语气" },
            { id: "excited", name: "兴奋", description: "充满活力、热情的语气" },
            { id: "whisper", name: "耳语", description: "低声、私密的语气" },
            { id: "radio", name: "电台风", description: "专业电台主持人风格" },
        ],
        voices: [
            { id: "rachel", name: "Rachel - 温暖女声", lang: "en" },
            { id: "drew", name: "Drew - 成熟女声", lang: "en" },
            { id: "clara", name: "Clara - 柔和女声", lang: "en" },
            { id: "sarah", name: "Sarah - 自然女声", lang: "en" },
            { id: "paul", name: "Paul - 磁性男声", lang: "en" },
            { id: "josh", name: "Josh - 活力男声", lang: "en" },
            { id: "antoni", name: "Antoni - 温柔男声", lang: "en" },
            { id: "elliot", name: "Elliot - 年轻男声", lang: "en" },
            { id: "lily", name: "Lily - 中文女声", lang: "zh" },
        ]
    });
});
