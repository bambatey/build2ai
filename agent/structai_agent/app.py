"""StructAI Agent — desktop UI.

A small CustomTkinter window that owns an :class:`AgentServer` instance.
The user picks a folder, the agent starts, and the web app talks to it
over HTTP. Closing the window minimises to the system tray so the agent
keeps running in the background.

Run directly with ``python -m structai_agent.app`` or via the packaged
``StructAI-Agent.exe``.
"""

from __future__ import annotations

import argparse
import sys
import threading
import tkinter as tk
import webbrowser
from collections import deque
from pathlib import Path
from tkinter import filedialog, messagebox
from typing import Callable

import customtkinter as ctk

from . import __version__, autostart
from .server import AgentServer

ASSETS = Path(__file__).resolve().parent / "assets"
ICON_PNG = ASSETS / "icon.png"
ICON_ICO = ASSETS / "icon.ico"

WEB_APP_URL = "http://localhost:3000"
LOG_LIMIT = 200


class AgentApp:
    def __init__(self, start_in_tray: bool = False) -> None:
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("dark-blue")

        self.server = AgentServer()
        self.server.add_listener(self._on_log)
        self._log_buffer: deque[str] = deque(maxlen=LOG_LIMIT)
        self._tray = None
        self._tray_thread: threading.Thread | None = None

        self.root = ctk.CTk()
        self.root.title("StructAI Agent")
        self.root.geometry("560x560")
        self.root.minsize(520, 520)
        try:
            if ICON_ICO.exists():
                self.root.iconbitmap(str(ICON_ICO))
        except tk.TclError:
            pass

        self._build_ui()
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

        # Try starting the server immediately so the user lands on a
        # working state. Failures are reported in the log panel.
        try:
            self.server.start()
        except OSError as exc:
            messagebox.showerror("StructAI Agent", f"Port already in use:\n{exc}")
        self._refresh_status()
        self._refresh_root_label()

        if start_in_tray:
            self.root.after(50, self._minimise_to_tray)

    # ---- UI construction ------------------------------------------------

    def _build_ui(self) -> None:
        # Header
        header = ctk.CTkFrame(self.root, fg_color="transparent")
        header.pack(fill="x", padx=20, pady=(20, 10))

        title = ctk.CTkLabel(
            header,
            text="StructAI Agent",
            font=ctk.CTkFont(size=22, weight="bold"),
        )
        title.pack(side="left")

        version = ctk.CTkLabel(
            header,
            text=f"v{__version__}",
            font=ctk.CTkFont(size=11),
            text_color="#6b7280",
        )
        version.pack(side="left", padx=(8, 0), pady=(8, 0))

        # Status card
        status_card = ctk.CTkFrame(self.root, corner_radius=10)
        status_card.pack(fill="x", padx=20, pady=8)

        row = ctk.CTkFrame(status_card, fg_color="transparent")
        row.pack(fill="x", padx=16, pady=(14, 6))
        self.status_dot = ctk.CTkLabel(
            row, text="●", font=ctk.CTkFont(size=18), text_color="#10b981"
        )
        self.status_dot.pack(side="left")
        self.status_label = ctk.CTkLabel(
            row,
            text="Çalışıyor",
            font=ctk.CTkFont(size=14, weight="bold"),
        )
        self.status_label.pack(side="left", padx=(6, 0))

        self.endpoint_label = ctk.CTkLabel(
            status_card,
            text=f"http://{self.server.host}:{self.server.port}",
            font=ctk.CTkFont(size=12),
            text_color="#9ca3af",
        )
        self.endpoint_label.pack(anchor="w", padx=16, pady=(0, 14))

        btns = ctk.CTkFrame(status_card, fg_color="transparent")
        btns.pack(fill="x", padx=16, pady=(0, 14))
        self.start_btn = ctk.CTkButton(
            btns, text="Başlat", width=110, command=self._start
        )
        self.start_btn.pack(side="left")
        self.stop_btn = ctk.CTkButton(
            btns,
            text="Durdur",
            width=110,
            command=self._stop,
            fg_color="#374151",
            hover_color="#4b5563",
        )
        self.stop_btn.pack(side="left", padx=(8, 0))
        ctk.CTkButton(
            btns,
            text="Web Uygulamasını Aç",
            width=180,
            command=lambda: webbrowser.open(WEB_APP_URL),
            fg_color="#1f2937",
            hover_color="#374151",
        ).pack(side="right")

        # Folder card
        folder_card = ctk.CTkFrame(self.root, corner_radius=10)
        folder_card.pack(fill="x", padx=20, pady=8)

        ctk.CTkLabel(
            folder_card,
            text="DİNLENEN KLASÖR",
            font=ctk.CTkFont(size=10, weight="bold"),
            text_color="#6b7280",
        ).pack(anchor="w", padx=16, pady=(14, 4))

        self.folder_label = ctk.CTkLabel(
            folder_card,
            text="(seçilmedi)",
            font=ctk.CTkFont(size=13),
            wraplength=480,
            justify="left",
            anchor="w",
        )
        self.folder_label.pack(anchor="w", padx=16, pady=(0, 12), fill="x")

        folder_btns = ctk.CTkFrame(folder_card, fg_color="transparent")
        folder_btns.pack(fill="x", padx=16, pady=(0, 14))
        ctk.CTkButton(
            folder_btns,
            text="Klasör Seç",
            command=self._pick_folder,
            width=140,
        ).pack(side="left")
        ctk.CTkButton(
            folder_btns,
            text="Temizle",
            command=lambda: self._set_root(None),
            width=100,
            fg_color="#374151",
            hover_color="#4b5563",
        ).pack(side="left", padx=(8, 0))

        # Settings
        settings_card = ctk.CTkFrame(self.root, corner_radius=10)
        settings_card.pack(fill="x", padx=20, pady=8)
        self.autostart_var = ctk.BooleanVar(value=autostart.is_enabled())
        ctk.CTkSwitch(
            settings_card,
            text="Windows başlangıcında otomatik çalıştır",
            variable=self.autostart_var,
            command=self._toggle_autostart,
        ).pack(anchor="w", padx=16, pady=14)

        # Log panel
        log_card = ctk.CTkFrame(self.root, corner_radius=10)
        log_card.pack(fill="both", expand=True, padx=20, pady=(8, 20))
        ctk.CTkLabel(
            log_card,
            text="LOG",
            font=ctk.CTkFont(size=10, weight="bold"),
            text_color="#6b7280",
        ).pack(anchor="w", padx=16, pady=(14, 4))
        self.log_text = ctk.CTkTextbox(
            log_card,
            font=ctk.CTkFont(size=11, family="Consolas"),
            wrap="none",
        )
        self.log_text.pack(fill="both", expand=True, padx=16, pady=(0, 14))
        self.log_text.configure(state="disabled")

    # ---- actions --------------------------------------------------------

    def _start(self) -> None:
        if self.server.running:
            return
        try:
            self.server.start()
        except OSError as exc:
            messagebox.showerror("StructAI Agent", f"Başlatılamadı: {exc}")
        self._refresh_status()

    def _stop(self) -> None:
        self.server.stop()
        self._refresh_status()

    def _pick_folder(self) -> None:
        initial = self.server.root or str(Path.home())
        path = filedialog.askdirectory(
            title="Dinlenecek klasörü seç",
            initialdir=initial,
        )
        if not path:
            return
        self._set_root(path)

    def _set_root(self, path: str | None) -> None:
        try:
            self.server.set_root(path)
        except Exception as exc:  # pragma: no cover
            messagebox.showerror("StructAI Agent", f"Klasör ayarlanamadı: {exc}")
            return
        self._refresh_root_label()

    def _toggle_autostart(self) -> None:
        if self.autostart_var.get():
            ok = autostart.enable()
            msg = "Otomatik başlatma açıldı" if ok else "Otomatik başlatma açılamadı"
        else:
            ok = autostart.disable()
            msg = "Otomatik başlatma kapatıldı" if ok else "Devre dışı bırakılamadı"
        self._on_log(msg)
        if not ok:
            # Roll the switch back so the UI mirrors the real state.
            self.autostart_var.set(autostart.is_enabled())

    # ---- view refresh ---------------------------------------------------

    def _refresh_status(self) -> None:
        if self.server.running:
            self.status_label.configure(text="Çalışıyor")
            self.status_dot.configure(text_color="#10b981")
        else:
            self.status_label.configure(text="Durdu")
            self.status_dot.configure(text_color="#ef4444")

    def _refresh_root_label(self) -> None:
        self.folder_label.configure(text=self.server.root or "(seçilmedi)")

    def _on_log(self, message: str) -> None:
        self._log_buffer.append(message)
        # Tk widgets must be touched on the main thread.
        self.root.after(0, self._flush_log)

    def _flush_log(self) -> None:
        self.log_text.configure(state="normal")
        self.log_text.delete("1.0", "end")
        self.log_text.insert("end", "\n".join(self._log_buffer))
        self.log_text.see("end")
        self.log_text.configure(state="disabled")

    # ---- tray integration ----------------------------------------------

    def _on_close(self) -> None:
        # Closing the window just hides it; the user quits via the tray
        # menu so the HTTP server keeps serving the web app.
        self._minimise_to_tray()

    def _minimise_to_tray(self) -> None:
        self.root.withdraw()
        if self._tray is None:
            self._start_tray()

    def _start_tray(self) -> None:
        try:
            import pystray
            from PIL import Image
        except ImportError:
            # No tray support — just hide the window. The user can bring
            # it back via Task Manager / re-launching the exe.
            self._on_log("pystray not installed; tray disabled")
            return

        if not ICON_PNG.exists():
            self._on_log("Tray icon missing")
            return

        image = Image.open(ICON_PNG)

        def _show(icon, item):
            self.root.after(0, self._show_window)

        def _quit(icon, item):
            self.root.after(0, self._quit_app)

        menu = pystray.Menu(
            pystray.MenuItem("StructAI Agent'ı Aç", _show, default=True),
            pystray.MenuItem("Çıkış", _quit),
        )
        self._tray = pystray.Icon("structai-agent", image, "StructAI Agent", menu)

        def _run():
            try:
                assert self._tray is not None
                self._tray.run()
            except Exception as exc:  # pragma: no cover
                self._on_log(f"Tray error: {exc}")

        self._tray_thread = threading.Thread(target=_run, daemon=True)
        self._tray_thread.start()

    def _show_window(self) -> None:
        self.root.deiconify()
        self.root.lift()
        self.root.focus_force()

    def _quit_app(self) -> None:
        try:
            self.server.stop()
        finally:
            if self._tray is not None:
                try:
                    self._tray.stop()
                except Exception:
                    pass
            self.root.destroy()

    # ---- lifecycle ------------------------------------------------------

    def run(self) -> None:
        self.root.mainloop()


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="structai-agent")
    parser.add_argument(
        "--tray",
        action="store_true",
        help="Start minimised to the system tray (used by autostart).",
    )
    return parser.parse_args(argv)


def main() -> None:
    args = parse_args(sys.argv[1:])
    app = AgentApp(start_in_tray=args.tray)
    app.run()


if __name__ == "__main__":
    main()
