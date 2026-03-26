# Superset Svelte

A visual canvas app for exploring branching chat conversations. Built with Svelte 5 + Vite.

## Features

- Chat with Claude (via API), local Ollama models, or WebLLM (in-browser)
- Visual node graph renders conversations on a pan/zoom canvas
- **Sessions** — independent top-level chat workspaces, managed in the sidebar
- **Forks** — copy a conversation into a new independent tree within a session
- **Side chats** — branch off any main-path node for a quick thread (1 level deep)
- Promote side chats back to the main path
- **Document panels** — open multiple Markdown documents on the canvas with rendered preview, KaTeX math, and inline editing
- **Folders** — organize documents into folders in the sidebar; upload, rename, download, move, and delete docs
- **Code editors** — JavaScript and Python editors live on the canvas alongside chat nodes
- **Drawing board** — freeform drawing canvas
- In-browser search across all conversations
- Encrypted API key storage (PBKDF2 + AES-GCM)
- All state stored in browser localStorage

## Getting Started

```bash
bun install
bun run dev
```

## Migration

To run the Svelte 5 migration tool:

```bash
bunx sv migrate svelte-5
```

## Architecture

See [CLAUDE.md](./CLAUDE.md) for detailed architecture, data model, branching concepts, and working rules.

## Project Structure

```
src/
├── lib/
│   ├── models/          index.ts (model metadata), logos.ts
│   ├── providers/       claude.ts, gemini.ts, ollama.ts, openai-compat.ts, webllm.ts, webllm-worker.ts, stream.ts, vault.ts
│   ├── search/          index.ts
│   ├── tree/            index.ts
│   └── validate-md/     index.ts, validate-md.spec.ts
│
├── state/
│   ├── chats.svelte.ts
│   ├── documents.svelte.ts
│   ├── initial-exchanges.ts
│   └── providers.svelte.ts
│
├── features/
│   ├── app-sidebar/
│   ├── canvas/          Canvas.svelte, ChatTree.svelte, ExchangeNode.svelte, layout.ts, katex.ts
│   ├── chat-header/
│   ├── chat-input/
│   ├── chat-toolbar/
│   ├── code-editor/     CodeEditor.svelte
│   ├── composer/
│   ├── docs-panel/      DocsPanel.svelte
│   ├── drawing-board/   DrawingBoard.svelte, drawing-types.ts
│   ├── model-palette/
│   ├── python-editor/   PythonEditor.svelte
│   └── search-dialog/
│
├── components/
│   ├── custom/          button.svelte, input.svelte
│   └── shadcn/          ui/ (shadcn-svelte primitives), utils.ts
│
├── assets/
├── App.svelte
└── main.ts
```
