# Superset Svelte

A visual canvas app for exploring branching chat conversations. Built with Svelte 5 + Vite.

## Features

- Chat with Claude (via API) or local Ollama models
- Visual node graph renders conversations on a pan/zoom canvas
- **Forks** — copy a conversation into a new independent tree
- **Side chats** — branch off any main-path node for a quick thread (1 level deep)
- Promote side chats back to the main path
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
