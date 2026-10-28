<!-- antislop:start -->
## antislop
For UI, copy, people, mobile layout, or code comments work, read `.agents/skills/antislop/SKILL.md` (core) and then the skill for the task:
- Core filter: `.agents/skills/antislop/SKILL.md`
- UI / visual: `.agents/skills/antislop-ui/SKILL.md`
- Copy & text: `.agents/skills/antislop-copywriting/SKILL.md`
- People / Accessibility: `.agents/skills/antislop-human/SKILL.md`
- Mobile / responsive: `.agents/skills/antislop-layoutmobile/SKILL.md`
- Code comments: `.agents/skills/antislop-code/SKILL.md`

Before starting, follow the core's "Two Usage Modes" section in strict order: explicit session instruction first, then global preference, then ask. A session instruction always wins. For a resolved mode, say `antislop active: <mode> (session override).` or `antislop active: <mode> (global preference).` once before presenting findings or making edits, using the actual mode and source. Acknowledging the user's request without naming the source does not replace this notice.
Only an explicit choice of antislop during or after selects a session mode. A request to review, audit, or avoid file edits does not select a mode; read the global preference in that case. Another skill's mode does not select antislop's mode.
If the mode is unresolved, ask during/after and end the response; wait for the answer before any UI review, planning, or concept. For read-only tasks, put the active-mode notice only at the start of the final answer, never in progress messages. For editing tasks, announce before the first edit and omit it from the final answer.
To update antislop later: `npx antislop-ai --update`, or run `npx antislop-ai` and pick Overwrite them.
<!-- antislop:end -->


<!-- ponytail:start -->
## Ponytail (Lazy Senior Dev Mode)
For coding, refactoring, fixing, reviewing, or choosing dependencies, apply `.agents/skills/ponytail/SKILL.md`:
- The best code is the code never written. Solve the whole problem with the least new code.
- Take the first option on the ladder: (1) Does it need to exist? (2) Already in this codebase? (3) Standard library / platform feature? (4) Installed dependency? (5) One line? (6) Minimum working code.
- Never over-engineer, wrap, or add boilerplate/speculative features.
- Never cut: validation at trust boundaries, error handling preventing data loss, security, accessibility, or tests for risky logic (branches/loops/parsers/auth/money).
- Mark deliberate shortcuts with `shortcut: <limit>, <when to upgrade>`.
- End replies with 1-2 lines stating what was skipped/not checked and any risk the user should know.
- Available sub-skills:
  - Review diffs: `.agents/skills/ponytail-review/SKILL.md`
  - Audit codebase: `.agents/skills/ponytail-audit/SKILL.md`
  - Track shortcuts: `.agents/skills/ponytail-debt/SKILL.md`
  - Scoreboard / gain: `.agents/skills/ponytail-gain/SKILL.md`
<!-- ponytail:end -->

<!-- taste-skill:start -->
## Taste Skill (tasteskill v2 / design-taste-frontend)
For frontend design, redesign, landing pages, or app screens:
- Skill: `.agents/skills/design-taste-frontend/SKILL.md` or `.agents/skills/taste-skill/SKILL.md`
- Based on empirical study of 247 award-winning gallery sites (One Page Love, Awwwards).
- House rules: Headlines max 2 lines at any width, no eyebrows/pill badges above titles, no monospace outside code, no index numbering (01, Step 1), no hairline grid borders, no background gradients/blobs, no floating shadows on resting elements, max 2 typefaces.
- Run `node .agents/skills/taste-skill/skills/taste-skill/scripts/draw.mjs` to deal curated directions, and `inspect.mjs` / `lint.mjs` for browser gate verification.
<!-- taste-skill:end -->
