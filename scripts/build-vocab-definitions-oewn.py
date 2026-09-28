#!/usr/bin/env python3
"""Build a deterministic OEWN definition layer for every vocabulary row.

The importer never guesses a canonical sense. Monosemous exact matches are safe
to expose directly; polysemous matches retain every dictionary sense and are
marked for review. Missing exact headwords remain explicit source_not_found
records rather than receiving fabricated placeholder definitions.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
VOCAB_PATH = ROOT / "assets" / "vocab-v1.4.json"
META_PATH = ROOT / "assets" / "vocab-definitions-oewn-2025.json"
OUTPUT_DIR = ROOT / "public" / "data" / "vocab-definitions" / "oewn-2025"
EXPECTED_ARCHIVE_SHA256 = "7d749f6e2c39e6970e4997839dcf6e42fd281f3c2fae0171d2192bae8cfa4b51"
GROUPS = ("V101", "V201", "V301", "V401", "V501", "V502", "V601", "APPENDIX")
POS_LABELS = {
    "n": "noun",
    "v": "verb",
    "a": "adjective",
    "s": "adjective",
    "r": "adverb",
}


def normalize_headword(value: str) -> str:
    return " ".join(value.replace("_", " ").strip().lower().split())


def archive_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_json(zf: zipfile.ZipFile, name: str) -> Any:
    with zf.open(name) as handle:
        return json.load(handle)


def parse_args() -> argparse.Namespace:
    default_archive = Path(os.environ.get("TEMP", ".")) / "voca-oewn-2025.json.zip"
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, default=default_archive)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    archive = args.archive.resolve()
    if not archive.is_file():
        raise FileNotFoundError(f"OEWN archive not found: {archive}")

    actual_hash = archive_hash(archive)
    if actual_hash != EXPECTED_ARCHIVE_SHA256:
        raise ValueError(
            "Unexpected OEWN archive hash: "
            f"expected {EXPECTED_ARCHIVE_SHA256}, got {actual_hash}"
        )

    vocab = json.loads(VOCAB_PATH.read_text(encoding="utf-8"))
    if not isinstance(vocab, list):
        raise TypeError("assets/vocab-v1.4.json must be a list")

    wanted = {normalize_headword(str(item["w"])) for item in vocab}
    display_by_key: dict[str, str] = {}
    for item in vocab:
        key = normalize_headword(str(item["w"]))
        display_by_key.setdefault(key, str(item["w"]).strip())

    senses_by_key: dict[str, list[dict[str, str]]] = defaultdict(list)
    needed_synsets: set[str] = set()

    with zipfile.ZipFile(archive) as zf:
        entry_files = sorted(
            name
            for name in zf.namelist()
            if re.fullmatch(r"entries-[^.]+\.json", Path(name).name)
        )
        for name in entry_files:
            entries = load_json(zf, name)
            for raw_headword, pos_map in entries.items():
                key = normalize_headword(raw_headword)
                if key not in wanted or not isinstance(pos_map, dict):
                    continue
                seen_for_key = {row["senseId"] for row in senses_by_key[key]}
                for pos_code, pos_payload in pos_map.items():
                    if not isinstance(pos_payload, dict):
                        continue
                    sense_rows = pos_payload.get("sense", [])
                    if not isinstance(sense_rows, list):
                        continue
                    for sense_row in sense_rows:
                        if not isinstance(sense_row, dict):
                            continue
                        sense_id = str(sense_row.get("id", "")).strip()
                        synset_id = str(sense_row.get("synset", "")).strip()
                        if not sense_id or not synset_id or sense_id in seen_for_key:
                            continue
                        senses_by_key[key].append(
                            {
                                "senseId": sense_id,
                                "synsetId": synset_id,
                                "partOfSpeech": POS_LABELS.get(pos_code, pos_code),
                            }
                        )
                        seen_for_key.add(sense_id)
                        needed_synsets.add(synset_id)

        synset_data: dict[str, dict[str, Any]] = {}
        synset_files = sorted(
            name
            for name in zf.namelist()
            if re.fullmatch(r"(?:noun|verb|adj|adv)\.[^.]+\.json", Path(name).name)
        )
        for name in synset_files:
            records = load_json(zf, name)
            if not isinstance(records, dict):
                continue
            for synset_id, record in records.items():
                if synset_id in needed_synsets and isinstance(record, dict):
                    synset_data[synset_id] = record

    definitions_by_key: dict[str, list[dict[str, str]]] = {}
    for key in sorted(wanted):
        resolved: list[dict[str, str]] = []
        seen_definitions: set[tuple[str, str]] = set()
        for sense in senses_by_key.get(key, []):
            synset = synset_data.get(sense["synsetId"], {})
            definitions = synset.get("definition", [])
            if isinstance(definitions, str):
                definitions = [definitions]
            if not isinstance(definitions, list):
                continue
            for raw_definition in definitions:
                definition = " ".join(str(raw_definition).split())
                signature = (sense["partOfSpeech"], definition.casefold())
                if not definition or signature in seen_definitions:
                    continue
                seen_definitions.add(signature)
                resolved.append(
                    {
                        "senseId": sense["senseId"],
                        "partOfSpeech": sense["partOfSpeech"],
                        "definition": definition,
                    }
                )
        definitions_by_key[key] = resolved

    source = {
        "name": "Open English WordNet",
        "edition": "2025",
        "url": "https://en-word.net/downloads/english-wordnet-2025-json.zip",
        "license": "CC BY 4.0",
        "attribution": "Princeton WordNet; Open English WordNet Team",
        "archiveSha256": actual_hash,
    }

    group_items: dict[str, dict[str, str]] = {group: {} for group in GROUPS}
    group_keys: dict[str, set[str]] = {group: set() for group in GROUPS}
    row_status = Counter()
    unique_status = Counter()

    for key, senses in definitions_by_key.items():
        if not senses:
            unique_status["source_not_found"] += 1
        elif len(senses) == 1:
            unique_status["single_sense"] += 1
        else:
            unique_status["dictionary_primary_unreviewed"] += 1

    for item in vocab:
        group = str(item["group"]).upper()
        if group not in group_items:
            raise ValueError(f"Unexpected vocabulary group: {group}")
        item_id = str(item["id"])
        key = normalize_headword(str(item["w"]))
        group_items[group][item_id] = key
        group_keys[group].add(key)
        senses = definitions_by_key[key]
        if not senses:
            row_status["source_not_found"] += 1
        elif len(senses) == 1:
            row_status["single_sense"] += 1
        else:
            row_status["dictionary_primary_unreviewed"] += 1

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for group in GROUPS:
        headwords: dict[str, Any] = {}
        for key in sorted(group_keys[group]):
            senses = definitions_by_key[key]
            if not senses:
                status = "source_not_found"
                representative_sense_id = None
            elif len(senses) == 1:
                status = "single_sense"
                representative_sense_id = senses[0]["senseId"]
            else:
                status = "dictionary_primary_unreviewed"
                representative_sense_id = senses[0]["senseId"]
            headwords[key] = {
                "headword": display_by_key[key],
                "status": status,
                "representativeSenseId": representative_sense_id,
                "senses": senses,
            }

        payload = {
            "schema": 1,
            "version": "oewn-2025",
            "group": group,
            "source": source,
            "items": dict(sorted(group_items[group].items())),
            "headwords": headwords,
        }
        output_path = OUTPUT_DIR / f"{group.lower()}.json"
        output_path.write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
            encoding="utf-8",
        )

    total_rows = len(vocab)
    total_unique = len(wanted)
    matched_rows = total_rows - row_status["source_not_found"]
    matched_unique = total_unique - unique_status["source_not_found"]
    metadata = {
        "schema": 1,
        "version": "oewn-2025",
        "source": source,
        "coverage": {
            "totalRows": total_rows,
            "totalUniqueHeadwords": total_unique,
            "matchedRows": matched_rows,
            "matchedRowPercent": round(matched_rows / total_rows * 100, 2),
            "singleSenseRows": row_status["single_sense"],
            "ambiguousRows": row_status["dictionary_primary_unreviewed"],
            "sourceNotFoundRows": row_status["source_not_found"],
            "matchedUniqueHeadwords": matched_unique,
            "singleSenseUniqueHeadwords": unique_status["single_sense"],
            "ambiguousUniqueHeadwords": unique_status["dictionary_primary_unreviewed"],
            "sourceNotFoundUniqueHeadwords": unique_status["source_not_found"],
        },
        "groupRows": {group: len(group_items[group]) for group in GROUPS},
        "quizEligibility": {
            "single_sense": True,
            "dictionary_primary_unreviewed": False,
            "source_not_found": False,
        },
    }
    META_PATH.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(json.dumps(metadata["coverage"], ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # pragma: no cover - command-line diagnostics
        print(f"ERROR: {exc}", file=sys.stderr)
        raise
