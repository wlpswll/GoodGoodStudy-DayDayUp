#!/usr/bin/env python3
"""扫描 english/ 下的音视频，写出 data/media.json。

扩展名需要与 english/js/catalog.js 保持一致。
分类看扩展名，不看文件夹名字，避免音频目录里的视频被分进音频。
"""

import json
import re
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "media.json"
SKIP_DIRS = {"css", "js", "data", "scripts", "miniprogram"}
AUDIO_EXTS = {"mp3", "m4a", "aac", "wav", "ogg", "oga", "flac", "opus", "weba"}
VIDEO_EXTS = {"mp4", "m4v", "webm", "ogv", "mov", "mkv"}


def natural_key(text):
    parts = re.split(r"(\d+)", text.casefold())
    return [int(part) if part.isdigit() else part for part in parts]


def kind_of(path):
    ext = path.suffix.lower().lstrip(".")
    if ext in VIDEO_EXTS:
        return "video", ext
    if ext in AUDIO_EXTS:
        return "audio", ext
    return None, ext


def collect():
    items = []
    for path in ROOT.rglob("*"):
        if not path.is_file() or path.name.startswith("."):
            continue
        relative = path.relative_to(ROOT)
        if relative.parts[0] in SKIP_DIRS:
            continue
        kind, ext = kind_of(path)
        if not kind:
            continue
        folder = relative.parent.as_posix() if relative.parent.as_posix() != "." else "未分类"
        items.append({
            "id": relative.as_posix(),
            "title": path.stem,
            "kind": kind,
            "ext": ext,
            "folder": folder,
            "src": relative.as_posix(),
        })
    items.sort(key=lambda item: (
        0 if item["kind"] == "video" else 1,
        natural_key(item["folder"]),
        natural_key(item["title"]),
    ))
    return items


def main():
    items = collect()
    payload = {
        "version": 1,
        "title": "一年级上册英语跟读",
        "generatedAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "items": items,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    videos = sum(1 for item in items if item["kind"] == "video")
    audios = sum(1 for item in items if item["kind"] == "audio")
    print(f"wrote {OUT.name}: {videos} videos, {audios} audios")


if __name__ == "__main__":
    main()
