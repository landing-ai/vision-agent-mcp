import os from 'os';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ServerConfig, EnvironmentConfig } from '../types.js';

export const SERVER_CONFIG: ServerConfig = {
    name: "vision-tools-api",
    version: "0.1.0",
    apiBaseUrl: "https://api.va.landing.ai"
};

export function getEnvironmentConfig(): EnvironmentConfig {
    return {
        apiKey: process.env.VISION_AGENT_API_KEY,
        outputDirectory: resolveOutputDirectory(process.env.OUTPUT_DIRECTORY),
        imageDisplayEnabled: process.env.IMAGE_DISPLAY_ENABLED === 'true'
    };
}

function resolveOutputDirectory(outputDir?: string): string | undefined {
    if (typeof outputDir !== 'string') {
        return undefined;
    }

    let resolvedPath = outputDir;

    if (outputDir.startsWith('~')) {
        resolvedPath = path.join(os.homedir(), outputDir.slice(1));
    } else if (outputDir.startsWith('.')) {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        resolvedPath = path.join(__dirname, outputDir);
    }

    fs.mkdirSync(resolvedPath, { recursive: true });
    return resolvedPath;
}