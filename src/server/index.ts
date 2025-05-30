import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { SERVER_CONFIG } from './config.js';
import { handleListTools, handleCallTool } from './handlers.js';

export function createServer(): Server {
    const server = new Server(
        { name: SERVER_CONFIG.name, version: SERVER_CONFIG.version }, 
        { capabilities: { tools: {} } }
    );

    server.setRequestHandler(ListToolsRequestSchema, handleListTools);
    server.setRequestHandler(CallToolRequestSchema, handleCallTool);

    return server;
}

export async function startServer(): Promise<void> {
    const server = createServer();
    
    try {
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.error(
            `${SERVER_CONFIG.name} MCP Server (v${SERVER_CONFIG.version}) running on stdio, proxying API at ${SERVER_CONFIG.apiBaseUrl}`
        );
    } catch (error) {
        console.error("Error during server startup:", error);
        process.exit(1);
    }
}

export async function cleanup(): Promise<void> {
    console.error("Shutting down MCP server...");
    process.exit(0);
}