import asyncio
import os
import sys
import httpx
from pathlib import Path
from typing import Any

from textual.app import App, ComposeResult
from textual.widgets import Header, Footer, Input, Static, Label
from textual.containers import Horizontal, Vertical, Container, VerticalScroll
from textual import work
from textual.reactive import reactive

# 导入 Nanobot 模块
# 确保 cli 路径在 sys.path 中，以便加载本地的 nanobot
CLI_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(CLI_DIR / "nanobot"))

from nanobot.cli.commands import _load_runtime_config, sync_workspace_templates
from nanobot.bus.queue import MessageBus
from nanobot.bus.events import InboundMessage
from nanobot.agent.loop import AgentLoop
from nanobot.cron.service import CronService
from nanobot.providers.image_generation import image_gen_provider_configs

API_BASE = "http://localhost:4000/api/agent/x"

class PlayerWidget(Static):
    """显示播放状态的 Widget"""
    track_title = reactive("IDLE")
    status = reactive("STANDBY")
    progress = reactive(0.0)

    def render(self) -> str:
        status_icon = "▶" if self.status == "PLAYING" else "⏸" if self.status == "PAUSED" else "🎙️" if self.status == "NARRATING" else "■"
        status_color = "green" if self.status == "PLAYING" else "yellow" if self.status == "NARRATING" else "red"
        
        return (
            f"[bold magenta]📻 CONSOLE[/bold magenta]\n\n"
            f"[bold white]Status:[/bold white] [{status_color}]{status_icon} {self.status}[/{status_color}]\n"
            f"[bold white]Track :[/bold white] {self.track_title[:35]}\n"
        )

class DNAWidget(Static):
    """显示 🧬 Aesthetic DNA 的 Widget"""
    low = reactive(0.0)
    mid = reactive(0.0)
    high = reactive(0.0)
    precision = reactive(0.0)

    def render(self) -> str:
        def make_bar(val: float) -> str:
            bars = int(val * 10)
            return "█" * bars + "░" * (10 - bars)

        return (
            f"[bold cyan]🧬 AESTHETIC DNA[/bold cyan]\n\n"
            f"LOW  (Bass) : [cyan]{make_bar(self.low)}[/cyan] {(self.low*10):.1f}\n"
            f"MID  (Text) : [cyan]{make_bar(self.mid)}[/cyan] {(self.mid*10):.1f}\n"
            f"HIGH (Air)  : [cyan]{make_bar(self.high)}[/cyan] {(self.high*10):.1f}\n\n"
            f"PRECISION   : [bold yellow]{(self.precision*100):.2f}%[/bold yellow]"
        )

class DJXTUI(App):
    BINDINGS = [
        ("ctrl+p", "toggle_pause", "Play/Pause"),
        ("ctrl+n", "next_track", "Next Song"),
        ("ctrl+k", "stop_track", "Stop Player"),
        ("ctrl+r", "radio_mode", "Radio Mode"),
    ]

    CSS = """
    Screen {
        background: #121214;
    }
    #main-container {
        height: 100%;
        margin-bottom: 1;
    }
    #left-pane {
        width: 60%;
        height: 100%;
        border-right: tall #232326;
        padding-right: 1;
    }
    #right-pane {
        width: 40%;
        height: 100%;
        padding-left: 1;
    }
    #chat-container {
        height: 100%;
        background: #121214;
        padding: 1;
    }
    /* 每一个聊天气泡/消息段落的样式 */
    .chat-msg {
        margin-bottom: 1;
        height: auto;
    }
    #player-panel {
        height: 40%;
        background: #1a1a1e;
        border: solid #34343a;
        margin-bottom: 1;
        padding: 1;
    }
    #dna-panel {
        height: 60%;
        background: #1a1a1e;
        border: solid #34343a;
        padding: 1;
    }
    #input-container {
        height: auto;
        dock: bottom;
    }
    #input-box {
        background: #1a1a1e;
        border: solid #34343a;
        color: #ffffff;
    }
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.bus = MessageBus()
        self.agent_loop = None
        self.cli_channel = "cli"
        self.cli_chat_id = "direct"
        self.config = None
        
        # 维护当前正在流式输出的消息组件和文本
        self.active_msg_widget = None
        self.active_msg_text = ""
        self.active_thought_widget = None
        self.active_thought_text = ""

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        with Horizontal(id="main-container"):
            with Vertical(id="left-pane"):
                yield VerticalScroll(id="chat-container")
            with Vertical(id="right-pane"):
                yield PlayerWidget(id="player-panel")
                yield DNAWidget(id="dna-panel")
        with Container(id="input-container"):
            yield Input(placeholder="Send a message to DJ-X... (or type /stream, /stop, /play, /pause, /next)", id="input-box")
        yield Footer()

    async def on_mount(self) -> None:
        self.title = "DJ-X (Nanobot Engine) TUI"
        self.sub_title = "The Breacher - Sound Explorer"
        
        # 打印欢迎语
        self.add_system_log("[bold green]💎 DJ-X TUI Online. Ready to breach.[/bold green]")

        # 初始化 Nanobot Core Agent
        try:
            self.config = _load_runtime_config(None, None)
            sync_workspace_templates(self.config.workspace_path)
            cron_store_path = self.config.workspace_path / "cron" / "jobs.json"
            cron = CronService(cron_store_path)
            
            self.agent_loop = AgentLoop.from_config(
                self.config, self.bus,
                cron_service=cron,
                image_generation_provider_configs=image_gen_provider_configs(self.config),
            )
            
            # 使用标准 asyncio.create_task 启动，避免 Textual Worker 触发 anyio 跨 Task 取消异常
            self.agent_task = asyncio.create_task(self.agent_loop.run())
            self.consumer_task = asyncio.create_task(self.run_outbound_consumer_loop())
        except Exception as e:
            self.add_system_log(f"[bold red]❌ Failed to load Nanobot: {e}[/bold red]")

        # 启动定时同步后台状态的任务
        self.set_interval(1.0, self.sync_backend_status)

    async def on_unmount(self) -> None:
        """卸载组件时，干净地取消后台任务并关闭 MCP 进程"""
        if hasattr(self, 'agent_task') and self.agent_task:
            self.agent_task.cancel()
        if hasattr(self, 'consumer_task') and self.consumer_task:
            self.consumer_task.cancel()
            
        if self.agent_loop:
            try:
                # 必须等待 MCP 关闭，否则子进程会变成孤儿进程，并在退出时触发 anyio 错误
                await self.agent_loop.close_mcp()
            except Exception:
                pass

    def add_system_log(self, text: str) -> None:
        """向聊天区域追加一条系统日志"""
        chat_container = self.query_one("#chat-container", VerticalScroll)
        widget = Static(text, classes="chat-msg")
        chat_container.mount(widget)
        widget.scroll_visible()

    async def run_outbound_consumer_loop(self) -> None:
        """从 bus 消费 outbound 消息并流式输出到聊天窗口 (标准协程，非 Textual @work)"""
        chat_container = self.query_one("#chat-container", VerticalScroll)

        while True:
            try:
                msg = await self.bus.consume_outbound()
                metadata = msg.metadata or {}
                
                # 1. 优先处理所有带有 _progress 标记的消息 (包括思考和工具调用)
                if metadata.get("_progress"):
                    is_reasoning = metadata.get("_reasoning", False) or metadata.get("_reasoning_delta", False)
                    is_tool = metadata.get("_tool_hint", False)
                    
                    if is_reasoning and msg.content:
                        # 流式输出思考过程
                        if not self.active_thought_widget:
                            self.active_thought_text = "[dim green]✻ Thinking: "
                            self.active_thought_widget = Static(self.active_thought_text, classes="chat-msg")
                            chat_container.mount(self.active_thought_widget)
                        
                        self.active_thought_text += msg.content
                        self.active_thought_widget.update(self.active_thought_text)
                        self.active_thought_widget.scroll_visible()
                    
                    elif is_tool and msg.content:
                        # 打印工具调用日志
                        # 把当前的思考区域合拢
                        if self.active_thought_widget:
                            self.active_thought_widget = None
                            self.active_thought_text = ""
                            
                        self.add_system_log(f"[dim yellow]🔧 Tool: {msg.content}[/dim yellow]")
                        
                    elif msg.content:
                        # 其它进度提示
                        self.add_system_log(f"[dim cyan]↳ {msg.content}[/dim cyan]")
                        
                    continue

                if metadata.get("_reasoning_end"):
                    # 思考结束，合拢思考区域
                    self.active_thought_widget = None
                    self.active_thought_text = ""
                    continue

                # 2. 处理流式正文输出
                if metadata.get("_stream_delta") and msg.content:
                    delta = msg.content
                    
                    # 确保在开始输出正文前，把思考组件的状态“合拢”
                    if self.active_thought_widget:
                        self.active_thought_widget = None
                        self.active_thought_text = ""

                    if not self.active_msg_widget:
                        # 创建一个新的回复组件
                        self.active_msg_text = "[bold green]DJ-X:[/bold green] "
                        self.active_msg_widget = Static(self.active_msg_text, classes="chat-msg")
                        chat_container.mount(self.active_msg_widget)
                    
                    self.active_msg_text += delta
                    self.active_msg_widget.update(self.active_msg_text)
                    self.active_msg_widget.scroll_visible()
                    continue

                if metadata.get("_stream_end"):
                    # 结束当前流式输出
                    self.active_msg_widget = None
                    self.active_msg_text = ""
                    self.active_thought_widget = None
                    self.active_thought_text = ""
                    continue

                # 3. 兜底普通非流式消息
                if msg.content:
                    sender = metadata.get("sender_id", "assistant")
                    if sender == "user":
                        # 用户消息通常已经由 on_input_submitted 渲染
                        pass
                    else:
                        self.add_system_log(f"[bold green]DJ-X:[/bold green] {msg.content}")

            except asyncio.CancelledError:
                break
            except Exception as e:
                self.add_system_log(f"[bold red]Error in consumer: {e}[/bold red]")

    async def sync_backend_status(self) -> None:
        """定时从 4000 端口获取 Express 后端的播放和 DNA 状态"""
        player_panel = self.query_one("#player-panel", PlayerWidget)
        dna_panel = self.query_one("#dna-panel", DNAWidget)

        try:
            async with httpx.AsyncClient(timeout=0.5) as client:
                # 1. 获取 DNA
                res_dna = await client.post(f"{API_BASE}/init")
                dna = res_dna.json().get("dna")
                if dna:
                    dna_panel.low = dna["spectralMap"]["lowEnd"]
                    dna_panel.mid = dna["spectralMap"]["midTexture"]
                    dna_panel.high = dna["spectralMap"]["highAir"]
                    dna_panel.precision = dna["evolution"]["precision"]

                # 2. 获取播放状态
                res_status = await client.get(f"{API_BASE}/status")
                player = res_status.json()
                if player:
                    if player.get("currentVoice"):
                        player_panel.status = "NARRATING"
                        player_panel.track_title = player["currentVoice"]["title"]
                    elif player.get("currentMusic"):
                        player_panel.status = "PAUSED" if player.get("isPaused") else "PLAYING"
                        player_panel.track_title = player["currentMusic"]["title"]
                    else:
                        player_panel.status = "IDLE"
                        player_panel.track_title = "IDLE"
        except Exception:
            # 后端可能没启动，容错
            player_panel.status = "OFFLINE"
            player_panel.track_title = "4000 port disconnected"

    async def on_input_submitted(self, event: Input.Submitted) -> None:
        """用户提交指令/文本时的回调"""
        query = event.value.strip()
        if not query:
            return

        chat_container = self.query_one("#chat-container", VerticalScroll)
        input_box = self.query_one("#input-box", Input)
        input_box.value = ""

        # 支持退出指令
        if query.lower() in ["exit", "quit", "q"]:
            self.exit()
            return

        # 渲染用户消息
        user_widget = Static(f"[bold blue]You:[/bold blue] {query}", classes="chat-msg")
        chat_container.mount(user_widget)
        user_widget.scroll_visible()

        # 拦截控制指令并直接发送到 Express 后端
        if query.startswith('/') and any(query.startswith(c) for c in ['/stream', '/chat', '/play ', '/pause', '/next', '/stop']):
            cmd_widget = Static(f"[bold yellow]⚒ 正在下达控制信号...[/bold yellow]", classes="chat-msg")
            chat_container.mount(cmd_widget)
            await self.send_backend_command(query, cmd_widget)
            return

        # 普通闲聊：发送到 Nanobot 消息总线
        await self.bus.publish_inbound(InboundMessage(
            channel=self.cli_channel,
            sender_id="user",
            chat_id=self.cli_chat_id,
            content=query,
            metadata={"_wants_stream": True},
        ))

    async def action_toggle_pause(self) -> None:
        """按下 Ctrl+P 切换播放/暂停"""
        chat_container = self.query_one("#chat-container", VerticalScroll)
        cmd_widget = Static("[bold yellow]⚒ [Hotkey] 正在切换播放/暂停...[/bold yellow]", classes="chat-msg")
        chat_container.mount(cmd_widget)
        await self.send_backend_command("/pause", cmd_widget)

    async def action_next_track(self) -> None:
        """按下 Ctrl+N 播放下一首"""
        chat_container = self.query_one("#chat-container", VerticalScroll)
        cmd_widget = Static("[bold yellow]⚒ [Hotkey] 正在切歌...[/bold yellow]", classes="chat-msg")
        chat_container.mount(cmd_widget)
        await self.send_backend_command("/next", cmd_widget)

    async def action_stop_track(self) -> None:
        """按下 Ctrl+K 停止播放"""
        chat_container = self.query_one("#chat-container", VerticalScroll)
        cmd_widget = Static("[bold yellow]⚒ [Hotkey] 正在停止播放...[/bold yellow]", classes="chat-msg")
        chat_container.mount(cmd_widget)
        await self.send_backend_command("/stop", cmd_widget)

    async def action_radio_mode(self) -> None:
        """按下 Ctrl+R 开启电台模式"""
        chat_container = self.query_one("#chat-container", VerticalScroll)
        cmd_widget = Static("[bold yellow]⚒ [Hotkey] 正在开启电台模式 (/stream)...[/bold yellow]", classes="chat-msg")
        chat_container.mount(cmd_widget)
        await self.send_backend_command("/stream", cmd_widget)

    async def send_backend_command(self, command: str, status_widget: Static) -> None:
        """发送控制指令到 4000 端口，并更新状态组件"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(f"{API_BASE}/chat", json={"message": command})
                data = res.json()
                logs = data.get("logs", [])
                if logs:
                    log_text = "\n".join([f"[bold yellow]⚒ {l['content']}[/bold yellow]" for l in logs])
                    status_widget.update(log_text)
                else:
                    status_widget.update("[bold yellow]⚒ 指令已成功发送并生效。[/bold yellow]")
        except Exception as e:
            status_widget.update(f"[bold red]❌ 指令发送失败: {e}[/bold red]")
        status_widget.scroll_visible()

if __name__ == "__main__":
    app = DJXTUI()
    app.run()
