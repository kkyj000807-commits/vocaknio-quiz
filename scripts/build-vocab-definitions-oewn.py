#!/usr/bin/env python3
"""Build a deterministic OEWN definition layer for every vocabulary row.

The importer never guesses a canonical sense. Monosemous exact matches are safe
to expose directly; polysemous matches retain every dictionary sense and are
marked for review. Missing exact headwords remain explicit source_not_found
records rather than receiving fabricated placeholder definitions.
"""

from __future__ import annotations

import argparse
import ctypes
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
QUIZ_PATH = ROOT / "assets" / "vocab-definition-quiz-oewn-2025.json"
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

# Manually checked against the current Korean occurrence glosses.  Automatic
# hyphen removal is unsafe: e.g. run-off (an election) is not the OEWN verb
# run off, and burn-out (exhaustion) is not the verb meaning to stop working.
SAFE_HYPHENATION_ALIASES = {
    "belly up": "belly-up",
    "big-time": "big time",
    "bread-and-butter": "bread and butter",
    "clapped-out": "clapped out",
    "cul-de-sac": "cul de sac",
    "double-bind": "double bind",
    "double-cross": "double cross",
    "eleventh-hour": "eleventh hour",
    "eye-opener": "eye opener",
    "fall-guy": "fall guy",
    "fence-mending": "fence mending",
    "free-fall": "free fall",
    "get-together": "get together",
    "grass-roots": "grass roots",
    "gung-ho": "gung ho",
    "horse-trading": "horse trading",
    "hurly-burly": "hurly burly",
    "lump-sum": "lump sum",
    "mumbo-jumbo": "mumbo jumbo",
    "name-calling": "name calling",
    "no-man's land": "no man's land",
    "nouveau riche": "nouveau-riche",
    "open and shut": "open-and-shut",
    "open-door": "open door",
    "out of date": "out-of-date",
    "photo-op": "photo op",
    "photo-opportunity": "photo opportunity",
    "pipe-dream": "pipe dream",
    "put - on the line": "put on the line",
    "put - to death": "put to death",
    "rank-and-file": "rank and file",
    "rubber-stamp": "rubber stamp",
    "saber-rattling": "saber rattling",
    "sell-off": "sell off",
    "sweep - under the rug": "sweep under the rug",
    "think-tank": "think tank",
    "tit-for-tat": "tit for tat",
    "top-of-the-line": "top of the line",
    "tried-and-true": "tried and true",
    "tug of war": "tug-of-war",
    "wheeler-dealer": "wheeler dealer",
}

# Editorial notation in the source vocabulary often writes an optional word or
# alternate spelling inside parentheses/slashes.  Only pairs inspected against
# both the current Korean occurrence gloss and OEWN are listed here.  Generic
# parenthesis stripping would corrupt entries such as bale(보석금), while a
# generic base-word fallback would attach the wrong sense to turn (to).
SAFE_EDITORIAL_ALIASES = {
    "(a)round the clock": ["around the clock", "round the clock"],
    "acknowledgment / acknowledgement": ["acknowledgment", "acknowledgement"],
    "accoutre (accouter)": ["accoutre"],
    "add-up / add up": ["add up"],
    "alzheimer's (disease)": ["alzheimer's disease"],
    "appertain (to)": ["appertain"],
    "ascribe (a to b)": ["ascribe"],
    "at (the) first blush": ["at first blush"],
    "at (the) least": ["at least", "at the least"],
    "be-all (and end-all)": ["be-all and end-all"],
    "by fits (and starts)": ["by fits and starts"],
    "boiler-plate(d)": ["boilerplate"],
    "capitalize (on)": ["capitalize"],
    "coincide (with)": ["coincide"],
    "date back (to)": ["date back"],
    "dig (up)": ["dig up"],
    "dismissive (of)": ["dismissive"],
    "disport (oneself)": ["disport"],
    "district attorney (da)": ["district attorney"],
    "double(-)bind": ["double bind"],
    "eon(aeon)": ["eon"],
    "eventuate (in)": ["eventuate"],
    "familiarity (with)": ["familiarity"],
    "fob (off)": ["fob off"],
    "get (a)round": ["get around"],
    "get the hang(or knack) of": ["get the hang of"],
    "hightail (it)": ["hightail it"],
    "hit the ceiling(or roof)": ["hit the ceiling"],
    "impostor (imposter)": ["impostor"],
    "impute (a to b)": ["impute"],
    "in the (very) nick of time": ["in the nick of time"],
    "independent (of)": ["independent"],
    "injurious (to)": ["injurious"],
    "knickknack/nicknack": ["knickknack", "nicknack"],
    "lard (with)": ["lard"],
    "life span": ["lifespan"],
    "own up (to)": ["own up"],
    "pork (barrel)": ["pork barrel"],
    "primary (election)": ["primary election"],
    "recourse (to)": ["recourse"],
    "rely (on)": ["rely on"],
    "resort (to)": ["resort"],
    "stir (up)": ["stir up"],
    "swoop (on)": ["swoop"],
    "synonymous (with)": ["synonymous"],
    "the killing fields": ["killing field"],
    "the senate": ["senate"],
    "the sword of damocles": ["sword of damocles"],
    "unrelated (to)": ["unrelated"],
    "vender (vendor)": ["vender"],
    "winnow (out)": ["winnow out"],
}


def normalize_headword(value: str) -> str:
    return " ".join(value.replace("_", " ").strip().lower().split())


def definition_exposes_headword(headword: str, definition: str) -> bool:
    """Reject definitions that reveal the answer or an obvious inflection."""

    word_tokens = re.findall(r"[a-z]+", normalize_headword(headword))
    definition_tokens = re.findall(r"[a-z]+", definition.casefold())
    if not word_tokens:
        return True
    phrase = " ".join(word_tokens)
    if phrase in " ".join(definition_tokens):
        return True
    if len(word_tokens) != 1 or len(word_tokens[0]) < 5:
        return False
    stem = word_tokens[0]
    return any(
        token.startswith(stem) or stem.startswith(token)
        for token in definition_tokens
        if len(token) >= 5
    )


def safe_alias_candidates(value: str) -> list[dict[str, str]]:
    """Return conservative spelling/format aliases, never semantic fallbacks.

    These rules only remove editorial marks or normalize punctuation inside the
    same lexical expression.  They deliberately do not lemmatize, shorten a
    phrase to its head word, or infer a sense from the Korean gloss.
    """

    key = normalize_headword(value)
    candidates: list[dict[str, str]] = []

    def add(alias: str, match_type: str) -> None:
        normalized = normalize_headword(alias)
        if not normalized or normalized == key:
            return
        if any(row["headword"] == normalized for row in candidates):
            return
        candidates.append({"headword": normalized, "matchType": match_type})

    if "*" in key:
        add(key.replace("*", ""), "editorial_mark_removed")

    if key in SAFE_HYPHENATION_ALIASES:
        add(SAFE_HYPHENATION_ALIASES[key], "reviewed_hyphenation_variant")
    for alias in SAFE_EDITORIAL_ALIASES.get(key, []):
        add(alias, "reviewed_editorial_variant")

    # Whole-word alternatives such as "amatory (or amatorial)".
    alternate = re.fullmatch(r"([^()\s]+)\s*\(or\s+([^()\s]+)\)", key)
    if alternate:
        add(alternate.group(1), "explicit_spelling_alternative")
        add(alternate.group(2), "explicit_spelling_alternative")

    # Optional spelling letters such as chutzpa(h) or fledg(e)ling.
    optional = re.fullmatch(r"([a-z'-]*)\(([a-z-]{1,3})\)([a-z'-]*)", key)
    if optional:
        prefix, insertion, suffix = optional.groups()
        add(prefix + suffix, "optional_spelling_letters")
        add(prefix + insertion + suffix, "optional_spelling_letters")

    return candidates


def archive_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_json(zf: zipfile.ZipFile, name: str) -> Any:
    with zf.open(name) as handle:
        return json.load(handle)


def write_json_if_changed(path: Path, value: Any, pretty: bool = False) -> None:
    serialized = json.dumps(value, ensure_ascii=False, **({"indent": 2} if pretty else {"separators": (",", ":")})) + "\n"
    if not path.is_file() or path.read_text(encoding="utf-8") != serialized:
        path.write_text(serialized, encoding="utf-8")


def parse_args() -> argparse.Namespace:
    default_archive = Path(os.environ.get("TEMP", ".")) / "voca-oewn-2025.json.zip"
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, default=default_archive)
    parser.add_argument("--reference-stage", type=Path, help="Private analysis/qa candidate output; never changes app data")
    return parser.parse_args()


def stage_location(requested: Path) -> Path:
    boundary = ROOT / "analysis" / "qa"
    output = requested if requested.is_absolute() else ROOT / requested
    if not output.resolve().is_relative_to(boundary.resolve()) or output.suffix != ".json":
        raise ValueError("Reference stage must be JSON inside analysis/qa")
    for parent in (output, *output.parents):
        if parent.is_symlink():
            raise ValueError("Reference stage cannot use symbolic links")
        if parent == ROOT:
            break
    return output.resolve()


def own_peak_working_set() -> int | None:
    if os.name != "nt":
        return None
    class Counters(ctypes.Structure):
        _fields_ = [("cb", ctypes.c_uint32), ("faults", ctypes.c_uint32)] + [
            (name, ctypes.c_size_t) for name in ("peak", "working", "peakPaged", "paged", "peakNonPaged", "nonPaged", "pagefile", "peakPagefile", "private")
        ]
    kernel = ctypes.WinDLL("kernel32")
    kernel.GetCurrentProcess.restype = ctypes.c_void_p
    counters = Counters()
    counters.cb = ctypes.sizeof(counters)
    psapi = ctypes.WinDLL("psapi")
    psapi.GetProcessMemoryInfo.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_uint32]
    return int(counters.peak) if psapi.GetProcessMemoryInfo(kernel.GetCurrentProcess(), ctypes.byref(counters), counters.cb) else None


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

    stage_path = stage_location(args.reference_stage) if args.reference_stage else None
    checkpoint_path = stage_path.with_suffix(".checkpoint.json") if stage_path else None
    stage_input = hashlib.sha256((actual_hash + archive_hash(VOCAB_PATH) + archive_hash(Path(__file__))).encode()).hexdigest()
    if stage_path and stage_path.exists():
        if not checkpoint_path or not checkpoint_path.is_file():
            raise ValueError("Unowned stage output preserved; checkpoint missing")
        previous = json.loads(checkpoint_path.read_text(encoding="utf-8"))
        if previous.get("generator") != "finetune-oewn-reference-stage-v1" or previous.get("outputSha256") != archive_hash(stage_path):
            raise ValueError("Modified or unowned stage output preserved")
        if previous.get("inputHash") == stage_input:
            print(json.dumps({"status": "NO_CHANGE", "inputHash": stage_input, "productionChanges": 0}))
            return 0

    vocab = json.loads(VOCAB_PATH.read_text(encoding="utf-8"))
    if not isinstance(vocab, list):
        raise TypeError("assets/vocab-v1.4.json must be a list")

    # Translation review is independent of dictionary-sense/quiz approval.
    translation_path = ROOT / "data/vocab-learning/reviewed-examples-20261014.json"
    translation_batch = json.loads(translation_path.read_text(encoding="utf-8"))
    if translation_batch["source"]["archiveSha256"] != actual_hash or translation_batch["source"]["sourceVocabularySha256"] != archive_hash(VOCAB_PATH):
        raise ValueError("Translation source edition does not match the current inputs")
    translations = translation_batch["entries"]
    editorial_path = ROOT / "data/vocab-learning/editorial-examples-20261015.json"
    editorial_batch = json.loads(editorial_path.read_text(encoding="utf-8"))
    if editorial_batch["source"]["archiveSha256"] != actual_hash or editorial_batch["source"]["sourceVocabularySha256"] != archive_hash(VOCAB_PATH):
        raise ValueError("Editorial source edition does not match the current inputs")
    editorial_examples = editorial_batch["entries"]

    wanted = {normalize_headword(str(item["w"])) for item in vocab}
    aliases_by_key = {key: safe_alias_candidates(key) for key in wanted}
    lookup_keys = wanted | {
        alias["headword"]
        for aliases in aliases_by_key.values()
        for alias in aliases
    }
    display_by_key: dict[str, str] = {}
    for item in vocab:
        key = normalize_headword(str(item["w"]))
        display_by_key.setdefault(key, str(item["w"]).strip())

    senses_by_key: dict[str, list[dict[str, Any]]] = defaultdict(list)
    sense_headword_by_id: dict[str, str] = {}
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
                if key not in lookup_keys or not isinstance(pos_map, dict):
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
                        sense_headword_by_id.setdefault(sense_id, key)
                        senses_by_key[key].append(
                            {
                                "senseId": sense_id,
                                "synsetId": synset_id,
                                "partOfSpeech": POS_LABELS.get(pos_code, pos_code),
                                "antonymSenseIds": [
                                    str(value).strip()
                                    for value in sense_row.get("antonym", [])
                                    if str(value).strip()
                                ],
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
                    synset_data[synset_id] = {
                        **record,
                        "_lexicographerFile": Path(name).stem,
                    }

    raw_definitions_by_key: dict[str, list[dict[str, Any]]] = {}
    for key in sorted(lookup_keys):
        resolved: list[dict[str, Any]] = []
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
                        "synsetId": sense["synsetId"],
                        "partOfSpeech": sense["partOfSpeech"],
                        "definition": definition,
                        "lexicographerFile": str(synset.get("_lexicographerFile", "")),
                        "synsetMembers": [
                            normalize_headword(str(member))
                            for member in synset.get("members", [])
                            if str(member).strip()
                        ],
                        "antonyms": sorted({
                            sense_headword_by_id[antonym_id]
                            for antonym_id in sense.get("antonymSenseIds", [])
                            if antonym_id in sense_headword_by_id
                            and sense_headword_by_id[antonym_id] != key
                        }),
                        "examples": [
                            example
                            for example in dict.fromkeys(
                                " ".join(value.split())
                                for value in (
                                    synset.get("example", [])
                                    if isinstance(synset.get("example", []), list)
                                    else [synset.get("example", "")]
                                )
                                # Attributed object examples need separate rights
                                # review; never display Python dict repr as English.
                                if isinstance(value, str)
                            )
                            if example
                        ],
                    }
                )
        raw_definitions_by_key[key] = resolved

    definitions_by_key: dict[str, list[dict[str, Any]]] = {}
    matches_by_key: dict[str, list[dict[str, str]]] = {}
    for key in sorted(wanted):
        exact = raw_definitions_by_key.get(key, [])
        if exact:
            definitions_by_key[key] = exact
            matches_by_key[key] = [{"headword": key, "matchType": "exact"}]
            continue

        resolved: list[dict[str, Any]] = []
        matches: list[dict[str, str]] = []
        seen_definitions: set[tuple[str, str]] = set()
        for alias in aliases_by_key[key]:
            alias_senses = raw_definitions_by_key.get(alias["headword"], [])
            if not alias_senses:
                continue
            matches.append(alias)
            for sense in alias_senses:
                signature = (sense["partOfSpeech"], sense["definition"].casefold())
                if signature in seen_definitions:
                    continue
                seen_definitions.add(signature)
                resolved.append({**sense, "matchedHeadword": alias["headword"]})
        definitions_by_key[key] = resolved
        matches_by_key[key] = matches

    source = {
        "name": "Open English WordNet",
        "edition": "2025",
        "url": "https://en-word.net/downloads/english-wordnet-2025-json.zip",
        "license": "CC BY 4.0",
        "attribution": "Princeton WordNet; Open English WordNet Team",
        "archiveSha256": actual_hash,
    }

    if stage_path:
        # Reuse the importer's actual sense/synset extraction. Shared clusters
        # appear once; original row IDs point to headword/sense candidates.
        clusters: dict[str, dict[str, Any]] = {}
        headwords = {}
        held = []
        rows_by_key: dict[str, list[str]] = defaultdict(list)
        for item in vocab:
            rows_by_key[normalize_headword(str(item["w"]))].append(str(item["id"]))
        for key, senses in definitions_by_key.items():
            pointers = []
            for sense in senses:
                cluster = clusters.setdefault(sense["synsetId"], {
                    "synsetId": sense["synsetId"], "partOfSpeech": sense["partOfSpeech"], "definitions": [],
                    "members": sense["synsetMembers"], "examples": sense["examples"],
                    "status": "licensed-source-reference-not-editorially-reviewed",
                })
                if sense["definition"] not in cluster["definitions"]:
                    cluster["definitions"].append(sense["definition"])
                pointers.append({"senseId": sense["senseId"], "synsetId": sense["synsetId"], "partOfSpeech": sense["partOfSpeech"], "antonyms": sense["antonyms"]})
            headwords[key] = {"headword": display_by_key[key], "itemIds": rows_by_key[key], "matches": matches_by_key[key], "senses": pointers}
            held.append({"headword": key, "itemIds": rows_by_key[key], "resumeKey": hashlib.sha256(key.encode()).hexdigest(),
                         "reasons": ["Korean sense alignment and individual relation glosses not newly reviewed", "Example translation/context quality not newly reviewed"]
                         + (["source_not_found"] if not senses else [])})
        payload = {"schema": 1, "status": "CANDIDATES_NOT_PRODUCTION", "inputHash": stage_input, "source": source,
                   "sourceVocabularySha256": archive_hash(VOCAB_PATH), "headwords": headwords, "clusters": clusters, "heldQueue": held,
                   "restrictions": ["No answer or learner ID changes", "No Korean inference from headword alone", "No semantic promotion", "No app export or UI delivery by staging"]}
        stage_path.parent.mkdir(parents=True, exist_ok=True)
        serialized = json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"
        temporary = stage_path.with_name(f"{stage_path.name}.{os.getpid()}.tmp")
        with temporary.open("x", encoding="utf-8") as handle:
            handle.write(serialized)
        temporary.replace(stage_path)
        checkpoint = {"generator": "finetune-oewn-reference-stage-v1", "inputHash": stage_input, "outputSha256": archive_hash(stage_path)}
        temporary_checkpoint = checkpoint_path.with_name(f"{checkpoint_path.name}.{os.getpid()}.tmp")
        with temporary_checkpoint.open("x", encoding="utf-8") as handle:
            handle.write(json.dumps(checkpoint, ensure_ascii=False) + "\n")
        temporary_checkpoint.replace(checkpoint_path)
        print(json.dumps({"status": "STAGED_NOT_PRODUCTION", "headwords": len(headwords), "sourceRows": len(vocab),
                          "lexicalSenses": len({sense["senseId"] for value in headwords.values() for sense in value["senses"]}),
                          "sharedClusters": len(clusters), "clustersWithExamples": sum(bool(cluster["examples"]) for cluster in clusters.values()),
                          "headwordsWithAnySourceExample": sum(any(clusters[sense["synsetId"]]["examples"] for sense in value["senses"]) for value in headwords.values()),
                          "heldHeadwords": len(held), "newSemanticReviewPass": 0, "productionChanges": 0,
                          "peakWorkingSetBytes": own_peak_working_set(), "inputHash": stage_input}))
        return 0

    group_items: dict[str, dict[str, str]] = {group: {} for group in GROUPS}
    group_keys: dict[str, set[str]] = {group: set() for group in GROUPS}
    row_status = Counter()
    unique_status = Counter()

    for key, senses in definitions_by_key.items():
        matches = matches_by_key[key]
        if not senses:
            unique_status["source_not_found"] += 1
        elif matches and matches[0]["matchType"] != "exact":
            unique_status["dictionary_alias_unreviewed"] += 1
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
        matches = matches_by_key[key]
        if not senses:
            row_status["source_not_found"] += 1
        elif matches and matches[0]["matchType"] != "exact":
            row_status["dictionary_alias_unreviewed"] += 1
        elif len(senses) == 1:
            row_status["single_sense"] += 1
        else:
            row_status["dictionary_primary_unreviewed"] += 1

    translation_keys: set[tuple[str, str]] = set()
    source_ids = {str(item["id"]) for item in vocab}
    source_by_id = {str(item["id"]): item for item in vocab}
    for translation in translations:
        key = normalize_headword(translation["headword"])
        signature = (translation["senseId"], translation["en"])
        source_sense = next((sense for sense in definitions_by_key.get(key, [])
                             if sense["senseId"] == translation["senseId"]), None)
        if signature in translation_keys or not source_sense or translation["en"] not in source_sense["examples"]:
            raise ValueError("Duplicate or unlinked reviewed example translation")
        if not all(isinstance(translation.get(field), str) and translation[field].strip() for field in ("ko", "cueKo")):
            raise ValueError("Incomplete reviewed example translation")
        if not translation.get("sourceRowIds") or not set(translation["sourceRowIds"]).issubset(source_ids):
            raise ValueError("Reviewed example references unknown source rows")
        if translation.get("reviewStatus") != "ai-reviewed-example-translation" or any(
            normalize_headword(source_by_id[row_id]["w"]) != key
            or source_by_id[row_id]["k"] != translation.get("sourceMeaningKo")
            for row_id in translation["sourceRowIds"]
        ):
            raise ValueError("Reviewed translation source word/meaning/status mismatch")
        translation_keys.add(signature)

    # Original editorial sentences are NOT dictionary quotations or quiz evidence.
    # Validate row meaning, lexical sense, POS and definition before exporting them.
    editorial_by_sense: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    editorial_keys: set[tuple[str, str]] = set()
    for example in editorial_examples:
        key = normalize_headword(example["headword"])
        signature = (key, example["senseId"])
        sense = next((value for value in definitions_by_key.get(key, []) if value["senseId"] == example["senseId"]), None)
        if signature in editorial_keys or not sense:
            raise ValueError("Duplicate or unlinked editorial example")
        if not all(isinstance(example.get(field), str) and example[field].strip() for field in ("en", "ko", "cueKo")):
            raise ValueError("Incomplete editorial example")
        if (example.get("reviewStatus") != "ai-reviewed-editorial-example"
                or sense["synsetId"] != example.get("synsetId")
                or sense["partOfSpeech"] != example.get("pos")
                or sense["definition"] != example.get("matchEvidence", {}).get("sourceDefinition")):
            raise ValueError("Editorial sense/POS/definition/status mismatch")
        ids = example.get("sourceRowIds", [])
        if not ids or len(set(ids)) != len(ids) or any(
                row_id not in source_by_id
                or normalize_headword(source_by_id[row_id]["w"]) != key
                or source_by_id[row_id]["k"] != example.get("sourceMeaningKo") for row_id in ids):
            raise ValueError("Editorial source row/meaning mismatch")
        editorial_keys.add(signature)
        support = {}
        if "relationMeaningsKo" in example:
            meanings = example["relationMeaningsKo"]
            if not isinstance(meanings, dict) or any(
                word == key or word not in sense["synsetMembers"]
                or not isinstance(meaning, str) or not meaning.strip() or len(meaning) > 16
                for word, meaning in meanings.items()
            ):
                raise ValueError("Editorial individual gloss is not a short same-synset relation")
            support["relationMeaningsKo"] = meanings
        if "usageKo" in example:
            if not isinstance(example["usageKo"], str) or not example["usageKo"].strip():
                raise ValueError("Empty editorial usage explanation")
            support["usageKo"] = example["usageKo"]
        editorial_by_sense[signature].append({
            **{field: example[field] for field in ("en", "ko", "cueKo", "sourceRowIds")},
            **support,
            "provenance": "FINETUNE original", "reviewStatus": "ai-reviewed-editorial-example",
        })

    translations_by_sense: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
    for translation in translations:
        translations_by_sense[(normalize_headword(translation["headword"]), translation["senseId"])].append(
            {field: translation[field] for field in ("en", "ko", "cueKo")})

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for group in GROUPS:
        headwords: dict[str, Any] = {}
        for key in sorted(group_keys[group]):
            senses = definitions_by_key[key]
            matches = matches_by_key[key]
            if not senses:
                status = "source_not_found"
                representative_sense_id = None
            elif matches and matches[0]["matchType"] != "exact":
                status = "dictionary_alias_unreviewed"
                representative_sense_id = senses[0]["senseId"]
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
                "matches": matches,
                # Licensed reference examples belong to each lexical sense,
                # not only the smaller set of eligible quiz entries.
                "senses": [
                    {
                        **{field: sense[field] for field in (
                            "senseId", "synsetId", "partOfSpeech", "definition", "matchedHeadword", "examples"
                        ) if field in sense},
                        "reviewedExamples": translations_by_sense.get((key, sense["senseId"]), []),
                        **({"editorialExamples": editorial_by_sense[(key, sense["senseId"])]}
                           if (key, sense["senseId"]) in editorial_by_sense else {}),
                    }
                    for sense in senses
                ],
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
        write_json_if_changed(output_path, payload)

    total_rows = len(vocab)
    total_unique = len(wanted)
    matched_rows = total_rows - row_status["source_not_found"]
    matched_unique = total_unique - unique_status["source_not_found"]
    metadata = {
        "schema": 1,
        "version": "oewn-2025",
        "source": source,
        "coverage": {
            "referenceExampleHeadwords": sum(any(sense["examples"] for sense in senses) for senses in definitions_by_key.values()),
            "referenceExampleSenses": len({sense["senseId"] for senses in definitions_by_key.values() for sense in senses if sense["examples"]}),
            "referenceExampleRows": sum(any(sense["examples"] for sense in definitions_by_key[normalize_headword(str(item["w"]))]) for item in vocab),
            "reviewedExampleTranslations": len(translations),
            "editorialExampleHeadwords": len({normalize_headword(example["headword"]) for example in editorial_examples}),
            "editorialExampleSenses": len(editorial_examples),
            "editorialExampleRows": len({row_id for example in editorial_examples for row_id in example["sourceRowIds"]}),
            "totalRows": total_rows,
            "totalUniqueHeadwords": total_unique,
            "matchedRows": matched_rows,
            "matchedRowPercent": round(matched_rows / total_rows * 100, 2),
            "singleSenseRows": row_status["single_sense"],
            "ambiguousRows": row_status["dictionary_primary_unreviewed"],
            "aliasMatchedRows": row_status["dictionary_alias_unreviewed"],
            "sourceNotFoundRows": row_status["source_not_found"],
            "matchedUniqueHeadwords": matched_unique,
            "singleSenseUniqueHeadwords": unique_status["single_sense"],
            "ambiguousUniqueHeadwords": unique_status["dictionary_primary_unreviewed"],
            "aliasMatchedUniqueHeadwords": unique_status["dictionary_alias_unreviewed"],
            "sourceNotFoundUniqueHeadwords": unique_status["source_not_found"],
        },
        "groupRows": {group: len(group_items[group]) for group in GROUPS},
        "quizEligibility": {
            "single_sense": True,
            "dictionary_primary_unreviewed": False,
            "dictionary_alias_unreviewed": False,
            "source_not_found": False,
        },
    }
    write_json_if_changed(META_PATH, metadata, pretty=True)

    quiz_entries: dict[str, Any] = {}
    excluded_definition_leakage = 0
    for key in sorted(wanted):
        senses = definitions_by_key[key]
        matches = matches_by_key[key]
        if len(senses) != 1 or matches != [{"headword": key, "matchType": "exact"}]:
            continue
        sense = senses[0]
        if definition_exposes_headword(key, sense["definition"]):
            excluded_definition_leakage += 1
            continue
        quiz_entries[key] = {
            "headword": display_by_key[key],
            "senseId": sense["senseId"],
            "partOfSpeech": sense["partOfSpeech"],
            "definition": sense["definition"],
            "lexicographerFile": sense["lexicographerFile"],
            "synsetMembers": sense["synsetMembers"],
            "antonyms": sense["antonyms"],
            "examples": sense["examples"],
        }

    quiz_items = {
        str(item["id"]): normalize_headword(str(item["w"]))
        for item in vocab
        if normalize_headword(str(item["w"])) in quiz_entries
    }
    quiz_payload = {
        "schema": 1,
        "version": "oewn-2025",
        "source": source,
        "coverage": {
            "eligibleHeadwords": len(quiz_entries),
            "eligibleRows": len(quiz_items),
            "excludedDefinitionLeakageHeadwords": excluded_definition_leakage,
            "exampleHeadwords": sum(bool(entry["examples"]) for entry in quiz_entries.values()),
            "exampleRows": sum(
                1 for item_key in quiz_items.values() if quiz_entries[item_key]["examples"]
            ),
        },
        "items": dict(sorted(quiz_items.items())),
        "entries": quiz_entries,
    }
    write_json_if_changed(QUIZ_PATH, quiz_payload)

    print(json.dumps({
        **metadata["coverage"],
        "definitionQuizRows": len(quiz_items),
        "definitionQuizHeadwords": len(quiz_entries),
        "definitionQuizLeakageExcludedHeadwords": excluded_definition_leakage,
        "definitionQuizExampleHeadwords": quiz_payload["coverage"]["exampleHeadwords"],
        "definitionQuizExampleRows": quiz_payload["coverage"]["exampleRows"],
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # pragma: no cover - command-line diagnostics
        print(f"ERROR: {exc}", file=sys.stderr)
        raise
