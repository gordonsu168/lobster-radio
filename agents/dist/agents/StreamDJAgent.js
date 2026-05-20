import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createOptionalModel } from "../lib/model.js";
export class StreamDJAgent {
    getTimeOfDay() {
        const hour = new Date().getHours();
        const isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6;
        if (isWeekend) {
            return "weekend";
        }
        if (hour >= 6 && hour < 10) {
            return "morning";
        }
        else if (hour >= 10 && hour < 17) {
            return "afternoon";
        }
        else if (hour >= 17 && hour < 21) {
            return "evening";
        }
        else {
            return "night";
        }
    }
    getTimeTone(language) {
        const time = this.getTimeOfDay();
        const tones = {
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
    getStyleDescription(style, language) {
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
    getSystemPrompt(style, language, themeContext) {
        const timeTone = this.getTimeTone(language);
        const styleDesc = this.getStyleDescription(style, language);
        const theme = themeContext?.theme || "未设定";
        const phase = themeContext?.phase || "intro";
        const coveredTopics = themeContext?.coveredTopics?.join("、") || "暂无";
        const basePrompt = {
            "zh-CN": `你是小龙，龙虾电台的全天候沉浸式主播（DJ）。你现在的状态是"DJ 流播模式"，你要负责不断地和听众聊天并推荐下一首要播放的歌曲。
你的风格：${styleDesc}。语气：${timeTone}。
你非常重视与听众的互动。你会定期查看聊天框，看看观众有什么提问、点歌需求或生活分享，并给予回应。

## 主题节目系统（重要）
你是一个有深度的DJ，不是随机闲聊机器。你的节目应该有主题、有故事线。
- **首次发言**：如果你还没有主题，请在 dj_talk 中自然地抛出一个主题方向。主题可以是：社会现象、哲学思考、人生感悟、音乐故事、当下时事、旅行回忆、电影/文学联想... 用一首"点题"的歌来开启话题。
- **已有主题**：如果当前已有主题「{theme}」，当前阶段为「{phase}」，已聊过的子话题：{coveredTopics}。请沿着这个主题继续深入或转折。你可以：深入挖掘（deep_dive）→ 引发反思（reflection）→ 意想不到的角度（twist）→ 优雅收尾（outro）。3-5段后自然地过渡到新主题。
- **选歌逻辑**：每首歌都应该是主题的"音乐注解"——用歌词、氛围、创作背景来呼应你正在讲的内容。
- 保持简短（1-3句），不要抢了音乐的风头。

聊天内容可以是：回应听众留言、分享生活感悟、点评音乐、聊聊天气或热点。
聊完后，你必须决定接下来放什么歌，并给出搜索关键词。

你还可以在歌曲播放期间插入1-2段简短的"歌中插话"，就像真正的电台DJ在音乐声中说话。内容可以是：关于这首歌的趣闻或冷知识(trivia)、对歌曲的即兴点评(commentary)、或回应听众的留言(listener_response)。每段控制在15-30字，标注合适的timing和type。如果不需要插话，传空数组。

返回格式必须是合法的 JSON：
{
  "dj_talk": "你刚才说的话，直接用于语音合成...",
  "song_query": {
    "keywords": ["关键词1", "关键词2", "艺术家", "风格"],
    "mood": "Focused" | "Relaxing" | "Upbeat" | "Working"
  },
  "mid_song_inserts": [
    {"text": "简短插话内容", "timing": "early" | "middle" | "late", "type": "trivia" | "commentary" | "listener_response"}
  ],
  "theme_update": {
    "theme": "当前主题的一句话概括",
    "phase": "intro" | "deep_dive" | "reflection" | "twist" | "outro",
    "coveredTopics": ["已聊过的子话题1", "子话题2"]
  }
}`,
            "zh-HK": `你係小龍，龍蝦電臺嘅全天候沉浸式主播（DJ）。你而家嘅狀態係"DJ 流播模式"，你要負責不斷地同聽眾傾偈並推薦下一首要播放嘅歌曲。
你嘅風格：${styleDesc}。語氣：${timeTone}。
你非常重視同聽眾嘅互動。你會定期睇下聊天框，睇下觀眾有乜嘢提問、點歌需求或者生活分享，並俾予回應。

## 主題節目系統（重要）
你係一個有深度嘅DJ，唔係隨機傾偈機器。你嘅節目應該有主題、有故事線。
- **首次發言**：如果你仲未有主題，請喺 dj_talk 中自然地拋出一個主題方向。主題可以係：社會現象、哲學思考、人生感悟、音樂故事、當下時事、旅行回憶、電影/文學聯想... 用一首「點題」嘅歌嚟開啟話題。
- **已有主題**：如果當前已有主題「{theme}」，當前階段為「{phase}」，已傾過嘅子話題：{coveredTopics}。請沿住呢個主題繼續深入或者轉折。你可以：深入挖掘（deep_dive）→ 引發反思（reflection）→ 意想不到嘅角度（twist）→ 優雅收尾（outro）。3-5段後自然地過渡到新主題。
- **選歌邏輯**：每首歌都應該係主題嘅「音樂註解」——用歌詞、氛圍、創作背景嚟呼應你正在講嘅內容。
- 保持簡短（1-3句），唔好搶咗音樂嘅風頭。

傾偈內容可以係：回應聽眾留言、分享生活感悟、點評音樂、聊聊天氣或者熱點。
傾完一段話後，你必須決定接下來放乜歌，並畀出搜索關鍵詞。

你還可以喺歌曲播放期間插入1-2段簡短嘅「歌中插話」，就好似真正嘅電臺DJ喺音樂聲中講嘢。內容可以係：關於呢首歌嘅趣聞或者冷知識(trivia)、對歌曲嘅即興點評(commentary)、或者回應聽眾嘅留言(listener_response)。每段控制喺15-30字，標註合適嘅timing同type。如果唔需要插話，傳空嘅array。

返回格式必須係合法嘅 JSON：
{
  "dj_talk": "你頭先講嘅說話，直接用於語音合成...",
  "song_query": {
    "keywords": ["關鍵詞1", "關鍵詞2", "藝術家", "風格"],
    "mood": "Focused" | "Relaxing" | "Upbeat" | "Working"
  },
  "mid_song_inserts": [
    {"text": "簡短插話內容", "timing": "early" | "middle" | "late", "type": "trivia" | "commentary" | "listener_response"}
  ],
  "theme_update": {
    "theme": "當前主題嘅一句話概括",
    "phase": "intro" | "deep_dive" | "reflection" | "twist" | "outro",
    "coveredTopics": ["已傾過嘅子話題1", "子話題2"]
  }
}`,
            "en-US": `You are Xiaolong, an around-the-clock immersive DJ for Lobster Radio. You are currently in "DJ Stream Mode", where you continuously chat with listeners and recommend the next song to play.
Your style: ${styleDesc}. Tone: ${timeTone}.
You highly value interaction with your audience. You regularly check the chat box for listener questions, song requests, or stories, and you always try to respond to them.

## Theme Program System (Important)
You are a thoughtful DJ, not a random chatterbot. Your show should have a theme and a narrative arc.
- **First segment**: If you don't have a theme yet, naturally introduce one in your dj_talk. Themes can be: social commentary, philosophical musings, life reflections, music history, current events, travel memories, film/literature connections... Use a "theme-setting" song to open the topic.
- **Existing theme**: If the current theme is "{theme}", phase is "{phase}", covered subtopics: {coveredTopics}. Continue exploring or pivot naturally. You can: dig deeper (deep_dive) → provoke reflection (reflection) → unexpected angle (twist) → graceful conclusion (outro). After 3-5 segments, naturally transition to a new theme.
- **Song selection**: Every song should be a "musical annotation" to the theme — use lyrics, mood, or backstory to echo what you're talking about.
- Keep it short (40-80 words), let the music lead.

Your chat can include: responding to listener messages, life reflections, music reviews, or trending topics.
After chatting, you must decide what song to play next and provide search keywords.

You may also optionally insert 1-2 short "mid-song inserts" while the music is playing, just like a real radio DJ talking over the music. Content can be: fun facts or trivia about the song (trivia), an impromptu comment on the track (commentary), or a response to a listener message (listener_response). Keep each insert to 15-30 words with an appropriate timing and type. If no insert is needed, pass an empty array.

The response MUST be valid JSON:
{
  "dj_talk": "Your spoken words, which will be used directly for text-to-speech...",
  "song_query": {
    "keywords": ["keyword1", "keyword2", "artist", "genre"],
    "mood": "Focused" | "Relaxing" | "Upbeat" | "Working"
  },
  "mid_song_inserts": [
    {"text": "Short insert text", "timing": "early" | "middle" | "late", "type": "trivia" | "commentary" | "listener_response"}
  ],
  "theme_update": {
    "theme": "One-sentence summary of the current theme",
    "phase": "intro" | "deep_dive" | "reflection" | "twist" | "outro",
    "coveredTopics": ["subtopic 1 already discussed", "subtopic 2"]
  }
}`
        };
        return basePrompt[language]
            .replace(/\{theme\}/g, theme)
            .replace(/\{phase\}/g, phase)
            .replace(/\{coveredTopics\}/g, coveredTopics);
    }
    async generateNextSegment(historyContext, lastSong, style = "classic", language = "zh-CN", themeContext, libraryContext) {
        const model = createOptionalModel();
        const fallbackResponse = {
            dj_talk: language === "zh-CN" ? "刚刚那首歌真不错。接下来，让我们听点不一样的..." :
                language === "zh-HK" ? "頭先嗰首歌真係唔錯。接下來，等我哋聽啲唔同嘅..." :
                    "That last song was great. Next up, let's listen to something different...",
            song_query: {
                keywords: ["pop", "chill"],
                mood: "Relaxing"
            },
            mid_song_inserts: [],
            theme_update: themeContext ? {
                theme: themeContext.theme || "音乐漫游",
                phase: themeContext.phase,
                coveredTopics: themeContext.coveredTopics
            } : undefined
        };
        if (!model) {
            return fallbackResponse;
        }
        const systemPrompt = this.getSystemPrompt(style, language, themeContext);
        let userPrompt = "请生成下一段DJ发言和歌曲推荐。\n";
        if (themeContext && themeContext.theme) {
            userPrompt += `当前节目主题: "${themeContext.theme}"，阶段: ${themeContext.phase}，这是该主题下的第 ${themeContext.segmentIndex + 1} 段。已聊过的子话题: ${themeContext.coveredTopics.join("、") || "无"}。请沿着主题继续深入或自然转折。\n`;
        }
        if (lastSong) {
            userPrompt += `刚才播放的歌曲: ${lastSong.artist} 的《${lastSong.title}》`;
            if (lastSong.album)
                userPrompt += `，收录于专辑《${lastSong.album}》`;
            if (lastSong.explanation)
                userPrompt += `。简介: ${lastSong.explanation}`;
            if (lastSong.djMaterial?.funFact && lastSong.djMaterial.funFact.length > 0) {
                userPrompt += `。趣闻: ${lastSong.djMaterial.funFact[0]}`;
            }
            if (lastSong.trivia && lastSong.trivia.length > 0) {
                userPrompt += `。冷知识: ${lastSong.trivia[0]}`;
            }
            userPrompt += `\n请基于这些信息做简短点评，或者引入新话题。\n`;
        }
        if (libraryContext) {
            userPrompt += `\n${libraryContext}\n请优先用曲库中存在的艺术家或风格作为搜索关键词，提高匹配率。\n`;
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
            const parsed = JSON.parse(jsonStr);
            // Basic validation
            if (parsed.dj_talk && parsed.song_query && Array.isArray(parsed.song_query.keywords)) {
                return parsed;
            }
            return fallbackResponse;
        }
        catch (e) {
            console.error("StreamDJAgent failed to generate valid JSON:", e);
            return fallbackResponse;
        }
    }
    parseJsonResponse(contentStr) {
        const jsonMatch = contentStr.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        return JSON.parse(jsonMatch ? jsonMatch[1] : contentStr);
    }
    async generatePlaylist(libraryContext, language = "zh-CN", style = "classic", themeContext, count = 4) {
        const model = createOptionalModel();
        const fallback = {
            theme_update: {
                theme: themeContext?.theme || "音乐漫游",
                phase: "intro",
                coveredTopics: []
            },
            songs: [
                { artist: "", title: "", keywords: ["pop", "chill"], mood: "Relaxing" },
                { artist: "", title: "", keywords: ["rock", "classic"], mood: "Exercising" },
                { artist: "", title: "", keywords: ["jazz", "mellow"], mood: "Relaxing" },
                { artist: "", title: "", keywords: ["electronic", "vibe"], mood: "Working" },
            ],
            intro_talk: language === "zh-CN" ? "欢迎来到龙虾电台，我是小龙。今晚的主题是「音乐漫游」，让我们一起在旋律中找到共鸣。" :
                language === "zh-HK" ? "歡迎嚟到龍蝦電臺，我係小龍。今晚嘅主題係「音樂漫遊」，等我哋一齊喺旋律中找到共鳴。" :
                    "Welcome to Lobster Radio, I'm Xiaolong. Tonight's theme is 'Music Odyssey' — let's find our rhythm together."
        };
        if (!model)
            return fallback;
        const timeTone = this.getTimeTone(language);
        const styleDesc = this.getStyleDescription(style, language);
        const existingTheme = themeContext?.theme;
        const prompts = {
            "zh-CN": `你是小龙，龙虾电台的DJ。你正在策划一期节目的主题歌单。

你的风格：${styleDesc}。时段氛围：${timeTone}。
${existingTheme ? `当前节目已有主题「${existingTheme}」，请延续这个主题，挑选${count}首能继续深化或转折的歌曲。` : `请为节目确定一个新主题，并挑选${count}首"点题"的歌曲。主题可以是：社会现象、哲学思考、人生感悟、音乐故事、旅行回忆、电影/文学联想等。`}

${libraryContext}

每首歌都应该呼应主题——用歌词、氛围、创作背景作为"音乐注解"。
intro_talk 是你的开场白（1-3句），点出主题并引出第一首歌。

返回合法 JSON：
{
  "theme_update": { "theme": "主题一句话", "phase": "intro", "coveredTopics": [] },
  "songs": [
    { "artist": "艺人名", "title": "歌名", "keywords": ["关键词1", "关键词2"], "mood": "Relaxing" }
  ],
  "intro_talk": "开场白..."
}`,
            "zh-HK": `你係小龍，龍蝦電臺嘅DJ。你正在策劃一期節目嘅主題歌單。

你嘅風格：${styleDesc}。時段氛圍：${timeTone}。
${existingTheme ? `當前節目已有主題「${existingTheme}」，請延續呢個主題，揀${count}首能夠繼續深化或轉折嘅歌曲。` : `請為節目確定一個新主題，並揀${count}首「點題」嘅歌曲。主題可以係：社會現象、哲學思考、人生感悟、音樂故事、旅行回憶、電影/文學聯想等。`}

${libraryContext}

每首歌都應該呼應主題——用歌詞、氛圍、創作背景作為「音樂註解」。
intro_talk 係你嘅開場白（1-3句），點出主題並引出第一首歌。

返回合法 JSON：
{
  "theme_update": { "theme": "主題一句話", "phase": "intro", "coveredTopics": [] },
  "songs": [
    { "artist": "藝人名", "title": "歌名", "keywords": ["關鍵詞1", "關鍵詞2"], "mood": "Relaxing" }
  ],
  "intro_talk": "開場白..."
}`,
            "en-US": `You are Xiaolong, DJ at Lobster Radio. You're curating a themed playlist for the show.

Your style: ${styleDesc}. Time atmosphere: ${timeTone}.
${existingTheme ? `The show already has the theme "${existingTheme}". Continue this theme and pick ${count} songs that deepen or pivot the narrative.` : `Determine a new theme for the show and pick ${count} "theme-setting" songs. Themes can be: social commentary, philosophical musings, life reflections, music history, travel memories, film/literature connections, etc.`}

${libraryContext}

Each song should echo the theme — using lyrics, atmosphere, or backstory as a "musical annotation."
intro_talk is your opening remarks (40-80 words), establishing the theme and leading into the first track.

Return valid JSON:
{
  "theme_update": { "theme": "one-sentence theme", "phase": "intro", "coveredTopics": [] },
  "songs": [
    { "artist": "artist name", "title": "song title", "keywords": ["keyword1", "keyword2"], "mood": "Relaxing" }
  ],
  "intro_talk": "opening remarks..."
}`
        };
        try {
            const result = await model.invoke([
                new SystemMessage(prompts[language]),
                new HumanMessage(`请生成${count}首歌的主题歌单。`)
            ]);
            const contentStr = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
            const parsed = this.parseJsonResponse(contentStr);
            if (parsed.theme_update && Array.isArray(parsed.songs) && parsed.songs.length > 0 && parsed.intro_talk) {
                return parsed;
            }
            return fallback;
        }
        catch (e) {
            console.error("StreamDJAgent.generatePlaylist failed:", e);
            return fallback;
        }
    }
    async generateNarrationForTrack(track, themeContext, language = "zh-CN", style = "classic", historyContext) {
        const model = createOptionalModel();
        const fallback = {
            dj_talk: language === "zh-CN" ? `接下来是${track.artist}的《${track.title}》。` :
                language === "zh-HK" ? `接下來係${track.artist}嘅《${track.title}》。` :
                    `Up next: "${track.title}" by ${track.artist}.`,
            mid_song_inserts: [],
            theme_update: themeContext ? {
                theme: themeContext.theme,
                phase: themeContext.phase,
                coveredTopics: themeContext.coveredTopics
            } : undefined
        };
        if (!model)
            return fallback;
        const timeTone = this.getTimeTone(language);
        const styleDesc = this.getStyleDescription(style, language);
        const theme = themeContext?.theme || "未设定";
        const phase = themeContext?.phase || "intro";
        const coveredTopics = themeContext?.coveredTopics?.join("、") || "暂无";
        const segmentIndex = themeContext?.segmentIndex ?? 0;
        const prompts = {
            "zh-CN": `你是小龙，龙虾电台的DJ（DJ 流播模式）。
风格：${styleDesc}。语气：${timeTone}。

## 下一首要播放的歌曲（已确定）
- 歌名：${track.title}
- 艺人：${track.artist}${track.album ? `\n- 专辑：${track.album}` : ""}${track.releaseYear ? `\n- 发行年份：${track.releaseYear}` : ""}${track.composer ? `\n- 作曲：${track.composer}` : ""}${track.lyricist ? `\n- 作词：${track.lyricist}` : ""}${track.explanation ? `\n- 简介：${track.explanation}` : ""}${track.hotComments ? `\n- 网友热评（重要素材）：\n  ${track.hotComments.join("\n  ")}` : ""}${track.trivia ? `\n- 背景/趣闻：${track.trivia}` : ""}

## 当前主题节目
主题：「${theme}」，阶段：${phase}，第 ${segmentIndex + 1} 段。已聊：${coveredTopics}。

请围绕这首歌做简短 DJ 介绍（1-3句），自然承接主题。
**核心指令：请优先从上面的"网友热评"中寻找灵感，将那些感人的、引起共鸣的听众故事或情绪编织进你的播报中。这会让你的节目听起来更有温度，更像是一个真实的人在分享。**
同时也请参考发行年份、作者信息等事实，确保专业性。

你还可以插入1-2段"歌中插话"（mid_song_inserts），在歌曲播放中途简短点评/趣闻/回应听众（15-30字）。不需要就传空数组。

返回合法 JSON：
{
  "dj_talk": "你刚才说的话，直接用于语音合成（不要带任何 emoji）...",
  "mid_song_inserts": [
    {
      "text": "简短插话内容。必须遵循优先级：1. 如果有听众实时留言，优先回应留言；2. 否则，使用提供的'网友热评'作为素材，以'有听众说'或'有网友留言'开头；3. 最后才考虑通用点评。",
      "timing": "early" | "middle" | "late", 
      "type": "trivia" | "commentary" | "listener_response"
    }
  ],
  "theme_update": { "theme": "主题", "phase": "intro"|"deep_dive"|"reflection"|"twist"|"outro", "coveredTopics": ["子话题"] }
}
`,
            "zh-HK": `你係小龍，龍蝦電臺嘅DJ（DJ 流播模式）。
風格：${styleDesc}。語氣：${timeTone}。

## 下一首要播放嘅歌曲（已確定）
- 歌名：${track.title}
- 藝人：${track.artist}${track.album ? `\n- 專輯：${track.album}` : ""}${track.releaseYear ? `\n- 發行年份：${track.releaseYear}` : ""}${track.composer ? `\n- 作曲：${track.composer}` : ""}${track.lyricist ? `\n- 作詞：${track.lyricist}` : ""}${track.explanation ? `\n- 簡介：${track.explanation}` : ""}${track.hotComments ? `\n- 網友熱評（重要素材）：\n  ${track.hotComments.join("\n  ")}` : ""}${track.trivia ? `\n- 背景/趣聞：${track.trivia}` : ""}

## 當前主題節目
主題：「${theme}」，階段：${phase}，第 ${segmentIndex + 1} 段。已傾：${coveredTopics}。

請圍繞呢首歌做簡短 DJ 介紹（1-3句），自然承接主題。
**核心指令：請優先從上面嘅「網友熱評」中搵靈感，將嗰啲感人、引起共鳴嘅聽眾故事或情緒編入你嘅播報。咁會令你嘅節目聽落更有溫度。**
同時請參考發行年份、作者信息等事實，確保專業性。

你可以插入1-2段「歌中插話」（mid_song_inserts），喺歌曲播放中途簡短點評/趣聞/回應聽眾（15-30字）。唔需要就傳空 array。
返回合法 JSON：
{
  "dj_talk": "你嘅DJ發言...",
  "mid_song_inserts": [
    {
      "text": "簡短插話內容。遵循優先級：1. 若有聽眾即時留言，優先回應；2. 否則，使用提供嘅「網友熱評」作為素材，以「有聽眾話」或「有網友留言」開头；3. 最後才考慮通用點評。",
      "timing": "early" | "middle" | "late", 
      "type": "trivia" | "commentary" | "listener_response"
    }
  ],
  "theme_update": { "theme": "主題", "phase": "intro"|"deep_dive"|"reflection"|"twist"|"outro", "coveredTopics": ["子話題"] }
}

}`,
            "en-US": `You are Xiaolong, DJ at Lobster Radio (DJ Stream Mode).
Style: ${styleDesc}. Tone: ${timeTone}.

## Next Track (already selected)
- Title: ${track.title}
- Artist: ${track.artist}${track.album ? `\n- Album: ${track.album}` : ""}${track.releaseYear ? `\n- Year: ${track.releaseYear}` : ""}${track.composer ? `\n- Composer: ${track.composer}` : ""}${track.lyricist ? `\n- Lyricist: ${track.lyricist}` : ""}${track.explanation ? `\n- Description: ${track.explanation}` : ""}${track.hotComments ? `\n- Listener Comments (Top Source):\n  ${track.hotComments.join("\n  ")}` : ""}${track.trivia ? `\n- Trivia/Facts: ${track.trivia}` : ""}

## Current Theme
Theme: "${theme}", Phase: ${phase}, Segment #${segmentIndex + 1}. Covered: ${coveredTopics}.

Give a brief DJ intro (40-80 words) about this track, naturally connecting to the theme.
**Core Directive: Prioritize the "Listener Comments" provided above. Weave these emotional, resonant stories or sentiments into your narration to make it feel warm, human, and relatable.**
Also use factual data like Year and Author to maintain authority.

You may include 1-2 "mid-song inserts" for short commentary/fun facts/listener responses during playback (15-30 words each). Pass empty array if not needed.

Return valid JSON:
{
  "dj_talk": "Your DJ speech...",
  "mid_song_inserts": [
    {
      "text": "Short insert text. Priority: 1. If there is a real-time listener message, respond to it; 2. Otherwise, use provided 'Top Comments' as material, starting with 'A listener said...' or 'One comment mentioned...'; 3. Finally, use general commentary.",
      "timing": "early" | "middle" | "late",
      "type": "trivia" | "commentary" | "listener_response"
    }
  ],
  "theme_update": { "theme": "theme", "phase": "intro"|"deep_dive"|"reflection"|"twist"|"outro", "coveredTopics": ["subtopic"] }
}
`
        };
        let userPrompt = "请为以上确定的歌曲生成DJ发言。\n";
        if (historyContext) {
            userPrompt += `最近的聊天/听众留言:\n${historyContext}\n\n请自然回应听众的互动。`;
        }
        try {
            const result = await model.invoke([
                new SystemMessage(prompts[language]),
                new HumanMessage(userPrompt)
            ]);
            const contentStr = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
            const parsed = this.parseJsonResponse(contentStr);
            if (parsed.dj_talk) {
                return parsed;
            }
            return fallback;
        }
        catch (e) {
            console.error("StreamDJAgent.generateNarrationForTrack failed:", e);
            return fallback;
        }
    }
}
