# Vision Agent MCP Server

<!-- ───────────────────────────── Badges ───────────────────────────── -->

<!-- Replace TODOs with real links once available -->

\[!\[npm]\([https://img.shields.io/npm/v/](https://img.shields.io/npm/v/)<!-- TODO:pkg-name -->?label=npm)]\([https://www.npmjs.com/package/](https://www.npmjs.com/package/)<!-- TODO:pkg-name -->)
[![build](https://img.shields.io/github/actions/workflow/status/landing-ai/vision-agent-mcp/ci.yml?branch=main)](!-- TODO:actions-link --)
[![license](https://img.shields.io/github/license/landing-ai/vision-agent-mcp)](LICENSE)

> **Beta – v0.1**
> This project is **early access** and subject to breaking changes until v1.0.

---

## Vision Agent MCP Server v0.1 – Overview

Modern LLM “agents” call external tools through the **Model Context Protocol (MCP)**.
**Vision Agent MCP** is a lightweight, side-car MCP server that runs locally on STDIN/STDOUT, translating each tool call from an MCP-compatible client (e.g., Claude Desktop, Cursor, Cline) into an authenticated HTTPS request to Landing AI’s Vision Agent REST APIs. The response—JSON plus any images or masks—is streamed back to the model, so you can issue natural-language computer-vision and document-analysis commands from your editor without writing custom REST code or loading an extra SDK.

![Demo of Vision Agent + Claude Code](assets/demo.gif) <!-- TODO: replace with real GIF or remove -->


## 🧰 Supported Use Cases (v0.1)

| Capability                          | Description                                                                                                                                                          |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`agentic-document-analysis`**     | Parse PDFs / images to extract text, tables, charts, and diagrams—taking layout and visual cues into account. [Web Version](https://va.landing.ai/demo/doc-extraction). |
| **`text-to-object-detection`**      | Detect free-form prompts like “all traffic lights” using OWLv2 / CountGD / Florence-2; outputs bounding boxes.                                                       |
| **`text-to-instance-segmentation`** | Generate pixel-perfect masks via Florence-2 + Segment-Anything-v2 (SAM-2).                                                                                           |
| **`activity-recognition`**          | Recognize multiple activities in video with start/end timestamps (1-pass efficient recognition, even for multiple activities).                                                  |
| **`depth-pro`**                     | Produce high-resolution monocular depth estimation for single images.                                                                                                |

> Whenever Vision Agent releases new endpoints, just run **`npm run generate-tools`**—the script fetches the latest OpenAPI spec and regenerates the local tool map automatically. 🚀

---

## 🗺 Table of Contents

1. [🚀 Quick Start](#-quick-start)
2. [📦 Installation Options](#-installation-options)
3. [⚙️ Configuration](#️-configuration)
4. [💡 Example Prompts](#-example-prompts)
5. [🏗 Architecture & Flow](#-architecture--flow)
6. [🧑‍💻 Developer Guide](#-developer-guide)
7. [🛟 Troubleshooting](#-troubleshooting)
8. [🤝 Contributing](#-contributing)
9. [🗓 Roadmap](#-roadmap)
10. [🔒 Security & Privacy](#-security--privacy)
11. [📜 License](#-license)
12. [📬 Support](#-support)


## 🚀 Quick Start

```bash
# 1. Clone & install dependencies
git clone https://github.com/landing-ai/vision-agent-mcp.git
cd vision-agent-mcp
npm install

# 2. Build TypeScript → ./build
npm run build

# 3. Set your Vision Agent API key
export VISION_AGENT_API_KEY="<YOUR_API_KEY>"

# 4. Launch the MCP server on STDIO
npm start            # (or: node build/index.js)
```

1. Open your MCP-aware client (e.g., Claude Desktop, Cursor, VS Code with mcp extension).
2. Upload a test image or PDF (e.g., `street.jpg` or `invoice.pdf`).
3. Send a prompt like:

   ```
   Detect all traffic lights in street.jpg using text-to-object-detection
   ```
4. If your client supports inline previews, you’ll see bounding-box overlays; otherwise, the PNG/mask is saved to `./output` and the chat shows its path.


## 📦 Installation Options

<details>
<summary><strong>A · Git clone ⬇️ (recommended)</strong></summary>

1. Clone the repo:

   ```bash
   git clone https://github.com/landing-ai/vision-agent-mcp.git
   cd vision-agent-mcp
   ```
2. Install dependencies:

   ```bash
   npm install
   ```
3. Build and start:

   ```bash
   npm run build
   npm start
   ```
4. Configure your environment variables (see [Configuration](#️-configuration)).

</details>

<details>
<summary><strong>B · Docker 🐳 (experimental)</strong></summary>

1. Build the Docker image:

   ```bash
   docker build -t vision-agent-mcp .
   ```
2. Run the container:

   ```bash
   docker run -it --rm \
     -e VISION_AGENT_API_KEY="<YOUR_API_KEY>" \
     -e OUTPUT_DIRECTORY="/app/output" \
     -e IMAGE_DISPLAY_ENABLED="true" \
     -v "$(pwd)/output:/app/output" \
     vision-agent-mcp
   ```
3. Inside Docker, you’ll still speak to STDIO. Mapping `output` lets you access generated images locally.

> **Note**: Using STDIO with Docker can be tricky—this is more suited for headless deployments or CI pipelines.

</details>

<details>
<summary><strong>C · NPX One-liner ➡️ (coming once published)</strong></summary>

```bash
npx <!-- TODO:pkg-name -->@latest
```

Easy peasy—no local clone needed. Will auto-build and run.

</details>

### 🧩 Prerequisites

| Software                 | Minimum Version        | Purpose                                                                 |
| ------------------------ | ---------------------- | ----------------------------------------------------------------------- |
| **Node.js**              | 20 (LTS)               | Uses native Blob & FormData APIs                                        |
| **Vision Agent account** | Any tier (API key)     | Fetch your API key from [Vision Agent Dashboard](https://va.landing.ai) |
| **MCP client**           | Any MCP-capable client | e.g., Claude Desktop, Cursor, Cline, or a custom script                 |
| **Git & npm/yarn**       | Latest stable          | To clone and install dependencies                                       |


## ⚙️ Configuration

Create a `.env` file at the project root (and add `.env` to `.gitignore`):

```dotenv
# Your Landing AI Vision Agent API key (required)
VISION_AGENT_API_KEY=your-vision-agent-api-key

# Optional: Where to save rendered images/masks/depth maps
OUTPUT_DIRECTORY=./output

# Optional: If "true", save images/videos returned by API into OUTPUT_DIRECTORY
IMAGE_DISPLAY_ENABLED=true
```

> **Tip**: The server auto-loads environment variables via `dotenv` in `src/index.ts`.

### Sample MCP Client Entry (`.mcp.json` for VS Code / Cursor)

```jsonc
{
  "mcpServers": {
    "Vision Agent": {
      "command": "node",
      "args": ["./build/index.js"],
      "env": {
        "VISION_AGENT_API_KEY": "YOUR_API_KEY_HERE",
        "OUTPUT_DIRECTORY": "./output",
        "IMAGE_DISPLAY_ENABLED": "true"
      }
    }
  }
}
```

* Point your MCP client at `node ./build/index.js`.
* Make sure `VISION_AGENT_API_KEY` is set.
* If you want inline previews, ensure `IMAGE_DISPLAY_ENABLED=true` and that your client supports rendering local file paths.


## 💡 Example Prompts

Upload your file (image, PDF, or video), then send one of these:

| Scenario                  | Prompt                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------- |
| **Invoice extraction**    | “Extract vendor, invoice date & total from this PDF using `agentic-document-analysis`.” |
| **Object detection**      | “Locate every pedestrian in street.jpg via `text-to-object-detection`.”                 |
| **Instance segmentation** | “Segment all tomatoes in kitchen.png with `text-to-instance-segmentation`.”             |
| **Activity recognition**  | “Identify activities occurring in match.mp4 via `activity-recognition`.”                |
| **Depth estimation**      | “Produce a depth map for selfie.png using `depth-pro`.”                                 |

> Feel free to experiment: change the prompt text (“all red cars,” “license plates,” “handwritten notes”) and see the magic happen. 🪄


## 🏗 Architecture & Flow

```text
┌────────────────────┐ 1. human prompt            ┌───────────────────┐
│ MCP-capable client │───────────────────────────▶│ Vision Agent MCP  │
│ (Cursor, Claude)   │                            │   (this repo)     │
└────────────────────┘                            └─────────▲─────────┘
            ▲  6. rendered PNG / JSON                     │ 2. JSON tool call
            │                                             │
            │ 5. preview path / data   3. HTTPS           │
            │                                             ▼
       local disk  ◀──────────┐                Landing AI Vision Agent
                               └──────────────▶  Cloud APIs
                                           4. JSON / media blob
```

1. **Prompt → tool call**
   The client converts your natural-language prompt into a structured MCP call (JSON-RPC).
2. **Validation**
   The server validates arguments against Zod schemas derived from Vision Agent’s OpenAPI spec.
3. **Forward**
   An authenticated Axios request hits the Vision Agent endpoint (e.g., `/v1/object-detect`).
4. **Response**
   The Cloud API returns JSON (bounding boxes, text, masks) plus any base64-encoded media.
5. **Visualization**
   If `IMAGE_DISPLAY_ENABLED=true`, masks/boxes/depth maps are saved as PNGs in `OUTPUT_DIRECTORY`.
6. **Return to chat**
   The MCP client receives structured JSON + file paths (or inline previews) and renders results for you.


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
* **Logging**

  * **stdout**: MCP JSON responses, normal operational logs.
  * **stderr**: Startup banners, detailed error stacks (in dev mode), Axios debug logs (if `NODE_DEBUG=axios`).

> **Tip**: To debug a JSON Schema mismatch, insert `console.log(inputSchema)` in `src/validation/schema.ts` or check `build/toolDefinitionMap.js` to inspect the generated Zod definitions.


## 🛟 Troubleshooting

<details>
<summary><strong>Authentication failed 🔒</strong></summary>

* Ensure `VISION_AGENT_API_KEY` is correctly set in your environment or `.env`.
* Free tiers can have rate limits—check your [Vision Agent dashboard](https://va.landing.ai) for usage stats.
* Confirm that outbound HTTPS to `api.va.landing.ai` isn’t blocked by a corporate firewall or VPN.

</details>

<details>
<summary><strong>“Tool not found” in chat 🔎</strong></summary>

* Your `toolDefinitionMap` may be stale. Run:

  ```bash
  npm run generate-tools
  ```

  then restart:

  ```bash
  npm start
  ```
* Make sure your MCP client is pointed at the right script (`node build/index.js`).
* Check that the Vision Agent OpenAPI hasn’t changed endpoints—update the whitelist in `src/generateTools.ts` if needed.

</details>

<details>
<summary><strong>Node &lt; 20 error 🚨</strong></summary>

* This code uses the native `Blob` & `FormData` APIs introduced in Node 20.
* If you see errors like “FormData is not defined” or “Blob is not a constructor,” upgrade:

  ```bash
  nvm install 20
  nvm use 20
  ```

  or download the latest LTS from [nodejs.org](https://nodejs.org/).

</details>

<details>
<summary><strong>Images / Masks not saving to disk 📁</strong></summary>

* Verify `OUTPUT_DIRECTORY` is set in your `.env` or your MCP client’s `env`.
* Ensure `IMAGE_DISPLAY_ENABLED=true`.
* Check folder permissions: you should have write access to `./output` (or whatever path you chose).
* Look for logs in `stderr`—you might see something like “EACCES: permission denied” if Node can’t write.

</details>


## 🤝 Contributing

We’d love your help! Here’s how you can pitch in:

1. **Fork the Repo & Create a Branch**

   ```bash
   git clone https://github.com/your-username/vision-agent-mcp.git
   cd vision-agent-mcp
   git checkout -b feature/my-new-feature
   ```

2. **Install & Typecheck**

   ```bash
   npm install
   npm run typecheck   # Make sure no TS errors
   ```

3. **Write Code & Tests**

   * If you add new functionality, write Jest tests under `__tests__/` and update `jest.config.js`.
   * If adding new Vision Agent endpoints, update the whitelist in `src/generateTools.ts` or adjust schema conversions.
   * Run:

     ```bash
     npm run build:all
     ```

     to regenerate `toolDefinitionMap`.

4. **Run the Server & Verify**

   ```bash
   npm start
   ```

   * In one terminal, run the MCP server.
   * In another, use the [Node.js test client example](#-nodejs-test-client-example) or your MCP client to verify your changes.

5. **Open a Pull Request**

   * Push your branch, open a PR to `main`, and describe **what** you changed and **why**.
   * Include screenshots or examples if your PR adds new behavior.
   * CI (lint, typecheck, unit tests) must pass before merge.

6. **Review & Merge**

   * We’ll review, provide feedback, and merge once it meets quality standards.
   * 🎉 Celebrate your contribution to making Vision Agent MCP even better!

---

## 🗓 Roadmap

| Version    | Highlights (tentative)                                                                                                                  |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **v0.2**   | Publish official Docker image · GitHub Actions CI · Basic unit tests                                                                    |
| **v0.3**   | Streaming progress updates · Automatic retries with exponential backoff                                                                 |
| **v1.0**   | Stable semver · Extended documentation site (MkDocs) · Windows MSI installer                                                            |
| **Future** | – Plugin system for custom Vision Agent tools <br> – GUI dashboard for offline testing <br> – Multi-transport support (WebSocket, HTTP) |

Got an idea? Open an [issue](https://github.com/landing-ai/vision-agent-mcp/issues) or start a [discussion](https://github.com/landing-ai/vision-agent-mcp/discussions).

---

## 🔒 Security & Privacy

* The MCP server runs **locally**—no files are forwarded anywhere except Landing AI’s API endpoints you explicitly call.
* Output images/masks are written to `OUTPUT_DIRECTORY` **only on your machine**.
* No telemetry or usage data is collected by this project.
* If you discover a vulnerability, please file a private security report (see [`SECURITY.md`](SECURITY.md)). <!-- TODO: create SECURITY.md or remove -->

---

## 📜 License

Distributed under the **MIT License**.
See [`LICENSE`](LICENSE) for the full text. <!-- TODO: swap if using Apache-2.0 or other -->

---

## 📬 Support

Need help or have questions? We’ve got you covered:

* **GitHub Issues**: Open an issue with a detailed description.
* **Email**: Contact the LandingAI team at [support@landing.ai](mailto:support@landing.ai).
* **Discord**: Join the VisionAgent community - [https://discord.com/invite/RVcW3j9RgR](https://discord.com/invite/RVcW3j9RgR).

We value your feedback—let’s build something amazing together! 🚀

---

### 🔧 Node.js Test Client Example

If you want to script calls or debug programmatically, create a `test-client.js` at the repo root:

```js
#!/usr/bin/env node

/**
 * Minimal MCP client demo:
 * 1. Launches the MCP server via `npm start`
 * 2. Sends ListTools request
 * 3. Sends a CallTool request for `text-to-object-detection`
 *
 * Usage: node test-client.js
 */

import { spawn } from 'child_process';
import path from 'path';

// Spawn the MCP server
const serverProcess = spawn('npm', ['start'], { shell: true });

// When the server is ready, send JSON-RPC messages over stdin
serverProcess.stdout.on('data', (data) => {
  const msg = data.toString();
  process.stdout.write(`SERVER OUT: ${msg}`);

  if (msg.includes('running on stdio')) {
    // 1) ListTools
    const listToolsMsg = {
      id: 1,
      method: 'ListTools',
      params: {}
    };
    serverProcess.stdin.write(JSON.stringify(listToolsMsg) + '\n');

    // 2) Call a tool (update imagePath to a real path on your machine)
    const callToolMsg = {
      id: 2,
      method: 'CallTool',
      params: {
        tool: 'text-to-object-detection',
        arguments: {
          imagePath: path.resolve(__dirname, 'examples', 'street.jpg'),
          prompt: 'a red sports car'
        }
      }
    };
    setTimeout(() => {
      serverProcess.stdin.write(JSON.stringify(callToolMsg) + '\n');
    }, 1000);
  }
});

// Print server stderr
serverProcess.stderr.on('data', (err) => {
  process.stderr.write(`SERVER ERR: ${err}`);
});

// Handle exit
serverProcess.on('exit', (code) => {
  console.log(`MCP Server exited with code ${code}`);
});
```

1. Place a test image at `examples/street.jpg`.
2. Run `node test-client.js` in one terminal—`npm start` will spin up the server.
3. Watch the console for ListTools and CallTool responses.

Use this as a template to automate Vision Agent MCP tasks in your own projects.

---

> *Made with ❤️ by the LandingAI Team*
