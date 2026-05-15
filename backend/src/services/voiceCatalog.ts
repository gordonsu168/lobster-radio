// Voice catalogue: each TTS provider's real voice names.
// No abstraction layer — the IDs here are what get sent to each provider's API.

export interface VoiceInfo {
  id: string;
  name: string;
  lang: "zh-CN" | "zh-HK" | "en-US" | "ja" | "ko" | "other";
  previewText: string;
}

const PREVIEW: Record<string, string> = {
  "zh-CN": "欢迎收听龙虾电台，我是您的AI音乐主播。",
  "zh-HK": "歡迎收聽龍蝦電台，我係你嘅AI音樂主播。",
  "en-US": "Welcome to Lobster Radio. I'm your AI music host.",
  "ja": "ロブスターラジオへようこそ。",
  "ko": "랍스터 라디오에 오신 것을 환영합니다.",
  "other": "Welcome to Lobster Radio.",
};

// ========== Edge TTS (Microsoft Neural) ==========
const EDGE_VOICES: VoiceInfo[] = [
  // Cantonese
  { id: "zh-HK-HiuGaaiNeural", name: "曉佳 HiuGaai — 溫柔女聲", lang: "zh-HK", previewText: PREVIEW["zh-HK"] },
  { id: "zh-HK-HiuMaanNeural", name: "曉曼 HiuMaan — 親切女聲", lang: "zh-HK", previewText: PREVIEW["zh-HK"] },
  { id: "zh-HK-WanLungNeural", name: "雲龍 WanLung — 成熟男聲", lang: "zh-HK", previewText: PREVIEW["zh-HK"] },
  // Mandarin
  { id: "zh-CN-XiaoxiaoNeural", name: "曉曉 Xiaoxiao — 親切女聲", lang: "zh-CN", previewText: PREVIEW["zh-CN"] },
  { id: "zh-CN-XiaoyiNeural", name: "曉伊 Xiaoyi — 溫柔女聲", lang: "zh-CN", previewText: PREVIEW["zh-CN"] },
  { id: "zh-CN-YunxiNeural", name: "雲希 Yunxi — 磁性男聲", lang: "zh-CN", previewText: PREVIEW["zh-CN"] },
  { id: "zh-CN-YunjianNeural", name: "雲健 Yunjian — 活力男聲", lang: "zh-CN", previewText: PREVIEW["zh-CN"] },
  { id: "zh-CN-YunyangNeural", name: "雲揚 Yunyang — 沉穩男聲", lang: "zh-CN", previewText: PREVIEW["zh-CN"] },
  // English
  { id: "en-US-AvaNeural", name: "Ava — 自然女聲", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "en-US-EmmaNeural", name: "Emma — 親切女聲", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "en-US-AriaNeural", name: "Aria — 專業女聲", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "en-US-AndrewNeural", name: "Andrew — 自然男聲", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "en-US-BrianNeural", name: "Brian — 活力男聲", lang: "en-US", previewText: PREVIEW["en-US"] },
];

// ========== ElevenLabs ==========
const ELEVENLABS_VOICES: VoiceInfo[] = [
  { id: "rachel", name: "Rachel — 溫暖女聲", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "drew", name: "Drew — 成熟女聲", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "clara", name: "Clara — 柔和女聲", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "sarah", name: "Sarah — 自然女聲", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "laura", name: "Laura — 親切女聲", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "paul", name: "Paul — 磁性男聲", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "josh", name: "Josh — 活力男聲", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "antoni", name: "Antoni — 溫柔男聲", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "elliot", name: "Elliot — 年輕男聲", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "lily", name: "Lily — 中文女聲", lang: "zh-CN", previewText: PREVIEW["zh-CN"] },
  { id: "chinese-female", name: "中文女聲 (Chinese Female)", lang: "zh-CN", previewText: PREVIEW["zh-CN"] },
];

// ========== Gemini TTS ==========
const GEMINI_VOICES: VoiceInfo[] = [
  { id: "Zephyr", name: "Zephyr — 明亮", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "Puck", name: "Puck — 活潑", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "Charon", name: "Charon — 資訊型", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "Kore", name: "Kore — 堅定", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "Fenrir", name: "Fenrir — 興奮", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "Leda", name: "Leda — 年輕", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "Orus", name: "Orus", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "Aoede", name: "Aoede", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "Callirrhoe", name: "Callirrhoe", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "Autonoe", name: "Autonoe", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "Enceladus", name: "Enceladus", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "Iapetus", name: "Iapetus", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "Umbriel", name: "Umbriel", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "Algieba", name: "Algieba", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "Despina", name: "Despina", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "Erinome", name: "Erinome", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "Algenib", name: "Algenib", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "Rasalgethi", name: "Rasalgethi", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "Laomedeia", name: "Laomedeia", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "Achernar", name: "Achernar", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "Alnilam", name: "Alnilam", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "Schedar", name: "Schedar", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "Gacrux", name: "Gacrux", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "Pulcherrima", name: "Pulcherrima", lang: "en-US", previewText: PREVIEW["en-US"] },
];

// ========== MOSS-TTS-Nano ==========
const MOSS_VOICES: VoiceInfo[] = [
  { id: "demo-1", name: "zh_1 歡迎關注模思智能", lang: "zh-CN", previewText: PREVIEW["zh-CN"] },
  { id: "demo-2", name: "zh_6 深夜溫柔晚安 🌙", lang: "zh-CN", previewText: PREVIEW["zh-CN"] },
  { id: "demo-3", name: "zh_4 台灣腔", lang: "zh-CN", previewText: PREVIEW["zh-CN"] },
  { id: "demo-4", name: "zh_3 京味胡同閒聊", lang: "zh-CN", previewText: PREVIEW["zh-CN"] },
  { id: "demo-5", name: "zh_10 時間觀念與文化邏輯", lang: "zh-CN", previewText: PREVIEW["zh-CN"] },
  { id: "demo-6", name: "zh_11 楊幂風格", lang: "zh-CN", previewText: PREVIEW["zh-CN"] },
  { id: "demo-7", name: "en_6 Welcome to OpenMOSS", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "demo-8", name: "en_2 The Bitter Lesson", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "demo-9", name: "en_4 English News", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "demo-10", name: "en_3 A Gentle Reminder", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "demo-11", name: "en_7 Taylor Swift Style", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "demo-12", name: "en_8 The Quiet Motion", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "demo-13", name: "jp_2 ニュース", lang: "ja", previewText: PREVIEW["ja"] },
  { id: "demo-14", name: "ko 新聞", lang: "ko", previewText: PREVIEW["ko"] },
  { id: "demo-15", name: "es Noticiero", lang: "other", previewText: PREVIEW["other"] },
  { id: "demo-16", name: "fr Journal", lang: "other", previewText: PREVIEW["other"] },
  { id: "demo-17", name: "de Nachrichten", lang: "other", previewText: PREVIEW["other"] },
  { id: "demo-18", name: "it Telegiornale", lang: "other", previewText: PREVIEW["other"] },
  { id: "demo-19", name: "hu Híradó", lang: "other", previewText: PREVIEW["other"] },
  { id: "demo-20", name: "ru Новости", lang: "other", previewText: PREVIEW["other"] },
  { id: "demo-21", name: "fa اخبار", lang: "other", previewText: PREVIEW["other"] },
  { id: "demo-22", name: "ar النشرة الإخبارية", lang: "other", previewText: PREVIEW["other"] },
  { id: "demo-23", name: "pl Wiadomości", lang: "other", previewText: PREVIEW["other"] },
  { id: "demo-24", name: "pt Noticiário", lang: "other", previewText: PREVIEW["other"] },
  { id: "demo-25", name: "cs Zprávy", lang: "other", previewText: PREVIEW["other"] },
  { id: "demo-26", name: "dk Nyhederne", lang: "other", previewText: PREVIEW["other"] },
  { id: "demo-27", name: "sv Nyheterna", lang: "other", previewText: PREVIEW["other"] },
  { id: "demo-28", name: "el Ειδήσεις", lang: "other", previewText: PREVIEW["other"] },
  { id: "demo-29", name: "tr Haber Bülteni", lang: "other", previewText: PREVIEW["other"] },
];

// ========== Mac Say ==========
const MACSAY_VOICES: VoiceInfo[] = [
  { id: "Meijia", name: "美佳 Meijia — 溫暖女聲 (國語)", lang: "zh-CN", previewText: PREVIEW["zh-CN"] },
  { id: "Ting-Ting", name: "婷婷 Ting-Ting — 標準女聲 (國語)", lang: "zh-CN", previewText: PREVIEW["zh-CN"] },
  { id: "Sin-ji", name: "Sin-ji — 粵語女聲", lang: "zh-HK", previewText: PREVIEW["zh-HK"] },
  { id: "Flo", name: "Flo — 自然女聲 (英文)", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "Sandy", name: "Sandy — 清晰女聲 (英文)", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "Reed", name: "Reed — 深沉男聲 (英文)", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "Eddy", name: "Eddy — 活力男聲 (英文)", lang: "en-US", previewText: PREVIEW["en-US"] },
];

// ========== CosyVoice ==========
const COSYVOICE_VOICES: VoiceInfo[] = [
  { id: "default", name: "預設粵語女聲", lang: "zh-HK", previewText: PREVIEW["zh-HK"] },
  { id: "cantonese-female-1", name: "粵語女聲 1", lang: "zh-HK", previewText: PREVIEW["zh-HK"] },
  { id: "chinese-female-1", name: "國語女聲 1", lang: "zh-CN", previewText: PREVIEW["zh-CN"] },
  { id: "chinese-male-1", name: "國語男聲 1", lang: "zh-CN", previewText: PREVIEW["zh-CN"] },
];

// ========== OpenAI TTS ==========
const OPENAI_VOICES: VoiceInfo[] = [
  { id: "alloy", name: "Alloy — 中性", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "echo", name: "Echo — 男聲", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "fable", name: "Fable — 英式男聲", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "onyx", name: "Onyx — 深沉男聲", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "nova", name: "Nova — 溫柔女聲", lang: "en-US", previewText: PREVIEW["en-US"] },
  { id: "shimmer", name: "Shimmer — 清晰女聲", lang: "en-US", previewText: PREVIEW["en-US"] },
];

const CATALOG: Record<string, VoiceInfo[]> = {
  edge: EDGE_VOICES,
  elevenlabs: ELEVENLABS_VOICES,
  gemini: GEMINI_VOICES,
  moss: MOSS_VOICES,
  macsay: MACSAY_VOICES,
  cosyvoice: COSYVOICE_VOICES,
  openai: OPENAI_VOICES,
};

export function getVoicesForProvider(provider: string): VoiceInfo[] {
  return CATALOG[provider] || [];
}

export function getAllVoices(): Record<string, VoiceInfo[]> {
  return CATALOG;
}
