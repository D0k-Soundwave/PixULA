# Parity work log

Newest entry at the bottom. One entry per session. Format:

    ## <YYYY-MM-DD> - Batch <N> part <X> - <title> - <done | partial | blocked>
    Model: <model>. Branch: <branch>.
    Commits: <hash> <subject> (one per line)
    Done: <items finished>
    Left: <items not finished, and where they went - "none" if none>
    Plan corrections: <what you changed in the batch files, and why - or "none">
    Opus: <question -> answer, one line each - or "none">
    Owner: <questions asked -> answers - or "none">
    Flaky tests: <names - or "none">
    Next: <the part or check-off you handed off to>

---

## 2026-10-08 - setup - instructions written - done
Model: Opus. Branch: parity-a (from main at 05f5256).
Done: RUNBOOK.md, CHECKOFF.md, batch-02.md to batch-12.md, count-verdicts.js,
chm2txt.py; ZX Paintbrush help text copied to .reference/zx-paintbrush-help/
(gitignored). Batch 1 (Bright and Flash) already shipped in 0.1.0-alpha.17.
Plan corrections: PLOT coordinates and grid colours moved from Batch 12 to
Batch 3 (they belong with the pointer readout and the grids).
Next: Batch 2 part 2A.
