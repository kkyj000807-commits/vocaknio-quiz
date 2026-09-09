"""Windows OS-held repository lock; released automatically if this process exits."""
import msvcrt
import os
import pathlib
import subprocess
import sys

common = subprocess.check_output(["git", "rev-parse", "--git-common-dir"], text=True).strip()
lock_path = pathlib.Path(common).resolve() / "codex-development.lock"
with lock_path.open("a+b") as handle:
    handle.seek(0)
    try:
        msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
    except OSError:
        print("LOCK_BUSY", flush=True)
        sys.exit(2)
    try:
        print(f"LOCK_ACQUIRED pid={os.getpid()}", flush=True)
        input("Keep this process alive while editing. Enter releases the lock.\n")
    except EOFError:
        pass
    finally:
        handle.seek(0)
        msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
        print("LOCK_RELEASED", flush=True)
