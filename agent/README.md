# StructAI Local Agent

A small Python program that exposes one user-chosen folder on the local
machine to the StructAI web app over HTTP. It ships in two flavours:

1. **Desktop app** — a CustomTkinter window with a system-tray icon and
   Windows autostart support. This is what end-users get from the
   `.exe` build.
2. **Headless server** — `python -m structai_agent` for development and
   testing.

Both modes share the same HTTP surface and only ever touch the single
root folder the user picks. All paths from the web app are validated
against that root before any filesystem call, so the agent cannot escape
to anywhere else on disk.

## Endpoints

| Method | Path                           | Purpose                                  |
| ------ | ------------------------------ | ---------------------------------------- |
| GET    | `/health`                      | Liveness probe                           |
| GET    | `/config`                      | Read current root folder                 |
| POST   | `/config`                      | Set root folder (`{ "root": "C:\\..." }`)|
| GET    | `/files`                       | Recursive file tree of the root          |
| GET    | `/file?path=<rel>`             | Read a file as text                      |
| PUT    | `/file`                        | Write file (`{ "path": "...", "content": "..." }`) |
| DELETE | `/file?path=<rel>`             | Delete a file                            |
| GET    | `/events`                      | Server-Sent Events stream of changes     |

All paths sent by the client are **relative to the root**. Absolute
paths and `..` traversal are rejected with HTTP 400. Reads/writes are
limited to known text extensions (`.s2k`, `.e2k`, `.txt`, `.json`, …)
and capped at 8 MB.

## Running from source

```bash
cd agent
python -m venv venv
venv\Scripts\Activate.ps1     # PowerShell
pip install -r requirements.txt

# Desktop UI:
python -m structai_agent.app

# Or headless (no window):
python -m structai_agent
```

The desktop window lets you pick the watched folder, start/stop the
server, toggle Windows autostart, and minimise to the system tray. The
selected root is persisted to `~/.structai-agent.json` so the next
launch picks it up automatically.

The HTTP server listens on `http://127.0.0.1:7117` by default. Override
with `STRUCTAI_AGENT_HOST` and `STRUCTAI_AGENT_PORT` env vars.

## Building the .exe

```bash
cd agent
venv\Scripts\Activate.ps1
pip install pyinstaller
python scripts/generate_icon.py    # only needed once
python build.py
```

The output is `agent/dist/StructAI-Agent.exe` — a single-file Windows
binary the user can double-click. No Python install required on the
target machine.

When the user enables "Windows başlangıcında otomatik çalıştır" in the
desktop app, the exe is registered under
`HKCU\Software\Microsoft\Windows\CurrentVersion\Run` with a `--tray`
flag so it starts minimised on login.

## Security notes

- Binds to `127.0.0.1` only — never reachable from the network.
- CORS allowlist is hard-coded to local development origins
  (`http://localhost:3000`, `http://127.0.0.1:3000`,
  `http://localhost:5173`, `http://127.0.0.1:5173`). Adjust in
  `structai_agent/server.py` if you serve the web app on a different
  port.
- All file paths are normalised and re-checked against the root before
  any filesystem call.
- Only text-format files are exposed; binaries are listed but not
  served. The 8 MB cap protects both agent and browser from runaway
  reads.
