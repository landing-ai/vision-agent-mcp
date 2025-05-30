import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';

export function isValidBase64(str: string): boolean {
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(str)) {
        return false;
    }
    
    if (str.length % 4 !== 0 || str.length < 1000) {
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

export function saveBase64Image(jsonString: string, filePath: string): boolean {
    try {
        const parsedObject = JSON.parse(jsonString);
        const base64Data: string = parsedObject.data[0];
        
        if (base64Data === undefined || !isValidBase64(base64Data)) {
            return false;
        }
        
        const imageBuffer = Buffer.from(base64Data, 'base64');
        if (!filePath.includes('/dev/null')) {
            fs.writeFileSync(filePath, imageBuffer);
        }
        return true;
    } catch (error: unknown) {
        console.error("Error saving base64 image:", error);
        return false;
    }
}

export async function resizeBase64Image(base64Image: string): Promise<string> {
    const imageBuffer = Buffer.from(base64Image, 'base64');
    const resizedBuffer = await sharp(imageBuffer)
        .resize(512, 512)
        .toBuffer();
    return resizedBuffer.toString('base64');
}

export async function extractFrameAtTime(base64Video: string, timeInSeconds: number): Promise<string> {
    const videoBuffer = Buffer.from(base64Video, 'base64');
    const tempVideoPath = `/tmp/temp_video_${Date.now()}.mp4`;
    const tempImagePath = `/tmp/temp_frame_${Date.now()}.jpg`;
    
    fs.writeFileSync(tempVideoPath, videoBuffer);
    
    return new Promise((resolve, reject) => {
        ffmpeg(tempVideoPath)
            .seekInput(timeInSeconds)
            .frames(1)
            .output(tempImagePath)
            .on('end', () => {
                const imageBuffer = fs.readFileSync(tempImagePath);
                fs.unlinkSync(tempVideoPath);
                fs.unlinkSync(tempImagePath);
                resolve(imageBuffer.toString('base64'));
            })
            .on('error', reject)
            .run();
    });
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