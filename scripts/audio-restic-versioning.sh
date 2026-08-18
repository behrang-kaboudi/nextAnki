#!/bin/sh

set -eu

die() {
  printf 'audio-restic: %s\n' "$*" >&2
  exit 1
}

project_root="$(git rev-parse --show-toplevel 2>/dev/null)" ||
  die "run this command inside the Anki Git worktree"
cd "$project_root"

restic_repository="$(git config --local --get anki.audioResticRepository || true)"
keychain_service="$(git config --local --get anki.audioResticKeychainService || true)"
keychain_account="$(git config --local --get anki.audioResticKeychainAccount || true)"
snapshot_anchor="$(git config --local --get anki.audioSnapshotAnchor || true)"
protected_ref="$(git config --local --get anki.audioSnapshotProtectedRef || true)"

[ -n "$restic_repository" ] ||
  die "missing local config anki.audioResticRepository"
[ -d "$restic_repository" ] ||
  die "Restic repository does not exist: $restic_repository"
[ -n "$keychain_service" ] ||
  die "missing local config anki.audioResticKeychainService"
[ -n "$keychain_account" ] ||
  die "missing local config anki.audioResticKeychainAccount"

case "$keychain_service" in
  *[!A-Za-z0-9._@-]*) die "unsupported character in Keychain service name" ;;
esac
case "$keychain_account" in
  *[!A-Za-z0-9._@-]*) die "unsupported character in Keychain account name" ;;
esac

restic_bin="$(command -v restic || true)"
jq_bin="$(command -v jq || true)"
[ -n "$restic_bin" ] || die "restic is not installed"
[ -n "$jq_bin" ] || die "jq is not installed"

password_command="security find-generic-password -a $keychain_account -s $keychain_service -w"

run_restic() {
  "$restic_bin" \
    -r "$restic_repository" \
    --password-command "$password_command" \
    "$@"
}

snapshot_exists() {
  snapshot_tag="$1"
  run_restic snapshots --tag "$snapshot_tag" --json |
    "$jq_bin" -e 'length > 0' >/dev/null
}

snapshot_commit() {
  requested_revision="${1:-HEAD}"
  commit_oid="$(git rev-parse --verify "$requested_revision^{commit}" 2>/dev/null)" ||
    die "not a commit: $requested_revision"
  snapshot_tag="git-$commit_oid"

  if snapshot_exists "$snapshot_tag"; then
    printf 'audio-restic: snapshot already exists for %s\n' "$commit_oid"
    return 0
  fi

  [ -d public/audio ] || die "audio source directory does not exist: public/audio"

  run_restic backup public/audio \
    --tag automatic-git-snapshot \
    --tag "$snapshot_tag"

  snapshot_exists "$snapshot_tag" ||
    die "snapshot verification failed for $commit_oid"

  printf 'audio-restic: snapshot verified for %s\n' "$commit_oid"
}

reject_staged_audio() {
  staged_audio="$(
    git diff --cached --name-only --diff-filter=ACMRTUXB -- |
      grep -Ei '^public/audio/.*\.(mp3|wav|m4a|aac|ogg|flac|webm|opus|aiff|aif|caf|wma)$' || true
  )"

  if [ -n "$staged_audio" ]; then
    printf '%s\n' 'audio-restic: commit blocked; audio files must not be tracked by Git:' >&2
    printf '%s\n' "$staged_audio" >&2
    return 1
  fi
}

verify_snapshot_range() {
  local_oid="$1"

  [ -n "$snapshot_anchor" ] ||
    die "missing local config anki.audioSnapshotAnchor"
  git cat-file -e "$snapshot_anchor^{commit}" 2>/dev/null ||
    die "snapshot anchor is not present in this history: $snapshot_anchor"
  git merge-base --is-ancestor "$snapshot_anchor" "$local_oid" ||
    die "protected history no longer contains snapshot anchor $snapshot_anchor"

  available_tags="$(
    run_restic snapshots --json |
      "$jq_bin" -r '.[] | .tags[]? | select(startswith("git-"))'
  )"
  missing_commits=""

  for commit_oid in $(git rev-list "$snapshot_anchor^..$local_oid"); do
    if ! printf '%s\n' "$available_tags" | grep -Fqx "git-$commit_oid"; then
      missing_commits="${missing_commits}${missing_commits:+
}$commit_oid"
    fi
  done

  if [ -n "$missing_commits" ]; then
    printf '%s\n' 'audio-restic: push blocked; these commits have no audio snapshot:' >&2
    printf '%s\n' "$missing_commits" >&2
    return 1
  fi
}

verify_push() {
  [ -n "$protected_ref" ] ||
    die "missing local config anki.audioSnapshotProtectedRef"

  zero_oid="0000000000000000000000000000000000000000"
  checked_protected_ref=false

  while read -r local_ref local_oid remote_ref remote_oid; do
    [ -n "${local_ref:-}" ] || continue
    [ "$local_oid" != "$zero_oid" ] || continue
    [ "$local_ref" = "$protected_ref" ] || continue

    verify_snapshot_range "$local_oid"
    checked_protected_ref=true
  done

  if [ "$checked_protected_ref" = true ]; then
    printf 'audio-restic: all required snapshots exist for %s\n' "$protected_ref"
  fi
}

case "${1:-}" in
  snapshot)
    shift
    snapshot_commit "${1:-HEAD}"
    ;;
  reject-staged)
    reject_staged_audio
    ;;
  verify-push)
    shift
    verify_push "$@"
    ;;
  *)
    die "usage: $0 {snapshot [commit]|reject-staged|verify-push}"
    ;;
esac
