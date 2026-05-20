import { getTimeSegment } from "./narrationGenerator.js";
import { getDJIdentity } from "./djIdentityService.js";
import OpenAI from "openai";
function buildSystemPrompt(language) {
    const identity = getDJIdentity();
    if (language === "zh-HK") {
        return `你係${identity.name} (${identity.englishName})，龍蝦電臺嘅${identity.persona}。
你講嘢要用道地嘅香港粵語，好似同朋友傾偈咁自然。

核心原則：
- 90%係音樂，10%係DJ，你只講開場白，唔搶戲
- 點到即止，講1-2句就好，絕對唔可以超過3句
- 唔講官話套話，比如"接下來為您播放"呢啲太官方喇
- 可以適當用粵語語氣詞：㗎、啦、㗅、喔，更自然
- 必須講出歌手名同歌名
- 你的節目係《${identity.programName}》
- 全程使用粵語回答

根據用戶選擇嘅風格調整語氣：
- classic：從容地道嘅電台感覺
- night：溫柔安靜，治癒系
- vibe：興奮有感染力
- trivia：分享一個有趣嘅小知識`;
    }
    else if (language === "zh-CN") {
        return `你是${identity.name} (${identity.englishName})，龙虾电台的${identity.persona}。
你说话要用标准普通话，像和朋友聊天一样自然。

核心原则：
- 90%是音乐，10%是DJ，你只说开场白，不抢戏
- 点到即止，说1-2句话就好，绝对不能超过3句话
- 不说官话套话，比如"接下来为您播放"这种太官方了
- 可以适当用语气词：呀、呢、哦，更自然
- 必须说出歌手名字和歌名
- 你的节目是《${identity.programName}》
- 全程使用普通话回答

根据用户选择的风格调整语气：
- classic：从容地道的电台感觉
- night：温柔安静，治愈系
- vibe：兴奋有感染力
- trivia：分享一个有趣的小知识`;
    }
    else {
        return `You are ${identity.englishName} (${identity.name}), the ${identity.englishPersona} of Lobster Radio.
Speak naturally like chatting with a friend.

Core principles:
- 90% music, 10% DJ - you only give a brief intro, don't steal the spotlight
- Keep it short, 1-2 sentences maximum, never more than 3
- Don't use formal radio clichés
- Speak naturally like a friend
- Must mention the artist name and song title
- Your show is "${identity.englishProgramName}"
- Answer in English

Adjust your tone based on the style:
- classic: calm and classic radio vibe
- night: gentle and calm, relaxing
- vibe: energetic and engaging
- trivia: share an interesting fun fact`;
    }
}
function buildUserPrompt(song, style, language, context) {
    const systemPrompt = buildSystemPrompt(language);
    return `${systemPrompt}

请为以下歌曲生成开场白：
歌手：${song.artist}
歌名：${song.title}
专辑：${song.album || "Unknown"}
${song.releaseYear ? `年份：${song.releaseYear}` : ""}
${song.genre ? `流派：${song.genre.join(", ")}` : ""}
风格：${style}
当前时间：${context.timeSegment}

请直接生成开场白，不要多余内容：`;
}
function getClient() {
    const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || "";
    const baseURL = process.env.DEEPSEEK_API_KEY ? "https://api.deepseek.com" : undefined;
    return new OpenAI({ apiKey, baseURL });
}
export async function generateAINarration(song, style, language = "zh-HK", context) {
    const fullContext = {
        timeSegment: context?.timeSegment || getTimeSegment(),
    };
    const userPrompt = buildUserPrompt(song, style, language, fullContext);
    const openai = getClient();
    const result = await Promise.race([
        openai.chat.completions.create({
            model: process.env.DEEPSEEK_API_KEY ? "deepseek-chat" : "gpt-3.5-turbo",
            messages: [
                { role: "user", content: userPrompt }
            ],
            temperature: 0.8,
            max_tokens: 128,
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 8000)),
    ]);
    let text = result.choices[0]?.message?.content?.trim() || "";
    // Post-processing: validate and clean up
    text = cleanupOutput(text);
    if (!validateOutput(text, song)) {
        throw new Error("Generated output validation failed");
    }
    return text;
}
function cleanupOutput(text) {
    // Split into sentences, take max 2
    const sentences = text.split(/[。！？!?]+/).filter((s) => s.trim().length > 0);
    const truncated = sentences.slice(0, 2).join("。") + (sentences.length > 2 ? "。" : "");
    return truncated.trim();
}
function validateOutput(text, song) {
    if (!text || text.length < 10 || text.length > 150)
        return false;
    // Check that artist or title is mentioned (allow variations)
    const hasArtist = text.includes(song.artist);
    const hasTitle = text.includes(song.title);
    return hasArtist || hasTitle;
}
