# generator-remote Agent Instructions

## Your Role

You maintain a **remote Frame fetcher** - a Generator that polls a URL for Frame JSON.

**Your job is to:**
- Implement the Generator interface for remote Frame sources
- Handle polling, caching, and lifecycle (destroy)
- Pass targetDimensions as query params so remote servers can adapt

**This is NOT a creative generator.** It fetches Frames created elsewhere.

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | RemoteFetchGenerator class, factory, polling logic |

## Constraints

- **Implements Generator interface** - `frame(context)` returns cached Frame
- **Polling-based** - fetches on interval, returns cached value synchronously
- **Explicit cleanup** - `destroy()` must stop polling timer
- **Silent failures** - fetch errors keep using cached frame (no UI errors)
- **targetDimensions forwarding** - adds query params for viewport adaptation

## API

```typescript
const gen = RemoteFetchGenerator.fromUrl('/frame.json', {
  pollInterval: 1000,  // ms between fetches
  fetch: customFetch,  // optional custom fetch
});

const frame = gen.frame({ time, targetDimensions });
gen.destroy();  // MUST call when done
```

## When Reviewing Changes

- Does `frame()` return synchronously (no await)?
- Is `destroy()` called to prevent memory leaks?
- Are fetch errors handled silently?
- Are targetDimensions forwarded as query params?

## After Changes

```bash
npm run typecheck
npm run test
```
