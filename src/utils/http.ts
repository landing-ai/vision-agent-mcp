import axios, { AxiosError } from 'axios';
import { HTTP_LIMITS } from '../constants.js';
import { ApiRequestError, VisionAgentError } from './errors.js';

export function formatApiError(error: AxiosError): string {
    let message = 'API request failed.';
    
    if (error.response) {
        message = `API Error: Status ${error.response.status} (${error.response.statusText || 'Status text not available'}). `;
        const responseData = error.response.data;
        
        if (typeof responseData === 'string') {
            message += `Response: ${responseData.substring(0, HTTP_LIMITS.MAX_RESPONSE_LOG_LENGTH)}${responseData.length > HTTP_LIMITS.MAX_RESPONSE_LOG_LENGTH ? '...' : ''}`;
        } else if (responseData) {
            try {
                const jsonString = JSON.stringify(responseData);
                message += `Response: ${jsonString.substring(0, HTTP_LIMITS.MAX_RESPONSE_LOG_LENGTH)}${jsonString.length > HTTP_LIMITS.MAX_RESPONSE_LOG_LENGTH ? '...' : ''}`;
            } catch {
                message += 'Response: [Could not serialize data]';
            }
        } else {
            message += 'No response body received.';
        }
    } else if (error.request) {
        message = 'API Network Error: No response received from server.';
        if (error.code) {
            message += ` (Code: ${error.code})`;
        }
    } else {
        message += `API Request Setup Error: ${error.message}`;
    }
    
    return message;
}

export function createAxiosError(error: AxiosError): ApiRequestError {
    const status = error.response?.status || 500;
    const message = formatApiError(error);
    
    return new ApiRequestError(message, status, {
        axiosError: true,
        code: error.code,
        url: error.config?.url,
        method: error.config?.method?.toUpperCase()
    });
}

export function sanitizeForLogging(data: unknown): string {
    if (typeof data === 'string') {
        // Remove potential sensitive information
        return data
            .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [REDACTED]')
            .replace(/Basic\s+[A-Za-z0-9+/=]+/g, 'Basic [REDACTED]')
            .replace(/"apiKey"\s*:\s*"[^"]+"/g, '"apiKey": "[REDACTED]"')
            .substring(0, HTTP_LIMITS.MAX_RESPONSE_LOG_LENGTH);
    }
    
    if (typeof data === 'object' && data !== null) {
        try {
            const sanitized = JSON.stringify(data, (key, value) => {
                if (typeof key === 'string' && 
                    (key.toLowerCase().includes('key') || 
                     key.toLowerCase().includes('token') || 
                     key.toLowerCase().includes('password') ||
                     key.toLowerCase().includes('secret'))) {
                    return '[REDACTED]';
                }
                return value;
            });
            return sanitized.substring(0, HTTP_LIMITS.MAX_RESPONSE_LOG_LENGTH);
        } catch {
            return '[Could not serialize object]';
        }
    }
    
    return String(data).substring(0, HTTP_LIMITS.MAX_RESPONSE_LOG_LENGTH);
}