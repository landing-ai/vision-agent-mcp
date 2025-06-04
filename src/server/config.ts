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

    let resolvedPath: string;

    if (outputDir.startsWith('~')) {
        resolvedPath = path.resolve(os.homedir(), outputDir.slice(1));
    } else if (outputDir.startsWith('.')) {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        resolvedPath = path.resolve(__dirname, outputDir);
    } else {
        resolvedPath = path.resolve(outputDir);
    }

    // Security: Validate the resolved path is safe
    if (!isPathSafe(resolvedPath)) {
        throw new Error(`Invalid output directory path: ${outputDir}. Path traversal detected.`);
    }

    try {
        fs.mkdirSync(resolvedPath, { recursive: true });
        return resolvedPath;
    } catch (error) {
        console.error(`Failed to create output directory: ${resolvedPath}`, error);
        return undefined;
    }
}

function isPathSafe(resolvedPath: string): boolean {
    // Normalize the path to remove any .. or . components
    const normalizedPath = path.normalize(resolvedPath);
    
    // Ensure the resolved path doesn't contain dangerous patterns
    if (normalizedPath.includes('..')) {
        return false;
    }
    
    // Define allowed base directories for security
    const allowedBaseDirs = [
        os.homedir(),
        os.tmpdir(),
        process.cwd(),
        path.dirname(fileURLToPath(import.meta.url))
    ];
    
    // Check if the path starts with any allowed base directory
    return allowedBaseDirs.some(baseDir => {
        const normalizedBase = path.normalize(baseDir);
        return normalizedPath.startsWith(normalizedBase);
    });
}