import { createCanvas, loadImage as nodeLoadImage, Image as NodeImage, Canvas } from 'canvas';
import { ColorRGBA } from '../types.js';

export function HSLToRGB(h: number, s: number, l: number, a = 1): ColorRGBA {
    s /= 100;
    l /= 100;
    
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    
    let r, g, b;
    
    if (h >= 0 && h < 60) {
        [r, g, b] = [c, x, 0];
    } else if (h >= 60 && h < 120) {
        [r, g, b] = [x, c, 0];
    } else if (h >= 120 && h < 180) {
        [r, g, b] = [0, c, x];
    } else if (h >= 180 && h < 240) {
        [r, g, b] = [0, x, c];
    } else if (h >= 240 && h < 300) {
        [r, g, b] = [x, 0, c];
    } else {
        [r, g, b] = [c, 0, x];
    }
    
    return {
        r: Math.round((r + m) * 255),
        g: Math.round((g + m) * 255),
        b: Math.round((b + m) * 255),
        a: a
    };
}

export function decodeMask(counts: string | any[], size: [any, any]): Uint8Array {
    const [height, width] = size;
    const bitmap = new Uint8Array(width * height);
    let pixel = 0;
    let value = 0;
    
    for (let i = 0; i < counts.length; i++) {
        const count = counts[i];
        for (let j = 0; j < count; j++) {
            if (pixel < bitmap.length) {
                bitmap[pixel++] = value;
            }
        }
        value = 1 - value;
    }
    
    return bitmap;
}

export function rotateBitmap90ClockwiseAndFlip(
    bitmap: string | any[] | Uint8Array,
    width: number,
    height: number
): Uint8Array {
    const resultBitmap = new Uint8Array(bitmap.length);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const originalIndex = y * width + x;
            
            const newX = y;
            const newY = x;
            const newIndex = newY * height + newX;
            
            resultBitmap[newIndex] = bitmap[originalIndex];
        }
    }
    
    return resultBitmap;
}

export function applyBitmapToImageData(
    bitmap: Uint8Array, 
    imgData: { data: Uint8ClampedArray }, 
    color: ColorRGBA
): void {
    const data = imgData.data;
    
    for (let i = 0; i < bitmap.length; i++) {
        if (bitmap[i] === 1) {
            const idx = i * 4;
            data[idx] = color.r;
            data[idx + 1] = color.g;
            data[idx + 2] = color.b;
            data[idx + 3] = Math.round(color.a * 255);
        }
    }
}

export async function loadImage(buffer: Buffer): Promise<NodeImage> {
    return nodeLoadImage(buffer);
}

export function createNewCanvas(width: number, height: number): Canvas {
    return createCanvas(width, height);
}