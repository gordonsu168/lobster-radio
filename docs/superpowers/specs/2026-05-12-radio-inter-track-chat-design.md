# 电台歌曲间闲聊功能设计

## 概述

为 Infinite AI Radio 模式增加**歌曲间DJ闲聊**功能，增强真实电台感。每首歌播放结束后，DJ会针对刚播放完的歌曲说一段简短评论，然后再介绍下一首歌。

## 背景

当前 Radio 模式只在每首歌播放前有新歌介绍，歌曲之间直接切换，缺少真实电台中DJ串场的自然感觉。增加串场闲聊能大幅提升沉浸感。

## 需求

- ✅ 每首歌结束后都插入闲聊（用户要求）
- ✅ 闲聊内容基于刚播放完的歌曲（上下文关联型）
- ✅ 歌曲播放中插入冷知识旁白（新增需求）
  - 在歌曲播放到一半左右轻声插入一段简短冷知识/有趣事实
  - 只有确实有料才加，不是每首都强制有
  - 内容简短，不打断听歌体验
- ✅ 混合模式：预存素材优先，AI生成作为后备
- ✅ 闲聊/旁白都通过TTS朗读，和开场白一样
- ✅ 保持原有播放流程流畅，不增加过多延迟

## 架构设计

### 数据模型扩展

在 `SongWiki` 类型中扩展 `djMaterial` 字段：

```typescript
interface SongWiki {
  // ... existing fields
  djMaterial?: {
    intro?: string[];      // 开场介绍素材
    outro?: string[];      // 结束闲聊素材（新增）- 播放完后说的评论
    vibe?: string[];       // 感受评价素材
    funFact?: string[];    // 有趣事实素材
  };
}
```

### 后端新增接口

新增 `POST /api/wiki/outro/:id` 接口：

- 输入：`{ songId, style, language }`
- 输出：`{ songId, outro, generated }`
- 逻辑：
  1. 如果 `djMaterial.outro` 有内容，随机选一条返回
  2. 如果没有内容，调用 AI（NarratorAgent）基于这首歌信息生成一段简短评论
  3. 返回结果

### 播放流程变更

**原有流程：**
```
currentTrack playing → ended → generate narration for nextTrack → play narration → play nextTrack
```

**歌曲间闲聊 + 歌中插播新流程：**
```
nextTrack loading → play music
  ↓
[if has mid-track trivia]
  wait until ~30-50% progress → play trivia voice (lower music volume temporarily) → restore volume → continue playing
  ↓
music ended → generate outro for currentTrack → play outro → generate narration for nextTrack → play narration → play nextTrack
```

*说明：mid-track trivia 是可选的，只有当歌曲有 `djMaterial.funFact` 素材时才会插播*

### 音量处理

歌曲播放过程中插播冷知识时，需要：
1. 将原歌曲音量降到 ~20-30%
2. 播放TTS旁白
3. 旁白结束后恢复原音量

这样保证旁白听得清，又不打断听歌体验。

### AI 提示词设计

NarratorAgent 需要新增生成 outro 的系统提示词：

```
你是龙虾电台的DJ，刚播放完一首歌。用1-2句话简单评价一下刚听完的这首歌，然后自然过渡到下一首歌。
保持亲切自然的语气，不要太长。
```

## 前端修改点

在 `RadioModePage.tsx` 中：

1. `handleTrackEnd()` 方法需要修改：歌曲结束后先请求并播放 outro
2. 新增状态 `currentOutro` 显示当前闲聊文本在UI上
3. 在播放区域新增一个 "DJ Outro" 展示区域，类似当前的 "DJ Intro"
4. 新增 `handleTimeUpdate` 监听歌曲播放进度，在大约 40% 进度时检查是否有 mid-track 冷知识需要插播
5. 插播逻辑：降低主音乐音量 → 播放冷知识TTS → 恢复主音乐音量
6. 新增状态 `currentTrivia` 显示当前冷知识文本在UI上

## 后端新增接口

新增 `POST /api/wiki/trivia/:id` 接口：

- 输入：`{ songId, style, language }`
- 输出：`{ songId, trivia, hasTrivia: boolean }`
- 逻辑：
  1. 如果 `djMaterial.funFact` 有内容，随机选一条返回，`hasTrivia = true`
  2. 如果没有内容，返回 `hasTrivia = false`
  3. （可选：如果需要可以让AI生成，但用户要求"确实有趣的才加上"，所以这里只返回预存素材）

## AI 提示词补充

NarratorAgent 需要新增生成 outro 的系统提示词：

```
你是龙虾电台的DJ，刚播放完一首歌。用1-2句话简单评价一下刚听完的这首歌，然后自然过渡到下一首歌。
保持亲切自然的语气，不要太长。
```

## 素材积累策略

- 启动时自动从现有曲库导入，逐步积累
- 也支持手动编辑 Song Wiki 添加素材
- AI fallback 保证即使没有素材也能正常工作

## 优缺点分析

| 优点 | 挑战 |
|------|------|
| 大幅增强真实电台沉浸感 | 每首歌多一次TTS请求（outro），总播放延迟增加约1-3秒 |
| 歌中插播冷知识增加趣味性 | 需要前端处理音量渐变，逻辑稍复杂 |
| 混合模式兼顾速度和质量 | 需要逐步积累djMaterial素材 |
| 不破坏现有架构，增量修改 | - |

## 实现顺序

1. 后端：确认 SongWiki 数据结构已经包含 djMaterial
2. 后端：新增 outro 生成 API
3. 后端：新增 trivia 获取 API
4. 前端：修改播放流程，歌曲结束后增加 outro 播放
5. 前端：UI 展示 outro 和 trivia 文本
6. 前端：实现歌中插播逻辑 + 音量自动调节
7. 测试验证整体流畅度
