"""Entry point: ``python -m structai_agent``.

Launches the desktop UI by default. Pass ``--headless`` to run only the
HTTP server (useful for development without a window).
"""

import sys

if "--headless" in sys.argv:
    sys.argv.remove("--headless")
    from .server import main
else:
    from .app import main

if __name__ == "__main__":
    main()
