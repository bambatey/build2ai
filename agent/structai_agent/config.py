"""Persistent agent configuration (currently just the watch root)."""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from pathlib import Path

CONFIG_PATH = Path.home() / ".structai-agent.json"


@dataclass
class AgentConfig:
    root: str | None = None

    @classmethod
    def load(cls) -> "AgentConfig":
        if not CONFIG_PATH.exists():
            return cls()
        try:
            data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return cls()
        return cls(root=data.get("root"))

    def save(self) -> None:
        try:
            CONFIG_PATH.write_text(
                json.dumps(asdict(self), indent=2),
                encoding="utf-8",
            )
        except OSError:
            # Persistence is best-effort; the agent still works in-memory.
            pass


def env_host() -> str:
    return os.environ.get("STRUCTAI_AGENT_HOST", "127.0.0.1")


def env_port() -> int:
    try:
        return int(os.environ.get("STRUCTAI_AGENT_PORT", "7117"))
    except ValueError:
        return 7117
