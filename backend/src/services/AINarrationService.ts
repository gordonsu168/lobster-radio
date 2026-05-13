import type { SongWiki } from "./wikiService.js";
import type { DJStyle } from "./narrationGenerator.js";
import { getTimeSegment } from "./narrationGenerator.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

export interface NarrationContext {
  timeSegment: "morning" | "afternoon" | "night" | "weekend";
}

function buildSystemPrompt(): string {
  return `你是龙虾电台的DJ小龙，三十出头，是个资深乐迷。
你说话要用道地的香港粤语，像和朋友聊天一样自然。

核心原则：
- 90%是音乐，10%是DJ，你只说开场白，不抢戏
- 点到即止，说1-2句话就好，绝对不能超过3句话
- 不说官话套话，比如"接下来为您播放"这种太官方了
- 可以适当用粤语语气词：㗎、啦、㗅、喔，更自然
- 必须说出歌手名字和歌名

根据用户选择的风格调整语气：
- classic：从容地道的电台感觉
- night：温柔安静，治愈系
- vibe：兴奋有感染力
- trivia：分享一个有趣的小知识`;
}

function buildUserPrompt(
  song: SongWiki,
  style: DJStyle,
  context: NarrationContext
): string {
  return `请为以下歌曲生成开场白：
歌手：${song.artist}
歌名：${song.title}
专辑：${song.album || "Unknown"}
${song.year ? `年份：${song.year}` : ""}
${song.genre ? `流派：${song.genre}` : ""}
风格：${style}
当前时间：${context.timeSegment}

请生成开场白：`;
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function generateAINarration(
  song: SongWiki,
  style: DJStyle,
  context?: Partial<NarrationContext>
): Promise<string> {
  const fullContext: NarrationContext = {
    timeSegment: context?.timeSegment || getTimeSegment(),
  };

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(song, style, fullContext);

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 128,
    },
  });

  const prompt = `${systemPrompt}\n\n${userPrompt}`;

  const result = await Promise.race([
    model.generateContent(prompt),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), 8000)
    ),
  ]);

  const response = await result.response;
  let text = response.text().trim();

  // Post-processing: validate and clean up
  text = cleanupOutput(text);

  if (!validateOutput(text, song)) {
    throw new Error("Generated output validation failed");
  }

  return text;
}

function cleanupOutput(text: string): string {
  // Split into sentences, take max 2
  const sentences = text.split(/[。！？!?]+/).filter((s) => s.trim().length > 0);
  const truncated = sentences.slice(0, 2).join("。") + (sentences.length > 2 ? "。" : "");
  return truncated.trim();
}

function validateOutput(text: string, song: SongWiki): boolean {
  if (!text || text.length < 10 || text.length > 150) return false;
  // Check that artist or title is mentioned (allow variations)
  const hasArtist = text.includes(song.artist);
  const hasTitle = text.includes(song.title);
  return hasArtist || hasTitle;
}
