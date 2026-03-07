"use client";

import { useEffect, useRef, useState } from "react";

export default function PhotoUploadPanel() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false);
  const [cameraError, setCameraError] = useState("");

  useEffect(() => {
    setCameraSupported(
      typeof navigator !== "undefined" &&
        !!navigator.mediaDevices &&
        !!navigator.mediaDevices.getUserMedia
    );

    return () => {
      stopCamera();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setShowCamera(false);
    stopCamera();
  };

  const startCamera = async () => {
    try {
      setCameraError("");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      streamRef.current = stream;
      setShowCamera(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setCameraError("Could not access webcam.");
      setShowCamera(false);
      stopCamera();
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/png");
    setPreviewUrl(dataUrl);
    setShowCamera(false);
    stopCamera();
  };

  return (
    <div className="space-y-3 rounded-2xl border border-dashed p-4">
      <div>
        <div className="font-medium">Add by Photo</div>
        <div className="text-sm text-gray-500">
          Upload an image or take one if your device supports it.
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={handleUploadClick}
          className="rounded-full border px-4 py-2 text-sm font-medium"
        >
          Upload Image
        </button>

        {cameraSupported && (
          <button
            type="button"
            onClick={startCamera}
            className="rounded-full border px-4 py-2 text-sm font-medium"
          >
            Take Photo
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {cameraError && <p className="text-sm text-red-500">{cameraError}</p>}

      {showCamera && (
        <div className="space-y-3">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full rounded-2xl border"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={capturePhoto}
              className="rounded-full border px-4 py-2 text-sm font-medium"
            >
              Capture
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCamera(false);
                stopCamera();
              }}
              className="rounded-full border px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {previewUrl && !showCamera && (
        <div className="space-y-2">
          <img
            src={previewUrl}
            alt="Medication preview"
            className="w-full rounded-2xl border object-cover"
          />
          <button
            type="button"
            onClick={() => {
              setPreviewUrl(null);
              if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
            }}
            className="rounded-full border px-4 py-2 text-sm font-medium"
          >
            Remove
          </button>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}