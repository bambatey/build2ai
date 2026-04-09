"""Background job runner for slow filesystem conversions.

We funnel every SAP2000 OAPI call through a single dedicated worker
thread because (a) COM apartment threading needs a stable home and (b)
SAP2000 happily refuses to be opened twice in parallel from the same
process. The HTTP server stays responsive while the worker chews through
its backlog.

Two job kinds exist:

* ``"sdb-to-s2k"`` — convert ``root/<name>.sdb`` to ``root/s2k/<name>.s2k``
* ``"s2k-to-sdb"`` — convert ``root/s2k/<name>.s2k`` to ``root/<name>.sdb``

Both are coalesced: if the same source path is queued twice while the
worker is busy, only the latest version is processed. This matches what
the user actually wants — the file system is the source of truth, not
the queue.
"""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from queue import Empty, Queue
from typing import Callable

from . import sap_oapi

LOG = logging.getLogger("structai_agent.jobs")


def _file_log(msg: str) -> None:
    """Always-on file logger so we can see what the worker is doing
    even when the UI listener never receives the message."""
    import os
    p = os.path.join(
        os.environ.get("TEMP", os.path.expanduser("~")),
        "structai-agent-jobs.log",
    )
    try:
        with open(p, "a", encoding="utf-8") as fh:
            fh.write(msg + "\n")
    except OSError:
        pass

S2K_SUBFOLDER = "s2k"


@dataclass
class Job:
    kind: str  # "sdb-to-s2k" | "s2k-to-sdb"
    src: Path
    dst: Path
    enqueued_at: float = field(default_factory=time.time)


class JobRunner:
    """Single-thread worker that processes :class:`Job` instances in order."""

    def __init__(self, on_status: Callable[[dict], None] | None = None) -> None:
        self._queue: Queue[Job] = Queue()
        self._pending: dict[str, Job] = {}
        # RLock so callers can hold the lock while emitting status events
        # whose callbacks then re-acquire it via ``status()``.
        self._lock = threading.RLock()
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._on_status = on_status
        self._busy = False
        self._last_error: str | None = None
        self._last_completed: float | None = None
        self._processed_count = 0

    # ---- lifecycle -----------------------------------------------------

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(
            target=self._loop, name="structai-jobs", daemon=True
        )
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        # Push a sentinel so the worker wakes up immediately.
        self._queue.put(Job(kind="__stop__", src=Path("."), dst=Path(".")))
        if self._thread is not None:
            self._thread.join(timeout=3)
        self._thread = None

    # ---- public API ----------------------------------------------------

    def enqueue(self, job: Job) -> None:
        _file_log(f"enqueue {job.kind} {job.src}")
        key = f"{job.kind}:{job.src}"
        with self._lock:
            # Coalesce: replace any older queued copy of the same source.
            existing = self._pending.get(key)
            if existing is not None:
                # The worker will just see the new one when it pops the
                # entry; we update its timestamp in place.
                existing.enqueued_at = job.enqueued_at
                self._emit_status()
                return
            self._pending[key] = job
        self._queue.put(job)
        self._emit_status()
        LOG.info("Queued %s: %s", job.kind, job.src.name)

    def status(self) -> dict:
        with self._lock:
            return {
                "running": bool(self._thread and self._thread.is_alive()),
                "busy": self._busy,
                "queued": len(self._pending),
                "processed": self._processed_count,
                "lastError": self._last_error,
                "lastCompleted": self._last_completed,
            }

    # ---- worker loop ---------------------------------------------------

    def _loop(self) -> None:
        _file_log("worker loop start")
        sap_oapi.init_thread()
        try:
            while not self._stop.is_set():
                try:
                    job = self._queue.get(timeout=0.5)
                except Empty:
                    continue

                _file_log(f"popped {job.kind} {job.src}")

                if job.kind == "__stop__":
                    return

                key = f"{job.kind}:{job.src}"
                with self._lock:
                    self._pending.pop(key, None)
                    self._busy = True
                    self._emit_status()

                self._run_one(job)

                with self._lock:
                    self._busy = False
                    self._processed_count += 1
                    self._last_completed = time.time()
                    self._emit_status()
        finally:
            _file_log("worker loop exit")
            sap_oapi.shutdown_thread()

    def _run_one(self, job: Job) -> None:
        _file_log(f"running {job.kind}: {job.src} -> {job.dst}")
        LOG.info("Running %s: %s -> %s", job.kind, job.src.name, job.dst.name)
        try:
            if job.kind == "sdb-to-s2k":
                sap_oapi.sdb_to_s2k(job.src, job.dst)
            elif job.kind == "s2k-to-sdb":
                sap_oapi.s2k_to_sdb(job.src, job.dst)
            else:
                raise ValueError(f"Unknown job kind: {job.kind}")
            _file_log(f"OK {job.kind}: {job.dst}")
            LOG.info("Done %s: %s", job.kind, job.dst.name)
            with self._lock:
                self._last_error = None
        except Exception as exc:
            import traceback
            tb = traceback.format_exc()
            _file_log(f"FAIL {job.kind}: {exc}\n{tb}")
            LOG.exception("Job failed: %s", job)
            with self._lock:
                self._last_error = f"{job.kind} {job.src.name}: {exc}"

    def _emit_status(self) -> None:
        if self._on_status is None:
            return
        try:
            self._on_status(self.status())
        except Exception:  # pragma: no cover
            pass
