---
name: project-verification-review
description: "Use this skill when validating a project, checking whether it is healthy, running the official test suite, installing missing dependencies, and producing a grounded review with evidence. It is for QA pass/fail checks, regression validation, environment setup verification, and concise progress reviews before proceeding with feature work."
---

# Project Verification & Review

Use this skill when you need to answer one of these questions with evidence:
- Does the project pass its checks?
- Are dependencies missing or the environment incomplete?
- What is the real status of the codebase before building or changing it?
- What should I review before proceeding with implementation?

## When to use this skill

Use it for:
- repo health checks
- dependency installs and environment fixes
- running the official test suite
- verifying build/test status with fresh output
- writing a concise review based on observable facts

Skip it for:
- one-off code writing without verification
- architecture design without runtime evidence
- server setup or deployment actions unrelated to repo validation

## Workflow

### Step 1: Confirm the project context
- Identify the repo root and current branch.
- Check whether the project is already in a clean working state.
- Note the expected test/build commands from the package or project config.

### Step 2: Install dependencies if needed
- If the project is missing packages, install the declared dependencies before running any verification.
- If install scripts warn or block some package steps, note the warning but do not treat it as a passing result.

### Step 3: Run the official verification command
- Prefer the repository’s declared script such as `npm test`, `npm run typecheck`, or the project’s documented validation command.
- Run the full command rather than a filtered subset unless the repo specifically expects that.
- Capture the real output and exit code.

### Step 4: Evaluate the evidence
- If tests pass, record the exact counts and the final exit code.
- If tests fail, identify the failure points, read the relevant output, and avoid guessing.
- Separate actual project issues from environment/setup issues like missing dependencies.

### Step 5: Review with grounded conclusions
Produce a short review that includes:
- overall status
- what passed
- what failed or was blocked
- any notable risk or warnings
- next recommended step

### Step 6: Decide the next action
- If checks are green, proceed with feature work or local app validation.
- If checks are red, fix the root cause before continuing.
- If the environment is incomplete, repair the environment and rerun verification.

## Completion checklist

Before declaring the project healthy, confirm all of the following:
- dependencies are installed
- the intended verification command was run
- the command completed with fresh output
- pass/fail counts are recorded
- review conclusions are based on observed evidence, not assumptions

## Example workflow

```bash
cd "<project-root>"
npm install
npm test
```

Then summarize the result like this:
- project status: healthy / degraded / blocked
- test evidence: counts and exit code
- review notes: risk, warnings, and next steps

## Decision points

### If npm install fails
- Fix missing or incompatible dependencies.
- Re-run install before any code review claims.

### If the test command fails with missing modules
- Treat that as an environment issue first.
- Install the required dependencies and rerun the same validation command.

### If tests fail logically
- Read the failure output and fix the root cause.
- Preserve the evidence trail and re-run the official suite after the fix.

### If tests pass
- Document the pass counts and proceed carefully, with a note that this is verified status at the time of testing.

## Review standard

A good review is concise, explicit, and evidence-driven:
- say what command was run
- say what happened
- state whether the project is healthy or blocked
- include the next most useful action

Avoid vague statements such as “should be fine” or “looks good” without evidence.
