"""StructAI agent HTTP server.

Implemented on top of the standard library's ``http.server`` so the only
external dependency is the optional ``watchdog`` package used by
``watcher.py``. The server is single-threaded per connection but uses
``ThreadingHTTPServer`` so an open SSE stream does not block other requests.

Public surface:

* :class:`AgentServer` — programmatic start/stop wrapper used by the
  desktop UI. Owns the HTTP server, the watcher and the persisted config.
* :func:`main` — CLI entry point used by ``python -m structai_agent``.
"""

from __future__ import annotations

import json
import logging
import threading
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Callable
from urllib.parse import parse_qs, urlparse

from . import __version__
from .config import AgentConfig, env_host, env_port
from .fs import FsError, delete_file, list_tree, read_file, write_file
from .watcher import FolderWatcher

LOG = logging.getLogger("structai_agent")

import re

# Any http(s)://localhost or 127.0.0.1 with any port is accepted. The agent
# only listens on the loopback interface so this is still sandboxed to the
# user's own machine.
_LOCALHOST_ORIGIN = re.compile(
    r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"
)


def _origin_allowed(origin: str | None) -> bool:
    return bool(origin and _LOCALHOST_ORIGIN.match(origin))

class _Context:
    """Shared agent state attached to the HTTP server instance."""

    def __init__(self) -> None:
        self.config = AgentConfig.load()
        self.watcher = FolderWatcher()
        self.watcher.set_root(self.config.root)


class Handler(BaseHTTPRequestHandler):
    server_version = f"StructAI-Agent/{__version__}"

    @property
    def ctx(self) -> _Context:
        return self.server.ctx  # type: ignore[attr-defined]

    # ---- helpers -------------------------------------------------------

    def _origin_ok(self) -> str | None:
        origin = self.headers.get("Origin")
        return origin if _origin_allowed(origin) else None

    def _send_cors(self, origin: str | None) -> None:
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Credentials", "true")
        self.send_header(
            "Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS"
        )
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send_json(self, payload: Any, status: int = 200) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._send_cors(self._origin_ok())
        self.end_headers()
        self.wfile.write(body)

    def _send_error(self, status: int, message: str) -> None:
        self._send_json({"error": message}, status=status)

    def _read_body(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        try:
            data = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise FsError(f"Invalid JSON body: {exc.msg}") from exc
        if not isinstance(data, dict):
            raise FsError("JSON body must be an object")
        return data

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A002
        LOG.info("%s - %s", self.address_string(), format % args)

    # ---- HTTP verbs ----------------------------------------------------

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(HTTPStatus.NO_CONTENT)
        self._send_cors(self._origin_ok())
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        url = urlparse(self.path)
        path = url.path
        query = {k: v[0] for k, v in parse_qs(url.query).items()}

        try:
            if path == "/health":
                return self._send_json(
                    {
                        "ok": True,
                        "version": __version__,
                        "watching": self.ctx.watcher.available,
                    }
                )

            if path == "/config":
                return self._send_json({"root": self.ctx.config.root})

            if path == "/files":
                return self._send_json({"root": self.ctx.config.root, "entries": list_tree(self.ctx.config.root)})

            if path == "/file":
                content = read_file(self.ctx.config.root, query.get("path", ""))
                return self._send_json({"path": query.get("path", ""), "content": content})

            if path == "/events":
                return self._stream_events()

            self._send_error(404, f"Unknown route: {path}")
        except FsError as exc:
            self._send_error(exc.status, str(exc))
        except Exception as exc:  # pragma: no cover
            LOG.exception("GET %s failed", path)
            self._send_error(500, f"Internal error: {exc}")

    def do_POST(self) -> None:  # noqa: N802
        url = urlparse(self.path)
        try:
            if url.path == "/config":
                body = self._read_body()
                root = body.get("root")
                if root is not None and not isinstance(root, str):
                    raise FsError("'root' must be a string or null")
                self.ctx.config.root = root or None
                self.ctx.config.save()
                self.ctx.watcher.set_root(self.ctx.config.root)
                # Validate by listing immediately so the client gets a real
                # error if the path is bad.
                if self.ctx.config.root:
                    list_tree(self.ctx.config.root)
                return self._send_json({"root": self.ctx.config.root})

            self._send_error(404, f"Unknown route: {url.path}")
        except FsError as exc:
            self._send_error(exc.status, str(exc))
        except Exception as exc:  # pragma: no cover
            LOG.exception("POST %s failed", url.path)
            self._send_error(500, f"Internal error: {exc}")

    def do_PUT(self) -> None:  # noqa: N802
        url = urlparse(self.path)
        try:
            if url.path == "/file":
                body = self._read_body()
                rel = body.get("path")
                content = body.get("content")
                if not isinstance(rel, str) or not isinstance(content, str):
                    raise FsError("'path' and 'content' must be strings")
                entry = write_file(self.ctx.config.root, rel, content)
                return self._send_json({"file": entry.__dict__})

            self._send_error(404, f"Unknown route: {url.path}")
        except FsError as exc:
            self._send_error(exc.status, str(exc))
        except Exception as exc:  # pragma: no cover
            LOG.exception("PUT %s failed", url.path)
            self._send_error(500, f"Internal error: {exc}")

    def do_DELETE(self) -> None:  # noqa: N802
        url = urlparse(self.path)
        query = {k: v[0] for k, v in parse_qs(url.query).items()}
        try:
            if url.path == "/file":
                delete_file(self.ctx.config.root, query.get("path", ""))
                return self._send_json({"deleted": query.get("path", "")})

            self._send_error(404, f"Unknown route: {url.path}")
        except FsError as exc:
            self._send_error(exc.status, str(exc))
        except Exception as exc:  # pragma: no cover
            LOG.exception("DELETE %s failed", url.path)
            self._send_error(500, f"Internal error: {exc}")

    # ---- SSE ----------------------------------------------------------

    def _stream_events(self) -> None:
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.send_header("X-Accel-Buffering", "no")
        self._send_cors(self._origin_ok())
        self.end_headers()

        queue = self.ctx.watcher.subscribe()
        try:
            # Initial hello so the client knows the connection is live.
            self._sse_send({"type": "hello", "watching": self.ctx.watcher.available})
            for event in self.ctx.watcher.stream(queue):
                self._sse_send(event)
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            self.ctx.watcher.unsubscribe(queue)

    def _sse_send(self, payload: dict) -> None:
        chunk = f"data: {json.dumps(payload)}\n\n".encode("utf-8")
        try:
            self.wfile.write(chunk)
            self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            raise


class _TServer(ThreadingHTTPServer):
    """ThreadingHTTPServer with a shared agent context attached."""

    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, addr, handler_cls, ctx: _Context) -> None:
        super().__init__(addr, handler_cls)
        self.ctx = ctx


class AgentServer:
    """Programmatic wrapper around the HTTP server.

    Owns its own background thread so the desktop UI can call ``start()``
    once and continue running its event loop. Safe to ``stop()`` and
    ``start()`` again.
    """

    def __init__(self, host: str | None = None, port: int | None = None) -> None:
        self.host = host or env_host()
        self.port = port or env_port()
        self.ctx = _Context()
        self._server: _TServer | None = None
        self._thread: threading.Thread | None = None
        self._listeners: list[Callable[[str], None]] = []

    @property
    def running(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    @property
    def root(self) -> str | None:
        return self.ctx.config.root

    def set_root(self, root: str | None) -> None:
        self.ctx.config.root = root or None
        self.ctx.config.save()
        self.ctx.watcher.set_root(self.ctx.config.root)
        self._log(f"Root set to: {self.ctx.config.root or '(none)'}")

    def start(self) -> None:
        if self.running:
            return
        try:
            self._server = _TServer((self.host, self.port), Handler, self.ctx)
        except OSError as exc:
            self._log(f"Failed to bind {self.host}:{self.port} -> {exc}")
            raise
        self._thread = threading.Thread(
            target=self._server.serve_forever,
            name="structai-agent-http",
            daemon=True,
        )
        self._thread.start()
        self._log(f"Agent listening on http://{self.host}:{self.port}")
        if self.ctx.config.root:
            self._log(f"Watching root: {self.ctx.config.root}")
        else:
            self._log("No root configured yet.")

    def stop(self) -> None:
        if self._server is not None:
            try:
                self._server.shutdown()
                self._server.server_close()
            except Exception as exc:  # pragma: no cover
                self._log(f"Shutdown error: {exc}")
        if self._thread is not None:
            self._thread.join(timeout=3)
        self.ctx.watcher.set_root(None)
        self._server = None
        self._thread = None
        self._log("Agent stopped")

    def add_listener(self, fn: Callable[[str], None]) -> None:
        self._listeners.append(fn)

    def _log(self, message: str) -> None:
        LOG.info(message)
        for fn in list(self._listeners):
            try:
                fn(message)
            except Exception:  # pragma: no cover
                pass


def main() -> None:
    """Console entry point: ``python -m structai_agent``."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    server = AgentServer()
    server.start()
    try:
        while server.running:
            try:
                if server._thread is not None:
                    server._thread.join(timeout=1)
            except KeyboardInterrupt:
                LOG.info("Shutting down")
                break
    finally:
        server.stop()


if __name__ == "__main__":
    main()
