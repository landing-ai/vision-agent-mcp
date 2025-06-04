import { ApiError, ValidationResult } from '../types.js';

export class VisionAgentError extends Error {
    public readonly code: string;
    public readonly status?: number;
    public readonly details?: Record<string, unknown>;

    constructor(message: string, code: string, status?: number, details?: Record<string, unknown>) {
        super(message);
        this.name = 'VisionAgentError';
        this.code = code;
        this.status = status;
        this.details = details;
    }
}

export class ValidationError extends VisionAgentError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'VALIDATION_ERROR', 400, details);
        this.name = 'ValidationError';
    }
}

export class FileProcessingError extends VisionAgentError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'FILE_PROCESSING_ERROR', 400, details);
        this.name = 'FileProcessingError';
    }
}

export class ApiRequestError extends VisionAgentError {
    constructor(message: string, status: number, details?: Record<string, unknown>) {
        super(message, 'API_REQUEST_ERROR', status, details);
        this.name = 'ApiRequestError';
    }
}

export class ConfigurationError extends VisionAgentError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'CONFIGURATION_ERROR', 500, details);
        this.name = 'ConfigurationError';
    }
}

export function createApiError(error: unknown): ApiError {
    if (error instanceof VisionAgentError) {
        return {
            code: error.code,
            message: error.message,
            status: error.status,
            details: error.details
        };
    }
    
    if (error instanceof Error) {
        return {
            code: 'UNKNOWN_ERROR',
            message: error.message,
            status: 500
        };
    }
    
    return {
        code: 'UNKNOWN_ERROR',
        message: 'An unknown error occurred',
        status: 500,
        details: { originalError: error }
    };
}

export function createValidationResult<T>(success: true, data: T): ValidationResult<T>;
export function createValidationResult<T>(success: false, error: string): ValidationResult<T>;
export function createValidationResult<T>(success: boolean, dataOrError: T | string): ValidationResult<T> {
    if (success) {
        return { success: true, data: dataOrError as T };
    } else {
        return { success: false, error: dataOrError as string };
    }
}

export function isAxiosError(error: unknown): error is { isAxiosError: true; response?: { status: number; data: unknown } } {
    return typeof error === 'object' && error !== null && 'isAxiosError' in error && error.isAxiosError === true;
}

export function formatErrorForUser(error: ApiError): string {
    let message = `Error ${error.code}`;
    if (error.status) {
        message += ` (${error.status})`;
    }
    message += `: ${error.message}`;
    
    if (error.details && Object.keys(error.details).length > 0) {
        const detailsStr = Object.entries(error.details)
            .map(([key, value]) => `${key}: ${String(value)}`)
            .join(', ');
        message += ` (${detailsStr})`;
    }
    
    return message;
}