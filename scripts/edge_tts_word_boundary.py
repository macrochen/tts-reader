#!/usr/bin/env python3
"""Generate Edge TTS audio and word-boundary metadata for one text chunk."""

import argparse
import asyncio
import json
from pathlib import Path

import edge_tts


TICKS_PER_SECOND = 10_000_000


def ticks_to_seconds(value):
    return value / TICKS_PER_SECOND


async def run(args):
    text = Path(args.text_file).read_text(encoding="utf-8")
    communicate = edge_tts.Communicate(
        text,
        args.voice,
        rate="+0%",
        volume=args.volume,
        boundary="WordBoundary",
    )

    word_boundaries = []
    with open(args.write_media, "wb") as audio_file:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_file.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                start = ticks_to_seconds(chunk["offset"])
                duration = ticks_to_seconds(chunk["duration"])
                word_boundaries.append(
                    {
                        "start": round(start, 6),
                        "end": round(start + duration, 6),
                        "text": chunk["text"],
                    }
                )

    Path(args.write_metadata).write_text(
        json.dumps({"wordBoundaries": word_boundaries}, ensure_ascii=False),
        encoding="utf-8",
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--text-file", required=True)
    parser.add_argument("--voice", required=True)
    parser.add_argument("--volume", required=True)
    parser.add_argument("--write-media", required=True)
    parser.add_argument("--write-metadata", required=True)
    args = parser.parse_args()
    asyncio.run(run(args))


if __name__ == "__main__":
    main()
