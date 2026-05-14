// ========== 🇭🇰 粤语 Cantonese ==========
const DJ_PHRASES_HK = {
    classic: {
        intros: [
            "欢迎返到龙虾电台，",
            "正在锁定龙虾电台，",
            "呢度系龙虾电台，",
            "各位听众朋友，",
            "嚟紧呢首歌，"
        ],
        titles: ["为你送上嘅系", "而家播紧嘅系", "送俾你嘅系", "嚟听下呢首", "来自"],
        transitions: ["收录喺大碟", "呢首歌出自专辑", "出自大碟"],
        endings: ["，希望你钟意。", "。", "，一齐嚟欣赏下。", "，用心感受啦。"]
    },
    night: {
        intros: [
            "夜阑人静，",
            "而家系深夜时分，",
            "个城已经静晒啦，",
            "呢个夜晚，",
            "仲未瞓嘅你，"
        ],
        titles: [
            "呢首《{}》送俾你，",
            "等《{}》陪你度过呢个夜晚，",
            "嚟听下{}嘅《{}》，",
            "呢首歌《{}》，"
        ],
        vibes: ["适合静静咁听。", "好适合呢个时刻。", "好衬而家嘅心情。", "希望可以治愈你一日嘅疲劳。"]
    },
    vibe: {
        intros: ["嚟啦嚟啦！", "各位朋友！", "准备好未？", "就系而家！", "Let's go! "],
        titles: ["嚟紧呢首歌！", "一齐嚟听！", "{}嘅《{}》！", "呢首你实识唱！"],
        calls: ["准备好未？", "跟住节奏！", "一齐郁！", "动起身！"]
    },
    trivia: {
        intros: ["你知唔知？", "讲个冷知识俾你听，", "有意思嘅系，", "同你分享下，"],
        facts: ["呢首歌收录喺大碟《{}》入面，", "呢首系{}年嘅作品，", "呢首歌由{}作曲，"],
        endings: ["几得意下？", "估唔到吧？", "学到嘢啦。"]
    },
    generic: {
        artists: [
            "呢首歌嘅演唱者系{}，",
            "嚟自{}嘅作品，",
            "{}嘅呢首经典，"
        ],
        albums: ["收录喺大碟《{}》入面，", "出自《{}》呢张碟，", "大碟《{}》入面嘅作品，"],
        timeBased: {
            morning: ["朝早听首好歌，", "新嘅一日由好音乐开始，"],
            afternoon: ["晏昼时光，", "做嘢攰啦，嚟首歌抖下，"],
            night: ["夜啦，", "晚上好，嚟首歌放松下，"],
            weekend: ["周末愉快！", "周末梗系要听啲好音乐啦，"]
        }
    }
};
// ========== 🇨🇳 普通话 Chinese ==========
const DJ_PHRASES_CN = {
    classic: {
        intros: [
            "欢迎回到龙虾电台，",
            "正在锁定龙虾电台，",
            "这里是龙虾电台，",
            "亲爱的听众朋友，",
            "接下来这首歌，"
        ],
        titles: ["为你带来的是", "现在播放的是", "送给你的是", "来听听这首", "来自"],
        transitions: ["收录在专辑", "这首歌来自专辑", "出自专辑"],
        endings: ["，希望你喜欢。", "。", "，让我们一起聆听。", "，用心感受吧。"]
    },
    night: {
        intros: [
            "夜深了，",
            "现在是深夜时分，",
            "城市已经安静下来了，",
            "这个夜晚，",
            "还没睡的你，"
        ],
        titles: [
            "这首《{}》送给你，",
            "让《{}》陪你度过这个夜晚，",
            "来听听{}的《{}》，",
            "这首歌《{}》，"
        ],
        vibes: ["适合静静聆听。", "很适合这个时刻。", "很符合现在的心情。", "希望可以治愈你一天的疲惫。"]
    },
    vibe: {
        intros: ["来啦来啦！", "各位朋友！", "准备好了吗？", "就是现在！", "Let's go! "],
        titles: ["接下来这首歌！", "一起来听！", "{}的《{}》！", "这首你一定会唱！"],
        calls: ["准备好了吗？", "跟着节奏！", "一起动起来！", "嗨起来！"]
    },
    trivia: {
        intros: ["你知道吗？", "讲个冷知识给你听，", "有意思的是，", "和你分享一下，"],
        facts: ["这首歌收录在专辑《{}》里，", "这是{}年的作品，", "这首歌由{}作曲，"],
        endings: ["挺有意思的吧？", "没想到吧？", "学到了吧。"]
    },
    generic: {
        artists: [
            "这首歌的演唱者是{}，",
            "来自{}的作品，",
            "{}的这首经典，"
        ],
        albums: ["收录在专辑《{}》中，", "出自《{}》专辑，", "专辑《{}》里的作品，"],
        timeBased: {
            morning: ["早上听首好歌，", "新的一天从好音乐开始，"],
            afternoon: ["下午时光，", "工作累了，来首歌休息一下，"],
            night: ["夜深了，", "晚上好，来首歌放松一下，"],
            weekend: ["周末愉快！", "周末当然要听好听的音乐啦，"]
        }
    }
};
// ========== 🇺🇸 英语 English ==========
const DJ_PHRASES_EN = {
    classic: {
        intros: [
            "Welcome back to Lobster Radio, ",
            "You're locked in to Lobster Radio, ",
            "This is Lobster Radio, ",
            "Dear listeners, ",
            "Coming up next, "
        ],
        titles: ["for you is", "now playing", "here's", "check out", "from"],
        transitions: ["from the album", "this track is from", "included in"],
        endings: [". Hope you enjoy it.", ".", ". Let's listen together.", ". Sit back and enjoy."]
    },
    night: {
        intros: [
            "It's getting late, ",
            "Late night vibes, ",
            "The city has quieted down, ",
            "On this night, ",
            "Still up, huh? "
        ],
        titles: [
            "Here's {} for you, ",
            "Let {} keep you company tonight, ",
            "Check out {} by {}, ",
            "This track {}, "
        ],
        vibes: ["Perfect for late night listening.", "Just right for this moment.", "Matches the mood perfectly.", "Hope it makes your day better."]
    },
    vibe: {
        intros: ["Here we go! ", "Let's go! ", "Ready? ", "Right now! ", "Let's do this! "],
        titles: ["Coming up next! ", "Let's go! ", "Check out {} by {}! ", "You know this one! "],
        calls: ["You ready? ", "Feel the beat! ", "Let's move! ", "Let's party! "]
    },
    trivia: {
        intros: ["Did you know? ", "Fun fact! ", "Here's something cool, ", "Let me tell you, "],
        facts: ["This track is from the album {}, ", "Released in {}, ", "Produced by {}, "],
        endings: ["Cool, right? ", "Who knew? ", "Now you know. "]
    },
    generic: {
        artists: [
            "This is {}, ",
            "A track from {}, ",
            "This classic by {}, "
        ],
        albums: ["From the album {}, ", "Taken from {}, ", "On the album {}, "],
        timeBased: {
            morning: ["Good morning, music time, ", "Start your day with good music, "],
            afternoon: ["Afternoon vibes, ", "Take a break, listen to some music, "],
            night: ["Evening time, ", "Relax and enjoy some tunes, "],
            weekend: ["Happy weekend! ", "Weekend vibes with good music, "]
        }
    }
};
// 语言映射表
const LANGUAGE_PHRASES = {
    "zh-HK": DJ_PHRASES_HK,
    "zh-CN": DJ_PHRASES_CN,
    "en-US": DJ_PHRASES_EN,
};
// 当前使用的语言（可通过环境变量或设置动态切换）
let currentLanguage = "zh-CN";
// 设置 DJ 语言
export function setDJLanguage(lang) {
    currentLanguage = lang;
    console.log(`🎙️ DJ 语言已切换为: ${lang}`);
}
// 获取当前语言的语料库
function getPhrases() {
    return LANGUAGE_PHRASES[currentLanguage];
}
// 随机选择数组中的一项
function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
// 模板字符串替换
function format(str, ...args) {
    let result = str;
    args.forEach((arg, i) => {
        result = result.replace("{}", arg);
    });
    return result;
}
// 获取时间段
export function getTimeSegment() {
    const hour = new Date().getHours();
    const day = new Date().getDay();
    // 周末
    if (day === 0 || day === 6) {
        return "weekend";
    }
    if (hour < 12)
        return "morning";
    if (hour < 18)
        return "afternoon";
    return "night";
}
// 获取歌曲名称连接词（不同语言有不同的）
function getSongConnector() {
    const connectors = {
        "zh-HK": "嘅",
        "zh-CN": "的",
        "en-US": " by ",
    };
    return connectors[currentLanguage];
}
// 生成经典电台风格旁白
function generateClassic(song) {
    const phrases = getPhrases().classic;
    const timeSeg = getTimeSegment();
    const timeIntro = pick(getPhrases().generic.timeBased[timeSeg]);
    const intro = Math.random() > 0.5 ? timeIntro : pick(phrases.intros);
    const titlePhrase = pick(phrases.titles);
    const transition = pick(phrases.transitions);
    const ending = pick(phrases.endings);
    const connector = getSongConnector();
    // 随机组合模式
    const pattern = Math.floor(Math.random() * 3);
    switch (pattern) {
        case 0:
            // 经典模式：开场 + 歌名 + 歌手 + 专辑 + 结尾
            return `${intro}${titlePhrase}${song.artist}${connector}《${song.title}》，${transition}《${song.album}》${ending}`;
        case 1:
            // 简洁模式：开场 + 歌手 + 歌名
            return `${intro}${song.artist}${connector}《${song.title}》${ending}`;
        default:
            // 专辑模式：开场 + 歌名 + 专辑
            return `${intro}《${song.title}》，${transition}《${song.album}》${ending}`;
    }
}
// 生成深夜治愈风旁白
function generateNight(song) {
    const phrases = getPhrases().night;
    const intro = pick(phrases.intros);
    const connector = getSongConnector();
    const patterns = [
        `${song.artist}${connector}《${song.title}》${pick(phrases.vibes)}`,
        `${pick(phrases.titles).replace("{}", song.title)}`,
    ];
    return `${intro}${pick(patterns)}`;
}
// 生成活力蹦迪风旁白
function generateVibe(song) {
    const phrases = getPhrases().vibe;
    const intro = pick(phrases.intros);
    const connector = getSongConnector();
    const patterns = [
        `${song.artist}${connector}《${song.title}》！${pick(phrases.calls)}`,
    ];
    return `${intro}${pick(patterns)}`;
}
// 生成冷知识科普风旁白
function generateTrivia(song) {
    const phrases = getPhrases().trivia;
    const intro = pick(phrases.intros);
    const connector = getSongConnector();
    const patterns = [
        `${song.artist}${connector}《${song.title}》收录在《${song.album}》专辑里${pick(phrases.endings)}`,
    ];
    return `${intro}${pick(patterns)}`;
}
// 主函数：根据风格生成旁白
export function generateNarration(song, style = "classic", language) {
    // 如果指定了语言，临时切换
    const originalLang = currentLanguage;
    if (language) {
        setDJLanguage(language);
    }
    let result;
    switch (style) {
        case "night":
            result = generateNight(song);
            break;
        case "vibe":
            result = generateVibe(song);
            break;
        case "trivia":
            result = generateTrivia(song);
            break;
        case "classic":
        default:
            result = generateClassic(song);
    }
    // 恢复原语言
    if (language) {
        setDJLanguage(originalLang);
    }
    return result;
}
// 随机选择风格
export function generateRandomNarration(song, language) {
    const styles = ["classic", "night", "vibe", "trivia"];
    const randomStyle = pick(styles);
    return generateNarration(song, randomStyle, language);
}
