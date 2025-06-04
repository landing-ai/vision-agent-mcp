import fs from 'fs';
import os from 'os';
import path from 'path';
import axios from 'axios';
import sharp from 'sharp';
import { FileType, LoadFileOptions, JsonObject, LoadedFile } from '../types.js';
import { FILE_LIMITS, ALLOWED_FILE_TYPES, CONTENT_TYPES } from '../constants.js';

export function detectFileType(input: string): FileType {
    const lowerInput = input.toLowerCase();
    const extension = path.extname(lowerInput);
    
    if (extension === '.pdf') {
        return 'pdf';
    } else if (['.mp4', '.mov', '.avi', '.wmv', '.flv', '.mkv', '.webm'].includes(extension)) {
        return 'video';
    } else if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.tiff'].includes(extension)) {
        return 'image';
    } else {
        return 'binary';
    }
}

export function validateFileSize(buffer: Buffer, fileType: FileType): void {
    const size = buffer.length;
    let maxSize: number;
    
    switch (fileType) {
        case 'image':
            maxSize = FILE_LIMITS.MAX_IMAGE_SIZE;
            break;
        case 'video':
            maxSize = FILE_LIMITS.MAX_VIDEO_SIZE;
            break;
        case 'pdf':
            maxSize = FILE_LIMITS.MAX_PDF_SIZE;
            break;
        default:
            maxSize = FILE_LIMITS.MAX_GENERIC_SIZE;
    }
    
    if (size > maxSize) {
        throw new Error(
            `File size ${(size / (1024 * 1024)).toFixed(2)}MB exceeds maximum allowed size of ${(maxSize / (1024 * 1024)).toFixed(2)}MB for ${fileType} files`
        );
    }
}

export function validateFileType(input: string, expectedType?: FileType): void {
    const detectedType = detectFileType(input);
    
    if (expectedType && detectedType !== expectedType && detectedType !== 'binary') {
        throw new Error(`File type mismatch: expected ${expectedType}, but detected ${detectedType} from file: ${input}`);
    }
    
    const extension = path.extname(input.toLowerCase());
    const allExtensions = [
        ...ALLOWED_FILE_TYPES.PDF,
        ...ALLOWED_FILE_TYPES.VIDEO,
        ...ALLOWED_FILE_TYPES.IMAGE
    ];
    
    if (!allExtensions.includes(extension as any) && detectedType !== 'binary') {
        throw new Error(`Unsupported file type: ${extension}. File: ${input}`);
    }
}

export async function fileToBase64(input: string, options: LoadFileOptions = {}): Promise<string> {
    try {
        // Validate file type before processing
        const fileType = options.fileType || detectFileType(input);
        validateFileType(input, fileType);
        
        let buffer: Buffer;
        
        if (input.startsWith('http://') || input.startsWith('https://')) {
            const response = await axios.get(input, { 
                responseType: 'arraybuffer',
                timeout: FILE_LIMITS.DOWNLOAD_TIMEOUT_MS,
                maxContentLength: getMaxSizeForFileType(fileType)
            });
            buffer = Buffer.from(response.data, 'binary');
        } else {
            // Validate file exists and is readable
            await fs.promises.access(input, fs.constants.R_OK);
            buffer = await fs.promises.readFile(input);
        }
        
        // Validate file size
        validateFileSize(buffer, fileType);
        
        switch (fileType) {
            case 'image':
                const processedImage = await sharp(buffer)
                    .removeAlpha()
                    .resize({ 
                        width: options.sharpOptions?.formatOptions?.width as number || undefined,
                        height: options.sharpOptions?.formatOptions?.height as number || undefined,
                        fit: 'inside',
                        withoutEnlargement: true
                    })
                    .toFormat('png')
                    .toBuffer();
                return processedImage.toString('base64');
            default:
                return buffer.toString('base64');
        }
    } catch (err) {
        if (err instanceof Error) {
            throw new Error(`Failed to process file '${input}': ${err.message}`);
        } else {
            throw new Error(`Failed to process file '${input}': Unknown error`);
        }
    }
}

function getMaxSizeForFileType(fileType: FileType): number {
    switch (fileType) {
        case 'image':
            return FILE_LIMITS.MAX_IMAGE_SIZE;
        case 'video':
            return FILE_LIMITS.MAX_VIDEO_SIZE;
        case 'pdf':
            return FILE_LIMITS.MAX_PDF_SIZE;
        default:
            return FILE_LIMITS.MAX_GENERIC_SIZE;
    }
}

export function loadFileFromBase64(
    base64String: string, 
    options: LoadFileOptions
): LoadedFile {
    if (!base64String || typeof base64String !== 'string') {
        throw new Error('Invalid base64 string provided');
    }
    
    const base64Data = base64String.replace(/^data:([^;]+);base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Validate file size
    if (options.fileType) {
        validateFileSize(buffer, options.fileType);
    }
    
    let contentType = options.contentType;
    if (!contentType) {
        contentType = detectContentTypeFromBase64(base64Data, options.fileType);
    }

    let filename = options.filename || 'file';
    if (!filename.includes('.')) {
        const extension = getExtensionFromContentType(contentType);
        filename = `${filename}.${extension}`;
    }

    return {
        buffer,
        filename,
        contentType,
        originalSize: buffer.length
    };
}

function detectContentTypeFromBase64(base64Data: string, fileType?: FileType): string {
    if (fileType === 'image') {
        if (base64Data.startsWith('/9j/')) return CONTENT_TYPES.IMAGE_JPEG;
        if (base64Data.startsWith('iVBORw0KGgo')) return CONTENT_TYPES.IMAGE_PNG;
        if (base64Data.startsWith('R0lGOD')) return CONTENT_TYPES.IMAGE_GIF;
        if (base64Data.startsWith('UklGR')) return CONTENT_TYPES.IMAGE_WEBP;
        return CONTENT_TYPES.IMAGE_JPEG; // default for images
    } else if (fileType === 'video') {
        return CONTENT_TYPES.VIDEO_MP4;
    } else if (fileType === 'pdf') {
        return CONTENT_TYPES.APPLICATION_PDF;
    }
    return CONTENT_TYPES.APPLICATION_OCTET_STREAM;
}

function getExtensionFromContentType(contentType: string): string {
    switch (contentType) {
        case CONTENT_TYPES.IMAGE_JPEG:
            return 'jpg';
        case CONTENT_TYPES.IMAGE_PNG:
            return 'png';
        case CONTENT_TYPES.IMAGE_GIF:
            return 'gif';
        case CONTENT_TYPES.IMAGE_WEBP:
            return 'webp';
        case CONTENT_TYPES.VIDEO_MP4:
            return 'mp4';
        case CONTENT_TYPES.APPLICATION_PDF:
            return 'pdf';
        default:
            return 'bin';
    }
}
export async function processFileArgs(toolArgs: JsonObject): Promise<JsonObject> {
    const fileTypeMap = {
        'images': 'image',
        'pdfs': 'pdf',
        'videos': 'video'
    } as const;
    
    const allFileTypes = ['image', 'video', 'pdf', 'images', 'pdfs', 'videos'] as const;
    
    if (!toolArgs['requestBody'] || typeof toolArgs['requestBody'] !== 'object') {
        return toolArgs;
    }
    
    // Track temporary files for cleanup
    const tempFiles: string[] = [];
    
    try {
        for (const fileType of allFileTypes) {
            if (fileType in toolArgs['requestBody']) {
                const isSingular = ['image', 'video', 'pdf'].includes(fileType);
                const isPluralArray = Array.isArray(toolArgs['requestBody'][fileType]);
                
                if (isSingular || !isPluralArray) {
                    let url = toolArgs['requestBody'][fileType] as string;
                    if (url?.startsWith('@')) {
                        url = url.slice(1);
                    }
                    
                    // Handle remote URLs
                    if (url?.startsWith('http://') || url?.startsWith('https://')) {
                        url = await downloadToTemp(url, fileType);
                        tempFiles.push(url);
                    }
                    
                    if (url) {
                        const normalizedPath = path.normalize(url);
                        if (!path.isAbsolute(normalizedPath)) {
                            throw new Error(`Please provide a global (absolute) file path instead of a local one for ${fileType}.`);
                        }
                        
                        const conversionFileType = isSingular ? fileType as FileType : fileTypeMap[fileType as keyof typeof fileTypeMap];
                        const fileBase64 = await fileToBase64(url, { fileType: conversionFileType });
                        toolArgs['requestBody'][fileType] = fileBase64;
                    }
                } else if (isPluralArray) {
                    const files = toolArgs['requestBody'][fileType] as string[];
                    
                    // Validate array size
                    if (files.length > FILE_LIMITS.MAX_FILES_IN_ARRAY) {
                        throw new Error(`Too many files in ${fileType} array. Maximum allowed: ${FILE_LIMITS.MAX_FILES_IN_ARRAY}, provided: ${files.length}`);
                    }
                    
                    const conversionFileType = fileTypeMap[fileType as keyof typeof fileTypeMap];
                    const processedFiles: string[] = [];
                    
                    for (let i = 0; i < files.length; i++) {
                        let url = files[i];
                        if (url?.startsWith('@')) {
                            url = url.slice(1);
                        }
                        
                        // Handle remote URLs
                        if (url?.startsWith('http://') || url?.startsWith('https://')) {
                            url = await downloadToTemp(url, fileType);
                            tempFiles.push(url);
                        }
                        
                        if (url) {
                            const normalizedPath = path.normalize(url);
                            if (!path.isAbsolute(normalizedPath)) {
                                throw new Error(`Please provide a global (absolute) file path instead of a local one for ${fileType}[${i}].`);
                            }
                            
                            const fileBase64 = await fileToBase64(url, { fileType: conversionFileType as FileType });
                            processedFiles.push(fileBase64);
                        }
                    }
                    
                    toolArgs['requestBody'][fileType] = processedFiles;
                }
            }
        }
        
        return toolArgs;
    } finally {
        // Clean up temporary files
        await Promise.allSettled(
            tempFiles.map(async (tempFile) => {
                try {
                    await fs.promises.unlink(tempFile);
                } catch (error) {
                    console.warn(`Failed to cleanup temporary file: ${tempFile}`, error);
                }
            })
        );
    }
}

async function downloadToTemp(url: string, fileType: string): Promise<string> {
    try {
        const response = await fetch(url, {
            signal: AbortSignal.timeout(FILE_LIMITS.DOWNLOAD_TIMEOUT_MS)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
            const size = parseInt(contentLength, 10);
            const detectedFileType = detectFileType(url);
            const maxSize = getMaxSizeForFileType(detectedFileType);
            
            if (size > maxSize) {
                throw new Error(`Download size ${(size / (1024 * 1024)).toFixed(2)}MB exceeds limit for ${detectedFileType} files`);
            }
        }
        
        const buffer = await response.arrayBuffer();
        validateFileSize(Buffer.from(buffer), detectFileType(url));
        
        const ext = getFileExtension(fileType);
        const tempPath = path.join(os.tmpdir(), `vision_agent_temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`);
        
        await fs.promises.writeFile(tempPath, Buffer.from(buffer));
        return tempPath;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to download ${url}: ${error.message}`);
        }
        throw new Error(`Failed to download ${url}: Unknown error`);
    }
}

function getFileExtension(fileType: string): string {
    switch (fileType) {
        case 'pdf':
        case 'pdfs':
            return '.pdf';
        case 'image':
        case 'images':
            return '.jpg';
        case 'video':
        case 'videos':
            return '.mp4';
        default:
            return '.bin';
    }
}