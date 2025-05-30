import { OpenAPIV3 } from 'openapi-types';
import { JSONSchema7 } from 'json-schema';

export interface McpToolDefinition {
    name: string;
    description: string;
    inputSchema: any;
    method: string;
    pathTemplate: string;
    parameters: any[];
    executionParameters: ExecutionParameter[];
    requestBodyContentType?: string;
    securityRequirements: any[];
    baseUrl?: string;
}

export interface ExecutionParameter {
    name: string;
    in: string;
}

export interface LoadFileOptions {
    fileType?: string;
    contentType?: string;
    skipImageProcessing?: boolean;
    sharpOptions?: {
        formatOptions?: Record<string, unknown>;
    };
    keepAlpha?: boolean;
    outputFormat?: string;
    filename?: string;
}

export interface LoadedFile {
    buffer: Buffer;
    contentType: string;
    filename: string;
    originalSize: number;
}

export interface ToolArgs {
    [key: string]: unknown;
    authorization?: string;
    requestBody?: string | Record<string, unknown>;
}

export interface ServerConfig {
    name: string;
    version: string;
    apiBaseUrl: string;
}

export interface EnvironmentConfig {
    apiKey?: string;
    outputDirectory?: string;
    imageDisplayEnabled: boolean;
}

export type FileType = 'pdf' | 'video' | 'image' | 'binary';

export type JsonObject = Record<string, any>;

export interface ColorRGBA {
    r: number;
    g: number;
    b: number;
    a: number;
}