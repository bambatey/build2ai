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

import logging
import os
import sys
import threading
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


def sdb_to_s2k(sdb_path: Path, s2k_path: Path) -> None:
    """Use the user's running SAP2000 to export ``sdb_path`` as ``s2k_path``."""
    if not _COM_AVAILABLE:
        raise RuntimeError("SAP2000 OAPI bu makinede kullanılamıyor")
    if not sdb_path.exists():
        raise FileNotFoundError(sdb_path)

    s2k_path.parent.mkdir(parents=True, exist_ok=True)
    sap = _attach_running()

    ret = sap.SapModel.File.OpenFile(str(sdb_path))
    if ret != 0:
        raise RuntimeError(f"OpenFile returned {ret}")

    # File.Save with a .s2k extension triggers the text-export path.
    ret = sap.SapModel.File.Save(str(s2k_path))
    if ret != 0:
        raise RuntimeError(f"Save returned {ret}")
    LOG.info("Converted %s -> %s", sdb_path.name, s2k_path.name)


def s2k_to_sdb(s2k_path: Path, sdb_path: Path) -> None:
    """Use the user's running SAP2000 to import ``s2k_path`` and save as ``sdb_path``."""
    if not _COM_AVAILABLE:
        raise RuntimeError("SAP2000 OAPI bu makinede kullanılamıyor")
    if not s2k_path.exists():
        raise FileNotFoundError(s2k_path)

    sdb_path.parent.mkdir(parents=True, exist_ok=True)
    sap = _attach_running()

    ret = sap.SapModel.File.OpenFile(str(s2k_path))
    if ret != 0:
        raise RuntimeError(f"OpenFile returned {ret}")

    ret = sap.SapModel.File.Save(str(sdb_path))
    if ret != 0:
        raise RuntimeError(f"Save returned {ret}")
    LOG.info("Converted %s -> %s", s2k_path.name, sdb_path.name)


# ---- internals -------------------------------------------------------------


def _attach_running():
    """Find an already-running SAP2000 instance via the COM ROT.

    We rely on the user keeping SAP2000 open. The first matching name in
    :data:`_ACTIVE_NAMES` wins.
    """
    last_err: Exception | None = None
    for name in _ACTIVE_NAMES:
        try:
            return comtypes.client.GetActiveObject(name)
        except (OSError, comtypes.COMError) as exc:  # type: ignore[attr-defined]
            last_err = exc
    raise RuntimeError(
        f"SAP2000 ROT'da bulunamadı ({last_err}). SAP2000 açık mı?"
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

    Required by COM apartment threading. Safe to call multiple times — the
    second call is a cheap no-op.
    """
    if not _COM_AVAILABLE:
        return
    try:  # pragma: no cover
        comtypes.CoInitialize()
    except OSError:
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
