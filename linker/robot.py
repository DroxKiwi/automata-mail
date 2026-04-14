#!/usr/bin/env python3
"""
Robot léger : appelle périodiquement les routes POST /api/internal/worker/trigger/*
de l’app Next (Bearer WORKER_TRIGGER_SECRET).

Au démarrage, charge le fichier `.env` à la racine du dépôt (parent du dossier `linker/`) :
même fichier que Next.js — pas de duplication. Les variables déjà définies dans le shell
ne sont pas écrasées.

Variables lues (souvent dans ce `.env` partagé) :
  WORKER_TRIGGER_SECRET  (≥ 16 caractères, identique à Next)
  NEXT_APP_BASE_URL      défaut http://localhost:3000
  INTERVAL_SECONDS       défaut 60
  TRIGGER_PATH           défaut /api/internal/worker/trigger/tick
  PROCESS_LIMIT          optionnel, 1–200 pour tick/process
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


def load_project_dotenv() -> None:
    """Charge `../.env` depuis `linker/robot.py` (racine du repo). Ne remplace pas l’existant."""
    root = Path(__file__).resolve().parent.parent
    path = root / ".env"
    if not path.is_file():
        return
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return
    if text.startswith("\ufeff"):
        text = text[1:]
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].strip()
        eq = line.find("=")
        if eq <= 0:
            continue
        key = line[:eq].strip()
        if not re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", key):
            continue
        if key in os.environ:
            continue
        val = line[eq + 1 :].strip()
        if (val.startswith('"') and val.endswith('"')) or (
            val.startswith("'") and val.endswith("'")
        ):
            val = val[1:-1].replace("\\n", "\n").replace('\\"', '"')
        os.environ[key] = val


def load_env() -> tuple[str, str, int, str, int | None]:
    base = os.environ.get("NEXT_APP_BASE_URL", "http://localhost:3000").strip().rstrip("/")
    secret = os.environ.get("WORKER_TRIGGER_SECRET", "").strip()
    if len(secret) < 16:
        print(
            "WORKER_TRIGGER_SECRET manquant ou trop court (minimum 16 caracteres).",
            file=sys.stderr,
        )
        sys.exit(1)
    try:
        interval = max(5, int(os.environ.get("INTERVAL_SECONDS", "60")))
    except ValueError:
        interval = 60
    path = os.environ.get(
        "TRIGGER_PATH",
        "/api/internal/worker/trigger/tick",
    ).strip()
    if not path.startswith("/"):
        path = "/" + path
    raw_limit = os.environ.get("PROCESS_LIMIT", "").strip()
    limit: int | None = None
    if raw_limit:
        try:
            n = int(raw_limit)
            if 1 <= n <= 200:
                limit = n
        except ValueError:
            pass
    return base, secret, interval, path, limit


def post_trigger(base_url: str, path: str, secret: str, limit: int | None) -> tuple[int, dict[str, Any]]:
    url = base_url + path
    payload: dict[str, Any] = {}
    if limit is not None:
        payload["limit"] = limit
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        method="POST",
        data=data,
        headers={
            "Authorization": f"Bearer {secret}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            code = resp.getcode()
            try:
                parsed = json.loads(body) if body.strip() else {}
            except json.JSONDecodeError:
                parsed = {"_raw": body[:500]}
            return code, parsed if isinstance(parsed, dict) else {"_data": parsed}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(err_body) if err_body.strip() else {}
        except json.JSONDecodeError:
            parsed = {"_raw": err_body[:500]}
        return e.code, parsed if isinstance(parsed, dict) else {"_data": parsed}
    except urllib.error.URLError as e:
        return -1, {"error": str(e.reason if hasattr(e, "reason") else e)}


def main() -> None:
    load_project_dotenv()
    base, secret, interval, path, limit = load_env()
    print(f"[linker] base={base} path={path} interval={interval}s", flush=True)
    while True:
        code, payload = post_trigger(base, path, secret, limit)
        if code == 200:
            print(f"[linker] OK {payload}", flush=True)
        else:
            print(f"[linker] HTTP {code} {payload}", flush=True)
        time.sleep(interval)


if __name__ == "__main__":
    main()
