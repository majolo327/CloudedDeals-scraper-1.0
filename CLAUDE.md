# CLAUDE.md — Project Instructions for Claude Code

## Project Overview

CloudedDeals scraper: a Playwright-based web scraper that visits cannabis
dispensary websites, extracts menus/pricing, detects deals, scores them, and
pushes results to Supabase. Runs as GitHub Actions cron jobs.

See `OPERATIONS.md` for full coverage details and platform status.

---

## Git & GitHub Environment Constraints

### No GitHub CLI API access

This environment uses a **local git proxy** (`http://local_proxy@127.0.0.1:<port>/git/...`)
that only supports git protocol operations:

- **Works:** `git push`, `git pull`, `git fetch`, `git clone`
- **Does NOT work:** `gh pr create`, `gh issue`, `gh api`, or any GitHub
  REST/GraphQL API call — there is no GitHub API token available

The `gh` CLI will always fail with `gh auth login` errors. Do not retry it or
attempt workarounds (curl to api.github.com, GH_TOKEN env vars, etc.) — none
of them will work in this environment.

### Pull Request Workflow

Since `gh` CLI cannot create PRs, follow this process **every time**:

1. **Push the branch** with `git push -u origin <branch-name>`
2. **Provide the compare URL** for the user to create the PR in their browser:
   ```
   https://github.com/majolo327/CloudedDeals-scraper-1.0/compare/main...<branch-name>
   ```
3. **Include a suggested PR title and body** in your message so the user can
   copy-paste it into the GitHub web UI
4. **Never assume a PR is merged or closed** — the user will handle merging
   manually after review. Do not proceed as if a PR is merged unless the user
   explicitly confirms it.

### Branch Naming

- Feature branches: `claude/<descriptive-name>-<session-suffix>`
- Always push with `-u` flag to set upstream tracking
- Never force-push to `main`

### Commit Standards

- Sign commits (gpgsign is already configured)
- Use conventional commit prefixes: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- Commit message body should explain **why**, not just what
- Append the Claude session URL to every commit message

---

## Repository Structure

```
clouded-deals/
  scraper/
    config/dispensaries.py    # All dispensary configs, browser fingerprint pools
    main.py                   # Entry point, orchestrates scraping
    platforms/
      base.py                 # BaseScraper — shared browser lifecycle & helpers
      dutchie.py              # Dutchie platform scraper
      jane.py                 # Jane platform scraper
      curaleaf.py             # Curaleaf platform scraper
      rise.py                 # Rise platform scraper (disabled — Turnstile)
      carrot.py               # Carrot platform scraper
      aiq.py                  # AIQ platform scraper
    deal_detector/            # Deal scoring & qualification logic
    requirements.txt
  frontend/                   # Next.js frontend (separate concern)
  docs/                       # Expansion roadmaps, market research
```

---

## Current Anti-Bot Stack (as of Feb 2026)

1. **playwright-stealth** — patches navigator props, WebGL, etc.
2. **Rotated User-Agents** — pool of Chrome 132-134 UAs, one per context
3. **Randomized viewports** — 4 base resolutions with jitter
4. **Region-mapped timezones** — each context gets a timezone matching the
   dispensary's geographic region (e.g. `southern-nv` → `America/Los_Angeles`)
5. **Rotated locale** — small `en-US` variant pool per context
6. **JS stealth init script** — belt-and-suspenders layer on top of playwright-stealth
7. **Real Chrome channel** — uses branded Chrome (not Chromium) for matching
   TLS fingerprint and codec support

---

## Beta Lock (Feb 22, 2026)

All platforms are in **locked beta**. Rules:
- No new sites, no new scrapers
- Surgical fixes only (see `OPERATIONS.md` for criteria)
- Anti-bot and reliability improvements are permitted
