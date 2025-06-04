# Vision Agent MCP Server

<!-- ───────────────────────────── Badges ───────────────────────────── -->
<!-- Replace all TODOs with real links once available -->

[![npm](https://img.shields.io/npm/v/vision-tools-mcp?label=npm)](https://www.npmjs.com/package/vision-tools-mcp)
![build](https://github.com/landing-ai/vision-agent-mcp/actions/workflows/ci.yml/badge.svg)

> **Beta – v0.1**  
> This project is **early access** and subject to breaking changes until v1.0.


## Vision Agent MCP Server v0.1 - Overview

Modern LLM “agents” call external tools through the **Model Context Protocol (MCP)**.
**Vision Agent MCP** is a lightweight, side-car MCP server that runs locally on STDIN/STDOUT, translating each tool call from an MCP-compatible client (Claude Desktop, Cursor, Cline, etc.) into an authenticated HTTPS request to Landing AI’s Vision Agent REST APIs. The response JSON, plus any images or masks, is streamed back to the model so that you can issue natural-language computer-vision and document-analysis commands from your editor without writing custom REST code or loading an extra SDK.


## 📸 Demo

<https://github.com/user-attachments/assets/4c78ebbb-85ac-4f39-865c-e4de27a57e6b>

## 🧰 Supported Use Cases (v0.1)

| Capability                    | Description                                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **`agentic-document-analysis`** | Parse PDFs / images to extract text, tables, charts, and diagrams taking into account layouts and other visual cues. Web Version [here](https://va.landing.ai/demo/doc-extraction).|
| **`text-to-object-detection`** | Detect free-form prompts (“all traffic lights”) using OWLv2 / CountGD / Florence-2 / Agentic Object Detection (Web Version [here](https://va.landing.ai/demo/agentic-od)); outputs bounding boxes.        |
| **`text-to-instance-segmentation`** | Pixel-perfect masks via Florence-2 + Segment-Anything-v2 (SAM-2).                                              |
| **`activity-recognition`**     | Recognise multiple activities in video with start/end timestamps.                                           |
| **`depth-pro`**                | High-resolution monocular depth estimation for single images.                                                    |

> Run **`npm run generate-tools`** whenever Vision Agent releases new endpoints. The script fetches the latest OpenAPI spec and regenerates the local tool map automatically.


## 🗺 Table of Contents
1. [Quick Start](#-quick-start)
2. [Configuration](#-configuration)
3. [Example Prompts](#-example-prompts)
4. [Architecture & Flow](#-architecture--flow)
5. [Developer Guide](#-developer-guide)
6. [Troubleshooting](#-troubleshooting)
7. [Contributing](#-contributing)
8. [Security & Privacy](#-security--privacy)


## 🚀 Quick Start

```bash
# 1  Install
npm install -g vision-tools-mcp

# 2  Set your Vision Agent API key
export VISION_AGENT_API_KEY="<YOUR_API_KEY>"

# 3  Configure your MCP client with the following settings:
{
  "mcpServers": {
    "Vision Agent": {
      "command": "npx",
      "args": ["vision-tools-mcp"],
      "env": {
        "VISION_AGENT_API_KEY": "<YOUR_API_KEY>",
        "OUTPUT_DIRECTORY": "/path/to/output/directory",
        "IMAGE_DISPLAY_ENABLED": "true"
      }
    }
  }
}
```

1. Open your MCP-aware client.
2. Download *street.png* (from the assets folder in this directory, or you can choose any test image).
3. Paste the prompt below (or any prompt):

```
Detect all traffic lights in /Users/cmaloney111/Documents/Landing/mcp/vision-agent-mcp/assets/street.png using text-to-object-detection
```

If your client supports inline resources, you’ll see bounding-box overlays; otherwise, the PNG is saved to your output directory, and the chat shows its path.


### Prerequisites

| Software                 | Minimum Version                          |
| ------------------------ | ---------------------------------------- |
| **Node.js**              | 20 (LTS)                                 |
| **Vision Agent account** | Any paid or free tier (needs API key)    |
| **MCP client**           | Claude Desktop / Cursor / Cline / *etc.* |


## ⚙️ Configuration

| ENV var                 | Required | Default    | Purpose                                                |
| ----------------------- | -------- | ---------- | ------------------------------------------------------ |
| `VISION_AGENT_API_KEY`  | **Yes**  | —          | Landing AI auth token.                                 |
| `OUTPUT_DIRECTORY`      | No       | —          | Where rendered images / masks / depth maps are stored. |
| `IMAGE_DISPLAY_ENABLED` | No       | `true`     | `false` ➜ skip rendering                               |

### Sample MCP client entry (`.mcp.json` for VS Code / Cursor)

```jsonc
{
  "mcpServers": {
    "Vision Agent": {
      "command": "npx",
      "args": ["vision-tools-mcp"],
      "env": {
        "VISION_AGENT_API_KEY": "912jkefief09jfjkMfoklwOWdp9293jefklwfweLQWO9jfjkMfoklwDK",
        "OUTPUT_DIRECTORY": "/Users/me/documents/mcp/test",
        "IMAGE_DISPLAY_ENABLED": "true"
      }
    }
  }
}
```


## 💡 Example Prompts

| Scenario                     | Prompt (after uploading file)                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| Invoice extraction           | *“Extract vendor, invoice date & total from this PDF using `agentic-document-analysis`.”* |
| Pedrestrian Recognition      | *“Locate every pedestrian in **street.jpg** via `text-to-object-detection`.”*             |
| Agricultural segmentation    | *“Segment all tomatoes in **kitchen.png** with `text-to-instance-segmentation`.”*         |
| Activity recognition (video) | *“Identify activities occurring in **match.mp4** via `activity-recognition`.”*            |
| Depth estimation             | *“Produce a depth map for **selfie.png** using `depth-pro`.”*                             |


## 🏗 Architecture & Flow

```text
┌────────────────────┐ 1. human prompt            ┌───────────────────┐
│ MCP-capable client │───────────────────────────▶│  Vision Agent MCP │
│  (Cursor, Claude)  │                            │   (this repo)     │
└────────────────────┘                            └─────────▲─────────┘
            ▲  6. rendered PNG / JSON                     │ 2. JSON tool call
            │                                             │
            │ 5. preview path / data         3. HTTPS     │
            │                                             ▼
       local disk  ◀──────────┐                Landing AI Vision Agent
                               └──────────────  Cloud APIs
                                           4. JSON / media blob
```

1. **Prompt → tool-call** The client converts your natural-language prompt into a structured MCP call.
2. **Validation** The server validates args with Zod schemas derived from the live OpenAPI spec.
3. **Forward** An authenticated Axios request hits the Vision Agent endpoint.
4. **Response** JSON + any base64 media are returned.
5. **Visualization** If enabled, masks / boxes / depth maps are rendered to files.
6. **Return to chat** The MCP client receives data + file paths (or inline previews).


## 🧑‍💻 Developer Guide

Here’s how to dive into the code, add new endpoints, or troubleshoot issues.

### 📑 Scripts & Commands

| Script                   | Purpose                                                     |
| ------------------------ | ----------------------------------------------------------- |
| `npm run build`          | Compile TypeScript → `build/` (adds executable bit).        |
| `npm run start`          | Build *and* run (`node build/index.js`).                    |
| `npm run typecheck`      | Type-only check (`tsc --noEmit`).                           |
| `npm run generate-tools` | Fetch latest OpenAPI and regenerate `toolDefinitionMap.ts`. |
| `npm run build:all`      | Convenience: `npm run build` + `npm run generate-tools`.    |

> **Pro Tip**: If you modify any files under `src/` or want to pick up new endpoints from Vision Agent, run `npm run build:all` to recompile + regenerate tool definitions.


### 📂 Project Layout

```text
vision-agent-mcp/
├── .eslintrc.json              # ESLint config (optional)
├── .gitignore                  # Ignore node_modules, build/, .env, etc.
├── jest.config.js              # Placeholder for future unit tests
├── mcp-va.md                   # Draft docs (incomplete)
├── package.json                # npm metadata, scripts, dependencies
├── package-lock.json           # Lockfile
├── tsconfig.json               # TypeScript compiler config
├── .env                        # Your environment variables (not committed)
│
├── src/                        # TypeScript source code
│   ├── generateTools.ts        # Dev script: fetch OpenAPI → generate MCP tool definitions (Zod schemas)
│   ├── index.ts                # Entry point: load .env, start MCP server, handle signals
│   ├── toolDefinitionMap.ts    # Auto-generated MCP tool definitions (don’t edit by hand)
│   ├── toolUtils.ts            # Helpers to build MCP tool objects (metadata, descriptions)
│   ├── types.ts                # Core TS interfaces (MCP, environment config, etc.)
│   │
│   ├── server/                 # MCP server logic
│   │   ├── index.ts            # Create & start the MCP server (Server + Stdio transport)
│   │   ├── handlers.ts         # `handleListTools` & `handleCallTool` implementations
│   │   ├── visualization.ts    # Post-process & save image/video outputs (masks, boxes, depth maps)
│   │   └── config.ts           # Load & validate .env, export SERVER_CONFIG & EnvConfig
│   │
│   ├── utils/                  # Generic utilities
│   │   ├── file.ts             # File handling (base64 encode images/PDFs, read streams)
│   │   └── http.ts             # Axios wrappers & error formatting
│   │
│   └── validation/             # Zod schema generation & argument validation
│       └── schema.ts           # Convert JSON Schema → Zod, validate incoming tool args
│
├── build/                      # Compiled JavaScript (generated after `npm run build`)
│   ├── index.js
│   ├── generateTools.js
│   ├── toolDefinitionMap.js
│   └── …                       # Mirror of `src/` structure
│
├── output/                     # Runtime artifacts (bounding boxes, masks, depth maps, etc.)
│
└── assets/                     # Static assets (e.g., demo.gif)
    └── demo.gif
```

### 🔍 Key Components

1. **`src/generateTools.ts`**

   * Fetches `https://api.va.landing.ai/openapi.json` (Vision Agent’s public OpenAPI).
   * Filters endpoints via a whitelist (or you can disable filtering to include all).
   * Converts JSON Schema → Zod schemas, writes `toolDefinitionMap.ts` with a `Map<string, McpToolDefinition>`.
   * Run: `npm run generate-tools`.

2. **`src/toolDefinitionMap.ts`**

   * Contains a map of tool names → MCP definitions (name, description, inputSchema, endpoint, HTTP method).
   * Generated automatically—**do NOT edit by hand**.

3. **`src/server/handlers.ts`**

   * Implements `handleListTools`: returns `[ { name, description, inputSchema } ]`.
   * Implements `handleCallTool`:

     * Validates incoming `arguments` with Zod.
     * If file-based args (e.g., `imagePath`, `pdfPath`), reads & base64-encodes via `src/utils/file.ts`.
     * Builds a multipart/form-data or JSON payload for Axios.
     * Calls Vision Agent endpoint, catches errors, returns MCP-compliant JSON response.
     * If `IMAGE_DISPLAY_ENABLED=true`, calls `src/server/visualization.ts` to save PNGs/JSON.

4. **`src/server/visualization.ts`**

   * Post-processes masks (base64 → PNG).
   * Optionally overlays bounding boxes or segmentation masks on the original image, saves to `OUTPUT_DIRECTORY`.
   * Returns file paths in MCP result so your client can render them.

5. **`src/utils/file.ts`**

   * `readFileAsBase64(path: string): Promise<string>`: Reads any binary (image, PDF, video) and returns base64.
   * `loadFileStream(path: string)`: Returns a Node.js stream for large file uploads.

6. **`src/utils/http.ts`**

   * Configures Axios with base URL `https://api.va.landing.ai`.
   * Adds `Authorization: Bearer ${VISION_AGENT_API_KEY}` header.
   * Wraps calls to Vision Agent endpoints, handles 4xx/5xx, formats errors into MCP error objects.

7. **`src/validation/schema.ts`**

   * Contains helpers to convert JSON Schema (from OpenAPI) → Zod.
   * Exposes a function `buildZodSchema(jsonSchema: any): ZodObject` used by `generateTools.ts`.

8. **`src/index.ts`**

   * Loads `dotenv` (reads `.env`).
   * Validates required env vars (`VISION_AGENT_API_KEY`).
   * Imports generated `toolDefinitionMap`.
   * Creates an MCP `Server` (from `@modelcontextprotocol/sdk/server`) with `StdioServerTransport`.
   * Wires `ListTools` → `handleListTools`, `CallTool` → `handleCallTool`.
   * Logs startup info:

     ```
     vision-tools-api MCP Server (v0.1.0) running on stdio, proxying to https://api.va.landing.ai
     ```
   * Listens for `SIGINT`/`SIGTERM` to gracefully shut down.


### 🚧 Error Handling & Logs

* **Validation Errors**
  If you send invalid or missing parameters, the server returns:

  ```json
  {
    "id": 3,
    "error": {
      "code": -32602,
      "message": "Validation error: missing required parameter ‘imagePath’"
    }
  }
  ```
* **Network Errors**
  Axios errors (timeouts, 5xx) are caught and returned as:

  ```json
  {
    "id": 4,
    "error": {
      "code": -32000,
      "message": "Vision Agent API error: 502 Bad Gateway"
    }
  }
  ```
* **Internal Exceptions**
  Uncaught exceptions in handlers produce:

  ```json
  {
    "id": 5,
    "error": {
      "code": -32603,
      "message": "Internal error: Unexpected token in JSON at position 345"
    }
  }
  ```


## 🛟 Troubleshooting

<details>
<summary><strong>Authentication failed</strong></summary>

* Verify `VISION_AGENT_API_KEY` is correct and active.
* Free tiers have rate limits—check your dashboard.
* Ensure outbound HTTPS to `api.va.landing.ai` isn’t blocked by a proxy/VPN.

</details>

<details>
<summary><strong>“Tool not found” in chat</strong></summary>

The local tool map may be stale. Run:

```bash
npm run generate-tools
npm start
```

</details>

<details>
<summary><strong>Node &lt; 20 error</strong></summary>

The code uses the Blob & FormData APIs natively introduced in Node 20.
Upgrade via `nvm install 20` (mac/Linux) or download from nodejs.org if on Windows.

</details>


## 🤝 Contributing

We love PRs!

1. **Fork** → `git checkout -b feature/my-feature`.
2. `npm run typecheck` (no errors)
3. Open a PR explaining **what** and **why**.

## 🔒 Security & Privacy

* The MCP server runs **locally**, so no files are forwarded anywhere except Landing AI’s API endpoints you explicitly call.
* Output images/masks are written to `OUTPUT_DIRECTORY` **only on your machine**.
* No telemetry is collected by this project.


> *Made with ❤️ by the LandingAI Team.*
