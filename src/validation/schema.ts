import { z, ZodError } from 'zod';

export function getZodSchemaFromJsonSchema(
    jsonSchema: Record<string, unknown>, 
    toolName: string
): z.ZodTypeAny {
    if (typeof jsonSchema !== 'object' || jsonSchema === null) {
        return z.object({}).passthrough();
    }

    try {
        // Safe conversion without eval() - build Zod schema directly from JSON schema
        return buildZodSchemaFromJson(jsonSchema);
    } catch (err: unknown) {
        console.error(`Failed to generate Zod schema for '${toolName}':`, err);
        return z.object({}).passthrough();
    }
}

function buildZodSchemaFromJson(schema: Record<string, unknown>): z.ZodTypeAny {
    const type = schema.type as string;
    
    switch (type) {
        case 'string':
            return buildStringSchema(schema);
        case 'number':
        case 'integer':
            return buildNumberSchema(schema);
        case 'boolean':
            return z.boolean();
        case 'array':
            return buildArraySchema(schema);
        case 'object':
            return buildObjectSchema(schema);
        default:
            // If no type is specified or unknown type, be permissive but safe
            return z.unknown();
    }
}

function buildStringSchema(schema: Record<string, unknown>): z.ZodString {
    let stringSchema = z.string();
    
    if (typeof schema.minLength === 'number') {
        stringSchema = stringSchema.min(schema.minLength);
    }
    if (typeof schema.maxLength === 'number') {
        stringSchema = stringSchema.max(schema.maxLength);
    }
    if (typeof schema.pattern === 'string') {
        try {
            stringSchema = stringSchema.regex(new RegExp(schema.pattern));
        } catch {
            // Invalid regex pattern, ignore
        }
    }
    
    return stringSchema;
}

function buildNumberSchema(schema: Record<string, unknown>): z.ZodNumber {
    let numberSchema = z.number();
    
    if (typeof schema.minimum === 'number') {
        numberSchema = numberSchema.min(schema.minimum);
    }
    if (typeof schema.maximum === 'number') {
        numberSchema = numberSchema.max(schema.maximum);
    }
    
    return numberSchema;
}

function buildArraySchema(schema: Record<string, unknown>): z.ZodArray<any> {
    const items = schema.items as Record<string, unknown> | undefined;
    if (items && typeof items === 'object') {
        const itemSchema = buildZodSchemaFromJson(items);
        return z.array(itemSchema);
    }
    return z.array(z.unknown());
}

function buildObjectSchema(schema: Record<string, unknown>): z.ZodObject<any> {
    const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
    const required = schema.required as string[] | undefined;
    
    if (!properties || typeof properties !== 'object') {
        return z.object({}).passthrough();
    }
    
    const zodProperties: Record<string, z.ZodTypeAny> = {};
    
    for (const [key, propSchema] of Object.entries(properties)) {
        if (typeof propSchema === 'object' && propSchema !== null) {
            let propZodSchema = buildZodSchemaFromJson(propSchema);
            
            // Make optional if not in required array
            if (!required?.includes(key)) {
                propZodSchema = propZodSchema.optional();
            }
            
            zodProperties[key] = propZodSchema;
        }
    }
    
    return z.object(zodProperties).passthrough();
}

export function validateToolArguments(
    schema: z.ZodTypeAny, 
    args: unknown, 
    toolName: string
): { success: true; data: any } | { success: false; error: string } {
    try {
        const argsToParse = (typeof args === 'object' && args !== null) ? args : {};
        const validatedArgs = schema.parse(argsToParse);
        return { success: true, data: validatedArgs };
    } catch (error) {
        if (error instanceof ZodError) {
            const errorMessage = `Invalid arguments for tool '${toolName}': ${
                error.errors.map(e => `${e.path.join('.')} (${e.code}): ${e.message}`).join(', ')
            }`;
            return { success: false, error: errorMessage };
        } else {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return { success: false, error: `Internal error during validation setup: ${errorMessage}` };
        }
    }
}