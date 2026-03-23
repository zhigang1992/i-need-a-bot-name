# TODOs

## Deferred

### Add more platform checkers (Discord, PyPI, Slack)
- **What:** Implement additional `PlatformChecker` modules for platforms beyond domain/npm/GitHub/Telegram.
- **Why:** User vision is "universal name finder." The checker interface is designed for one-module-per-platform extensibility.
- **Platforms to consider:** Discord bot (via Discord API), PyPI (via `https://pypi.org/pypi/{name}/json`), Slack app directory, Twitter/X handle.
- **Depends on:** v1 shipping with the checker registry pattern working end-to-end.
- **Context:** Each platform has unique API quirks and availability semantics. Research API endpoints and rate limits before implementing. The proxy infrastructure already handles rate limits, so the main work is understanding each platform's availability checking API.
