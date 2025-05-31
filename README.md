# Vision Agent MCP (v0.1)

An MCP package for Vision Agent that brings powerful computer vision and document analysis tools to the Model Context Protocol.

![Demo of Vision Agent with Claude Code](assets/demo.gif)


## Available Tools

This MCP server provides access to the following Vision Agent API tools:

### **text-to-object-detection**
Detect objects in images or videos based on text prompts using advanced computer vision models (OWLv2, CountGD, Florence2). Identifies and locates objects described in natural language with bounding boxes and confidence scores.

### **text-to-instance-segmentation**
Generate precise pixel-level segmentation masks for objects based on text descriptions. Combines Florence2 with SAM2 (Segment Anything Model 2) to create detailed instance segmentation masks.

### **activity-recognition**
Analyze video content to identify and describe human activities and behaviors. Processes video streams with temporal understanding to recognize activities with timestamped events.

### **depth-pro**
Generate high-quality depth information from single images. Uses advanced depth estimation models to create depth maps showing relative distances of objects from the camera viewpoint.

### **agentic-document-analysis**
Extract and analyze structured information from documents using AI agents. Performs intelligent document processing to extract text, metadata, and structured data from images and PDFs. See [here](https://va.landing.ai/demo/doc-extraction) for the web version.

## Installation & Build

1. Clone the repository:

   ```bash
   git clone https://github.com/landing-ai/vision-agent-mcp.git
   ```

2. Navigate into the project directory:

   ```bash
   cd vision-agent-mcp
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Build the project:

   ```bash
   npm run build
   ```

### Get Your VisionAgent API Key
If you do not have a VisionAgent API key, [create an account](https://va.landing.ai/home) and obtain your [API key](https://va.landing.ai/settings/api-key).

## Environment Variables

- `VISION_AGENT_API_KEY` - **Required** API key for Vision Agent authentication
- `OUTPUT_DIRECTORY` - Optional directory for saving processed outputs (supports relative and absolute paths)
- `IMAGE_DISPLAY_ENABLED` - Set to `"true"` to enable image visualization features

## Client Configuration

After building, configure your MCP client with the following settings:

```json
{
  "mcpServers": {
    "Vision Agent": {
      "command": "node",
      "args": [
        "/path/to/build/index.js"
      ],
      "env": {
        "VISION_AGENT_API_KEY": "YOUR_API_KEY_HERE",
        "OUTPUT_DIRECTORY": "../../output",
        "IMAGE_DISPLAY_ENABLED": "true"
      }
    }
  }
}
```

> **Note:** Replace `/path/to/build/index.js` with the actual path to your built `index.js` file, and set your environment variables as needed. For MCP clients without image display capabilities, like Cursor, set IMAGE_DISPLAY_ENABLED to False. For MCP clients with image display capabilities, like Claude Desktop, set IMAGE_DISPLAY_ENABLED to true to visualize tool outputs. Generally, MCP clients that support resources (see this list: https://modelcontextprotocol.io/clients) will support image display.

## Development Commands

### Build Commands
- `npm run build` - Compile TypeScript to build/ directory with executable permissions
- `npm run build:all` - Full build including tool generation (runs `npm run build && npm run generate-tools`)
- `npm run typecheck` - Type check without emitting files

### Tool Management
- `npm run generate-tools` - Fetch latest tool definitions from Vision Agent API and update tool mappings
- This command:
  - Fetches the OpenAPI specification from `https://api.va.landing.ai/openapi.json`
  - Filters tools based on the whitelist in `src/generateTools.ts`
  - Generates `toolDefinitionMap.ts` in both `src/` and `build/` directories
  - Updates MCP tool definitions to match the latest API

### Running
- `npm start` - Build and run the MCP server

## Requirements

- Node.js >= 20.0.0
- Vision Agent API key
- MCP-compatible client (e.g., Claude Desktop, Cursor, Cline, etc.)