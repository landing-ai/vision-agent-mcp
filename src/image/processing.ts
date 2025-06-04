import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';
import { VALIDATION, IMAGE_PROCESSING } from '../constants.js';

export function isValidBase64(str: string): boolean {
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(str)) {
        return false;
    }
    
    if (str.length % 4 !== 0 || str.length < VALIDATION.MIN_STRING_LENGTH_THRESHOLD) {
        return false;
    }
    
    try {
        const decoded = Buffer.from(str, 'base64');
        const reEncoded = decoded.toString('base64');
        const normalizedInput = str.replace(/=+$/, '');
        const normalizedOutput = reEncoded.replace(/=+$/, '');
        
        return normalizedInput === normalizedOutput;
    } catch (e) {
        return false;
    }
}

export async function saveBase64Image(base64Data: string, filePath: string): Promise<void> {
    try {
        if (base64Data === undefined || !isValidBase64(base64Data)) {
            throw new Error('Invalid base64 string')
        }
        
        const imageBuffer = Buffer.from(base64Data, 'base64');

        if (!filePath.includes('/dev/null')) {
            await fs.promises.writeFile(filePath, imageBuffer);
        }
    } catch (error: unknown) {
        console.error("Error saving base64 image:", error);
        throw error; // Re-throw to allow caller to handle
    }
}

export async function resizeBase64Image(base64Image: string): Promise<string> {
    const imageBuffer = Buffer.from(base64Image, 'base64');
    const resizedBuffer = await sharp(imageBuffer)
        .resize(IMAGE_PROCESSING.DEFAULT_RESIZE_WIDTH, IMAGE_PROCESSING.DEFAULT_RESIZE_HEIGHT)
        .toBuffer();
    return resizedBuffer.toString('base64');
}

export async function extractFrameAtTime(base64Video: string, timeInSeconds: number): Promise<string> {
    const videoBuffer = Buffer.from(base64Video, 'base64');
    const tempVideoPath = `/tmp/vision_agent_temp_video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`;
    const tempImagePath = `/tmp/vision_agent_temp_frame_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
    
    try {
        await fs.promises.writeFile(tempVideoPath, videoBuffer);
        
        return new Promise((resolve, reject) => {
            ffmpeg(tempVideoPath)
                .seekInput(timeInSeconds)
                .frames(1)
                .output(tempImagePath)
                .on('end', async () => {
                    try {
                        const imageBuffer = await fs.promises.readFile(tempImagePath);
                        resolve(imageBuffer.toString('base64'));
                    } catch (error) {
                        reject(error);
                    } finally {
                        // Cleanup files
                        await Promise.allSettled([
                            fs.promises.unlink(tempVideoPath).catch(() => {}),
                            fs.promises.unlink(tempImagePath).catch(() => {})
                        ]);
                    }
                })
                .on('error', async (error) => {
                    // Cleanup files on error
                    await Promise.allSettled([
                        fs.promises.unlink(tempVideoPath).catch(() => {}),
                        fs.promises.unlink(tempImagePath).catch(() => {})
                    ]);
                    reject(error);
                })
                .run();
        });
    } catch (error) {
        // Cleanup video file if write failed
        await fs.promises.unlink(tempVideoPath).catch(() => {});
        throw error;
    }
}

export async function numpyBase64ToImage(
    base64Array: string, 
    width: number, 
    height: number
): Promise<string> {
    const buffer = Buffer.from(base64Array, 'base64');
    const floatArray = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
    const uint8Array = Uint8Array.from(floatArray.map(v => Math.max(0, Math.min(255, v))));
    const pixelBuffer = Buffer.from(uint8Array);
    const expectedSize = width * height;

    if (pixelBuffer.length !== expectedSize) {
        throw new Error(`Buffer size mismatch: expected ${expectedSize} bytes, got ${pixelBuffer.length} bytes`);
    }

    const imageBuffer = await sharp(pixelBuffer, {
        raw: {
            width,
            height,
            channels: 1
        }
    })
    .png()
    .toBuffer();

    return imageBuffer.toString('base64');
}