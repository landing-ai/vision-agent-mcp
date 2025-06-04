// Security and performance constants

export const FILE_LIMITS = {
    // Maximum file sizes in bytes
    MAX_IMAGE_SIZE: 50 * 1024 * 1024,  // 50MB
    MAX_VIDEO_SIZE: 500 * 1024 * 1024, // 500MB  
    MAX_PDF_SIZE: 100 * 1024 * 1024,   // 100MB
    MAX_GENERIC_SIZE: 10 * 1024 * 1024, // 10MB
    
    // Maximum number of files in arrays
    MAX_FILES_IN_ARRAY: 10,
    
    // Timeout for file downloads
    DOWNLOAD_TIMEOUT_MS: 30000, // 30 seconds
} as const;

export const HTTP_LIMITS = {
    // Maximum response length to log/return in error messages
    MAX_RESPONSE_LOG_LENGTH: 200,
    
    // Request timeout
    REQUEST_TIMEOUT_MS: 60000, // 60 seconds
} as const;

export const IMAGE_PROCESSING = {
    // Default image dimensions for processing
    DEFAULT_RESIZE_WIDTH: 512,
    DEFAULT_RESIZE_HEIGHT: 512,
    
    // Maximum dimensions to prevent memory issues
    MAX_IMAGE_WIDTH: 4096,
    MAX_IMAGE_HEIGHT: 4096,
} as const;

export const VALIDATION = {
    // Minimum string length for certain validations
    MIN_STRING_LENGTH_THRESHOLD: 1000,
} as const;

export const ALLOWED_FILE_TYPES = {
    IMAGE: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.tiff'],
    VIDEO: ['.mp4', '.mov', '.avi', '.wmv', '.flv', '.mkv', '.webm'],
    PDF: ['.pdf'],
} as const;

export const CONTENT_TYPES = {
    IMAGE_JPEG: 'image/jpeg',
    IMAGE_PNG: 'image/png', 
    IMAGE_GIF: 'image/gif',
    IMAGE_WEBP: 'image/webp',
    VIDEO_MP4: 'video/mp4',
    APPLICATION_PDF: 'application/pdf',
    APPLICATION_OCTET_STREAM: 'application/octet-stream',
} as const;