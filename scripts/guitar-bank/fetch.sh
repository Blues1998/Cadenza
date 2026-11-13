#!/bin/sh
# Downloads the CC0 recordings the guitar bank is built from into ./work.
# About 1.2 GB of downloads. Needs curl, unzip and 7zz (brew install sevenzip).
set -e
cd "$(dirname "$0")"
mkdir -p work/dl
cd work

META=https://github.com/facebookincubator/Meta-open-sound/releases/download
FREEPATS=https://github.com/freepats/electric-guitar-FSBS-clean/releases/download/2026-08-07

[ -f dl/nylon.zip ] || curl -L -o dl/nylon.zip "$META/meta-nylon-guitar-v1.0.0/meta-open-sound-meta-nylon-guitar-wav.zip"
[ -f dl/steel.zip ] || curl -L -o dl/steel.zip "$META/meta-steel-guitar-v1.0.0/meta-open-sound-meta-steel-guitar-wav.zip"
[ -f dl/fsbs.7z ]   || curl -L -o dl/fsbs.7z   "$FREEPATS/EGuitarFSBS-clean-SFZ+FLAC-20260807.7z"

rm -rf wav-nylon wav-steel fsbs
unzip -q dl/nylon.zip -d wav-nylon
unzip -q dl/steel.zip -d wav-steel
7zz x -y -ofsbs dl/fsbs.7z > /dev/null
echo "Sources ready in $(pwd)"
