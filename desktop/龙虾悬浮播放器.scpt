
-- 🦞 龙虾电台悬浮播放器
-- 运行方式：双击即可，或者在终端运行 osascript 龙虾悬浮播放器.scpt

-- 检查网页是否可以访问
do shell script "curl -s --connect-timeout 2 http://localhost:4000 > /dev/null 2>&1 || echo 'NOT_RUNNING'"
set result to the result

if result is "NOT_RUNNING" then
    display dialog "⚠️ 后端服务未启动！" & return & return & "正在自动启动龙虾电台服务..." buttons {"确定"} default button 1 giving up after 2
    
    -- 启动后端服务
    do shell script "cd /Users/gordon/.openclaw/workspace/lobster-radio && npm run dev > /tmp/lobster-radio.log 2>&1 &"
    
    -- 等待服务启动
    delay 4
end if

-- 使用 Google Chrome 创建悬浮窗口
tell application "Google Chrome"
    activate
    
    -- 检查是否已经有龙虾电台的窗口
    set windowExists to false
    repeat with w in windows
        if title of w contains "Lobster Radio" or title of w contains "龙虾电台" then
            set windowExists to true
            set index of w to 1
            exit repeat
        end if
    end repeat
    
    if not windowExists then
        -- 创建新窗口
        make new window with properties {URL:"http://localhost:5173"}
        delay 0.5
        
        -- 设置窗口大小和位置
        tell window 1
            set bounds to {20, 80, 440, 780}
            set active tab index to 1
        end tell
    end if
end tell

-- 显示成功提示
display dialog "🦞 龙虾电台悬浮播放器已启动！" & return & return & ¬
    "✅ 窗口已自动置顶到左上角" & return & ¬
    "💡 可以拖动调整窗口大小和位置" & return & ¬
    "⌨️  Cmd+Tab 可以快速切换" buttons {"开始听歌！"} default button 1 with icon note giving up after 3

-- 提示如何置顶
display dialog "💡 小技巧：" & return & return & ¬
    "想要窗口一直置顶？" & return & ¬
    "在 Chrome 中：" & return & ¬
    "1. 按 Cmd+Ctrl+F 进入全屏" & return & ¬
    "2. 或者用第三方工具如 Helium / Float Player" buttons {"知道了"} default button 1 with icon note
