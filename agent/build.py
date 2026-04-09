"""Bundle the StructAI Agent into a single Windows executable.

Usage::

    pip install pyinstaller
    python build.py

The resulting binary is written to ``dist/StructAI-Agent.exe``.

We deliberately don't keep PyInstaller in ``requirements.txt`` so users who
just want to run the agent from source aren't forced to install a 100MB
build toolchain.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ICON = ROOT / "structai_agent" / "assets" / "icon.ico"
ICON_PNG = ROOT / "structai_agent" / "assets" / "icon.png"
# Entry must be a top-level script so PyInstaller doesn't try to execute
# a file that uses ``from .x import y``. ``launcher.py`` lives at the
# project root and re-imports from the package, which keeps relative
# imports working at runtime.
ENTRY = ROOT / "launcher.py"
NAME = "StructAI-Agent"


def main() -> None:
    if shutil.which("pyinstaller") is None:
        print("pyinstaller not found. Install with: pip install pyinstaller")
        sys.exit(1)
    if not ICON.exists():
        print("Icon missing — run `python scripts/generate_icon.py` first.")
        sys.exit(1)

    # Clean previous build artifacts so versions don't get mixed.
    for d in ("build", "dist"):
        p = ROOT / d
        if p.exists():
            shutil.rmtree(p)
    spec = ROOT / f"{NAME}.spec"
    if spec.exists():
        spec.unlink()

    # We need both the .ico (window/exe icon) and the .png (tray icon) to be
    # available at runtime, so we ship them as data files.
    # PyInstaller's --add-data uses ';' on Windows.
    sep = ";" if sys.platform == "win32" else ":"
    add_data = f"{ICON}{sep}structai_agent/assets"
    add_data_png = f"{ICON_PNG}{sep}structai_agent/assets"

    # NOTE: temporarily switched from --windowed to --console so we can see
    # stderr/Python tracebacks while debugging startup crashes. Switch back
    # to --windowed for releases.
    cmd = [
        "pyinstaller",
        "--noconfirm",
        "--clean",
        "--onefile",
        "--console",
        f"--name={NAME}",
        f"--icon={ICON}",
        f"--add-data={add_data}",
        f"--add-data={add_data_png}",
        "--collect-submodules=structai_agent",
        "--collect-submodules=customtkinter",
        "--collect-data=customtkinter",
        "--collect-all=pystray",
        "--collect-all=PIL",
        "--hidden-import=PIL._tkinter_finder",
        "--hidden-import=watchdog.observers",
        "--hidden-import=watchdog.observers.read_directory_changes",
        "--collect-all=comtypes",
        str(ENTRY),
    ]

    print("Running:", " ".join(cmd))
    result = subprocess.run(cmd, cwd=ROOT)
    if result.returncode != 0:
        print("PyInstaller failed.")
        sys.exit(result.returncode)

    out = ROOT / "dist" / f"{NAME}.exe"
    print(f"\nDone. Output: {out}")
    if out.exists():
        size_mb = out.stat().st_size / (1024 * 1024)
        print(f"Size: {size_mb:.1f} MB")


if __name__ == "__main__":
    main()
