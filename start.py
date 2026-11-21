#!/usr/bin/env python3
"""One-Command Full-Stack Supervisor for AstraGrade v3.0 (FastAPI :8000 + Vite React :3000)."""
import os
import shutil
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"


def get_python_exe() -> str:
    """Find a Python executable that has FastAPI and Uvicorn installed."""
    candidates = [
        sys.executable,
        str(ROOT / "venv" / "Scripts" / "python.exe"),
        os.path.expanduser(r"~\AppData\Local\Programs\Python\Python312\python.exe"),
        "python",
        "py",
    ]
    for c in candidates:
        if not c:
            continue
        try:
            res = subprocess.run(
                [str(c), "-c", "import fastapi, uvicorn; print('OK')"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            if "OK" in res.stdout:
                return str(c)
        except Exception:
            pass
    return sys.executable


def free_ports(ports=(8000, 3000)) -> None:
    """Safely terminate any lingering orphan processes holding our required ports."""
    current_pid = os.getpid()
    if os.name == "nt":
        for port in ports:
            try:
                cmd = f'powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort {port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess"'
                res = subprocess.run(cmd, capture_output=True, text=True, shell=True)
                for line in res.stdout.strip().splitlines():
                    line = line.strip()
                    if line.isdigit():
                        pid = int(line)
                        if pid > 0 and pid != current_pid:
                            print(f"  [i] Freeing port {port} (clearing lingering PID {pid})...")
                            subprocess.run(f"taskkill /F /PID {pid}", shell=True, capture_output=True)
            except Exception:
                pass


def wait_for_server(url: str, timeout: float = 12.0) -> bool:
    """Poll a URL until it responds or times out."""
    start = time.time()
    while time.time() - start < timeout:
        try:
            with urllib.request.urlopen(url, timeout=1.0) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            time.sleep(0.4)
    return False


def kill_proc_tree(proc: subprocess.Popen) -> None:
    """Safely terminate a process and its child processes on Windows or POSIX."""
    if not proc or proc.poll() is not None:
        return
    try:
        if os.name == "nt":
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                capture_output=True,
            )
        else:
            proc.terminate()
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass


def main():
    print("=" * 76)
    print("  AstraGrade v3.0 — Smart Education AI Answer Sheet Evaluation System")
    print("=" * 76)

    # Clean any orphan listeners on 8000 & 3000 first
    free_ports([8000, 3000])

    py_exe = get_python_exe()
    print(f"  [Python Environment] : {py_exe}")

    env = os.environ.copy()
    env["PYTHONPATH"] = str(BACKEND)

    # 1. Start FastAPI Backend
    print("  [1/2] Starting FastAPI Backend on http://localhost:8000 ...")
    backend_proc = subprocess.Popen(
        [py_exe, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--reload-dir", "app"],
        cwd=str(BACKEND),
        env=env,
    )

    time.sleep(0.8)
    if backend_proc.poll() is not None:
        print(f"\n  [ERROR] FastAPI backend failed to start (exit code {backend_proc.returncode}).")
        return

    # 2. Check Frontend node_modules & Start Vite
    npm_cmd = shutil.which("npm.cmd") or shutil.which("npm") or "npm"
    frontend_proc = None

    if (FRONTEND / "package.json").exists():
        if not (FRONTEND / "node_modules").exists():
            print("  [!] Installing frontend dependencies (npm install)...")
            subprocess.run([npm_cmd, "install"], cwd=str(FRONTEND), check=True, shell=(os.name == "nt"))

        print("  [2/2] Starting Vite React Workspace on http://localhost:3000 ...")
        frontend_proc = subprocess.Popen([npm_cmd, "run", "dev"], cwd=str(FRONTEND), shell=(os.name == "nt"))

    # 3. Wait for backend and frontend to be live
    print("  [...] Waiting for services to initialize...")
    backend_ok = wait_for_server("http://localhost:8000/api/health", timeout=12.0)
    if backend_ok:
        print("  [✓] FastAPI Backend is live at http://localhost:8000")
        print("  [✓] Interactive API Docs at http://localhost:8000/docs")
    else:
        print("  [!] Backend taking longer to start; check console logs above.")

    if frontend_proc:
        frontend_ok = wait_for_server("http://localhost:3000", timeout=15.0)
        if frontend_ok:
            print("  [✓] Vite React Frontend is live at http://localhost:3000")
        else:
            print("  [!] Vite taking longer to start; check console logs above.")

    # 4. Open in browser
    target_url = "http://localhost:3000" if frontend_proc else "http://localhost:8000/docs"
    print(f"  [✓] Opening AstraGrade Workspace: {target_url}")
    print("  (Press Ctrl+C to stop all servers)\n")
    time.sleep(1.0)
    try:
        webbrowser.open(target_url)
    except Exception:
        pass

    try:
        # Keep supervisor alive; auto-restart backend or frontend if transiently stopped
        while True:
            if backend_proc.poll() is not None:
                print(f"\n  [!] FastAPI backend stopped (code {backend_proc.returncode}). Auto-restarting...")
                free_ports([8000])
                time.sleep(1.0)
                backend_proc = subprocess.Popen(
                    [py_exe, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--reload-dir", "app"],
                    cwd=str(BACKEND),
                    env=env,
                )
            if frontend_proc and frontend_proc.poll() is not None:
                print(f"\n  [!] Vite frontend stopped (code {frontend_proc.returncode}). Auto-restarting...")
                free_ports([3000])
                time.sleep(1.0)
                frontend_proc = subprocess.Popen([npm_cmd, "run", "dev"], cwd=str(FRONTEND), shell=(os.name == "nt"))
            time.sleep(1.5)
    except KeyboardInterrupt:
        print("\n  Shutting down AstraGrade servers...")
    finally:
        kill_proc_tree(backend_proc)
        if frontend_proc:
            kill_proc_tree(frontend_proc)
        # Ensure ports are released cleanly
        free_ports([8000, 3000])
        print("  [✓] Servers stopped successfully.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"\n  [FATAL ERROR] {exc}")
        import traceback
        traceback.print_exc()
    finally:
        if sys.stdin and sys.stdin.isatty():
            try:
                input("\nPress Enter to exit...")
            except Exception:
                pass
