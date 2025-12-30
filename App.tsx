import React, { useState, useRef, useEffect } from 'react';
import { VideoData, ProcessingState } from './types';
import VideoUploader from './components/VideoUploader';
import { Wand2, Loader2, Download, AlertCircle, CheckCircle2 } from './components/Icons';
import { analyzeVideoContent, cleanFrame, generateCleanVideo } from './services/gemini';

const App: React.FC = () => {
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [processingState, setProcessingState] = useState<ProcessingState>({
    status: 'idle',
    message: '',
    progress: 0,
  });
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleVideoSelected = (data: VideoData) => {
    setVideoData(data);
    setResultVideoUrl(null);
    setProcessingState({ status: 'idle', message: '', progress: 0 });
  };

  const captureFirstFrame = (): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    return dataUrl.split(',')[1];
  };

  const startProcessing = async () => {
    if (!videoData?.previewUrl) return;

    // Check for API Key first using the helper (in service, but good to check presence)
    if (!process.env.API_KEY && !(window as any).aistudio) {
        alert("API Key environment missing.");
        return;
    }

    try {
      setProcessingState({ status: 'analyzing', message: 'Analyzing video structure...', progress: 10 });
      
      // 1. Wait for video metadata to load so we can capture frame
      if (videoRef.current && videoRef.current.readyState < 2) {
          await new Promise(resolve => {
              if (videoRef.current) videoRef.current.onloadeddata = resolve;
          });
      }

      const firstFrameBase64 = captureFirstFrame();
      if (!firstFrameBase64) throw new Error("Could not capture video frame");

      // 2. Analyze Content
      // Use provided base64 if upload, otherwise we can't analyze deeply without backend.
      // Fallback: Use the captured frame for analysis if full video base64 isn't available (link mode)
      const dataToAnalyze = videoData.base64Data || firstFrameBase64;
      const mimeToAnalyze = videoData.mimeType || 'image/png';
      
      const analysisPrompt = await analyzeVideoContent(dataToAnalyze, mimeToAnalyze);
      console.log("Analysis:", analysisPrompt);
      
      setProcessingState({ status: 'cleaning_frame', message: 'Reconstructing clean keyframes...', progress: 40 });

      // 3. Clean the first frame (Remove Logo)
      const cleanedFrameBase64 = await cleanFrame(firstFrameBase64);
      
      setProcessingState({ status: 'generating', message: 'Generating logo-free video with Veo...', progress: 60 });

      // 4. Generate Video
      const videoUrl = await generateCleanVideo(
        cleanedFrameBase64,
        analysisPrompt,
        (msg) => setProcessingState(prev => ({ ...prev, message: msg }))
      );

      if (videoUrl) {
        setResultVideoUrl(videoUrl);
        setProcessingState({ status: 'completed', message: 'Restoration complete!', progress: 100 });
      }

    } catch (error: any) {
      console.error(error);
      setProcessingState({ 
        status: 'error', 
        message: 'Processing failed', 
        error: error.message || "Unknown error occurred" 
      });
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-indigo-500/30">
      {/* Hidden Canvas for processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Wand2 className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
                SoraCleaner
              </h1>
              <p className="text-xs text-zinc-500 font-medium tracking-wide">AI VIDEO RESTORATION</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-xs text-zinc-400">
                Powered by Gemini 2.5 & Veo
             </div>
          </div>
        </div>
      </header>

      <main className="pt-32 pb-20 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-white">
            Remove Watermarks. <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
              Restore Perfection.
            </span>
          </h2>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto leading-relaxed">
            Upload a video with the "Sora" logo or other watermarks. Our AI pipeline analyzes the scene and reconstructs a pristine, logo-free version using Google's Veo technology.
          </p>
        </div>

        {/* Input Section */}
        {!videoData && (
          <VideoUploader onVideoSelected={handleVideoSelected} />
        )}

        {/* Processing/Result Section */}
        {videoData && (
          <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700">
            
            {/* Original Video */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Original Source</h3>
                <button 
                  onClick={() => setVideoData(null)}
                  className="text-xs text-zinc-500 hover:text-white transition-colors"
                >
                  Change Video
                </button>
              </div>
              <div className="relative aspect-video bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 shadow-xl group">
                {/* We use crossorigin anonymous for canvas extraction if possible, though local files don't need it */}
                <video 
                  ref={videoRef}
                  src={videoData.previewUrl || ''} 
                  className="w-full h-full object-cover"
                  controls
                  crossOrigin="anonymous"
                  muted
                />
              </div>
              <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800/50 text-sm text-zinc-400">
                 <p>Source detected. Ready for AI analysis and reconstruction.</p>
              </div>
            </div>

            {/* Result Video */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Restored Output</h3>
              
              <div className="relative aspect-video bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 shadow-xl flex flex-col items-center justify-center">
                
                {processingState.status === 'idle' && !resultVideoUrl && (
                  <div className="text-center p-8 space-y-6">
                    <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Wand2 className="text-zinc-500" size={24} />
                    </div>
                    <p className="text-zinc-400">Ready to process video.</p>
                    <button
                      onClick={startProcessing}
                      className="px-8 py-3 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                    >
                      Start Restoration
                    </button>
                  </div>
                )}

                {(processingState.status !== 'idle' && processingState.status !== 'completed' && processingState.status !== 'error') && (
                  <div className="absolute inset-0 bg-zinc-900/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-8 text-center">
                    <div className="relative mb-6">
                        <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs font-bold text-indigo-400">{processingState.progress}%</span>
                        </div>
                    </div>
                    <h4 className="text-xl font-medium text-white mb-2">Processing Video</h4>
                    <p className="text-indigo-300 animate-pulse text-sm">{processingState.message}</p>
                    <div className="mt-8 flex flex-col gap-2 text-xs text-zinc-500 max-w-xs">
                        <div className={`flex items-center gap-2 ${['analyzing', 'cleaning_frame', 'generating', 'completed'].includes(processingState.status) ? 'text-indigo-400' : ''}`}>
                            <CheckCircle2 size={12} /> Analyzing scene dynamics
                        </div>
                        <div className={`flex items-center gap-2 ${['cleaning_frame', 'generating', 'completed'].includes(processingState.status) ? 'text-indigo-400' : ''}`}>
                            <CheckCircle2 size={12} /> Removing watermark artifacts
                        </div>
                        <div className={`flex items-center gap-2 ${['generating', 'completed'].includes(processingState.status) ? 'text-indigo-400' : ''}`}>
                            <CheckCircle2 size={12} /> Synthesizing clean video
                        </div>
                    </div>
                  </div>
                )}

                {processingState.status === 'error' && (
                  <div className="text-center p-8 max-w-sm">
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                      <AlertCircle size={24} />
                    </div>
                    <h4 className="text-white font-medium mb-2">Processing Failed</h4>
                    <p className="text-sm text-red-400 mb-6">{processingState.error}</p>
                    <button
                      onClick={() => setProcessingState({ status: 'idle', message: '', progress: 0 })}
                      className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                )}

                {resultVideoUrl && (
                  <video 
                    src={resultVideoUrl}
                    className="w-full h-full object-cover"
                    controls
                    autoPlay
                    loop
                  />
                )}
              </div>

              {resultVideoUrl && (
                <div className="flex justify-end">
                   <a 
                     href={resultVideoUrl} 
                     download="restored_video.mp4"
                     target="_blank"
                     rel="noreferrer"
                     className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
                   >
                     <Download size={16} />
                     Download Result
                   </a>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
