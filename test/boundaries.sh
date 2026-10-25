#!/usr/bin/env bash
# Boundaries in the source that no unit test can see: who may run a command,
# read a file, start the IPC target or act on Hyprland; that only the
# adapters name an exchange's endpoint; that the rule files stay pure; and
# that colours come from the theme. Prints a FAILED line per breach and
# exits non-zero on any. Adapted from the original Stonks' test/boundaries.sh.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
failed=0
fail() { echo "FAILED $*"; failed=1; }

# only PATTERN FILE...: PATTERN (PCRE, across lines) appears in the QML
# only in FILEs.
only() {
  local pattern=$1 files file
  shift
  files=$(rg -lUP -e "$pattern" -- *.qml)
  [ $? -le 1 ] || fail "rg could not check '$pattern'"
  for file in $files; do
    [[ " $* " == *" $file "* ]] || fail "$file: '$pattern' belongs only in $*"
  done
}
# none PATTERN FILE...: PATTERN (PCRE) appears in none of FILEs. An rg error
# fails too: a check that did not run passes nothing.
none() {
  local pattern=$1 hits code hit
  shift
  hits=$(rg -nP -e "$pattern" -- "$@")
  code=$?
  [ "$code" -le 1 ] || fail "rg could not check '$pattern' in $*"
  [ "$code" -eq 0 ] || return 0
  while read -r hit; do fail "$hit: '$pattern' is not allowed here"; done <<< "$hits"
}

# Commands run only in the two feeds that fetch; files are read and written
# only by the service, the symbol list's cache and the trend colours; one
# IPC target; only the window's host and the screens act on Hyprland.
only '\bProcess\s*\{' PriceFeed.qml SymbolList.qml
only '\bFileView\s*\{' Service.qml SymbolList.qml TrendColors.qml
only '^import Quickshell\.Io' PriceFeed.qml SymbolList.qml Service.qml IpcTarget.qml TrendColors.qml
only '\bIpcHandler\s*\{' IpcTarget.qml
only '^import Quickshell\.Hyprland' WindowHost.qml Screens.qml
only '\bPriceFeed\s*\{' Service.qml
none '^import "adapters/' *.qml
# Only Exchanges.js imports the adapters; the screens ask it for one.
hits=$(rg -l '^\.import "adapters/' -- *.js)
[ "$hits" = "Exchanges.js" ] || fail "only Exchanges.js may import an adapter, found: $hits"
none 'execDetached|XMLHttpRequest|https?://' *.qml
# No rule file names an endpoint; only adapters/ does.
none 'https?://(?!github\.com)' *.js
# Every request goes through Fetch.curlCommand, which compresses and caps it.
while read -r hit; do
  [ -n "$hit" ] && fail "$hit: a command that is not Fetch.curlCommand's"
done <<< "$(rg -n '\.command\s*=' -- *.qml | rg -v 'Fetch\.curlCommand\(')"
for flag in --compressed --max-filesize; do
  rg -q -F -- "\"$flag\"" Fetch.js || fail "Fetch.js: curlCommand no longer sends $flag"
done
# The rule files (every *.js here) are pure: no host, no I/O, no clock.
none '\bQt\.|\bQuickshell\b|XMLHttpRequest|Date\.now\(|\bDate\s*\(\s*\)' *.js adapters/*.js
# Colours come from the theme: no hex literal outside Tones.js's own pairs
# and no hex or numeric Qt.rgba in the QML.
others=()
for file in *.js adapters/*.js; do [ "$file" = Tones.js ] || others+=("$file"); done
none "([\"'])#[0-9a-fA-F]{3,8}\\1" "${others[@]}"
none "([\"'])#[0-9a-fA-F]{3,8}\\1|Qt\\.(rgba|hsla|hsva)\\(\\s*[0-9.]" *.qml
# The bar entry holds only the pill's forms; the service's file holds the rest.
jq -e '.barWidget.defaults | keys == ["barStyle"]' manifest.json > /dev/null \
  || fail "manifest.json: the bar entry's defaults hold more than barStyle"
# QtQuick owns Sprite: a Sprite.qml here would resolve as QtQuick's type.
[ -e Sprite.qml ] && fail "Sprite.qml: QtQuick owns the Sprite type"

exit "$failed"
