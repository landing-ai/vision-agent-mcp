import path from 'path';
import axios, { AxiosRequestConfig } from 'axios';
import FormData from 'form-data';
import {
    CallToolRequest,
    Tool,
    TextContent
} from "@modelcontextprotocol/sdk/types.js";
import { toolDefinitionMap } from '../toolDefinitionMap.js';
import { McpToolDefinition, ToolArgs, JsonObject, FileType } from '../types.js';
import { getZodSchemaFromJsonSchema, validateToolArguments } from '../validation/schema.js';
import { processFileArgs, loadFileFromBase64 } from '../utils/file.js';
import { formatApiError, createAxiosError, sanitizeForLogging } from '../utils/http.js';
import { createApiError, formatErrorForUser, isAxiosError } from '../utils/errors.js';
import { saveBase64Image } from '../image/processing.js';
import { createVisualization } from './visualization.js';
import { SERVER_CONFIG, getEnvironmentConfig } from './config.js';

export async function handleListTools() {
    const toolsForClient: Tool[] = Array.from(toolDefinitionMap.values()).map(def => ({
        name: def.name,
        description: "Note: Any files passed to image, pdf, or video parameters must be absolute paths or uris, no relative paths. Here is what this tool does: " + def.description,
        inputSchema: typeof def.inputSchema === 'boolean' ? {} : (def.inputSchema as any)
    }));
    return { tools: toolsForClient };
}

export async function handleCallTool(request: CallToolRequest) {
    const { name: toolName, arguments: toolArgs } = request.params;
    const toolDefinition = toolDefinitionMap.get(toolName);
    
    if (!toolDefinition) {
        console.error(`Error: Unknown tool requested: ${toolName}`);
        return { content: [{ type: "text", text: `Error: Unknown tool requested: ${toolName}` }] };
    }
    
    return await executeApiTool(toolName, toolDefinition, toolArgs ?? {});
}

async function executeApiTool(
    toolName: string,
    definition: McpToolDefinition,
    toolArgs: JsonObject,
) {
    try {
        const context = await createExecutionContext(toolName, toolArgs);
        const validatedArgs = await validateAndProcessArgs(definition, toolArgs, toolName);
        const response = await makeApiRequest(definition, validatedArgs, context);
        return await processResponse(response, definition, toolArgs, context);
    } catch (error: unknown) {
        return handleExecutionError(error, toolName);
    }
}

async function createExecutionContext(toolName: string, toolArgs: JsonObject) {
    const config = getEnvironmentConfig();
    if (!config.apiKey) {
        throw new Error('VISION_AGENT_API_KEY environment variable is required');
    }
    
    return {
        toolName,
        apiKey: config.apiKey,
        outputDirectory: config.outputDirectory,
        imageDisplayEnabled: config.imageDisplayEnabled,
        startTime: Date.now()
    };
}

async function validateAndProcessArgs(definition: McpToolDefinition, toolArgs: JsonObject, toolName: string) {
    const processedArgs = await processFileArgs(toolArgs);
    
    const validationResult = validateArguments(definition, processedArgs, toolName);
    if (!validationResult.success) {
        throw new Error(`Validation failed: ${validationResult.error}`);
    }
    
    return validationResult.data;
}

async function makeApiRequest(definition: McpToolDefinition, validatedArgs: ToolArgs, context: any) {
    const requestConfig = buildRequestConfig(definition, validatedArgs, context.apiKey);
    console.error(`Executing tool "${context.toolName}": ${requestConfig.method} ${requestConfig.url}`);
    
    return await axios(requestConfig);
}

function validateArguments(definition: McpToolDefinition, args: JsonObject, toolName: string) {
    const schema = typeof definition.inputSchema === 'boolean' ? {} : (definition.inputSchema as Record<string, unknown>);
    const zodSchema = getZodSchemaFromJsonSchema(schema, toolName);
    return validateToolArguments(zodSchema, args, toolName);
}

function buildRequestConfig(definition: McpToolDefinition, validatedArgs: ToolArgs, apiKey: string): AxiosRequestConfig {
    let urlPath = definition.pathTemplate;
    const queryParams: Record<string, unknown> = {};
    const headers: Record<string, string> = { 
        'Accept': 'application/json',
        'Authorization': `Basic ${apiKey}`
    };
    
    definition.executionParameters.forEach((param) => {
        // Skip authorization parameter - it's now handled in headers
        if (param.name === 'authorization') {
            return;
        }
        
        const value = validatedArgs[param.name];
        if (typeof value !== 'undefined' && value !== null) {
            if (param.in === 'path') {
                urlPath = urlPath.replace(`{${param.name}}`, encodeURIComponent(String(value)));
            } else if (param.in === 'query') {
                queryParams[param.name] = value;
            } else if (param.in === 'header') {
                headers[param.name.toLowerCase()] = String(value);
            }
        }
    });

    if (urlPath.includes('{')) {
        throw new Error(`Failed to resolve path parameters: ${urlPath}`);
    }

    const requestUrl = `${SERVER_CONFIG.apiBaseUrl}${urlPath}`;
    const form = buildFormData(validatedArgs['requestBody']);
    
    return {
        method: definition.method.toUpperCase(),
        url: requestUrl,
        params: queryParams,
        headers: headers,
        data: form,
    };
}

function buildFormData(requestBodyData: unknown): FormData {
    const form = new FormData();
    
    if (requestBodyData) {
        Object.entries(requestBodyData).forEach(([key, value]) => {
            if (['image', 'pdf', 'video'].includes(key)) {
                const loadedFile = loadFileFromBase64(value, { 
                    fileType: key as FileType,
                    filename: `${key}_${Date.now()}`
                });
                form.append(key, loadedFile.buffer, { 
                    filename: loadedFile.filename, 
                    contentType: loadedFile.contentType 
                });
            } else if (['images', 'pdfs', 'videos'].includes(key)) {
                const files = Array.isArray(value) ? value : [value];
                files.forEach((file, index) => {
                    const fileType = key === 'images' ? 'image' : (key === 'pdfs' ? 'pdf' : 'video');
                    const loadedFile = loadFileFromBase64(file, { 
                        fileType: fileType as FileType,
                        filename: `${fileType}_${Date.now()}_${index}`
                    });
                    form.append(key, loadedFile.buffer, { 
                        filename: loadedFile.filename, 
                        contentType: loadedFile.contentType 
                    });
                });
            } else {
                if (Array.isArray(value)) {
                    if (value.every(item => item === null || (typeof item !== 'object' && typeof item !== 'function'))) {
                        value.forEach(item => form.append(key, item));
                    } else {
                        form.append(key, JSON.stringify(value));
                    }
                } else {
                    form.append(key, String(value));
                }
            }
        });
    }
    
    return form;
}

async function processResponse(response: any, definition: McpToolDefinition, toolArgs: JsonObject, context: any) {
    let responseText = formatResponseData(response);
    
    const responseContent = [];
    const imageResponseNames = ['text-to-object-detection', 'text-to-instance-segmentation', 'activity-recognition', 'depth-pro'];
    
    if (imageResponseNames.includes(definition.name)) {
        const visualization = await createVisualization(definition, response, toolArgs);

        if (context.outputDirectory) {
            if (visualization) {
                await Promise.allSettled(
                    visualization.map(async (item, i) => {
                        if (item.type === "image") {
                            const outputPath = path.join(context.outputDirectory, `output_${definition.name}_${Date.now()}_${i}.jpg`);
                            try {
                                await saveBase64Image(item.data, outputPath);
                                responseContent.push({
                                    type: "text",
                                    text: `API Image Response (Status: ${response.status}):\nImage successfully generated and saved to ${outputPath}`
                                });
                            } catch (error) {
                                console.error(`Failed to save image ${i}:`, error);
                                responseContent.push({
                                    type: "text",
                                    text: `API Image Response (Status: ${response.status}):\nImage generated but failed to save to ${outputPath}`
                                });
                            }
                        }
                    })
                );
            }
        }
        if (context.imageDisplayEnabled) {
            if (visualization) {
                responseContent.push(...visualization);
            }
        }
    } else {
        responseContent.push({
            type: "text",
            text: `API Text Response (Status: ${response.status}):\n${responseText}`
        } as TextContent);
    }
    
    return { content: responseContent };
}

function formatResponseData(response: any): string {
    const contentType = response.headers['content-type']?.toLowerCase() || '';
    
    if (contentType.includes('application/json') && typeof response.data === 'object' && response.data !== null) {
        try {
            return JSON.stringify(response.data, null, 2);
        } catch (e) {
            return "[Stringify Error]";
        }
    } else if (typeof response.data === 'string') {
        return response.data;
    } else if (response.data !== undefined && response.data !== null) {
        return String(response.data);
    } else {
        return `(Status: ${response.status} - No body content)`;
    }
}

function handleExecutionError(error: unknown, toolName: string) {
    const apiError = createApiError(error);
    const userMessage = formatErrorForUser(apiError);
    
    // Log detailed error information (sanitized)
    console.error(`Error during execution of tool '${toolName}':`, {
        code: apiError.code,
        message: apiError.message,
        status: apiError.status,
        details: apiError.details ? sanitizeForLogging(apiError.details) : undefined,
        toolName
    });
    
    return { 
        content: [{ 
            type: "text", 
            text: `Tool execution failed: ${userMessage}`
        }] 
    };
}