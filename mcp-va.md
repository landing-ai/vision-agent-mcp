# Vision Agent MCP Server 

<!-- Badges (fill in real links) -->
[![npm](https://img.shields.io/npm/v/<!-- TODO:pkg-name -->?label=npm)](https://www.npmjs.com/package/<!-- TODO:pkg-name -->)
[![build](https://img.shields.io/github/actions/workflow/status/landing-ai/vision-agent-mcp/ci.yml)](<!-- TODO:actions-link -->)
[![license](https://img.shields.io/github/license/landing-ai/vision-agent-mcp)](LICENSE)

> **Beta – v0.1**  
> This server is an **early preview**. Expect breaking changes until we hit v1.0.

---

## Overview

The **Vision Agent MCP Server** implements the [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) so that large-language-model “agents” can call Landing AI’s Vision Agent APIs from any MCP-compatible client (Claude Desktop, Cursor, Cline, …).

### Supported Vision Agent tools (v0.1)

| Tool | What it does |
|------|--------------|
| `agentic-document-analysis` | Extracts structured data, text, layout & metadata from PDFs and images. |
| `text-to-object-detection` | Detects objects described in free-text prompts (OWLv2 / CountGD / Florence 2). |
| `text-to-instance-segmentation` | Produces pixel-accurate masks via Florence 2 + SAM 2. |
| `activity-recognition` | Labels human activities in video with timestamps. |
| `depth-pro` | Generates high-resolution monocular depth maps. |

*(Run `npm run generate-tools` to pull the latest tool list from the Vision Agent OpenAPI spec.)*

---

## 🗺 Table of Contents
1. [Quick Start](#-quick-start)
2. [Installation](#-installation)
3. [Configuration](#-configuration)
4. [Example Prompts](#-example-prompts)
5. [How It Works](#-how-it-works)
6. [Developer Guide](#-developer-guide)
7. [Troubleshooting](#-troubleshooting)
8. [Contributing](#-contributing)
9. [Roadmap](#-roadmap)
10. [License](#-license)

---

## 🚀 Quick Start

```bash
# 1 Clone & install
git clone https://github.com/landing-ai/vision-agent-mcp.git
cd vision-agent-mcp
npm install

# 2 Build
npm run build          # compiles TypeScript to ./build

# 3 Set env vars (at least your Vision Agent key)
export VISION_AGENT_API_KEY=<YOUR_KEY>

# 4 Launch the server
npm start              # or: node build/index.js
````

Open your MCP-capable client, switch to “Vision Agent MCP”, and try:

```
Detect all traffic lights in street.jpg using text-to-object-detection
```

If your client supports resource previews, you’ll see bounding boxes in-line.

---

## 📦 Installation

<details>
<summary><strong>Option A – use the repo (recommended for now)</strong></summary>

Same as “Quick Start” above: clone → `npm install` → `npm run build` → `npm start`.

</details>

<details>
<summary><strong>Option B – Docker (experimental)</strong></summary>

```bash
docker build -t vision-agent-mcp .
docker run -it --rm \
  -e VISION_AGENT_API_KEY=<YOUR_KEY> \
  -p 3910:3910 \
  vision-agent-mcp
```

</details>

<details>
<summary><strong>Option C – NPX one-liner (coming once published to npm)</strong></summary>

```bash
npx <!-- TODO:pkg-name -->@latest
```

</details>

### Requirements

| What                           | Version                          |
| ------------------------------ | -------------------------------- |
| Node.js                        | **≥ 20.0.0**                     |
| Vision Agent account & API key | required                         |
| MCP-compatible client          | Claude Desktop, Cursor, Cline, … |

---

## ⚙️ Configuration

### Environment variables

| Variable                | Required | Default    | Description                                     |
| ----------------------- | -------- | ---------- | ----------------------------------------------- |
| `VISION_AGENT_API_KEY`  | **Yes**  | –          | Auth token from Landing AI                      |
| `OUTPUT_DIRECTORY`      | No       | `./output` | Where processed images / JSON go                |
| `IMAGE_DISPLAY_ENABLED` | No       | `true`     | Set `false` if your client can’t preview images |

### Client snippet (`.mcp.json` for VS Code / Cursor)

```jsonc
{
  "mcpServers": {
    "Vision Agent": {
      "command": "node",
      "args": ["./build/index.js"],
      "env": {
        "VISION_AGENT_API_KEY": "YOUR_API_KEY_HERE",
        "OUTPUT_DIRECTORY": "../../output",
        "IMAGE_DISPLAY_ENABLED": "true"
      }
    }
  }
}
```

> **Tip**: Point `args[0]` to the built `index.js` wherever it lives on your machine.

---

## 💡 Example Prompts

| Use case                  | Prompt                                                                                         |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| **Invoice parsing**       | “Extract vendor name, invoice date and total from this PDF using `agentic-document-analysis`.” |
| **Object detection**      | “Locate every pedestrian in *street.jpg* with `text-to-object-detection`.”                     |
| **Instance segmentation** | “Segment all tomatoes in *kitchen.png* via `text-to-instance-segmentation`.”                   |
| **Activity recognition**  | “What sports are being played in *game.mp4*? Use `activity-recognition`.”                      |
| **Depth maps**            | “Generate a depth map for *selfie.png* with `depth-pro`.”                                      |

Copy–paste any line above into your MCP client chat after uploading the file(s).

---

## 🛠 How It Works

```
┌────────────┐   MCP JSON   ┌────────────────┐
│  MCP Client│ ───────────▶ │Vision Agent MCP│
└────────────┘              │   (this repo)  │
       ▲  ▲  human prompt   │                │
       │  └────────────────▶│Tool executor   │
       │                    └───────▲────────┘
       │  image / json              │ REST
       └────────────────────────────┘
                   Vision Agent API (cloud)
```

1. Your MCP client sends a JSON tool-call to the local server.
2. The server forwards the request to the appropriate Vision Agent REST endpoint.
3. Results (JSON + optional images) stream back and are surfaced in chat.
4. If `IMAGE_DISPLAY_ENABLED=true`, image artifacts are saved to `OUTPUT_DIRECTORY` and their paths are returned so the client can preview them inline.

All tool definitions are auto-generated from the public [OpenAPI spec](https://api.va.landing.ai/openapi.json) each time you run `npm run generate-tools`, ensuring parity with new Vision Agent features.

---

## 🧑‍💻 Developer Guide

| Script                   | What it does                                             |
| ------------------------ | -------------------------------------------------------- |
| `npm run build`          | TypeScript → `build/` (adds executable bit)              |
| `npm run start`          | **Build plus run** (`node build/index.js`)               |
| `npm run typecheck`      | `tsc --noEmit`                                           |
| `npm run generate-tools` | Pulls latest OpenAPI, regenerates `toolDefinitionMap.ts` |
| `npm run build:all`      | `build` **+** `generate-tools`                           |

### Project structure (top-level)

```text
src/
  cli.ts              ← entry for `npm start`
  server.ts           ← MCP server impl
  generateTools.ts    ← pulls / transforms OpenAPI spec
  …                   
build/                ← compiled JS (ignored until build)
```

---

## 🛟 Troubleshooting

<details>
<summary>“Authentication failed”</summary>

* Make sure `VISION_AGENT_API_KEY` is correct and **not expired**.
* Double-check that your network allows outbound HTTPS to `api.va.landing.ai`.

</details>

<details>
<summary>“Client says: tool not found”</summary>

Run `npm run generate-tools` to refresh tool definitions, then restart the server.

</details>

<details>
<summary>Node &lt; 20 errors</summary>

The repo targets modern language features enabled in Node 20+. Upgrade Node or use `nvm` to switch versions.

</details>

---

## 🤝 Contributing

1. **Fork** and create a feature branch.
2. Run `npm test` (coming soon) and `npm run typecheck`.
3. Open a PR—please describe **what** it changes and **why**.
4. All contributions follow the [Contributor Covenant](CODE_OF_CONDUCT.md).

---

## 🗓 Roadmap

| Version  | Planned features                                      |
| -------- | ----------------------------------------------------- |
| **v0.2** | Docker image published, CI pipeline, basic unit tests |
| **v0.3** | Streaming progress messages & retry logic             |
| **v1.0** | Stable API, semver guarantees, formal docs site       |

*(Have ideas? Open a discussion or PR!)*

---

## 📜 License

<!-- TODO: choose license if not MIT -->

Distributed under the MIT License.
See [`LICENSE`](LICENSE) for details.

---

*Made with ❤️ by the Landing AI Developer Experience team.*

```

---

### What’s still missing?

* **CI badge URL and workflow file name**  
* **Actual npm package name** (if you decide to publish)  
* **GIF/Screenshot** for the quick test (drop a file in `/docs` and reference it)  
* **Final License type** (MIT, Apache-2.0, …)

Let me know if you’d like deeper examples (e.g., code snippets that parse responses), an architecture diagram in SVG, or extra sections like a **Security Policy**. Happy to iterate!
::contentReference[oaicite:0]{index=0}
```
