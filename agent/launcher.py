"""PyInstaller entry script.

This file lives at the *root* of the agent project (next to ``build.py``)
so PyInstaller can pick it up as a normal top-level script. It imports
the real entry point from the ``structai_agent`` package, which keeps
the package's relative imports working in the bundled exe.

Wraps the actual entry point in a hard try/except so we never lose a
startup traceback to the windowed-mode void: any failure is mirrored to
``%TEMP%\\structai-agent-crash.log`` and (best-effort) printed.
"""

from __future__ import annotations

import os
import sys
import traceback


def _crash(exc: BaseException) -> None:
    log_path = os.path.join(
        os.environ.get("TEMP", os.path.expanduser("~")),
        "structai-agent-crash.log",
    )
    tb = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
    try:
        with open(log_path, "w", encoding="utf-8") as fh:
            fh.write(tb)
    except OSError:
        pass
    try:
        print(tb, file=sys.stderr)
        sys.stderr.flush()
    except Exception:
        pass
    # Best-effort native message box so the user always sees *something*.
    try:
        import ctypes

        ctypes.windll.user32.MessageBoxW(
            0,
            f"StructAI Agent başlatılamadı:\n\n{exc}\n\nDetay: {log_path}",
            "StructAI Agent",
            0x10,  # MB_ICONERROR
        )
    except Exception:
        pass


def main() -> int:
    try:
        from structai_agent.app import main as real_main

        real_main()
        return 0
    except BaseException as exc:
        _crash(exc)
        return 1


if __name__ == "__main__":
    sys.exit(main())
