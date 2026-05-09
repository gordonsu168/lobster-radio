import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createOptionalModel } from "../lib/model.js";
export class NarratorAgent {
    async generate(input) {
        const model = createOptionalModel();
        const historyCount = input.history.length;
        const style = input.style || "classic";
        if (!model) {
            // 粤语模板 - 四种 DJ 风格
            const templates = {
                classic: [
                    `欢迎返到龙虾电台，而家为你送上嘅系${input.track.artist}嘅《${input.track.title}》，收录喺大碟《${input.track.album}》入面，希望你钟意。`,
                    `正在锁定龙虾电台，而家播紧嘅系${input.track.artist}嘅《${input.track.title}》，一齐嚟欣赏啦。`,
                    `呢度系龙虾电台，接下来呢首歌，${input.track.artist}嘅《${input.track.title}》，希望可以陪你度过呢段美好时光。`,
                    `${input.track.artist}嘅《${input.track.title}》，收录喺《${input.track.album}》入面，希望呢首歌可以陪住你。`,
                ],
                night: [
                    `夜阑人静，等${input.track.artist}嘅《${input.track.title}》陪你度过呢个安静嘅夜晚。`,
                    `而家系深夜时分，听听${input.track.artist}嘅《${input.track.title}》，好衬而家嘅心情。`,
                    `夜啦，有歌陪你。${input.track.artist}嘅《${input.track.title}》，送俾夜猫子嘅你。`,
                    `呢个夜晚，等《${input.track.title}》嘅旋律陪你放松一下。`,
                ],
                vibe: [
                    `嚟啦嚟啦！就系而家！${input.track.artist}嘅《${input.track.title}》，跟住节奏一齐郁！`,
                    `各位朋友！准备好未！${input.track.artist}嘅《${input.track.title}》，俾啲反应！`,
                    `Let's go！接下来呢首歌你实识唱！${input.track.artist}嘅《${input.track.title}》！`,
                    `就系呢个感觉！${input.track.artist}嘅《${input.track.title}》，一齐嚟啦！`,
                ],
                trivia: [
                    `你知唔知？${input.track.artist}嘅《${input.track.title}》收录喺《${input.track.album}》呢张大碟入面，几得意下？`,
                    `讲个冷知识俾你听，《${input.track.title}》系${input.track.artist}嘅代表作之一，估唔到吧？`,
                    `同你分享下，《${input.track.title}》呢首歌出自${input.track.artist}嘅专辑《${input.track.album}》。学到嘢啦！`,
                ]
            };
            const styleTemplates = templates[style] || templates.classic;
            return styleTemplates[Math.floor(Math.random() * styleTemplates.length)];
        }
        // LLM 模式 - 生成更地道的粤语旁白
        const styleDescriptions = {
            classic: "经典电台主持风格，亲切、专业，带一点点怀旧感",
            night: "深夜治愈系，温柔、安静，适合夜晚收听",
            vibe: "活力蹦迪风，热情、兴奋，带动听众情绪",
            trivia: "冷知识科普风，有趣、有料，带一点点书卷气"
        };
        const result = await model.invoke([
            new SystemMessage(`你系龙虾电台嘅AI DJ，一个地道嘅香港电台主持。用纯正粤语讲嘢，语气要自然、亲切，似同朋友倾计一样。风格：${styleDescriptions[style]}。旁白控制喺 1-2 句，唔好太长。`),
            new HumanMessage(`心情模式：${input.mood}\n上下文：${input.contextSummary}\n而家播放紧：${input.track.artist}嘅《${input.track.title}》，收录喺《${input.track.album}》\n听众已经听咗${historyCount}首歌\n\n请用纯正粤语讲一段电台开场白，1-2句就得，唔好太长！`)
        ]);
        return typeof result.content === "string" ? result.content : JSON.stringify(result.content);
    }
}
