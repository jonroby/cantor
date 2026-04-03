# Cantor API Audit: What's Sent to Claude on Each Request

## Executive Summary

The application sends **substantial and growing payloads** to Claude on
each request. Key findings:

- System prompts are **~600 tokens base** (and can exceed 2500-3000 with
  document content)
- Tool definitions add **~665 tokens** on every request
- Full conversation history is sent on **every request** with smart but
  incomplete compression
- Document artifacts can add **hundreds or thousands of tokens** when
  active
- Multi-turn tool use creates **compound payload growth** with compressed
  but still-present history

---

## 1. SYSTEM PROMPT ANALYSIS

### System Prompt Size

**File:** `/Users/jonroby/ai/cantor/src/app/agent/index.ts` lines
1010-1038 (`buildSystemPrompt()`)

**Base System Prompt Content:** - Core instructions: ~616 tokens

- Includes rules for agent behavior, tool guidance, chart creation instructions - **Variable component:** `<current_document>` section

                          **Document Section:**                                                            ```typescript

  const documentSection = documentContent ? `\n\n<current_document>\n${documentContent}\n</current_document>`
  : '\n\nThere is no active document content.'; ```

                                                                             **Size Estimates:**                                                              | Component | Characters | Tokens |

  |-----------|-----------|---------| | Core prompt | 2,461 | ~616 |
  | Empty doc section | 48 | ~12 | | With 5KB document | 5,048 | ~1,262 |
  | With 10KB document | 10,048 | ~2,512 | | With 20KB document | 20,048 | ~5,012 |

### When System Prompt is Sent

**ALWAYS on agent requests** (`startRun()` at line 1114):

```typescript
const systemPrompt = agent.buildSystemPrompt(options!.liveDocumentContent);
agent.startRun(chatId, created.id, model, history, toolContext, systemPrompt);
```

**File:** `/Users/jonroby/ai/cantor/src/app/chat/index.ts` lines 356-429
(`submitPrompt()`)

In **regular chat mode** (non-agent): System prompt is **NOT sent**
(passed as `undefined`)

---

## 2. TOOLS/FUNCTIONS DEFINITION ANALYSIS

### Tool Count and Registry

**File:** `/Users/jonroby/ai/cantor/src/app/agent/index.ts` lines 59-935

| Module          | Line Range | Count  | Category               |
| --------------- | ---------- | ------ | ---------------------- |
| DOCUMENT_TOOLS  | 59-471     | 14     | File/folder operations |
| CHAT_TOOLS      | 473-706    | 8      | Chat management        |
| WORKSPACE_TOOLS | 708-934    | 5      | Workspace control      |
| **TOTAL**       | -          | **27** | -                      |

### Tool Definition Structure

```typescript
export const TOOLS: external.providers.stream.ToolDefinition[] = TOOLS_REGISTRY.map((tool) => ({
	name: tool.name,
	description: tool.description,
	input_schema: tool.input_schema
}));
```

**File:** `/Users/jonroby/ai/cantor/src/app/agent/index.ts` lines 959-963

### Tool Schema Size Estimation

Each tool includes:

- `name`: string (varies, avg ~15 chars)
- `description`: string (varies, avg ~80-100 chars)
- `input_schema`: object with type, properties, required arrays

**Verbosity Analysis:**

```json
{
  "name": "edit_document",
  "description": "Propose a replacement for the currently active
document. The user must accept or reject it.",
  "input_schema": {
    "type": "object",
    "properties": {
      "content": {
        "type": "string",
        "description": "The full replacement document content."
      }
    },
    "required": ["content"]
  }
}
```

**Total Tool Payload Size:**

- Serialized: ~8,100-9,500 characters
- Tokens: **~665-750 tokens per request**
- **Sent on EVERY agent request** (line 1162: `tools: TOOLS`)
- NOT sent in regular chat mode

---

## 3. CONVERSATION HISTORY ANALYSIS

### History Inclusion Policy

**ALWAYS sent on every request** - both agent and regular chat modes

**File:** `/Users/jonroby/ai/cantor/src/app/chat/index.ts` lines 329-354
(`buildHistory()`)

History is **selected via context strategy** before sending:

```typescript
const selectedPath = selectExchanges(fullPath, budget);
const history = buildHistory(selectedPath, options?.liveDocumentContent);
```

**File:** `/Users/jonroby/ai/cantor/src/app/chat/context.ts` lines 22-43
(`selectExchanges()`)

### Context Strategy Options

**File:** `/Users/jonroby/ai/cantor/src/app/chat/context.ts` lines 22-43

| Strategy | Behavior                        | Token Cost   |
| -------- | ------------------------------- | ------------ |
| `full`   | All exchanges in path           | **Highest**  |
| `lru`    | Last N exchanges fitting budget | **Moderate** |
| `bm25`   | Relevance-scored selection      | **Moderate** |

### History Compression

Tool input/output compression happens **during streaming**, not on
initial request:

**File:** `/Users/jonroby/ai/cantor/src/external/streams/streams.ts`
lines 27-47

```typescript
const CONTENT_THRESHOLD = 200;

function summarizeToolInput(input: Record<string, unknown>): Record<string, unknown> {
	const summarized: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(input)) {
		if (typeof value === 'string' && value.length > CONTENT_THRESHOLD) {
			summarized[key] = `[${value.length} chars]`;
		} else {
			summarized[key] = value;
		}
	}
	return summarized;
}

function truncateToolResult(content: string): string {
	if (content.length <= CONTENT_THRESHOLD) return content;
	return (
		content.slice(0, CONTENT_THRESHOLD) +
		`… [truncated,
${content.length} chars total]`
	);
}
```

**Called at:** Line 162 `compressOlderToolTurns(rawMessages)` before
appending new tool results

### Typical History Size

For a 5-exchange conversation:

- Each exchange: ~1 user message + ~1 assistant message = 2 messages
- Per message: 50-500 tokens (depending on length)
- **5 exchanges = 10-100+ tokens** (or more with tool results)
- **On longer conversations: easily 500-1000+ tokens**

---

## 4. LARGE ARTIFACTS (SVGs, Code, Images)

### Image Attachments

**Sent on every request** if present in message history

**File:** `/Users/jonroby/ai/cantor/src/external/providers/claude.ts`
lines 16-35

```typescript
messages: messages.map((message) => {
	const raw = message as unknown as { role: string; content: unknown };
	if (Array.isArray(raw.content)) {
		return { role: raw.role, content: raw.content };
	}
	return {
		role: message.role,
		content: message.images?.length
			? [
					...message.images.map((img) => ({
						type: 'image' as const,
						source: {
							type: 'base64' as const,
							media_type: img.mimeType,
							data: img.base64 // FULL BASE64 SENT
						}
					})),
					{ type: 'text' as const, text: message.content }
				]
			: message.content
	};
});
```

**ImageAttachment Definition:**

**File:** `/Users/jonroby/ai/cantor/src/domain/tree/core.ts`

```typescript
export interface ImageAttachment {
	mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
	base64: string; // ENTIRE BASE64 STRING STORED
}
```

**Size Impact:**

- A single 500KB image: ~666,000 characters = ~166,500+ tokens
- Multiple images compound exponentially
- **This is the #1 token consumer if images are present**

### Code/SVG in Documents

Code blocks in documents are sent as part of the live document content in
the system prompt:

- Sent every request if document is active
- **No truncation** for code/SVG

Example workflow:

1.  User asks to create an SVG diagram
2.  Agent creates file with SVG content
3.  SVG content becomes part of document
4.  Full SVG sent in `<current_document>` section on next request

**This can be 5KB-50KB+ for complex SVGs**

---

## 5. TYPICAL REQUEST PAYLOADS

### Regular Chat Request (Non-Agent)

**Endpoint:** `https://api.anthropic.com/v1/messages`

```json
{
	"model": "claude-3-5-sonnet-20241022",
	"max_tokens": 8192,
	"stream": true,
	"messages": [
		{ "role": "user", "content": "Hello" },
		{ "role": "assistant", "content": "Hi there!" },
		// ... more history ...
		{ "role": "user", "content": "New question?" }
	]
	// NO system
	// NO tools
}
```

**Payload Size:**

- History only: 100-1000+ tokens
- **Total: ~100-1000+ tokens**

### Agent Request with Full Setup

**File:** `/Users/jonroby/ai/cantor/src/app/agent/index.ts` lines
1156-1196

```json
{
  "model": "claude-3-5-sonnet-20241022",
  "max_tokens": 8192,
  "stream": true,
  "system": "You are an agent inside a document workspace
chat.\n\n[...616 tokens of rules, capabilities, chart
instructions...]\n\n<current_document>\n[...variable, can be 1000-5000+
tokens...]\n</current_document>",
  "tools": [
    {
      "name": "edit_document",
      "description": "Propose a replacement...",
      "input_schema": { /* complex schema */ }
    },
    // ... 26 more tools = ~665 tokens
  ],
  "messages": [
    { "role": "user", "content": "Review my doc" },
    { "role": "assistant", "content": "Done" },
    // ... history selected by context strategy ...
    { "role": "user", "content": "Help me refine it" }
  ]
}
```

**Payload Breakdown:**
| Component | Tokens | Every Request? |
|-----------|--------|---|
| System prompt (core) | ~616 | YES (agent mode) |
| System prompt (document) | 0-5000+ | YES if doc active |
| Tools (27 definitions) | ~665 | YES (agent mode) |
| Conversation history | 100-2000+ | YES (always) |
| Images (if present) | 166,500+ | YES if present |
| **TOTAL MINIMUM** | **~1,381** | |
| **TOTAL WITH 10KB DOC** | **~3,881** | |
| **TOTAL WITH IMAGES** | **~168,381+** | |

### Multi-Turn Tool Use Request

**File:** `/Users/jonroby/ai/cantor/src/external/streams/streams.ts`
lines 155-183

On tool use continuation, the request includes:

```json
{
	"messages": [
		// Original history...
		{ "role": "user", "content": "Help me create a file" },
		{
			"role": "assistant",
			"content": [
				{ "type": "text", "text": "I'll help you create that file..." },
				{
					"type": "tool_use",
					"id": "...",
					"name": "create_file",
					"input": { "filename": "...", "content": "..." }
				}
			]
		},
		{
			"role": "user",
			"content": [
				{ "type": "tool_result", "tool_use_id": "...", "content": "Created file successfully..." }
			]
		},
		// NEW REQUEST STARTS HERE with accumulated history
		{ "role": "user", "content": "What's next?" }
	]
}
```

**Important:** Previous tool turns are **compressed** but still included:

- Tool input > 200 chars → `[NNNN chars]` (saves space)
- Tool result > 200 chars → truncated to 200 chars + `… [truncated, NNNN
chars total]`
- Still sends all text that fits the budget

---

## 6. KEY FINDINGS & EGREGIOUS TOKEN CONSUMERS

### Ranked by Impact

1.  **IMAGES (if present)**: 166,500+ tokens per image
    - Entire base64 sent on every request
    - No compression, no reference system
    - **File:**
      `/Users/jonroby/ai/cantor/src/external/providers/claude.ts` lines 24-32

2.  **Active Document Content**: 1,000-5,000+ tokens
    - Sent inside `<current_document>` on every request
    - Includes code, SVGs, markup
    - No incremental updates (full document each time)
    - **File:** `/Users/jonroby/ai/cantor/src/app/agent/index.ts` lines
      1010-1013

3.  **Tool Definitions**: ~665 tokens
    - 27 tools, all sent every agent request
    - Even if only 1-2 are needed
    - **File:** `/Users/jonroby/ai/cantor/src/app/agent/index.ts` lines
      959-963

4.  **Conversation History**: 100-2,000+ tokens
    - Sent on every request
    - Compression only truncates individual items (incomplete)
    - BM25 selection attempts to reduce, but full path still sent in many
      cases
    - **File:** `/Users/jonroby/ai/cantor/src/app/chat/context.ts` lines
      22-43

5.  **System Prompt Core**: ~616 tokens
    - Always sent in agent mode
    - Includes repetitive capability descriptions
    - **File:** `/Users/jonroby/ai/cantor/src/app/agent/index.ts` lines
      1010-1038

---

## 7. WHAT'S SENT ON EVERY REQUEST VS CONDITIONAL

### ✅ SENT ON EVERY REQUEST

- **Conversation history** (both modes)
  - Line 385: `const history = buildHistory(selectedPath,
options?.liveDocumentContent);`
  - File: `/Users/jonroby/ai/cantor/src/app/chat/index.ts`

- **System prompt core** (agent mode only)
  - Line 399: `const systemPrompt =
agent.buildSystemPrompt(options!.liveDocumentContent);`
  - File: `/Users/jonroby/ai/cantor/src/app/chat/index.ts`

- **Tool definitions** (agent mode only)
  - Line 1162: `tools: TOOLS,`
  - File: `/Users/jonroby/ai/cantor/src/app/agent/index.ts`

- **Images** (if any message has images)
  - Lines 24-32 of
    `/Users/jonroby/ai/cantor/src/external/providers/claude.ts`

### ⚠️ CONDITIONAL

- **Active document content**
  - Included in system prompt if `options?.liveDocumentContent` is
    provided
  - Line 399: `agent.buildSystemPrompt(options!.liveDocumentContent)`
  - File: `/Users/jonroby/ai/cantor/src/app/chat/index.ts`

- **Tool results** (agent mode with tool use)
  - Only added to history after tool execution
  - Lines 155-183:
    `/Users/jonroby/ai/cantor/src/external/streams/streams.ts`

---

## 8. REQUEST CONSTRUCTION FLOW

### Agent Mode Flow

1.  **submitPrompt()**
    (`/Users/jonroby/ai/cantor/src/app/chat/index.ts:356`)
    - Line 384: `selectExchanges()` applies context budget
    - Line 385: `buildHistory()` constructs messages

2.  **buildSystemPrompt()**
    (`/Users/jonroby/ai/cantor/src/app/agent/index.ts:1010`)
    - Line 1028: Calls `describeCapabilities()` (expands 27 tools inline
      in text)
    - Lines 1011-1013: Adds document section if present

3.  **startRun()**
    (`/Users/jonroby/ai/cantor/src/app/agent/index.ts:1114`)
    - Line 1156-1196: Calls `external.streams.startStream()`
    - Passes: `history`, `system`, `tools: TOOLS`

4.  **streamClaudeChat()**
    (`/Users/jonroby/ai/cantor/src/external/providers/claude.ts:4`)
    - Lines 12-41: Constructs request body
    - Line 43: Sends to `https://api.anthropic.com/v1/messages`

### Regular Chat Mode Flow

1.  **submitPrompt()**
    (`/Users/jonroby/ai/cantor/src/app/chat/index.ts:356`)
    - Line 384: `selectExchanges()` applies context budget
    - Line 385: `buildHistory()` constructs messages

2.  **startStream()**
    (`/Users/jonroby/ai/cantor/src/app/chat/index.ts:402`)
    - Passes: `history` only
    - No `system`, no `tools`

3.  **streamClaudeChat()**
    (`/Users/jonroby/ai/cantor/src/external/providers/claude.ts:4`) - No system prompt added (line 36: `if (system) { body.system =
system; }`) - No tools added (line 39: `if (tools?.length) { body.tools = tools;
}`)

---

## OPTIMIZATION OPPORTUNITIES

### High Priority

1.  **Image Management**: Reference external URIs instead of base64
    - Current: 166,500+ tokens per image per request
    - Potential: ~50 tokens per image reference

2.  **Document Caching**: Send only diffs or references
    - Current: Full document on every request (1000-5000+ tokens)
    - Potential: Send hash + changes only (~100-200 tokens)

3.  **Tool Subset Selection**: Only send relevant tools
    - Current: All 27 tools (~665 tokens) always
    - Potential: Send 5-10 context-appropriate tools (~150-300 tokens)

4.  **Capability Descriptions in System Prompt**: Pre-compile, cache, or
    reference
    - Current: Full tool list expanded in system prompt text
    - Potential: Reference tool schema definitions instead

### Medium Priority

5.  **History Compression**: More aggressive truncation
    - Current: Only truncates items >200 chars
    - Potential: Summarize older exchanges, keep only recent

6.  **Document Serialization**: Use more compact formats
    - Current: Full text/SVG/code
    - Potential: Compress large documents, send summaries

---

## CONCLUSION

**The application sends substantial token payloads on every request:**

- **Minimum per request**: ~1,381 tokens (empty chat, no doc)
- **With 10KB active document**: ~3,881 tokens
- **With image**: 168,000+ tokens
- **This compounds on multi-turn conversations** with continued history
  growth

The largest inefficiencies are:

1.  Images as base64 (166,500+ tokens/image)
2.  Full document content on every request (1000-5000+ tokens)
3.  All tools sent even when not used (~665 tokens)
4.  Full history sent with incomplete compression (~100-2000+ tokens)
    Run shell command
    Focus optimization efforts on image handling and document content
    delivery for maximum token savings.
