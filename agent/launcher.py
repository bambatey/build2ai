"""PyInstaller entry script.

This file lives at the *root* of the agent project (next to ``build.py``)
so PyInstaller can pick it up as a normal top-level script. It imports
the real entry point from the ``structai_agent`` package, which keeps
the package's relative imports working in the bundled exe.
"""

from structai_agent.app import main

if __name__ == "__main__":
    main()
