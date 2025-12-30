import { GoogleGenAI, Type } from "@google/genai";
import { VeoResponse } from "../types";

// Helper to ensure API key is selected
const getAiClient = async (): Promise<GoogleGenAI> => {
  if ((window as any).aistudio) {
    const hasKey = await (window as any).aistudio.hasSelectedApiKey();
    if (!hasKey) {
      await (window as any).aistudio.openSelectKey();
    }
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const analyzeVideoContent = async (
  videoBase64: string,
  mimeType: string
): Promise<string> => {
  const ai = await getAiClient();
  
  // Use Gemini 2.5 Flash for fast multimodal analysis
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-latest', // Using latest flash for analysis
    contents: {
      parts: [
        {
          inlineData: {
            data: videoBase64,
            mimeType: mimeType,
          },
        },
        {
          text: "Describe the visual content, subject, movement, and camera angle of this video in high detail. Focus on the main action and scene description. Do not mention any watermarks or text overlays in the description.",
        },
      ],
    },
  });

  return response.text || "A cinematic video scene.";
};

export const cleanFrame = async (
  imageBase64: string,
  mimeType: string = 'image/png'
): Promise<string> => {
  const ai = await getAiClient();

  // Use Gemini 2.5 Flash Image for editing/inpainting logic (simulated by regenerating the frame clean)
  // We ask it to output a clean version of the image.
  // Note: True inpainting is complex, here we ask the model to generate a description or we try to use the image editing capability if available.
  // Ideally we would use an inpainting model. Since we are using Veo, we can actually pass the noisy image to Veo with a prompt to "Ignore watermark".
  // However, cleaning the first frame dramatically improves stability.
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          inlineData: {
            data: imageBase64,
            mimeType: mimeType,
          },
        },
        {
          text: "Remove the 'Sora' or 'Sora 2' watermark and any text overlays from this image. Output only the visual data of the cleaned image.",
        },
      ],
    },
    // We try to get the image back. In many cases, generateContent with image model might return text.
    // If it returns text, we will fallback to using the dirty image with a strong prompt.
    // BUT, let's try to see if we can get an image back if we ask nicely or use generateImages if appropriate (Imagen).
    // Let's stick to a safer path: Analyze the image, get a prompt, then use Imagen to re-generate the first frame CLEAN.
  });
  
  // Check if we got an image back (not guaranteed with standard generateContent unless specific edit mode)
  // For the sake of this application's reliability with available APIs:
  // We will use Imagen 3 (via gemini-3-pro-image-preview or similar) to RE-GENERATE the first frame based on the description of the dirty frame.
  
  // 1. Describe dirty frame
  const descriptionResponse = await ai.models.generateContent({
    model: 'gemini-2.5-flash-latest',
    contents: {
      parts: [
        { inlineData: { data: imageBase64, mimeType } },
        { text: "Describe this image in extreme detail for reconstruction. Ignore any text or watermarks like 'Sora'." }
      ]
    }
  });
  const prompt = descriptionResponse.text || "A clean video frame";

  // 2. Generate clean frame using Imagen
  const imagenResponse = await ai.models.generateImages({
    model: 'imagen-4.0-generate-001',
    prompt: prompt + " high quality, photorealistic, no text, no watermarks, clear 8k.",
    config: {
        numberOfImages: 1,
        aspectRatio: '16:9', // Assuming 16:9 for most video
        outputMimeType: 'image/png'
    }
  });

  return imagenResponse.generatedImages[0].image.imageBytes;
};

export const generateCleanVideo = async (
  startFrameBase64: string,
  prompt: string,
  onProgress?: (msg: string) => void
): Promise<string | null> => {
  const ai = await getAiClient();

  if (onProgress) onProgress("Initializing generation model...");

  try {
    // We use the cleaned start frame and the video description to generate a new video
    // This effectively "removes" the watermark by hallucinating the rest of the video from the clean start.
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview', // Fast for better UX
      prompt: prompt + " cinematic, high quality, consistent motion.",
      image: {
        imageBytes: startFrameBase64,
        mimeType: 'image/png',
      },
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9',
      },
    });

    if (onProgress) onProgress("Video generation started. This may take a moment...");

    // Polling loop
    while (!operation.done) {
      if (onProgress) onProgress("Rendering video frames...");
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Poll every 5s
      operation = await ai.operations.getVideosOperation({ operation });
    }

    if (operation.error) {
        throw new Error(operation.error.message || "Video generation failed");
    }

    const videoUri = (operation.response as VeoResponse)?.generatedVideos?.[0]?.video?.uri;
    
    if (!videoUri) {
      throw new Error("No video URI returned");
    }

    // Append API Key for download
    return `${videoUri}&key=${process.env.API_KEY}`;

  } catch (error: any) {
    console.error("Veo Error:", error);
    if (error.message?.includes("Requested entity was not found")) {
         if ((window as any).aistudio) {
             await (window as any).aistudio.openSelectKey();
             // Retry once? Ideally prompt user. For now, throw.
             throw new Error("API Key session expired. Please try again.");
         }
    }
    throw error;
  }
};
