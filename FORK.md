# THE FORK — 2026-07-14

## Decision
Greencross elected to fork the engine to pursue an experimental direction that
may change the art substantially. The stable line is preserved so the
experiment can be judged and, if found unworthy, abandoned without loss.

## The return point
- Branch: `rev13-baseline` (immutable reference)
- Tag: `v13.0-baseline`
- Commit: `fbb59895fbf173d194c2d316a06d30fe83a05be5`
- State: REV 13.0 · LAZARUS · FACES FOR SOULS. Sepolia rehearsal complete
  (inscribe + collect proven on-chain at 0x072B09Cf9F428cd09D771a75c3b9889Ba7a3E3CD).
  Band doctrine layout. Split archive. Live editions. Gallery with breeding.
  Mainnet deploy pending only a go decision.

## How to return (kill the fork)
Restore `index.html` from the baseline and push to `main`:

    git checkout rev13-baseline -- index.html && git commit -m "fork abandoned, baseline restored" && git push

Or ask Claude: "restore the rev13 baseline" (one API call, same effect).

## How to keep the fork
Merge nothing; `main` already carries it. Delete this file's "experimental"
framing, retag, and the fork becomes the trunk.

## Verdict
PENDING — the experiment runs on `main` (live at dithervoid.art) until judged.
