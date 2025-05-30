import { z, ZodError } from 'zod';
import { jsonSchemaToZod } from 'json-schema-to-zod';

export function getZodSchemaFromJsonSchema(
    jsonSchema: Record<string, unknown>, 
    toolName: string
): z.ZodTypeAny {
    if (typeof jsonSchema !== 'object' || jsonSchema === null) {
        return z.object({}).passthrough();
    }

    try {
        const zodSchemaString: string = jsonSchemaToZod(jsonSchema);
        const zodSchema: z.ZodTypeAny = eval(zodSchemaString);
        
        if (typeof zodSchema?.parse !== 'function') {
            throw new Error('Eval did not produce a valid Zod schema.');
        }
        
        return zodSchema;
    } catch (err: unknown) {
        console.error(`Failed to generate/evaluate Zod schema for '${toolName}':`, err);
        return z.object({}).passthrough();
    }
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