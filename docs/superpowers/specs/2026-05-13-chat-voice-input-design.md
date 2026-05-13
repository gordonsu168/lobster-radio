# 电台模式 Chat 语音输入设计

**日期：** 2026-05-13
**状态：** 设计待审阅
**作者：** Claude Code（与用户协同 brainstorm）

## 一句话摘要

在 `RadioModePage` 的 `ChatPanel` 输入框旁加一个长按麦克风按钮，通过新 hook `useSpeechRecognition` 封装浏览器原生 Web Speech API，用 `djLanguage` 作识别语言，识别结果填入输入框由用户确认后发送；不支持或出错时优雅降级。

## 目标

让用户在电台模式下可以用语音而非键盘与 AI DJ 制作人对话，降低交互门槛，更贴近"听电台、跟主播聊天"的体验。

## 非目标

- 不做实时流式语音对话（用户说完就发，不打断 DJ）
- 不做声纹识别 / 唤醒词
- 不引入任何后端 STT 服务和 API key
- 不替换键盘输入，仅作为补充

## 关键决策

| 决策 | 选择 | 原因 |
|---|---|---|
| 识别方案 | 浏览器 Web Speech API | 零后端、零成本、Chrome/Edge/Safari 已能产出可用结果 |
| 触发方式 | 长按说话（微信式） | 控制感强、避免漏开/漏关、对短句最友好 |
| 识别语言来源 | 复用 `RuntimeSettings.djLanguage` | 不引入新设置；"DJ 说什么语言，你就说什么语言"逻辑直观 |
| 结果落点 | 填入 input 由用户编辑后手动 Send | 给用户校对机会，避免误识别直接污染对话 |

## 架构

```
┌─────────────────── ChatPanel ───────────────────┐
│                                                  │
│  ┌──────────────┐    ┌────────┐    ┌────────┐  │
│  │  <input>     │    │ <Mic>  │    │ <Send> │  │
│  └──────┬───────┘    └───┬────┘    └────────┘  │
│         │                │                       │
│         │                │ start/stop            │
│         │ append final   ▼                       │
│         │         useSpeechRecognition (hook)    │
│         │         ┌─────────────────────┐        │
│         │         │ wraps SpeechRecog.  │        │
│         └─────────┤ exposes:            │        │
│                   │  isSupported        │        │
│                   │  isRecording        │        │
│                   │  transcript         │        │
│                   │  interimTranscript  │        │
│                   │  error              │        │
│                   │  start(lang) stop() │        │
│                   └─────────────────────┘        │
│                            │                     │
│                            ▼                     │
│              window.SpeechRecognition            │
│              (or webkitSpeechRecognition)        │
└──────────────────────────────────────────────────┘
```

## 文件改动

**新增：**
- `frontend/src/hooks/useSpeechRecognition.ts`
  - 封装 Web Speech API；处理 webkit 前缀、生命周期清理、interim/final 区分
  - 接口：`{ isSupported, isRecording, transcript, interimTranscript, error, start(lang), stop(), reset() }`
  - 配置：`continuous=false`、`interimResults=true`、`maxAlternatives=1`
  - 不依赖任何外部库

**修改：**
- `frontend/src/components/ChatPanel.tsx`
  - 在输入框右侧、Send 按钮左侧加内联 `<MicButton>`
  - 新增 props：`language?: string`（来自父组件 `djLanguage`，默认 `'zh-CN'`）
  - 长按手势：`onPointerDown / onPointerUp / onPointerLeave / onPointerCancel`
  - 录音中 UI：按钮变红 + 脉冲动画；输入框上方浮 interim transcript 气泡（"正在听… {临时识别}"）
- `frontend/src/pages/RadioModePage.tsx`
  - 把当前 `djLanguage` 设置作为 `language` prop 传给 `ChatPanel`

**不改动：**
- 后端、agents、`api.ts`、`types.ts`（`djLanguage` 已存在）

## 状态机

```
idle ──start()──► listening ──onresult(final)──► idle (transcript 已更新)
  ▲                  │
  │                  ├──stop() / onend ──► idle
  │                  └──onerror ──► error (附 message) ──reset──► idle
```

## 长按交互流程

1. 用户 `pointerdown` 麦克风按钮 → 调 `start(djLanguage)`，按钮变红+脉冲，输入框上方出现"正在听…"气泡
2. 用户说话期间 → `interimTranscript` 实时显示在气泡里（不写入 input，避免抖动）
3. 用户 `pointerup`（或 leave/cancel）→ 调 `stop()`，等 `onresult` 的 final 结果回来
4. final 结果 **append** 到 `input` state（拼接而非替换，允许连续多次录入）→ 气泡消失，输入框聚焦，光标在末尾
5. 用户检查/编辑后手动点 Send

## 边界与错误处理

| 情况 | 行为 |
|---|---|
| 浏览器不支持 SpeechRecognition | 麦克风按钮 disabled + tooltip "当前浏览器不支持语音输入" |
| 用户拒绝麦克风权限（`onerror` not-allowed） | inline 提示 "请在浏览器设置中允许麦克风" |
| 网络/服务错误（`onerror` network/service-not-allowed） | inline 红字提示 "语音识别失败，请重试或手动输入" |
| 没识别到内容（final 为空） | 静默，不打扰 |
| 按下不到 500ms 就松开 | 视为误触，stop 并丢弃结果，提示 "按住说话" |
| `loading`（producer 回复中） | 麦克风按钮 disabled |
| 重复 start | 先 stop 再 start，保证只有一个会话 |

## 浏览器兼容矩阵

| 浏览器 | 支持 | 备注 |
|---|---|---|
| Chrome 桌面 | ✅ | Google 云识别，效果最佳 |
| Edge 桌面 | ✅ | 同 Chrome |
| Safari 桌面 | ✅ | iOS/macOS 14.1+ |
| Firefox | ❌ | 按钮 disabled，提示用户 |
| Electron WebView（desktop 包） | ⚠ 取决于版本 | `isSupported` 自动检测，不支持则 disabled |

## 测试与验收

前端无单测体系（仅 agents 包有测试），采用手动验收：

- [ ] Chrome / Edge / Safari 桌面端：长按 → 说话 → 松开 → 文字进输入框 → 编辑 → 发送
- [ ] 三种 djLanguage（zh-CN / zh-HK / en-US）各试一次，识别语言匹配
- [ ] Firefox：麦克风按钮 disabled，tooltip 正确
- [ ] 拒绝麦克风权限：错误提示正确
- [ ] producer 回复中麦克风 disabled
- [ ] 误触 <500ms：丢弃且提示
- [ ] 连续两次长按：第二次结果 append 到第一次后面
- [ ] `npm run lint` 通过

## 未来可扩展（不在本次范围）

- 可在设置中加 STT 语言独立字段（与 djLanguage 解耦）
- 可加后端 STT fallback（Gemini / Whisper），仿照现有 TTS 多 provider 模式
- 可加"点击切换 + 静音自动停止"作为另一种交互模式
