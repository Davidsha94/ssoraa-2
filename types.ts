export interface VeoConfig {
  numberOfVideos: number;
  resolution: '720p' | '1080p';
  aspectRatio: '16:9' | '9:16' | '1:1' | '3:4' | '4:3';
  image?: {
    imageBytes: string;
    mimeType: string;
  };
}

export interface GeneratedVideo {
  video: {
    uri: string;
    expirationTime?: string;
  };
}

export interface VeoResponse {
  generatedVideos?: GeneratedVideo[];
}

export interface ProcessingState {
  status: 'idle' | 'analyzing' | 'cleaning_frame' | 'generating' | 'completed' | 'error';
  message: string;
  progress: number;
  error?: string;
}

export interface VideoData {
  file: File | null;
  url: string | null;
  previewUrl: string | null;
  base64Data?: string;
  mimeType?: string;
}
