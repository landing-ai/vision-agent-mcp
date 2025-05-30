import SwaggerParser from '@apidevtools/swagger-parser';
import { OpenAPIV3 } from 'openapi-types';
import type { JSONSchema7, JSONSchema7TypeName } from 'json-schema';
import { McpToolDefinition } from './types.js';

export async function getToolsFromOpenApi(specPathOrUrl: string): Promise<McpToolDefinition[]> {
    try {
        const api = await SwaggerParser.dereference(specPathOrUrl) as OpenAPIV3.Document;
        let allTools = extractToolsFromApi(api);
        allTools.forEach(obj => obj.name = obj.pathTemplate.split('/').pop() || '');

        const baseUrl = determineBaseUrl(api);
        
        return allTools.map(tool => ({
            ...tool,
            baseUrl: baseUrl || undefined,
        }));
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to extract tools from OpenAPI: ${error.message}`);
        }
        throw error;
    }
}

function extractToolsFromApi(api: OpenAPIV3.Document): McpToolDefinition[] {
    const tools: McpToolDefinition[] = [];
    const globalSecurity = api.security || [];

    if (!api.paths) return tools;

    for (const [path, pathItem] of Object.entries(api.paths)) {
        if (!pathItem) continue;

        for (const method of Object.values(OpenAPIV3.HttpMethods)) {
            const operation = pathItem[method];
            if (!operation) continue;

            const description = operation.description || operation.summary || `Executes ${method.toUpperCase()} ${path}`;
            const { inputSchema, parameters, requestBodyContentType } = generateInputSchemaAndDetails(operation);
            const executionParameters = parameters.map((p) => ({ name: p.name, in: p.in }));
            const securityRequirements = operation.security === null ? globalSecurity : operation.security || globalSecurity;

            tools.push({
                name: (typeof operation.operationId === 'string') ? operation.operationId : 'Unknown',
                description,
                inputSchema,
                method,
                pathTemplate: path,
                parameters,
                executionParameters,
                requestBodyContentType,
                securityRequirements,
            });
        }
    }

    return tools;
}

function generateInputSchemaAndDetails(operation: OpenAPIV3.OperationObject): {
    inputSchema: JSONSchema7 | boolean;
    parameters: OpenAPIV3.ParameterObject[];
    requestBodyContentType?: string;
} {
    const properties: { [key: string]: JSONSchema7 | boolean } = {};
    const required: string[] = [];

    const allParameters: OpenAPIV3.ParameterObject[] = Array.isArray(operation.parameters)
        ? operation.parameters.map((p) => p as OpenAPIV3.ParameterObject)
        : [];

    allParameters.forEach((param) => {
        if (!param.name || !param.schema) return;

        const paramSchema = mapOpenApiSchemaToJsonSchema(param.schema as OpenAPIV3.SchemaObject);
        if (typeof paramSchema === 'object') {
            paramSchema.description = param.description || paramSchema.description;
        }

        properties[param.name] = paramSchema;
        if (param.required) required.push(param.name);
    });

    let requestBodyContentType: string | undefined = undefined;

    if (operation.requestBody) {
        const opRequestBody = operation.requestBody as OpenAPIV3.RequestBodyObject;
        const contentEntries = Object.entries(opRequestBody.content || {});
        
        if (contentEntries.length > 0) {
            const [contentType, mediaTypeObject] = contentEntries[0];
            requestBodyContentType = contentType;

            if (mediaTypeObject?.schema) {
                const bodySchema = mapOpenApiSchemaToJsonSchema(mediaTypeObject.schema as OpenAPIV3.SchemaObject);

                if (typeof bodySchema === 'object') {
                    bodySchema.description = opRequestBody.description || bodySchema.description || `Request body (content type: ${contentType})`;
                }

                properties['requestBody'] = bodySchema;
            } else {
                properties['requestBody'] = {
                    type: 'string',
                    description: opRequestBody.description || `Request body (content type: ${contentType})`,
                };
            }

            if (opRequestBody.required) required.push('requestBody');
        }
    }

    const inputSchema: JSONSchema7 = {
        type: 'object',
        properties,
        ...(required.length > 0 && { required }),
    };

    return { inputSchema, parameters: allParameters, requestBodyContentType };
}

function mapOpenApiSchemaToJsonSchema(
    schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject
): JSONSchema7 | boolean {
    if ('$ref' in schema) {
        console.warn(`Unresolved $ref '${schema.$ref}'.`);
        return { type: 'object' };
    }

    if (typeof schema === 'boolean') return schema;

    const jsonSchema: JSONSchema7 = { ...schema } as any;

    if (schema.type === 'integer') jsonSchema.type = 'number';

    delete (jsonSchema as any).nullable;
    delete (jsonSchema as any).example;
    delete (jsonSchema as any).xml;
    delete (jsonSchema as any).externalDocs;
    delete (jsonSchema as any).deprecated;
    delete (jsonSchema as any).readOnly;
    delete (jsonSchema as any).writeOnly;

    if (schema.nullable) {
        if (Array.isArray(jsonSchema.type)) {
            if (!jsonSchema.type.includes('null')) jsonSchema.type.push('null');
        } else if (typeof jsonSchema.type === 'string') {
            jsonSchema.type = [jsonSchema.type as JSONSchema7TypeName, 'null'];
        } else if (!jsonSchema.type) {
            jsonSchema.type = 'null';
        }
    }

    if (jsonSchema.type === 'object' && jsonSchema.properties) {
        const mappedProps: { [key: string]: JSONSchema7 | boolean } = {};

        for (const [key, propSchema] of Object.entries(jsonSchema.properties)) {
            if (typeof propSchema === 'object' && propSchema !== null) {
                mappedProps[key] = mapOpenApiSchemaToJsonSchema(propSchema as OpenAPIV3.SchemaObject);
            } else if (typeof propSchema === 'boolean') {
                mappedProps[key] = propSchema;
            }
        }

        jsonSchema.properties = mappedProps;
    }

    if (jsonSchema.type === 'array' && typeof jsonSchema.items === 'object' && jsonSchema.items !== null) {
        jsonSchema.items = mapOpenApiSchemaToJsonSchema(
            jsonSchema.items as OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject
        );
    }

    return jsonSchema;
}

function determineBaseUrl(api: OpenAPIV3.Document, cmdLineBaseUrl?: string): string | null {
    if (cmdLineBaseUrl) {
        return normalizeUrl(cmdLineBaseUrl);
    }

    if (api.servers && api.servers.length === 1 && api.servers[0].url) {
        return normalizeUrl(api.servers[0].url);
    }

    if (api.servers && api.servers.length > 1) {
        console.warn(
            `Multiple servers found. Using first: "${api.servers[0].url}". Use --base-url to override.`
        );
        return normalizeUrl(api.servers[0].url);
    }

    return null;
}

function normalizeUrl(url: string): string {
    return url.replace(/\/$/, '');
}