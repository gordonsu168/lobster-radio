import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createOptionalModel } from "../lib/model.js";
export class NarratorAgent {
    async generate(input) {
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
    getFallbackTemplate(track, style, language) {
        const templates = {
            "zh-HK": {
                classic: [
                    `欢迎返到龙虾电台，而家为你送上嘅系${track.artist}嘅《${track.title}》。呢首歌收录喺大碟《${track.album}》入面，见证住佢地音乐旅程上嘅一个重要时刻。希望呢把熟悉嘅声音可以唤起你心底嘅共鸣。`,
                    `正在锁定龙虾电台，而家播紧嘅系${track.artist}嘅《${track.title}》。一首经典嘅好歌，往往可以带我地穿越时空，返到最纯粹嘅一刻。一齐嚟用心欣赏啦。`,
                    `继续留喺龙虾电台，而家送出${track.artist}嘅代表作《${track.title}》。收录喺《${track.album}》里面嘅呢首歌，绝对系当时乐坛嘅一大突破。由得音乐慢慢带出当时嘅回忆。`,
                    `听紧龙虾电台嘅你，准备好迎接呢首经典未？${track.artist}主唱嘅《${track.title}》，真系百听不厌。用心去感受每一个音符带嚟嘅感动。`
                ],
                night: [
                    `夜阑人静，等${track.artist}嘅《${track.title}》陪你度过呢个安静嘅夜晚。旋律当中流露嘅细腻情感，好啱而家静落嚟嘅心情。由得音乐带走全日嘅疲惫啦。`,
                    `而家系深夜时分，听听${track.artist}嘅《${track.title}》。每一个音符都仿佛喺度同夜空对话，安抚住每一颗未瞓嘅心。送俾夜猫子嘅你。`,
                    `夜阑人静嘅时候，最啱听${track.artist}嘅《${track.title}》。呢首歌就好似一位老朋友，喺耳边细细声同你诉说心事。愿你有个好梦。`,
                    `喺呢个宁静嘅夜空下，由${track.artist}同佢嘅《${track.title}》陪伴你。抛开日间嘅烦恼，畀自己一个彻底放松嘅时刻。晚安。`
                ],
                vibe: [
                    `嚟啦嚟啦！就系而家！${track.artist}嘅《${track.title}》！呢首歌嘅节奏同编曲真系无得顶，绝对系带动气氛嘅绝佳之作。跟住节奏一齐郁啦！`,
                    `各位朋友！准备好未！${track.artist}嘅《${track.title}》准备炸爆你嘅喇叭。呢种充满能量嘅音乐风格，就系我地而家最需要嘅感觉！`,
                    `全场最High嘅时刻到啦！${track.artist}带嚟呢首《${track.title}》绝对可以令你热血沸腾。放开手脚，跟住强劲嘅节拍尽情狂欢啦！`,
                    `你准备好迎接呢股强烈嘅音浪未？${track.artist}嘅《${track.title}》一出，边个可以抵挡得住呢种魅力！将音量开到最大，感受呢份无与伦比嘅震撼！`
                ],
                trivia: [
                    `同你分享一个细节，${track.artist}嘅《${track.title}》其实蕴含住好多精心设计嘅音乐元素。这首歌收录喺《${track.album}》入面，绝对值得你细细品味。试下听埋背景入面嘅层次感啦。`,
                    `考下你啦，${track.artist}嘅《${track.title}》背后原来有个不为人知嘅故事。当年录音嗰阵，佢哋加入咗一啲特别嘅声效。下次听嗰阵不妨留意下。`,
                    `关于${track.artist}呢首《${track.title}》，有个好有趣嘅冷知识。原来首歌嘅创作灵感系源自一个偶然嘅机遇。音乐世界真系充满惊喜。`
                ]
            },
            "zh-CN": {
                classic: [
                    `欢迎回到龙虾电台，现在为你送上的是${track.artist}的《${track.title}》。这首歌收录在专辑《${track.album}》中，见证了他们音乐旅程上的一个重要时刻。希望这熟悉的声音能唤起你心底的共鸣。`,
                    `正在收听龙虾电台，现在播放的是${track.artist}的《${track.title}》。一首经典的好歌，往往能带我们穿越时空，回到最纯粹的那一刻。一起来用心欣赏吧。`,
                    `继续留在龙虾电台，现在送出${track.artist}的代表作《${track.title}》。收录在《${track.album}》里的这首歌，绝对是当时乐坛的一大突破。让音乐慢慢带出当时的回忆。`,
                    `听着龙虾电台的你，准备好迎接这首经典了吗？${track.artist}主唱的《${track.title}》，真是百听不厌。用心去感受每一个音符带来的感动。`
                ],
                night: [
                    `夜深人静，让${track.artist}的《${track.title}》陪你度过这个安静的夜晚。旋律中流露的细腻情感，很适合现在平静的心情。让音乐带走一天的疲惫吧。`,
                    `现在是深夜时分，听听${track.artist}的《${track.title}》。每一个音符都仿佛在与夜空对话，安抚着每一颗未眠的心。送给夜猫子的你。`,
                    `夜深人静的时候，最适合听${track.artist}的《${track.title}》。这首歌就像一位老朋友，在耳边细细与你诉说心事。愿你有个好梦。`,
                    `在这个宁静的夜空下，由${track.artist}和他的《${track.title}》陪伴你。抛开白天的烦恼，给自己一个彻底放松的时刻。晚安。`
                ],
                vibe: [
                    `来了来了！就是现在！${track.artist}的《${track.title}》！这首歌的节奏和编曲真是绝了，绝对是带动气氛的绝佳之作。跟着节奏一起动起来吧！`,
                    `各位朋友！准备好了吗！${track.artist}的《${track.title}》准备燃爆你的音箱。这种充满能量的音乐风格，就是我们现在最需要的感觉！`,
                    `全场最High的时刻到啦！${track.artist}带来这首《${track.title}》绝对能让你热血沸腾。放开手脚，跟着强劲的节拍尽情狂欢吧！`,
                    `你准备好迎接这股强烈的音浪了吗？${track.artist}的《${track.title}》一出，谁能抵挡得住这种魅力！将音量开到最大，感受这份无与伦比的震撼！`
                ],
                trivia: [
                    `和你分享一个细节，${track.artist}的《${track.title}》其实蕴含着很多精心设计的音乐元素。这首歌收录在《${track.album}》中，绝对值得你细细品味。试着听听背景里的层次感吧。`,
                    `考考你啦，${track.artist}的《${track.title}》背后原来有个不为人知的故事。当年录音的时候，他们加入了一些特别的声效。下次听的时候不妨留意下。`,
                    `关于${track.artist}这首《${track.title}》，有个很有趣的冷知识。原来这首歌的创作灵感是源自一个偶然的机遇。音乐世界真是充满惊喜。`
                ]
            },
            "en-US": {
                classic: [
                    `Welcome back to Lobster Radio. Now playing ${track.title} by ${track.artist}, from the album ${track.album}. This track really marks a pivotal moment in their musical journey. Hope this familiar voice brings back some great memories.`,
                    `You're tuned to Lobster Radio. Here's ${track.title} by ${track.artist}. A truly classic song has the power to transport us through time, back to our purest moments. Let's enjoy this masterpiece together.`,
                    `Stay right here with Lobster Radio as we spin ${track.title} by ${track.artist}. Featured on the album ${track.album}, this track was an absolute breakthrough. Let the music take you on a journey down memory lane.`,
                    `Are you ready for a true classic on Lobster Radio? We've got ${track.title} by ${track.artist} lined up for you. Take a moment to really feel the emotion hidden within every single note.`
                ],
                night: [
                    `Late into the night, let ${track.title} by ${track.artist} accompany you through this quiet evening. The delicate emotions in this melody perfectly capture the stillness of the midnight hours. Let the music wash away the fatigue of your day.`,
                    `It's the late night hours. Here's ${track.title} by ${track.artist}. Every note feels like a conversation with the night sky, soothing every restless soul. This one goes out to all you night owls.`,
                    `When the world goes quiet, there's nothing better than ${track.title} by ${track.artist}. This song feels like an old friend whispering secrets in the dark. Wishing you the sweetest of dreams tonight.`,
                    `Underneath this peaceful night sky, let ${track.artist} and ${track.title} keep you company. Leave the worries of the day behind and allow yourself to completely unwind. Goodnight.`
                ],
                vibe: [
                    `Here we go! Right now! ${track.title} by ${track.artist}! The production and rhythm on this track are absolutely unbelievable. It's the exact energy we need to elevate this moment, so move to the beat!`,
                    `Everyone! Are you ready! ${track.title} by ${track.artist} is about to blow through your speakers. The cultural impact and pure energy of this sound is undeniable. Let me hear you!`,
                    `It's time to take things to the next level! ${track.title} by ${track.artist} is guaranteed to get your blood pumping. Let loose and surrender to these massive beats right now!`,
                    `Are you prepared for this tidal wave of sound? When ${track.title} by ${track.artist} drops, there's absolutely no resisting its pull! Turn the volume all the way up and feel the shockwave!`
                ],
                trivia: [
                    `Let me share a quick detail with you: ${track.title} by ${track.artist} is actually packed with incredibly clever musical elements. Coming from the album ${track.album}, it completely deserves a deeper listen. Try to catch the subtle layers hidden in the background.`,
                    `Here's a little quiz for you: ${track.title} by ${track.artist} actually has a fascinating hidden backstory. During the recording sessions, they incorporated some highly unusual sound effects. Keep an ear out for them next time you listen.`,
                    `There's a really interesting piece of trivia about ${track.title} by ${track.artist}. It turns out the entire inspiration for the song came from a completely chance encounter. The world of music is full of surprises.`
                ]
            }
        };
        const langTemplates = templates[language];
        const styleTemplates = langTemplates[style] || langTemplates.classic;
        return styleTemplates[Math.floor(Math.random() * styleTemplates.length)];
    }
    getSystemPrompt(style, language) {
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
    getUserPrompt(input, historyCount, language) {
        const shortMem = input.shortTermMemory || "None";
        const longMem = input.longTermMemory || "None";
        const prompts = {
            "zh-HK": `心情模式：${input.mood}\n上下文：${input.contextSummary}\n短期记忆：${shortMem}\n长期记忆：${longMem}\n而家播放紧：${input.track.artist}嘅《${input.track.title}》，收录喺《${input.track.album}》\n歌曲背景：${input.track.explanation}\n听众已经听咗${historyCount}首歌\n\n请利用提供嘅短期同长期记忆令你嘅旁白更个性化（例如：如果听众今日成日飞歌，可以讲下转下口味；如果播紧佢最钟意嘅歌手，就提下）。请结合上面嘅歌曲背景同埋你自己对歌手历史、专辑上下文或制作秘密嘅深入了解，用纯正粤语讲一段深刻难忘嘅电台开场白，控制喺 3-4 句。`,
            "zh-CN": `心情模式：${input.mood}\n上下文：${input.contextSummary}\n短期记忆：${shortMem}\n长期记忆：${longMem}\n现在播放：${input.track.artist}的《${input.track.title}》，收录在《${input.track.album}》\n歌曲背景：${input.track.explanation}\n听众已经听了${historyCount}首歌\n\n请利用提供的短期和长期记忆让你的旁白更个性化（例如：如果听众今天经常切歌，可以提一下换换口味；如果正播放他们最喜欢的歌手，可以提一下）。请结合上面的歌曲背景和你自己对歌手历史、专辑上下文或制作秘密的深入了解，用普通话说一段深刻难忘的电台开场白，控制在 3-4 句。`,
            "en-US": `Mood mode: ${input.mood}\nContext: ${input.contextSummary}\nShort-Term Memory: ${shortMem}\nLong-Term Memory: ${longMem}\nNow playing: ${input.track.title} by ${input.track.artist}, from ${input.track.album}\nTrack Context: ${input.track.explanation}\nListener has heard ${historyCount} songs\n\nPlease use the provided Short-Term and Long-Term memory context to make your commentary more personalized (e.g., if they skipped a lot today, mention a change of pace; if playing a favorite artist, acknowledge it). Please blend the provided track context with your own deep knowledge of the artist's history, album context, or production secrets to create a profound and memorable radio intro in 3-4 sentences.`
        };
        return prompts[language];
    }
}
