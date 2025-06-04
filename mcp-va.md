# Vision Agent MCP Server

<!-- ───────────────────────────── Badges ───────────────────────────── -->
<!-- Replace all TODOs with real links once available -->

[![npm](https://img.shields.io/npm/v/<!-- TODO:pkg-name -->?label=npm)](https://www.npmjs.com/package/<!-- TODO:pkg-name -->)
[![build](https://img.shields.io/github/actions/workflow/status/landing-ai/vision-agent-mcp/ci.yml?branch=main)](<!-- TODO:actions-link -->)
[![license](https://img.shields.io/github/license/landing-ai/vision-agent-mcp)](LICENSE)

> **Beta – v0.1**  
> This project is **early access** and subject to breaking changes until v1.0.


## Why this project exists

Modern LLM “agents” call external tools through the **Model Context Protocol (MCP)**.
**Vision Agent MCP** is a lightweight, side-car MCP server that runs locally on STDIN/STDOUT, translating each tool call from an MCP-compatible client (Claude Desktop, Cursor, Cline, etc.) into an authenticated HTTPS request to Landing AI’s Vision Agent REST APIs. The response—JSON plus any images or masks—is streamed back to the model, so you can issue natural-language computer-vision and document-analysis commands from your editor without writing custom REST code or loading an extra SDK.


## 📸 Demo

![Demo of Vision Agent + Claude Code](assets/demo.gif) <!-- TODO: provide a real GIF or remove -->

---

## 🧰 Supported Vision Agent tools (v0.1)

| Capability                    | Description                                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **`agentic-document-analysis`** | Parse PDFs / images to extract text, tables, charts, and diagrams taking into account layouts and other visual cues.                                 |
| **`text-to-object-detection`** | Detect free-form prompts (“all traffic lights”) using OWLv2 / CountGD / Florence-2; outputs bounding boxes.        |
| **`text-to-instance-segmentation`** | Pixel-perfect masks via Florence-2 + Segment-Anything-v2 (SAM-2).                                              |
| **`activity-recognition`**     | Recognise multiple activities at one-pass in video with start/end timestamps.                                           |
| **`depth-pro`**                | High-resolution monocular depth estimation for single images.                                                    |

> Run **`npm run generate-tools`** whenever Vision Agent releases new endpoints—the script fetches the latest OpenAPI spec and regenerates the local tool map automatically.

---

## 🗺 Table of Contents
1. [Quick Start](#-quick-start)
2. [Installation Options](#-installation-options)
3. [Configuration](#-configuration)
4. [Example Prompts](#-example-prompts)
5. [Architecture & Flow](#-architecture--flow)
6. [Developer Guide](#-developer-guide)
7. [Troubleshooting](#-troubleshooting)
8. [Contributing](#-contributing)
9. [Roadmap](#-roadmap)
10. [Security & Privacy](#-security--privacy)
11. [License](#-license)

---

## 🚀 Quick Start

```bash
# 1  Clone & install
git clone https://github.com/landing-ai/vision-agent-mcp.git
cd vision-agent-mcp
npm install

# 2  Build TypeScript → ./build
npm run build

# 3  Set your Vision Agent API key
export VISION_AGENT_API_KEY="<YOUR_API_KEY>"

# 4  Launch the MCP server on stdio
npm start            # or: node build/index.js
````

1. Open your MCP-aware client, choose **Vision Agent MCP**.
2. Upload *street.jpg* (or any test image).
3. Paste the prompt below:

```
Detect all traffic lights in street.jpg using text-to-object-detection
```

If your client supports inline resources you’ll see bounding-box overlays; otherwise, the PNG is saved to `./output` and the chat shows its path.

---

## 📦 Installation Options

<details>
<summary><strong>A&nbsp;·&nbsp;Git clone ⬇️ (recommended)</strong></summary>

Exactly what the Quick Start shows: clone → `npm install` → `npm run build` → `npm start`.

</details>

<details>
<summary><strong>B&nbsp;·&nbsp;Docker 🐳 (experimental)</strong></summary>

```bash
docker build -t vision-agent-mcp .
docker run -it --rm \
  -e VISION_AGENT_API_KEY="<YOUR_API_KEY>" \
  -p 3910:3910 \          # Only needed if you enable HTTP transport later
  vision-agent-mcp
```

Mongoising on stdio inside Docker can be awkward; keep this for headless deployments or testing.

</details>

<details>
<summary><strong>C&nbsp;·&nbsp;NPX One-liner ➡️ (coming once published)</strong></summary>

```bash
npx <!-- TODO:pkg-name -->@latest
```

</details>

### Prerequisites

| Software                 | Minimum Version                          |
| ------------------------ | ---------------------------------------- |
| **Node.js**              | 20 (LTS)                                 |
| **Vision Agent account** | Any paid or free tier (needs API key)    |
| **MCP client**           | Claude Desktop / Cursor / Cline / *etc.* |

---

## ⚙️ Configuration

| ENV var                 | Required | Default    | Purpose                                                |
| ----------------------- | -------- | ---------- | ------------------------------------------------------ |
| `VISION_AGENT_API_KEY`  | **Yes**  | —          | Landing AI auth token.                                 |
| `OUTPUT_DIRECTORY`      | No       | `./output` | Where rendered images / masks / depth maps are stored. |
| `IMAGE_DISPLAY_ENABLED` | No       | `true`     | `false` ➜ skip rendering; only return file paths.      |

> **Tip**  Create a local `.env` file for convenience—`dotenv` is auto-loaded by `src/index.ts`.

### Sample MCP client entry (`.mcp.json` for VS Code / Cursor)

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

---

## 💡 Example Prompts

| Scenario                     | Prompt (after uploading file)                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| Invoice extraction           | *“Extract vendor, invoice date & total from this PDF using `agentic-document-analysis`.”* |
| Object detection             | *“Locate every pedestrian in **street.jpg** via `text-to-object-detection`.”*             |
| Instance segmentation        | *“Segment all tomatoes in **kitchen.png** with `text-to-instance-segmentation`.”*         |
| Activity recognition (video) | *“Identify activities occurring in **match.mp4** via `activity-recognition`.”*            |
| Depth estimation             | *“Produce a depth map for **selfie.png** using `depth-pro`.”*                             |

---

## 🏗 Architecture & Flow

```text
┌────────────────────┐ 1. human prompt            ┌───────────────────┐
│ MCP-capable client │───────────────────────────▶│  Vision Agent MCP │
│  (Cursor, Claude)  │                            │   (this repo)     │
└────────────────────┘                            └─────────▲─────────┘
            ▲  6. rendered PNG / JSON                     │ 2. JSON tool call
            │                                             │
            │ 5. preview path / data   3. HTTPS           │
            │                                             ▼
       local disk  ◀──────────┐                Landing AI Vision Agent
                               └──────────────▶  Cloud APIs
                                           4. JSON / media blob
```

1. **Prompt → tool-call** The client converts your natural-language prompt into a structured MCP call.
2. **Validation** The server validates args with Zod schemas derived from the live OpenAPI spec.
3. **Forward** An authenticated Axios request hits the Vision Agent endpoint.
4. **Response** JSON + any base64 media are returned.
5. **Visualisation** If enabled, masks / boxes / depth maps are rendered to files.
6. **Return to chat** The MCP client receives data + file paths (or inline previews).

---

## 🧑‍💻 Developer Guide

| Script                   | Purpose                                                            |
| ------------------------ | ------------------------------------------------------------------ |
| `npm run build`          | Compile TS → `build/` (adds executable bit).                       |
| `npm run start`          | Build *and* run (`node build/index.js`).                           |
| `npm run typecheck`      | Type-only check (`tsc --noEmit`).                                  |
| `npm run generate-tools` | Fetch latest public OpenAPI and regenerate `toolDefinitionMap.ts`. |
| `npm run build:all`      | Convenience: `build` + `generate-tools`.                           |

### Project layout

```text
src/
  index.ts            # CLI entry (dotenv, signal handlers, startServer)
  server/
    index.ts          # MCP server w/ Stdio transport
    handlers.ts       # listTools, callTool, etc.
    visualization.ts  # camera-ready rendering for each tool
  generateTools.ts    # Dev script (OpenAPI → TS map)
  utils/              # file.ts, http.ts, etc.
build/                # compiled JS (git-ignored)
output/               # runtime artifacts (bounding boxes, masks, …)
```

---

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

---

## 🤝 Contributing

We love PRs!

1. **Fork** → `git checkout -b feature/my-feature`.
2. `npm run typecheck` (no errors) & `npm test` <!-- TODO: add tests or update -->.
3. Open a PR explaining **what** and **why**.
4. CI must pass (lint, unit tests) before merge.

All contributors agree to the [Contributor Covenant](CODE_OF_CONDUCT.md).

---

## 🗓 Roadmap

| Version  | Highlights (tentative)                                               |
| -------- | -------------------------------------------------------------------- |
| **v0.2** | Publish official Docker image · GitHub Actions CI · Basic unit tests |
| **v0.3** | Streaming progress updates · Automatic retries w/ back-off           |
| **v1.0** | Stable semver · Extended docs site · Windows MSI installer           |

Got a feature request? Open an issue or start a GitHub discussion.

---

## 🔒 Security & Privacy

* The MCP server runs **locally**—no files are forwarded anywhere except Landing AI’s API endpoints you explicitly call.
* Output images/masks are written to `OUTPUT_DIRECTORY` **only on your machine**.
* No telemetry is collected by this project.
* If you discover a vulnerability, please file a private security report (see `SECURITY.md`). <!-- TODO: provide a SECURITY.md or remove -->

---

## 📜 License

Distributed under the **MIT License**.
See [`LICENSE`](LICENSE) for the full text. <!-- TODO: swap if using Apache-2.0 or other -->

---

> *Made with ❤️ by the LandingAI Team.*


### What’s still left to plug in

* **Actual npm package name** (`<!-- TODO:pkg-name -->`) once you publish.  
* **CI badge URL**—update once your GitHub Actions workflow is named and merged.  
* **Demo GIF** path (`assets/demo.gif`) or remove the image block.  
* **Security policy** (`SECURITY.md`) if you decide to maintain one.  
* **Unit tests** (and the accompanying `npm test`)—the scaffold is there but currently empty.
