# Capability Rollout Matrix

Last updated: 2026-02-17

## Scope

Tracks capability adoption across major product surfaces.

Legend:
- `ROUTE`: UI route uses capability router for action.
- `RUNNER`: frontend capability runner supports invocation.
- `FASTAPI`: `/api/capabilities` adapter supports invocation path.

## Thinking Organizer

| Surface | Capability Coverage | Route | Runner | FastAPI |
|---|---|---|---|---|
| Create/View/Link flows | `organizer.nodes.*`, `organizer.node.*` | Yes | Yes | Yes |

## Thoughts

| Surface | Capability Coverage | Route | Runner | FastAPI |
|---|---|---|---|---|
| New Thought create | `thoughts.create` | Yes | Yes | Yes |
| Thoughts calendar read | direct read orchestrators (`thoughtsOrch`) | Partial | N/A | N/A |

## Todos

| Surface | Capability Coverage | Route | Runner | FastAPI |
|---|---|---|---|---|
| Todo create | `todos.create` | Yes | Yes | Yes |
| Todo toggle | `todos.toggle` | Yes | Yes | Yes |
| Todo calendar read | direct read orchestrators (`todosOrch`) | Partial | N/A | N/A |

## Tools

| Surface | Capability Coverage | Route | Runner | FastAPI |
|---|---|---|---|---|
| Format for Excalidraw | `tools.files.list_markdown`, `tools.excalidraw.preview`, `tools.excalidraw.format` | Yes | Yes | Yes |
| PDF to Markdown | `tools.files.list_pdf`, `tools.pdf.preview`, `tools.pdf.convert` | Yes | Yes* | Yes* |
| Transcript Cleaner | `tools.folders.list`, `tools.transcript.preview`, `tools.transcript.clean_save` | Yes | Yes | Yes |

\* PDF conversion depends on `/api/tools/pdf-to-markdown*` availability for the active runtime.

## Next Gaps

- Add read/list capabilities for Thoughts/Todos calendar summaries to complete read-side parity.
- Extend parity fixtures to include deterministic PDF adapter scenarios once `/api/tools/pdf-to-markdown*` test harness is available.
- Add UI-level auth token storage UX for remote invoke sessions.
