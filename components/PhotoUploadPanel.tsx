"use client";

import { useEffect, useRef, useState } from "react";
import { parseMedicationPhoto } from "@/lib/api";
import { ActiveIngredient } from "@/lib/types";

type ParsedPhotoDraft = {
  displayName?: string;
  dosageText?: string;
  instructions?: string;
  recurrenceType?: "daily" | "weekly";
  daysOfWeek?: string[];
  time?: string;

  normalizedName?: string;
  activeIngredients?: ActiveIngredient[];
  needsReview?: boolean;
  confidence?: number;
  source?: "photo";
};

type SuggestionFlags = {
  displayName?: boolean;
  dosageText?: boolean;
  instructions?: boolean;
  recurrenceType?: boolean;
  daysOfWeek?: boolean;
  time?: boolean;
};

type PhotoUploadPanelProps = {
  onParsed?: (values: ParsedPhotoDraft, suggested: SuggestionFlags) => void;
};

type ParsedMedicationResponse = {
  display_name?: string;
  normalized_name?: string;
  active_ingredients?: ActiveIngredient[];
  dosage_text?: string;
  instructions?: string;
  schedule?: {
    recurrence_type?: "daily" | "weekly";
    days_of_week?: string[];
    times?: string[];
  } | null;
  needs_review?: boolean;
  confidence?: number;
};

function dataUrlToFile(dataUrl: string, filename: string) {
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mime = mimeMatch?.[1] || "image/png";

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new File([bytes], filename, { type: mime });
}

export default function PhotoUploadPanel({ onParsed }: PhotoUploadPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [parseError, setParseError] = useState("");
  const [isParsing, setIsParsing] = useState(false);

  useEffect(() => {
    setCameraSupported(
      typeof navigator !== "undefined" &&
        !!navigator.mediaDevices &&
        !!navigator.mediaDevices.getUserMedia
    );

    return () => {
      stopCamera();
      setPreviewUrl((prev) => {
        if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
        return prev;
      });
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

  const setPreview = (url: string, file: File | null) => {
    setPreviewUrl((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return url;
    });
    setSelectedFile(file);
    setParseError("");
    setShowCamera(false);
    stopCamera();
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

    const dataUrl = canvas.toDataURL("image/png");
    const file = dataUrlToFile(dataUrl, `medication-${Date.now()}.png`);

    setPreview(dataUrl, file);
  };

  const handleParse = async () => {
    if (!selectedFile) {
      setParseError("Please upload or capture a photo first.");
      return;
    }

    setIsParsing(true);
    setParseError("");

    try {
      const parsed = (await parseMedicationPhoto(
        selectedFile
      )) as ParsedMedicationResponse;

      const parsedTime = parsed.schedule?.times?.[0];
      const parsedRecurrence = parsed.schedule?.recurrence_type;
      const parsedDays = parsed.schedule?.days_of_week ?? [];

      onParsed?.(
        {
          displayName: parsed.display_name || "",
          dosageText: parsed.dosage_text || "",
          instructions: parsed.instructions || "",
          recurrenceType: parsedRecurrence,
          daysOfWeek: parsedDays,
          time: parsedTime,

          normalizedName: parsed.normalized_name || "",
          activeIngredients: parsed.active_ingredients || [],
          needsReview: parsed.needs_review ?? false,
          confidence: parsed.confidence ?? 0,
          source: "photo",
        },
        {
          displayName: !!parsed.display_name,
          dosageText: !!parsed.dosage_text,
          instructions: !!parsed.instructions,
          recurrenceType: !!parsedRecurrence && !!parsedTime,
          daysOfWeek: parsedDays.length > 0,
          time: !!parsedTime,
        }
      );
    } catch (error) {
      console.error("Failed to parse medication photo:", error);
      setParseError("Could not analyze this photo.");
    } finally {
      setIsParsing(false);
    }
  };

  const clearPreview = () => {
    setPreviewUrl((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    setSelectedFile(null);
    setParseError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border p-4">
      <div>
        <h3 className="font-medium">Photo Import</h3>
        <p className="text-sm text-gray-500">
          Upload a medication label or take a photo to extract details.
        </p>
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
      {parseError && <p className="text-sm text-red-500">{parseError}</p>}

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
              onClick={clearPreview}
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