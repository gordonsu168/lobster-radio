
-- 龙虾电台悬浮播放器
-- 用法：双击运行，或者用 osascript 命令执行

tell application "System Events"
    -- 检查是否已经有悬浮窗口在运行
    set isRunning to false
    repeat with p in every process
        if name of p is "Electron" or name of p is "龙虾电台" then
            set isRunning to true
            exit repeat
        end if
    end repeat
end tell

if isRunning then
    display dialog "龙虾电台已经在运行中！" buttons {"知道了"} default button 1 with icon note
    return
end if

-- 使用 Node 启动 Electron 悬浮窗
do shell script "cd /Users/gordon/.openclaw/workspace/lobster-radio/desktop && /opt/homebrew/bin/node start-electron.js &> /dev/null &"

display dialog "🦞 龙虾电台悬浮窗已启动！" & return & return & "✅ 自动悬浮置顶" & return & "✅ 点击托盘图标控制" & return & "✅ 快捷键 Cmd+Shift+L 显示/隐藏" buttons {"好的"} default button 1 with icon note giving up after 3
