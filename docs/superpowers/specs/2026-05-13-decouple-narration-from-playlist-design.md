# 设计：电台模式旁白与播放列表解耦

## 上下文

当前电台模式中，音乐播放和旁白（intro/outro）共享同一个 `HTMLAudioElement`。这导致：

- 当用户切歌时，任何正在播放的旁白会被立即终止
- 用户需求：切歌不应该打断正在播放的旁白，旁白应该继续播完

## 需求

### 功能需求

| 场景 | 期望行为 |
|------|----------|
| intro 正在播放时切歌 | intro 继续播放完，不被打断 |
| outro 正在播放时切歌 | outro 继续播放完，不被打断 |
| 用户点击跳过按钮 | 只发送跳过请求给 AI DJ (producer)，不立即切歌，由 AI 决定何时切歌 |
| AI DJ 请求切歌 | 切歌不影响正在播放的旁白，旁白继续播完 |
| 用户点击暂停按钮 | 暂停音乐 **和** 所有正在播放的旁白 |
| 用户点击播放按钮 | 恢复音乐 **和** 所有正在播放的旁白 |
| mid-track trivia | 保持当前行为（已经使用独立音频） |
| 音量调节 | 音乐和旁白使用相同音量设置 |

### 非功能需求

- 旁白播放完成后自动清理音频实例，避免内存泄漏
- 保持现有错误处理行为不变
- 电台节奏由 AI DJ (producer) 主导，用户只能请求跳过

## 架构设计

### 方案：独立 Audio 实例

选择方案一：**每个旁白使用独立的 `HTMLAudioElement` 实例**。

### 组件职责

| 组件 | 职责 |
|------|------|
| Music Player | 一个固定的 `HTMLAudioElement`，只负责音乐播放 |
| Narration Player | 动态创建 `HTMLAudioElement`，每个旁白一个实例 |
| RadioModePage | 管理所有活动的旁白实例，统一控制暂停/恢复/音量 |

### 数据结构

在 `RadioModePage` 添加一个 ref 来跟踪所有活跃的旁白实例：

```typescript
interface NarrationInstance {
  audio: HTMLAudioElement;
  onEnded: () => void;
}

const activeNarrationsRef = useRef<NarrationInstance[]>([]);
```

### 核心流程变化

#### 1. 播放 intro 然后音乐（`playNarrationThenMusic`）

```
用户请求播放新曲目
  ↓
如果有 cached narration audio → 使用 cached
否则 → 请求 TTS 生成音频 → 创建 Blob URL
  ↓
创建新的 HTMLAudioElement 用于这个旁白
  ↓
配置事件监听：
  - ended: 播放完成 → 开始音乐 → 从 activeNarrations 移除 → 销毁 audio → 释放 URL
  - error: 错误处理 → 直接开始音乐 → 清理
  ↓
设置音量（同步主音量）→ 开始播放
  ↓
音乐等待旁白结束后开始播放（和原来逻辑一样）
```

#### 2. 播放 outro 然后下一首（`playOutroThenNext`）

```
当前音乐播放完毕
  ↓
请求生成 outro
  ↓
创建独立 HTMLAudioElement
  ↓
播放 outro，音乐立即切到下一首
  ↓
outro 播放完自动清理
```

**变化**：原来 outro 播完才会切到下一首 → **现在音乐立即切走，outro 后台继续播放**。

#### 3. 用户点击跳过按钮（主界面）

```
用户点击歌曲卡片上的"Skip"按钮
  ↓
自动在聊天框发送消息："我想要跳过这首歌"给 AI DJ
  ↓
不立即切歌，由 AI DJ 思考后决定何时切歌
  ↓
正在播放的旁白完全不受影响，继续播放
```

#### 4. AI DJ 请求切歌

```
AI DJ 决定切歌，调用切歌回调
  ↓
停止当前音乐
  ↓
立即开始播放下一首（音乐部分）
  ↓
**不对现有正在播放的旁白做任何操作** → 让它们继续播完
```

#### 5. 暂停/播放（`handlePlayPause`）

```
切换音乐播放状态
  ↓
遍历 activeNarrationsRef 中所有实例，同步应用暂停/播放
```

#### 5. 音量同步

如果全局有音量控制（当前代码没看到，但预留支持），所有新创建的旁白实例会同步音量。

### 内存管理

- 旁白播放 ended 或 error 后立即：
  1. 从 `activeNarrationsRef` 移除
  2. 移除所有事件监听器
  3. `audio.pause()`
  4. `URL.revokeObjectURL(url)`
  5. 让 GC 回收

### 错误处理

保持现有错误处理策略：

- TTS 请求失败 → 直接播放音乐，不播放旁白
- 旁白播放失败 → 继续音乐流程，不阻塞

## 受影响的文件

| 文件 | 修改类型 | 说明 |
|------|----------|------|
| `frontend/src/pages/RadioModePage.tsx` | 大幅修改 | 主要重构，添加独立旁白实例管理；修改Skip按钮行为 |
| `frontend/src/components/ChatPanel.tsx` | 小幅修改 | 暴露方法允许外部触发发送消息 |
| `frontend/src/hooks/useAudioPlayer.ts` | 无修改 | 音乐继续使用它 |

## 优点和缺点对比

### 优点

- ✅ 完全满足需求：切歌确实不影响旁白
- ✅ 实现简单，每个旁白独立，不需要复杂的队列管理
- ✅ 符合直觉：用户切歌是切音乐，DJ已经在说的话就让它说完
- ✅ 容易测试，每个实例独立

### 缺点

- ⚠️ 极端情况下可能多个旁白同时播放（比如用户连续快速切歌）
- ⚠️ 会有多个音频实例同时发声，可能音乐和旁白重叠。但这符合需求，用户要求解耦。

## 验收标准

1. [ ] 用户点击跳过按钮只发消息给 AI DJ，不立即切歌
2. [ ] AI DJ 请求切歌时，当 intro 正在播放，intro 继续播放完不被打断
3. [ ] AI DJ 请求切歌时，当 outro 正在播放，outro 继续播放完不被打断
4. [ ] 点击暂停，音乐和所有旁白都暂停
5. [ ] 点击播放，音乐和所有旁白都恢复
6. [ ] 旁白播放完后正确清理资源，没有内存泄漏
7. [ ] mid-track trivia 行为保持不变
8. [ ] 正常播放流程（不切歌）行为和原来保持一致
