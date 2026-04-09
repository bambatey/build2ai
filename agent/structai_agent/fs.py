"""Sandboxed filesystem helpers.

Every public function in this module takes a *root* (the user-chosen folder)
plus a *relative* path coming from the web client. The relative path is
normalised and re-checked against the root before any IO call so the agent
cannot escape the chosen folder.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

# File extensions we treat as plain text. Others are still listed in the tree
# but reads/writes are refused to keep the protocol simple.
TEXT_EXTENSIONS: frozenset[str] = frozenset(
    {
        ".s2k",
        ".$2k",
        ".e2k",
        ".$et",
        ".txt",
        ".md",
        ".csv",
        ".json",
        ".xml",
        ".tcl",
        ".inp",
        ".log",
        ".cfg",
        ".ini",
    }
)

# Hard cap on file size we are willing to read/write through the wire.
MAX_FILE_BYTES = 8 * 1024 * 1024  # 8 MB


class FsError(Exception):
    """Raised for any user-facing filesystem failure."""

    def __init__(self, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.status = status


@dataclass
class FileEntry:
    name: str
    path: str  # forward-slash relative path
    type: str  # "file" | "folder"
    size: int | None = None
    modified: str | None = None  # ISO 8601 UTC
    is_text: bool = False


def _normalise_root(root: str | None) -> Path:
    if not root:
        raise FsError("Root folder is not configured", status=409)
    p = Path(root).expanduser()
    if not p.exists():
        raise FsError(f"Root folder does not exist: {p}", status=409)
    if not p.is_dir():
        raise FsError(f"Root path is not a folder: {p}", status=409)
    return p.resolve()


def _resolve_inside(root: str | None, rel: str) -> tuple[Path, Path]:
    """Return ``(root_path, absolute_target_path)`` after sandbox checks."""
    root_path = _normalise_root(root)

    if rel is None:
        raise FsError("Missing 'path' parameter")
    # Reject absolute paths and Windows drive letters outright.
    if rel.startswith(("/", "\\")) or (len(rel) > 1 and rel[1] == ":"):
        raise FsError("Absolute paths are not allowed")

    # Normalise separators and walk components manually so we don't accept
    # backslash-encoded escapes from clients on non-Windows boxes.
    parts = [p for p in rel.replace("\\", "/").split("/") if p not in ("", ".")]
    for part in parts:
        if part == "..":
            raise FsError("Path traversal is not allowed")

    target = (root_path / Path(*parts)).resolve()
    try:
        target.relative_to(root_path)
    except ValueError as exc:
        raise FsError("Resolved path escapes the sandbox") from exc
    return root_path, target


def _entry_for(root: Path, path: Path) -> FileEntry:
    rel = path.relative_to(root).as_posix() or "."
    is_dir = path.is_dir()
    stat = path.stat()
    ext = path.suffix.lower()
    return FileEntry(
        name=path.name or rel,
        path=rel,
        type="folder" if is_dir else "file",
        size=None if is_dir else stat.st_size,
        modified=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
        is_text=(not is_dir) and ext in TEXT_EXTENSIONS,
    )


def list_tree(root: str | None) -> list[dict]:
    """Return a flat list of every file and folder under the root."""
    root_path = _normalise_root(root)
    entries: list[FileEntry] = []
    for path in _walk(root_path):
        try:
            entries.append(_entry_for(root_path, path))
        except OSError:
            # Skip files we cannot stat (permissions, etc.) so the tree still
            # comes back useful for the rest.
            continue
    entries.sort(key=lambda e: (e.type != "folder", e.path.lower()))
    return [e.__dict__ for e in entries]


def _walk(root: Path) -> Iterable[Path]:
    # Skip dot-folders (.git, .venv, ...) so we don't drown the UI.
    for path in root.rglob("*"):
        if any(part.startswith(".") for part in path.relative_to(root).parts):
            continue
        yield path


def read_file(root: str | None, rel: str) -> str:
    _, target = _resolve_inside(root, rel)
    if not target.exists() or not target.is_file():
        raise FsError("File not found", status=404)
    if target.stat().st_size > MAX_FILE_BYTES:
        raise FsError(
            f"File too large to read over the wire (>{MAX_FILE_BYTES} bytes)",
            status=413,
        )
    if target.suffix.lower() not in TEXT_EXTENSIONS:
        raise FsError("Refusing to read non-text file", status=415)
    return target.read_text(encoding="utf-8", errors="replace")


def write_file(root: str | None, rel: str, content: str) -> FileEntry:
    root_path, target = _resolve_inside(root, rel)
    if target.exists() and target.is_dir():
        raise FsError("Path is a folder, not a file")
    if len(content.encode("utf-8")) > MAX_FILE_BYTES:
        raise FsError(
            f"Content too large to write (>{MAX_FILE_BYTES} bytes)",
            status=413,
        )
    if target.suffix.lower() not in TEXT_EXTENSIONS:
        raise FsError("Refusing to write non-text file", status=415)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    return _entry_for(root_path, target)


def delete_file(root: str | None, rel: str) -> None:
    _, target = _resolve_inside(root, rel)
    if not target.exists():
        raise FsError("File not found", status=404)
    if target.is_dir():
        raise FsError("Refusing to delete a folder")
    target.unlink()
