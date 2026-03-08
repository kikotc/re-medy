"use client";

import { useEffect, useRef, useState } from "react";
import { parseMedicationPhoto } from "@/lib/api";
import { ActiveIngredient, MedicationDraft } from "@/lib/types";

type SuggestionFlags = {
  displayName?: boolean;
  dosageText?: boolean;
  instructions?: boolean;
  recurrenceType?: boolean;
  daysOfWeek?: boolean;
  time?: boolean;
};

type PhotoUploadPanelProps = {
  onParsed?: (values: Partial<MedicationDraft>, suggested: SuggestionFlags) => void;
};

export default function PhotoUploadPanel({ onParsed }: PhotoUploadPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState("");

  useEffect(() => {
    setCameraSupported(
      typeof navigator !== "undefined" &&
        !!navigator.mediaDevices &&
        !!navigator.mediaDevices.getUserMedia
    );

    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const setPreview = (url: string, file?: File) => {
    setPreviewUrl((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return url;
    });
    if (file) setImageFile(file);
    setShowCamera(false);
    stopCamera();
    setParseError("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url, file);
  };

  const startCamera = async () => {
    try {
      setCameraError("");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });

      streamRef.current = stream;
      setShowCamera(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setCameraError("Could not access camera.");
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

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], "capture.png", { type: "image/png" });
      const dataUrl = canvas.toDataURL("image/png");
      setPreview(dataUrl, file);
    }, "image/png");
  };

  const handleParse = async () => {
    if (!imageFile) return;

    setIsParsing(true);
    setParseError("");

    try {
      const parsed = await parseMedicationPhoto(imageFile);

      // Build suggestion flags — mark all AI-filled fields as suggested
      const suggested: SuggestionFlags = {
        displayName: true,
        dosageText: !!parsed.dosage_text,
        instructions: !!parsed.instructions,
        recurrenceType: true,
        time: parsed.schedule.times.length > 0,
      };

      onParsed?.(
        {
          displayName: parsed.display_name,
          dosageText: parsed.dosage_text,
          instructions: parsed.instructions,
          recurrenceType: parsed.schedule.recurrence_type,
          daysOfWeek: parsed.schedule.days_of_week,
          time: parsed.schedule.times[0] || "",

          normalizedName: parsed.normalized_name,
          activeIngredients: parsed.active_ingredients,
          needsReview: parsed.needs_review,
          confidence: parsed.confidence,
          source: "photo",
        },
        suggested
      );
    } catch (err) {
      console.error("Photo parse failed:", err);
      setParseError("Could not analyze the photo. Try uploading a clearer image.");
    } finally {
      setIsParsing(false);
    }
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
        <div className="space-y-3">
          <img
            src={previewUrl}
            alt="Medication preview"
            className="w-full rounded-2xl border object-cover"
          />

          {parseError && (
            <p className="text-sm text-red-500">{parseError}</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleParse}
              disabled={isParsing}
              className="rounded-full border px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {isParsing ? "Analyzing..." : "Use Photo"}
            </button>

            <button
              type="button"
              onClick={() => {
                if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
                setPreviewUrl(null);
                setImageFile(null);
                setParseError("");
              }}
              className="rounded-full border px-4 py-2 text-sm font-medium"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
