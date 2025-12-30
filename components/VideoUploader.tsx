import React, { useState, useRef } from 'react';
import { Upload, Link as LinkIcon, AlertCircle } from './Icons';
import { VideoData } from '../types';

interface VideoUploaderProps {
  onVideoSelected: (data: VideoData) => void;
  disabled?: boolean;
}

const VideoUploader: React.FC<VideoUploaderProps> = ({ onVideoSelected, disabled }) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'link'>('upload');
  const [dragActive, setDragActive] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    const url = URL.createObjectURL(file);
    // Convert to base64 for API
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      onVideoSelected({
        file,
        url: null,
        previewUrl: url,
        base64Data: base64Data,
        mimeType: file.type
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Since we cannot CORS fetch arbitrary URLs, we will just pass it.
    // Real implementation would need a backend proxy.
    // For this demo, we assume the user might paste a direct mp4 link which might work in video tag,
    // but for API processing we warn them.
    if (!linkInput) return;
    
    // Check if it looks like a video file
    if (linkInput.match(/\.(mp4|webm|mov)$/i)) {
       onVideoSelected({
        file: null,
        url: linkInput,
        previewUrl: linkInput,
      });
    } else {
      alert("For this demo, please use a direct link to a video file (.mp4) or upload a file. Standard website URLs cannot be processed client-side.");
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden shadow-2xl">
      <div className="flex border-b border-zinc-800">
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex-1 py-4 text-sm font-medium transition-colors duration-200 flex items-center justify-center gap-2 ${
            activeTab === 'upload' ? 'bg-zinc-800/50 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/30'
          }`}
        >
          <Upload size={18} />
          Upload Video
        </button>
        <button
          onClick={() => setActiveTab('link')}
          className={`flex-1 py-4 text-sm font-medium transition-colors duration-200 flex items-center justify-center gap-2 ${
            activeTab === 'link' ? 'bg-zinc-800/50 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/30'
          }`}
        >
          <LinkIcon size={18} />
          Paste Link
        </button>
      </div>

      <div className="p-8">
        {activeTab === 'upload' ? (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 ${
              dragActive
                ? 'border-indigo-500 bg-indigo-500/10 scale-[1.02]'
                : 'border-zinc-700 hover:border-zinc-600 bg-zinc-900'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="hidden"
              disabled={disabled}
            />
            <div className="flex flex-col items-center gap-4">
              <div className={`p-4 rounded-full ${dragActive ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-800 text-zinc-400'}`}>
                <Upload size={32} />
              </div>
              <div>
                <p className="text-lg font-medium text-white mb-1">
                  Drag and drop your video here
                </p>
                <p className="text-sm text-zinc-500">
                  Supports MP4, MOV, WEBM up to 50MB
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className="px-6 py-2.5 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Browse Files
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleLinkSubmit} className="flex flex-col gap-4 py-8">
            <div className="relative">
              <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
              <input
                type="url"
                placeholder="Paste video URL (Direct .mp4 link)"
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                disabled={disabled}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl py-4 pl-12 pr-4 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>
            <div className="flex items-start gap-2 text-xs text-yellow-500/80 bg-yellow-500/10 p-3 rounded-lg">
                <AlertCircle size={14} className="mt-0.5" />
                <p>Processing external links directly requires server-side fetching. For best results in this browser-only demo, please download the video and use the Upload tab.</p>
            </div>
            <button
              type="submit"
              disabled={!linkInput || disabled}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Import from URL
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default VideoUploader;
