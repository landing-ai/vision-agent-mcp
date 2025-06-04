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
    fileType?: FileType;
    contentType?: string;
    skipImageProcessing?: boolean;
    sharpOptions?: {
        formatOptions?: {
            width?: number;
            height?: number;
            [key: string]: unknown;
        };
    };
    keepAlpha?: boolean;
    outputFormat?: 'png' | 'jpeg' | 'webp' | 'gif';
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
    requestBody?: RequestBodyData;
}

export interface RequestBodyData {
    [key: string]: unknown;
    // File fields
    image?: string;
    video?: string;
    pdf?: string;
    images?: string[];
    videos?: string[];
    pdfs?: string[];
    // Common fields
    prompt?: string;
    text?: string;
    query?: string;
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

// Error handling types
export interface ApiError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    status?: number;
}

export interface ValidationResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}

export interface FileProcessingResult {
    success: boolean;
    data?: string; // base64 data
    error?: string;
    metadata?: {
        originalSize: number;
        processedSize: number;
        contentType: string;
        filename: string;
    };
}

// MCP Response types
export interface McpResponse {
    content: Array<{
        type: 'text' | 'image';
        text?: string;
        data?: string;
        mimeType?: string;
    }>;
}

// Tool execution context
export interface ToolExecutionContext {
    toolName: string;
    apiKey: string;
    outputDirectory?: string;
    imageDisplayEnabled: boolean;
    startTime: number;
}