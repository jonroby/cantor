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

## Architecture

See [CLAUDE.md](./CLAUDE.md) for detailed architecture, data model, branching concepts, and working rules.
