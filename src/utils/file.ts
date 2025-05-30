import fs from 'fs';
import path from 'path';
import axios from 'axios';
import sharp from 'sharp';
import { FileType, LoadFileOptions, JsonObject } from '../types.js';

export function detectFileType(input: string): FileType {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.endsWith('.pdf')) {
        return 'pdf';
    } else if (/\.(mp4|mov|avi|wmv|flv|mkv|webm)$/.test(lowerInput)) {
        return 'video';
    } else if (/\.(jpg|jpeg|png|gif|bmp|webp|svg|tiff)$/.test(lowerInput)) {
        return 'image';
    } else {
        return 'binary';
    }
}

export async function fileToBase64(input: string, options: LoadFileOptions = {}): Promise<string> {
    try {
        let buffer: Buffer;
        const fileType = options.fileType || detectFileType(input);
        
        if (input.startsWith('http://') || input.startsWith('https://')) {
            const response = await axios.get(input, { responseType: 'arraybuffer' });
            buffer = Buffer.from(response.data, 'binary');
        } else {
            buffer = await fs.promises.readFile(input);
        }
        
        switch (fileType) {
            case 'image':
                const processedImage = await sharp(buffer).removeAlpha().toFormat('png').toBuffer();
                return processedImage.toString('base64');
            default:
                return buffer.toString('base64');
        }
    } catch (err) {
        if (err instanceof Error) {
            throw new Error(`Failed to process file: ${err.message}`);
        } else {
            throw new Error('Failed to process file: Unknown error');
        }
    }
}

export function loadFileFromBase64(
    base64String: string, 
    { fileType, filename = 'file', contentType = null }: any
) {
    const base64Data = base64String.replace(/^data:([^;]+);base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    if (!contentType) {
        switch (fileType) {
            case 'image':
                contentType = 'image/jpeg';
                if (base64Data.startsWith('/9j/')) contentType = 'image/jpeg';
                else if (base64Data.startsWith('iVBORw0KGgo')) contentType = 'image/png';
                else if (base64Data.startsWith('R0lGOD')) contentType = 'image/gif';
                else if (base64Data.startsWith('UklGR')) contentType = 'image/webp';
                break;
            case 'video':
                contentType = 'video/mp4';
                break;
            case 'pdf':
                contentType = 'application/pdf';
                break;
            default:
                contentType = 'application/octet-stream';
        }
    }

    if (!filename.includes('.')) {
        const extension = contentType.split('/')[1];
        filename = `${filename}.${extension}`;
    }

    return {
        buffer,
        filename,
        contentType
    };
}

export async function processFileArgs(toolArgs: JsonObject): Promise<JsonObject> {
    const fileTypeMap = {
        'images': 'image',
        'pdfs': 'pdf',
        'videos': 'video'
    };
    
    const allFileTypes = ['image', 'video', 'pdf', 'images', 'pdfs', 'videos'];
    
    for (const fileType of allFileTypes) {
        if (fileType in toolArgs['requestBody']) {
            const isSingular = ['image', 'video', 'pdf'].includes(fileType);
            const isPluralArray = Array.isArray(toolArgs['requestBody'][fileType]);
            
            if (isSingular || !isPluralArray) {
                let url = toolArgs['requestBody'][fileType];
                if (url.startsWith('@')) {
                    url = url.slice(1);
                }
                const normalizedPath = path.normalize(url);
                if (!path.isAbsolute(normalizedPath)) {
                    throw new Error(`Please provide a global (absolute) file path instead of a local one for ${fileType}.`);
                }
                
                const conversionFileType = isSingular ? fileType : fileTypeMap[fileType as keyof typeof fileTypeMap];
                const fileBase64 = await fileToBase64(url, { fileType: conversionFileType });
                toolArgs['requestBody'][fileType] = fileBase64;
            } else if (isPluralArray) {
                const conversionFileType = fileTypeMap[fileType as keyof typeof fileTypeMap];
                const processedFiles = [];
                
                for (let i = 0; i < toolArgs['requestBody'][fileType].length; i++) {
                    let url = toolArgs['requestBody'][fileType][i];
                    if (url.startsWith('@')) {
                        url = url.slice(1);
                    }
                    const normalizedPath = path.normalize(url);
                    if (!path.isAbsolute(normalizedPath)) {
                        throw new Error(`Please provide a global (absolute) file path instead of a local one for ${fileType}[${i}].`);
                    }
                    
                    const fileBase64 = await fileToBase64(url, { fileType: conversionFileType });
                    processedFiles.push(fileBase64);
                }
                
                toolArgs['requestBody'][fileType] = processedFiles;
            }
        }
    }
    
    return toolArgs;
}