import { McpToolDefinition, JsonObject } from '../types.js';
import { 
    loadImage, 
    createNewCanvas, 
    HSLToRGB, 
    decodeMask, 
    rotateBitmap90ClockwiseAndFlip, 
    applyBitmapToImageData 
} from '../image/visualization.js';
import { extractFrameAtTime, resizeBase64Image, numpyBase64ToImage } from '../image/processing.js';

export async function createVisualization(
    definition: McpToolDefinition, 
    response: any, 
    toolArgs: JsonObject
): Promise<any[] | null> {
    const content = [];
    
    switch (definition.name) {
        case 'text-to-object-detection':
            const objectImage = await createObjectDetectionVisualization(response, toolArgs);
            if (objectImage) {
                content.push({ type: "image", data: objectImage, mimeType: "image/jpeg" });
            }
            break;
            
        case 'text-to-instance-segmentation':
            const segmentationImage = await createSegmentationVisualization(response, toolArgs);
            if (segmentationImage) {
                content.push({ type: "image", data: segmentationImage, mimeType: "image/jpeg" });
            }
            break;
            
        case 'activity-recognition':
            const activityContent = await createActivityVisualization(response, toolArgs);
            content.push(...activityContent);
            break;
            
        case 'depth-pro':
            const depthImage = await createDepthVisualization(response, toolArgs);
            if (depthImage) {
                content.push({ type: "image", data: depthImage, mimeType: "image/jpeg" });
            }
            break;

        default:
            const defaultImage = await createDefaultVisualization(response);
            if (defaultImage) {
                content.push({ type: "image", data: defaultImage, mimeType: "image/jpeg" });
            }
    }
    
    return content.length > 0 ? content : null;
}

async function createObjectDetectionVisualization(response: any, toolArgs: JsonObject): Promise<string | null> {
    try {
        const img = await loadImage(Buffer.from(toolArgs.requestBody.image, 'base64'));
        const canvas = createNewCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        ctx.lineWidth = 3;
        response.data.data[0].forEach((det: { bounding_box: [any, any, any, any] }, i: number) => {
            ctx.strokeStyle = `hsl(${(i * 30) % 360}, 100%, 50%)`;
            const [x, y, x2, y2] = det.bounding_box;
            ctx.strokeRect(x, y, x2 - x, y2 - y);
        });

        let image = canvas.toBuffer().toString('base64');
        image = await resizeBase64Image(image);
        return image;
    } catch (error) {
        console.error('Error creating object detection visualization:', error);
        return null;
    }
}

async function createSegmentationVisualization(response: any, toolArgs: JsonObject): Promise<string | null> {
    try {
        const img = await loadImage(Buffer.from(toolArgs.requestBody.image, 'base64'));
        const canvas = createNewCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        response.data.data[0].forEach((segmentation: { mask: { counts: any; size: any } }, i: number) => {
            const originalBitmap = decodeMask(segmentation.mask.counts, segmentation.mask.size);
            const [originalWidth, originalHeight] = segmentation.mask.size;
            
            const rotatedBitmap = rotateBitmap90ClockwiseAndFlip(originalBitmap, originalWidth, originalHeight);
            const rotatedWidth = originalHeight;
            const rotatedHeight = originalWidth;
            
            const overlayCanvas = createNewCanvas(rotatedWidth, rotatedHeight);
            const overlayCtx = overlayCanvas.getContext('2d');
            const imgData = overlayCtx.createImageData(rotatedWidth, rotatedHeight);
            
            const color = HSLToRGB((i * 30) % 360, 100, 50, 0.5);
            applyBitmapToImageData(rotatedBitmap, imgData, color);
            
            overlayCtx.putImageData(imgData, 0, 0);
            ctx.drawImage(overlayCanvas, 0, 0);
        });
        

        let image = canvas.toBuffer().toString('base64');
        image = await resizeBase64Image(image);
        return image;

    } catch (error) {
        console.error('Error creating segmentation visualization:', error);
        return null;
    }
}

async function createActivityVisualization(response: any, toolArgs: JsonObject): Promise<any[]> {
    const content = [];
    
    try {
        for (const event of JSON.parse(JSON.stringify(response.data)).data.events) {
            const midTime = (event.start_time + event.end_time) / 2;
            let image = await extractFrameAtTime(toolArgs.requestBody.video, midTime);
            image = await resizeBase64Image(image);
            
            content.push({ type: "text", text: event.description });
            content.push({ type: "image", data: image, mimeType: "image/jpeg" });
        }
    } catch (error) {
        console.error('Error creating activity visualization:', error);
    }
    
    return content;
}

async function createDepthVisualization(response: any, toolArgs: JsonObject): Promise<string | null> {
    try {
        const img = await loadImage(Buffer.from(toolArgs.requestBody.image, 'base64'));
        let image = await numpyBase64ToImage(
            JSON.parse(JSON.stringify(response.data)).data.depth, 
            img.width, 
            img.height
        );
            
        image = await resizeBase64Image(image);
        return image;
    } catch (error) {
        console.error('Error creating depth visualization:', error);
        return null;
    }
}

async function createDefaultVisualization(response: any): Promise<string | null> {
    try {
        let image = JSON.parse(JSON.stringify(response.data)).data[0];
        image = await resizeBase64Image(image);
        return image;
    } catch (error) {
        console.error('Error creating default visualization:', error);
        return null;
    }
}