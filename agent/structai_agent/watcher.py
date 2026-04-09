"""Optional file-system watcher backed by ``watchdog``.

If ``watchdog`` is not installed (or fails to start) the agent still works —
clients just don't get push notifications and have to refresh manually.
"""

from __future__ import annotations

import threading
import time
from pathlib import Path
from queue import Empty, Queue
from typing import Iterator

try:
    from watchdog.events import FileSystemEventHandler
    from watchdog.observers import Observer

    _WATCHDOG_AVAILABLE = True
except ImportError:  # pragma: no cover
    _WATCHDOG_AVAILABLE = False


class FolderWatcher:
    """Coalesces filesystem events from a single root and broadcasts to subscribers."""

    def __init__(self) -> None:
        self._root: Path | None = None
        self._observer = None
        self._lock = threading.Lock()
        self._subscribers: list[Queue[dict]] = []

    @property
    def available(self) -> bool:
        return _WATCHDOG_AVAILABLE

    def set_root(self, root: str | None) -> None:
        with self._lock:
            self._stop_locked()
            if not root or not _WATCHDOG_AVAILABLE:
                return
            path = Path(root).expanduser()
            if not path.is_dir():
                return
            self._root = path.resolve()
            self._start_locked()

    def subscribe(self) -> Queue[dict]:
        q: Queue[dict] = Queue(maxsize=256)
        with self._lock:
            self._subscribers.append(q)
        return q

    def unsubscribe(self, q: Queue[dict]) -> None:
        with self._lock:
            try:
                self._subscribers.remove(q)
            except ValueError:
                pass

    def stream(self, q: Queue[dict]) -> Iterator[dict]:
        try:
            while True:
                try:
                    yield q.get(timeout=15)
                except Empty:
                    # Heartbeat keeps SSE connections alive through proxies.
                    yield {"type": "ping", "ts": time.time()}
        finally:
            self.unsubscribe(q)

    # ---- internals -----------------------------------------------------

    def _broadcast(self, event: dict) -> None:
        with self._lock:
            for q in list(self._subscribers):
                if q.full():
                    # Drop the oldest event so slow clients don't stall us.
                    try:
                        q.get_nowait()
                    except Empty:
                        pass
                q.put_nowait(event)

    def _start_locked(self) -> None:
        if not _WATCHDOG_AVAILABLE or self._root is None:
            return
        handler = _Handler(self._root, self._broadcast)
        self._observer = Observer()
        self._observer.schedule(handler, str(self._root), recursive=True)
        try:
            self._observer.start()
        except Exception:  # pragma: no cover
            self._observer = None

    def _stop_locked(self) -> None:
        if self._observer is not None:
            try:
                self._observer.stop()
                self._observer.join(timeout=2)
            except Exception:
                pass
            self._observer = None
        self._root = None


if _WATCHDOG_AVAILABLE:

    class _Handler(FileSystemEventHandler):  # type: ignore[misc]
        def __init__(self, root: Path, sink) -> None:
            super().__init__()
            self._root = root
            self._sink = sink

        def _to_rel(self, raw: str) -> str | None:
            try:
                return Path(raw).resolve().relative_to(self._root).as_posix()
            except (OSError, ValueError):
                return None

        def _emit(self, kind: str, raw: str, dest: str | None = None) -> None:
            rel = self._to_rel(raw)
            if rel is None:
                return
            payload = {"type": kind, "path": rel, "ts": time.time()}
            if dest is not None:
                dest_rel = self._to_rel(dest)
                if dest_rel is not None:
                    payload["destPath"] = dest_rel
            self._sink(payload)

        def on_created(self, event):  # type: ignore[override]
            self._emit("created", event.src_path)

        def on_modified(self, event):  # type: ignore[override]
            if not event.is_directory:
                self._emit("modified", event.src_path)

        def on_deleted(self, event):  # type: ignore[override]
            self._emit("deleted", event.src_path)

        def on_moved(self, event):  # type: ignore[override]
            self._emit("moved", event.src_path, event.dest_path)
