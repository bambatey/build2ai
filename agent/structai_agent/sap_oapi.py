"""SAP2000 OAPI bridge.

Wraps the (Windows-only, COM-based) SAP2000 Open API so the rest of the
agent can convert ``.sdb`` <-> ``.s2k`` without caring about the gritty
COM details. Optional: if SAP2000 or ``comtypes`` aren't installed, the
module degrades to a no-op and reports ``available = False``.

Concurrency notes
-----------------
COM apartment threading means each thread that touches OAPI must call
``CoInitialize`` first. We never call into this module from arbitrary
threads — :class:`structai_agent.jobs.JobRunner` owns a single dedicated
worker that drives all conversions, so we just initialise the COM
apartment once when that thread starts up.

The two ProgIDs we try cover SAP2000 v19+ (CSI.SAP2000.API.SapObject)
and the older v15-v18 helper-based flow (SAP2000v1.Helper). The first
that responds wins.
"""

from __future__ import annotations

import contextlib
import logging
import os
import shutil
import sys
import tempfile
import threading
import time
from dataclasses import dataclass
from pathlib import Path

LOG = logging.getLogger("structai_agent.sap")

# ---- optional imports ------------------------------------------------------

_COM_AVAILABLE = False
_COM_IMPORT_ERROR: str | None = None
comtypes = None  # type: ignore[assignment]
if sys.platform == "win32":
    try:  # pragma: no cover - depends on comtypes being installed
        import comtypes  # type: ignore[import-not-found]  # noqa: F401
        import comtypes.client  # type: ignore[import-not-found]  # noqa: F401

        _COM_AVAILABLE = True
    except Exception as _imp_exc:
        _COM_IMPORT_ERROR = repr(_imp_exc)
else:
    _COM_IMPORT_ERROR = f"platform={sys.platform}"


# Friendly object names we accept from a running SAP2000 instance via the
# Running Object Table. The list mirrors what CSI uses across versions.
_ACTIVE_NAMES = (
    "CSI.SAP2000.API.SapObject",
    "SAP2000v1.SapObject",
)


@dataclass
class SapStatus:
    available: bool
    reason: str | None = None
    version: str | None = None


# ---- public API ------------------------------------------------------------


def is_supported() -> bool:
    """True if we *could* talk to SAP2000 on this machine."""
    return _COM_AVAILABLE


_probe_lock = threading.Lock()
_probe_cache: SapStatus | None = None


def probe(force: bool = False) -> SapStatus:
    """Look for an already-running SAP2000 instance.

    The agent never starts SAP2000 by itself anymore — the user keeps
    SAP2000 open and we attach to it through the COM Running Object
    Table. Cached so repeated UI polls are cheap; pass ``force=True``
    after the user just opened SAP2000 to recheck.
    """
    global _probe_cache
    with _probe_lock:
        if _probe_cache is not None and not force:
            return _probe_cache
        if not _COM_AVAILABLE:
            _probe_cache = SapStatus(
                available=False,
                reason=f"comtypes import edilemedi: {_COM_IMPORT_ERROR}",
            )
            return _probe_cache

        init_thread()
        try:
            sap = _attach_running()
            version = _safe_version(sap)
            _probe_cache = SapStatus(available=True, version=version)
        except Exception as exc:
            _probe_cache = SapStatus(
                available=False,
                reason=f"SAP2000 açık değil ({exc}). Lütfen SAP2000'i başlatın.",
            )
        finally:
            shutdown_thread()
        return _probe_cache


def _ensure_initialized(sap) -> None:
    """Bring an attached SAP2000 instance into an OAPI-usable state.

    When we attach to a running SAP2000 via ``Helper.GetObject`` the
    OAPI proxy is returned but its ``SapModel`` is still ``None``
    until ``ApplicationStart`` has been called. On a *running* instance
    this does NOT spawn a second window — it just initialises the OAPI
    side. After that we additionally call ``InitializeNewModel`` so the
    SapModel object exists even when the user opened SAP2000 with no
    document.
    """
    try:
        # ApplicationStart(Units, Visible, ModelPath). Visible=True so
        # we never accidentally hide the user's running window. The
        # call is a fast no-op when the OAPI side is already up.
        sap.ApplicationStart(6, True, "")
    except Exception:
        pass
    try:
        sap.SapModel.InitializeNewModel(6)
    except Exception:
        pass


def sdb_to_s2k(sdb_path: Path, s2k_path: Path) -> None:
    """Use the user's running SAP2000 to export ``sdb_path`` as ``s2k_path``.

    To stay out of the user's way we

    1. **Wait for the file to settle.** A user who just hit Ctrl+S in
       SAP2000 may not have finished flushing the binary; we retry a
       few times until the size stops changing.
    2. **Work on a temp copy.** SAP2000 holds the live ``.sdb`` open with
       an exclusive lock, so OAPI ``OpenFile`` on the same path returns
       error 1. We snapshot the bytes into ``%TEMP%`` first and feed
       *that* path to OAPI instead.
    3. **Restore the user's previous model.** ``OpenFile`` swaps the
       running model out, so we capture whatever was open beforehand
       and reopen it once we're done. The user never sees the swap if
       it happens within ``a couple of frames``.
    """
    if not _COM_AVAILABLE:
        raise RuntimeError("SAP2000 OAPI bu makinede kullanılamıyor")

    _wait_until_stable(sdb_path)
    if not sdb_path.exists():
        raise FileNotFoundError(sdb_path)

    s2k_path.parent.mkdir(parents=True, exist_ok=True)

    sap = _attach_running()
    _ensure_initialized(sap)

    # Remember whichever model the user currently has open so we can
    # put it back when we're done.
    previous_model: str | None = _safe_current_filename(sap)

    with _temp_copy(sdb_path) as temp_sdb:
        ret = sap.SapModel.File.OpenFile(str(temp_sdb))
        if ret != 0:
            raise RuntimeError(f"OpenFile returned {ret}")

        ret = sap.SapModel.File.Save(str(s2k_path))
        if ret != 0:
            raise RuntimeError(f"Save returned {ret}")

    _normalise_sap_export(s2k_path)

    # Restore the previous model so the user keeps working where they
    # left off. Best-effort — failures are non-fatal.
    if previous_model and Path(previous_model).exists():
        try:
            sap.SapModel.File.OpenFile(previous_model)
        except Exception:
            pass

    LOG.info("Converted %s -> %s", sdb_path.name, s2k_path.name)


def _wait_until_stable(
    path: Path, *, attempts: int = 8, interval: float = 0.4
) -> None:
    """Block until ``path``'s size has stopped changing.

    Used to ride out an in-progress save: SAP2000 may flush the .sdb
    in chunks, and we don't want to fire OAPI at a half-written file.
    """
    last_size = -1
    for _ in range(attempts):
        try:
            size = path.stat().st_size
        except OSError:
            time.sleep(interval)
            continue
        if size == last_size and size > 0:
            return
        last_size = size
        time.sleep(interval)


@contextlib.contextmanager
def _temp_copy(src: Path):
    """Copy ``src`` to a uniquely-named temp file and yield its path.

    Cleaned up automatically once the ``with`` block exits. We retry
    the copy a couple of times because a freshly-saved .sdb may still
    have a sharing-violation lock for a brief moment.
    """
    tmp_dir = Path(tempfile.gettempdir()) / "structai-agent"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    dst = tmp_dir / f"{src.stem}-{os.getpid()}-{int(time.time() * 1000)}.sdb"

    last_err: Exception | None = None
    for attempt in range(5):
        try:
            shutil.copy2(src, dst)
            last_err = None
            break
        except (PermissionError, OSError) as exc:
            last_err = exc
            time.sleep(0.4 * (attempt + 1))
    if last_err is not None:
        raise RuntimeError(f"Could not copy {src.name} to temp: {last_err}")

    try:
        yield dst
    finally:
        try:
            dst.unlink()
        except OSError:
            pass


def _safe_current_filename(sap) -> str | None:
    """Return the path of whatever model SAP2000 has open right now.

    The OAPI exposes ``SapModel.GetModelFilename(IncludePath=True)``
    but the signature varies across versions, so we wrap it in a
    blanket try/except.
    """
    try:
        result = sap.SapModel.GetModelFilename(True)
    except Exception:
        return None
    if isinstance(result, str) and result:
        return result
    if isinstance(result, tuple):
        for item in result:
            if isinstance(item, str) and item:
                return item
    return None


def _normalise_sap_export(target: Path) -> None:
    """Rename SAP2000's ``.$2k`` output to ``.s2k`` and drop sibling files.

    SAP2000 always writes the text export with the dollar-prefix
    extension regardless of what we asked for. It also drops a fresh
    copy of the binary model (``.sdb``) and a thumbnail (``.ico``) next
    to it. None of those help us downstream, so we delete them.
    """
    folder = target.parent
    stem = target.stem  # e.g. "BaseModel"
    dollar = folder / f"{stem}.$2k"
    if dollar.exists():
        try:
            if target.exists():
                target.unlink()
            dollar.rename(target)
        except OSError:
            pass
    # Cleanup companions that aren't ours.
    for suffix in (".sdb", ".ico", ".log"):
        side = folder / f"{stem}{suffix}"
        if side.exists():
            try:
                side.unlink()
            except OSError:
                pass


def s2k_to_sdb(s2k_path: Path, sdb_path: Path) -> None:
    """Use the user's running SAP2000 to import ``s2k_path`` and save as ``sdb_path``."""
    if not _COM_AVAILABLE:
        raise RuntimeError("SAP2000 OAPI bu makinede kullanılamıyor")
    if not s2k_path.exists():
        raise FileNotFoundError(s2k_path)

    sdb_path.parent.mkdir(parents=True, exist_ok=True)
    sap = _attach_running()
    _ensure_initialized(sap)

    ret = sap.SapModel.File.OpenFile(str(s2k_path))
    if ret != 0:
        raise RuntimeError(f"OpenFile returned {ret}")

    ret = sap.SapModel.File.Save(str(sdb_path))
    if ret != 0:
        raise RuntimeError(f"Save returned {ret}")
    LOG.info("Converted %s -> %s", s2k_path.name, sdb_path.name)


# ---- internals -------------------------------------------------------------


def _attach_running():
    """Find an already-running SAP2000 instance.

    CSI's official Python examples instantiate the *helper* COM object
    and ask **it** for the running SapObject. The helper acts as a
    broker that returns a fully initialised ``cOAPI`` proxy whose
    ``SapModel`` property is non-null even when the GUI was just opened
    with no model loaded. We try the helper first and fall back to a
    plain ROT lookup so older builds still work.
    """
    last_err: Exception | None = None

    # Path 1 — CSI helper / GetObject (recommended).
    try:
        helper = comtypes.client.CreateObject("SAP2000v1.Helper")
        sap = helper.GetObject("CSI.SAP2000.API.SapObject")
        if sap is not None:
            return sap
    except Exception as exc:  # pragma: no cover - depends on SAP2000 build
        last_err = exc

    # Path 2 — bare ROT lookup.
    for name in _ACTIVE_NAMES:
        try:
            obj = comtypes.client.GetActiveObject(name)
            if obj is not None:
                return obj
        except (OSError, comtypes.COMError) as exc:  # type: ignore[attr-defined]
            last_err = exc

    raise RuntimeError(
        f"SAP2000'e bağlanılamadı ({last_err}). SAP2000 açık mı?"
    )


def _safe_version(sap) -> str | None:
    try:
        # GetVersion(ByRef Version, ByRef MyVersionNumber) -> Long
        # comtypes returns out-params as a tuple.
        result = sap.SapModel.GetVersion("", 0)
        if isinstance(result, tuple) and result:
            for item in result:
                if isinstance(item, str) and item:
                    return item
    except Exception:
        return None
    return None


def init_thread() -> None:
    """Call once on every worker thread that will touch SAP2000.

    Required by COM apartment threading. We initialise as STA because
    that's what most desktop COM servers (including SAP2000) expect — an
    MTA worker calling into an STA proxy stalls forever the first time
    it tries to marshal a method call.
    """
    if not _COM_AVAILABLE:
        return
    try:  # pragma: no cover
        comtypes.CoInitialize()
    except OSError:
        # RPC_E_CHANGED_MODE — already initialised as MTA on this thread.
        pass


def shutdown_thread() -> None:
    if not _COM_AVAILABLE:
        return
    try:  # pragma: no cover
        comtypes.CoUninitialize()
    except OSError:
        pass


# Keep linters happy on non-Windows boxes where ``os`` is unused.
_ = os
