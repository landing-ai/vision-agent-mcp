import path from 'path';
import axios, { AxiosRequestConfig } from 'axios';
import FormData from 'form-data';
import {
    CallToolRequest,
    Tool,
    TextContent
} from "@modelcontextprotocol/sdk/types.js";
import { toolDefinitionMap } from '../toolDefinitionMap.js';
import { McpToolDefinition, ToolArgs, JsonObject } from '../types.js';
import { getZodSchemaFromJsonSchema, validateToolArguments } from '../validation/schema.js';
import { processFileArgs, loadFileFromBase64 } from '../utils/file.js';
import { formatApiError } from '../utils/http.js';
import { saveBase64Image } from '../image/processing.js';
import { createVisualization } from './visualization.js';
import { SERVER_CONFIG, getEnvironmentConfig } from './config.js';

export async function handleListTools() {
    const toolsForClient: Tool[] = Array.from(toolDefinitionMap.values()).map(def => ({
        name: def.name,
        description: "Note: Any files passed to image, pdf, or video parameters must be absolute paths or uris, no relative paths. Here is what this tool does: " + def.description,
        inputSchema: typeof def.inputSchema === 'boolean' ? {} : def.inputSchema
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
    const config = getEnvironmentConfig();
    const enhancedArgs = { ...toolArgs, authorization: `Basic ${config.apiKey}` };
    const processedArgs = await processFileArgs(enhancedArgs);
    
    try {
        const validationResult = validateArguments(definition, processedArgs, toolName);
        if (!validationResult.success) {
            return { content: [{ type: 'text', text: validationResult.error }] };
        }

        const requestConfig = buildRequestConfig(definition, validationResult.data);
        console.error(`Executing tool "${toolName}": ${requestConfig.method} ${requestConfig.url}`);

        const response = await axios(requestConfig);
        return await processResponse(response, definition, processedArgs, config);
        
    } catch (error: unknown) {
        return handleExecutionError(error, toolName);
    }
}

function validateArguments(definition: McpToolDefinition, args: JsonObject, toolName: string) {
    const schema = typeof definition.inputSchema === 'boolean' ? {} : definition.inputSchema;
    const zodSchema = getZodSchemaFromJsonSchema(schema, toolName);
    return validateToolArguments(zodSchema, args, toolName);
}

function buildRequestConfig(definition: McpToolDefinition, validatedArgs: ToolArgs): AxiosRequestConfig {
    let urlPath = definition.pathTemplate;
    const queryParams: Record<string, unknown> = {};
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    
    definition.executionParameters.forEach((param) => {
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
                const loadedFile = loadFileFromBase64(value, { fileType: key });
                form.append(key, loadedFile.buffer, { 
                    filename: loadedFile.filename, 
                    contentType: loadedFile.contentType 
                });
            } else if (['images', 'pdfs', 'videos'].includes(key)) {
                const files = Array.isArray(value) ? value : [value];
                files.forEach(file => {
                    const fileType = key === 'images' ? 'image' : (key === 'pdfs' ? 'pdf' : 'video');
                    const loadedFile = loadFileFromBase64(file, { fileType });
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

async function processResponse(response: any, definition: McpToolDefinition, toolArgs: JsonObject, config: any) {
    let responseText = formatResponseData(response);
    
    const responseContent = [];
    const imageResponseNames = ['text-to-object-detection', 'text-to-instance-segmentation', 'activity-recognition', 'depth-pro'];
    
    if (imageResponseNames.includes(definition.name)) {
        const visualization = await createVisualization(definition, response, toolArgs);

        if (config.outputDirectory) {
            if (visualization) {
                visualization.forEach((item, i) => {
                    if (item.type === "image") {
                        const outputPath = path.join(config.outputDirectory, `output_${definition.name}_${Date.now()}.jpg`);
                        saveBase64Image(item.data, outputPath);
                        responseContent.push({
                            type: "text",
                            text: `API Image Response (Status: ${response.status}):\nImage successfully generated and saved to ${outputPath}`
                        });
                    }
                });
            }
        }
        if (config.imageDisplayEnabled) {
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
    let errorMessage: string;
    
    if (axios.isAxiosError(error)) {
        errorMessage = formatApiError(error);
    } else if (error instanceof Error) {
        errorMessage = error.message;
    } else {
        errorMessage = 'Unexpected error: ' + String(error);
    }
    
    console.error(`Error during execution of tool '${toolName}':`, errorMessage);
    return { content: [{ type: "text", text: errorMessage }] };
}