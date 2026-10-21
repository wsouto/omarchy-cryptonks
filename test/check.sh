#!/usr/bin/env bash
# The checks to run before every commit: `bash test/check.sh`.
#
#   1. omarchy plugin validate   the manifest follows the shell's schema
#   2. qmllint                   every QML file parses and uses real types
#
# It prints "ALL PASS" on its last line only when both succeed.
# The lint step borrows the approach of the original Stonks project
# (test/lint.sh): qmllint finds the shell's types through a temporary
# `qs` link to /usr/share/omarchy/shell.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

failed=0

echo "== manifest"
omarchy plugin validate . || failed=1

echo "== qmllint"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
ln -s /usr/share/omarchy/shell "$tmp/qs"
# --block-scope-var-declaration disable: Qt 6.12 warns about `var` inside
# blocks, a style this project keeps.
/usr/lib/qt6/bin/qmllint --block-scope-var-declaration disable -I "$tmp" *.qml || failed=1

if [ "$failed" -eq 0 ]; then echo "ALL PASS"; else echo "FAILED"; exit 1; fi
