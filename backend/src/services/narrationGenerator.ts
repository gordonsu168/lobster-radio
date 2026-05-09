import type { SongWiki } from "./wikiService.js";

export type DJStyle = "classic" | "night" | "vibe" | "trivia";

// DJ 语料库 - 地道广东话版
const DJ_PHRASES = {
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

// 随机选择数组中的一项
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 模板字符串替换
function format(str: string, ...args: string[]): string {
  let result = str;
  args.forEach((arg, i) => {
    result = result.replace("{}", arg);
  });
  return result;
}

// 获取时间段
function getTimeSegment(): "morning" | "afternoon" | "night" | "weekend" {
  const hour = new Date().getHours();
  const day = new Date().getDay();
  
  // 周末
  if (day === 0 || day === 6) {
    return "weekend";
  }
  
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "night";
}

// 生成经典电台风格旁白 - 地道广东话
function generateClassic(song: SongWiki): string {
  const phrases = DJ_PHRASES.classic;
  const timeSeg = getTimeSegment();
  const timeIntro = pick(DJ_PHRASES.generic.timeBased[timeSeg]);
  
  const intro = Math.random() > 0.5 ? timeIntro : pick(phrases.intros);
  const titlePhrase = pick(phrases.titles);
  const transition = pick(phrases.transitions);
  const ending = pick(phrases.endings);
  
  // 随机组合模式
  const pattern = Math.floor(Math.random() * 3);
  
  switch (pattern) {
    case 0:
      // 经典模式：开场 + 歌名 + 歌手 + 专辑 + 结尾
      return `${intro}${titlePhrase}${song.artist}嘅《${song.title}》，${transition}《${song.album}》${ending}`;
    case 1:
      // 简洁模式：开场 + 歌手 + 歌名
      return `${intro}${song.artist}《${song.title}》${ending}`;
    default:
      // 专辑模式：开场 + 歌名 + 专辑
      return `${intro}《${song.title}》，${transition}《${song.album}》${ending}`;
  }
}

// 生成深夜治愈风旁白 - 地道广东话
function generateNight(song: SongWiki): string {
  const phrases = DJ_PHRASES.night;
  const intro = pick(phrases.intros);
  const patterns = [
    `${song.artist}嘅《${song.title}》陪你度过呢个安静嘅夜晚。`,
    `等《${song.title}》陪伴你，嚟自${song.artist}。`,
    `夜啦，听下${song.artist}嘅《${song.title}》，好衬而家嘅心情。`
  ];
  
  return `${intro}${pick(patterns)}`;
}

// 生成活力蹦迪风旁白 - 地道广东话
function generateVibe(song: SongWiki): string {
  const phrases = DJ_PHRASES.vibe;
  const intro = pick(phrases.intros);
  const patterns = [
    `${song.artist}嘅《${song.title}》！跟住节奏一齐郁！`,
    `就系而家！等${song.artist}嘅《${song.title}》点燃你！`,
    `${song.artist}嘅经典之作《${song.title}》！动起身！`
  ];
  
  return `${intro}${pick(patterns)}`;
}

// 生成冷知识科普风旁白 - 地道广东话
function generateTrivia(song: SongWiki): string {
  const phrases = DJ_PHRASES.trivia;
  const intro = pick(phrases.intros);
  const patterns = [
    `${song.artist}嘅《${song.title}》收录喺《${song.album}》大碟入面，几得意下？`,
    `讲个冷知识俾你听，《${song.title}》出自${song.artist}嘅大碟《${song.album}》，估唔到吧？`,
    `你知唔知？《${song.title}》系${song.artist}嘅作品，嚟自《${song.album}》呢张碟。学到嘢啦！`
  ];
  
  return `${intro}${pick(patterns)}`;
}

// 主函数：根据风格生成旁白
export function generateNarration(song: SongWiki, style: DJStyle = "classic"): string {
  switch (style) {
    case "night":
      return generateNight(song);
    case "vibe":
      return generateVibe(song);
    case "trivia":
      return generateTrivia(song);
    case "classic":
    default:
      return generateClassic(song);
  }
}

// 随机选择风格
export function generateRandomNarration(song: SongWiki): string {
  const styles: DJStyle[] = ["classic", "night", "vibe", "trivia"];
  const randomStyle = pick(styles);
  return generateNarration(song, randomStyle);
}
