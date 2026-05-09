#!/bin/bash

# 龙虾电台悬浮播放器 - 一键启动脚本
# 功能：打开一个置顶的浏览器窗口作为悬浮播放器

cd "$(dirname "$0")"

echo "🦞 正在启动龙虾电台悬浮播放器..."

# 检查后端服务是否在运行
if ! curl -s http://localhost:4000 > /dev/null 2>&1; then
    echo "🔧 正在启动后端服务..."
    cd ..
    npm run dev > /tmp/lobster-radio.log 2>&1 &
    sleep 3
fi

# 使用 AppleScript 打开一个独立的 Chrome 窗口，并置顶
osascript << 'EOF'
tell application "Google Chrome"
    activate
    set newWindow to make new window with properties {URL:"http://localhost:5173"}
    tell newWindow
        set bounds to {20, 80, 440, 760}
        set active tab index to 1
    end tell
end tell

-- 尝试让窗口置顶（需要辅助功能权限）
tell application "System Events"
    tell process "Google Chrome"
        -- 可以在这里添加自定义行为
    end tell
end tell

display dialog "🦞 龙虾电台悬浮播放器已启动！" & return & return & ¬
    "💡 提示：" & return & ¬
    "   • 窗口已自动定位到左上角" & return & ¬
    "   • 可以拖动调整位置和大小" & return & ¬
    "   • 建议使用 Chrome 或 Edge 浏览器" buttons {"好的"} default button 1 with icon note giving up after 5
EOF

echo "✅ 启动完成！"
