# Project Instructions

## Decision Graph Workflow

**THIS IS MANDATORY. Log decisions IN REAL-TIME, not retroactively.**

### The Core Rule

```
BEFORE you do something -> Log what you're ABOUT to do
AFTER it succeeds/fails -> Log the outcome
CONNECT immediately -> Link every node to its parent
AUDIT regularly -> Check for missing connections
```

### Behavioral Triggers - MUST LOG WHEN:

| Trigger | Log Type | Example |
|---------|----------|---------|
| User asks for a new feature | `goal` **with -p** | "Add dark mode" |
| Choosing between approaches | `decision` | "Choose state management" |
| About to write/edit code | `action` | "Implementing Redux store" |
| Something worked or failed | `outcome` | "Redux integration successful" |
| Notice something interesting | `observation` | "Existing code uses hooks" |

### CRITICAL: Capture VERBATIM User Prompts

**Prompts must be the EXACT user message, not a summary.** When a user request triggers new work, capture their full message word-for-word.

**BAD - summaries are useless for context recovery:**
```bash
# DON'T DO THIS - this is a summary, not a prompt
deciduous add goal "Add auth" -p "User asked: add login to the app"
```

**GOOD - verbatim prompts enable full context recovery:**
```bash
# Use --prompt-stdin for multi-line prompts
deciduous add goal "Add auth" -c 90 --prompt-stdin << 'EOF'
I need to add user authentication to the app. Users should be able to sign up
with email/password, and we need OAuth support for Google and GitHub. The auth
should use JWT tokens with refresh token rotation.
EOF

# Or use the prompt command to update existing nodes
deciduous prompt 42 << 'EOF'
The full verbatim user message goes here...
EOF
```

**When to capture prompts:**
- Root `goal` nodes: YES - the FULL original request
- Major direction changes: YES - when user redirects the work
- Routine downstream nodes: NO - they inherit context via edges

**Updating prompts on existing nodes:**
```bash
deciduous prompt <node_id> "full verbatim prompt here"
cat prompt.txt | deciduous prompt <node_id>  # Multi-line from stdin
```

Prompts are viewable in the TUI detail panel (`deciduous tui`) and web viewer.

### ⚠️ CRITICAL: Maintain Connections

**The graph's value is in its CONNECTIONS, not just nodes.**

| When you create... | IMMEDIATELY link to... |
|-------------------|------------------------|
| `outcome` | The action/goal it resolves |
| `action` | The goal/decision that spawned it |
| `option` | Its parent decision |
| `observation` | Related goal/action |

**Root `goal` nodes are the ONLY valid orphans.**

### Quick Commands

```bash
deciduous add goal "Title" -c 90 -p "User's original request"
deciduous add action "Title" -c 85
deciduous link FROM TO -r "reason"  # DO THIS IMMEDIATELY!
deciduous serve   # View live (auto-refreshes every 30s)
deciduous sync    # Export for static hosting

# Metadata flags
# -c, --confidence 0-100   Confidence level
# -p, --prompt "..."       Store the user prompt (use when semantically meaningful)
# -f, --files "a.rs,b.rs"  Associate files
# -b, --branch <name>      Git branch (auto-detected)
# --commit <hash|HEAD>     Link to git commit (use HEAD for current commit)

# Branch filtering
deciduous nodes --branch main
deciduous nodes -b feature-auth
```

### ⚠️ CRITICAL: Link Commits to Actions/Outcomes

**After every git commit, link it to the decision graph!**

```bash
git commit -m "feat: add auth"
deciduous add action "Implemented auth" -c 90 --commit HEAD
deciduous link <goal_id> <action_id> -r "Implementation"
```

The `--commit HEAD` flag captures the commit hash and links it to the node. The web viewer will show commit messages, authors, and dates.

### Git History & Deployment

```bash
# Export graph AND git history for web viewer
deciduous sync

# This creates:
# - docs/graph-data.json (decision graph)
# - docs/git-history.json (commit info for linked nodes)
```

To deploy to GitHub Pages:
1. `deciduous sync` to export
2. Push to GitHub
3. Settings > Pages > Deploy from branch > /docs folder

Your graph will be live at `https://<user>.github.io/<repo>/`

### Branch-Based Grouping

Nodes are auto-tagged with the current git branch. Configure in `.deciduous/config.toml`:
```toml
[branch]
main_branches = ["main", "master"]
auto_detect = true
```

### Audit Checklist (Before Every Sync)

1. Does every **outcome** link back to what caused it?
2. Does every **action** link to why you did it?
3. Any **dangling outcomes** without parents?

### Session Start Checklist

```bash
deciduous nodes    # What decisions exist?
deciduous edges    # How are they connected? Any gaps?
git status         # Current state
```

### Multi-User Sync

Share decisions across teammates:

```bash
# Export your branch's decisions
deciduous diff export --branch feature-x -o .deciduous/patches/my-feature.json

# Apply patches from teammates (idempotent)
deciduous diff apply .deciduous/patches/*.json

# Preview before applying
deciduous diff apply --dry-run .deciduous/patches/teammate.json
```

PR workflow: Export patch → commit patch file → PR → teammates apply.

---

## Code Quality Standards

### Success Criteria for Edits

Before considering any code edit complete, verify:

1. **Type Safety**: Code compiles with `npm run typecheck` (no TypeScript errors)
2. **Tests Pass**: All tests pass with `npm run test`
3. **Linting Clean**: No lint errors with `npm run lint`
4. **Formatting Consistent**: Code is formatted with `npm run format`
5. **Dependencies Resolve**: Cross-package imports work correctly

### Acceptance Criteria Before Committing

**All checks must pass before committing:**

```bash
npm install        # Ensure dependencies are installed
npm run typecheck  # TypeScript compilation succeeds
npm run lint       # No ESLint errors
npm run format:check  # Code follows formatting standards
npm run test       # All tests pass
```

**Commit Checklist:**

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes (or `npm run lint:fix` applied)
- [ ] `npm run format:check` passes (or `npm run format` applied)
- [ ] `npm run test` passes
- [ ] New code has appropriate test coverage
- [ ] Decision graph updated with relevant nodes

### Package Structure

```
packages/
├── spec/                    # Core types and interfaces
├── generators/
│   ├── procedural/          # Procedural shape generation (p5.js-inspired)
│   └── object/              # Object-based shape generation (three.js-inspired)
├── renderers/
│   ├── common/              # Shared renderer functionality
│   ├── svg/                 # SVG rendering
│   └── canvas/              # Canvas rendering
└── test-app/                # Visual verification with Playwright
```

All generator and renderer packages depend on `@medli/spec`.

---

## Sub-Agents: Domain-Specific Context

**THIS IS MANDATORY. ALL file edits MUST be performed via Task agents.**

Sub-agents are defined in `.claude/agents.toml`. Each agent provides domain-specific context, constraints, and instructions for its package.

### ⚠️ CRITICAL: Sub-Agents for ALL File Edits

**NEVER edit files directly in the main conversation.** Instead:

1. **Spawn a Task agent** for each package you need to modify
2. **Include the agent's instructions** from `.claude/agents.toml` in the Task prompt
3. **Run agents in parallel** when editing multiple independent packages

This is required because:
- **Context control**: Long-running activities benefit from scoped context per package
- **Domain expertise**: Each agent has specific knowledge (p5.js patterns, three.js patterns, SVG APIs, Canvas APIs)
- **Parallel execution**: Multiple packages can be modified simultaneously
- **Consistency**: Domain-specific rules are applied uniformly

### File Edit Workflow

**Step 1: Identify affected packages**

For a feature like "add lines", determine which packages need changes:
- `spec` - Add Line type
- `generator-procedural` - Add line() method
- `generator-object` - Add Line class
- `renderer-svg` - Add line rendering
- `renderer-canvas` - Add line rendering
- `test-app` - Update examples

**Step 2: Spawn Task agents for each package**

Use `subagent_type: "general-purpose"` and include the agent context:

```
# Example Task prompt for generator-procedural:

Working on packages/generators/procedural/

AGENT CONTEXT (from agents.toml):
- INSPIRATION: p5.js
- Pattern: imperative sketch with draw function called every frame
- Sketch interface is the user-facing API
- When adding primitives: add method to Sketch interface, store call data, include in Frame

TASK: Add line() and lineOffset() methods to the Sketch interface.
- line(x1, y1, x2, y2) draws from start to end
- lineOffset(x, y, dx, dy) draws from start with offset
- Both create Line shapes in the Frame

Edit the file and return confirmation when complete.
```

**Step 3: Run independent agents in parallel**

When packages don't depend on each other's changes, spawn multiple Task agents in a SINGLE message:

```
# These can run in parallel:
- Task 1: generator-procedural (add line methods)
- Task 2: generator-object (add Line class)
- Task 3: renderer-svg (add line rendering)
- Task 4: renderer-canvas (add line rendering)

# This must wait for spec changes:
- Task 5: test-app (update examples after generators are done)
```

**Step 4: Verify after all agents complete**

Run checks in the main conversation:
```bash
npm run typecheck && npm run lint && npm run format:check && npm run test
```

### When to Use Sub-Agents

| Action | Requirement |
|--------|-------------|
| **ANY file edit** | **MUST use Task agent with domain context** |
| Exploring a package | Task with Explore subagent_type |
| Multi-package feature | One Task agent PER package |
| Verification | Main conversation (run tests, visual check) |

### Available Agents

| Agent | Package | File Pattern | Focus |
|-------|---------|--------------|-------|
| `spec` | `packages/spec` | `packages/spec/**` | Data exchange types |
| `generator-procedural` | `packages/generators/procedural` | `packages/generators/procedural/**` | p5.js patterns |
| `generator-object` | `packages/generators/object` | `packages/generators/object/**` | three.js patterns |
| `renderer-common` | `packages/renderers/common` | `packages/renderers/common/**` | Shared loop logic |
| `renderer-svg` | `packages/renderers/svg` | `packages/renderers/svg/**` | SVG DOM rendering |
| `renderer-canvas` | `packages/renderers/canvas` | `packages/renderers/canvas/**` | Canvas 2D rendering |
| `test-app` | `packages/test-app` | `packages/test-app/**` | Visual verification |

### Example: Adding a New Primitive

For a feature touching 6 packages, spawn **at least 6 Task agents**:

1. **spec agent**: Add type to Frame
2. **generator-procedural agent**: Add sketch method
3. **generator-object agent**: Add scene object class
4. **renderer-svg agent**: Add SVG rendering
5. **renderer-canvas agent**: Add Canvas rendering
6. **test-app agent**: Update examples

Agents 2-5 can run in parallel after agent 1 completes (they depend on spec types).

---

## Feature Parity Requirements

### Generator Parity

Both generators MUST support the same primitives:
- When adding a primitive to `generator-procedural`, add it to `generator-object` too
- When adding a primitive to `generator-object`, add it to `generator-procedural` too
- Use `test-app` to verify both produce **identical visual output**

### Renderer Parity

All renderers MUST:
- Support the full spec encoded in `Frame`
- Produce **equivalent visual output** when rendering the same Frame
- Use `test-app` to verify visual equivalence across renderers
