"""Windows autostart registration via the per-user Run registry key.

We deliberately use ``HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run``
because it does not require admin rights and is removed cleanly on user
profile deletion.

The functions degrade to no-ops on non-Windows platforms so the rest of
the agent stays portable.
"""

from __future__ import annotations

import sys
from pathlib import Path

REG_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
REG_NAME = "StructAI Agent"


def _winreg():
    if sys.platform != "win32":
        return None
    try:
        import winreg  # type: ignore[import-not-found]

        return winreg
    except ImportError:  # pragma: no cover
        return None


def _quoted(path: str) -> str:
    return f'"{path}"'


def current_executable() -> str:
    """Return the command we want Windows to run on login.

    When packaged with PyInstaller ``sys.frozen`` is set and ``sys.executable``
    points at the bundled exe; otherwise we fall back to running the module
    via the current Python interpreter.
    """
    if getattr(sys, "frozen", False):
        return _quoted(sys.executable) + " --tray"
    py = sys.executable or "python"
    return f"{_quoted(py)} -m structai_agent.app --tray"


def is_enabled() -> bool:
    winreg = _winreg()
    if winreg is None:
        return False
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, REG_KEY) as key:
            value, _ = winreg.QueryValueEx(key, REG_NAME)
            return bool(value)
    except FileNotFoundError:
        return False
    except OSError:
        return False


def enable() -> bool:
    winreg = _winreg()
    if winreg is None:
        return False
    cmd = current_executable()
    try:
        with winreg.OpenKey(
            winreg.HKEY_CURRENT_USER, REG_KEY, 0, winreg.KEY_SET_VALUE
        ) as key:
            winreg.SetValueEx(key, REG_NAME, 0, winreg.REG_SZ, cmd)
        return True
    except OSError:
        return False


def disable() -> bool:
    winreg = _winreg()
    if winreg is None:
        return False
    try:
        with winreg.OpenKey(
            winreg.HKEY_CURRENT_USER, REG_KEY, 0, winreg.KEY_SET_VALUE
        ) as key:
            winreg.DeleteValue(key, REG_NAME)
        return True
    except FileNotFoundError:
        return True
    except OSError:
        return False
