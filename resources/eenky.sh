#!/bin/bash
# Resolves the directory where this script is located and runs eenky with --no-sandbox
# to avoid crashes on systems restricting unprivileged user namespaces (e.g. Ubuntu 24.04).
HERE="$(dirname "$(readlink -f "${0}")")"
exec "${HERE}/eenky" --no-sandbox "$@"
