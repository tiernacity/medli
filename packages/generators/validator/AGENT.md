# generator-validator Agent Instructions

## Your Role

You maintain the **ValidatorGenerator** - a pipeline generator that validates upstream frames.

**Fail fast.** Invalid frames should throw immediately with descriptive errors.

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | ValidatorGenerator class and withValidation factory |

## Pipeline Pattern

ValidatorGenerator wraps an upstream generator:

```typescript
class ValidatorGenerator implements Generator {
  constructor(private upstream: Generator) {}

  frame(context: RenderContext): Frame {
    const frame = this.upstream.frame(context);
    // Validate and throw or return
  }
}
```

## Validation Source

Uses `validateFrame()` from @medli/spec. Do NOT duplicate validation logic here.

## Error Messages

Error messages must include the validation failure reason from validateFrame().

## Constraints

- Pass-through on valid frames (no modifications)
- Throw descriptive Error on invalid frames
- No caching or state between calls

## When Reviewing Changes

- Does invalid frame produce clear error message?
- Is valid frame returned unchanged?
- Is the upstream generator called correctly?

## After Changes

```bash
npm run typecheck
npm run test
```
