"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { Camera, RefreshCw, AlertTriangle, CheckCircle2, CloudLightning } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function WebcamDetector({ onDetect }: { onDetect: (data: any) => void }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isDetecting, setIsDetecting] = useState(false);
    const [isCameraOn, setIsCameraOn] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Start webcam
    const startWebcam = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
            });
            setStream(mediaStream);
            setIsCameraOn(true);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
            setError(null);
        } catch (err: any) {
            setError("Webcam access denied or unavailable.");
            console.error(err);
        }
    };

    const stopWebcam = () => {
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
            setStream(null);
            setIsCameraOn(false);
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
        }
    };

    const toggleWebcam = () => {
        if (isCameraOn) stopWebcam();
        else startWebcam();
    };

    useEffect(() => {
        startWebcam();
        return () => {
            if (stream) stream.getTracks().forEach((t) => t.stop());
        };
    }, []);

    // Capture frame and send to API
    const captureAndDetect = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current) return;

        setIsDetecting(true);
        setError(null);

        const video = videoRef.current;
        const canvas = canvasRef.current;

        // Draw current frame to canvas
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Get base64 JPEG
        const base64Image = canvas.toDataURL("image/jpeg", 0.7);

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/detect`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image_b64: base64Image }),
            });

            const data = await res.json();
            if (data.success) {
                // Persist for other pages to consume
                localStorage.setItem("atmos_last_detection", JSON.stringify(data.combined));
                onDetect(data);
            } else {
                setError(data.detail || "Detection failed.");
            }
        } catch (err) {
            setError("Network error connecting to Backend AI.");
        } finally {
            setIsDetecting(false);
        }
    }, [onDetect]);

    return (
        <div className="relative rounded-2xl overflow-hidden glass-panel border-atmos-green/40 h-[450px] bg-black/30 backdrop-blur-sm shadow-[0_0_30px_rgba(0,255,136,0.1)] flex flex-col justify-center items-center">

            {/* Video Feed */}
            {isCameraOn && (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 mix-blend-screen opacity-70 ${isDetecting ? 'blur-sm grayscale' : ''}`}
                />
            )}

            {/* Hidden Canvas for capture */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Overlay UI */}
            <div className="absolute inset-0 z-10 p-6 flex flex-col justify-between pointer-events-none">
                {/* Top Header */}
                <div className="flex justify-between items-start w-full font-mono">
                    <div className="glass-panel px-4 py-2 rounded-lg border border-[var(--color-plasma-teal)]/50 flex items-center bg-black/60 backdrop-blur-md">
                        <div className={`w-3 h-3 rounded-full mr-3 ${isCameraOn ? 'bg-[var(--color-plasma-teal)] animate-pulse shadow-[0_0_10px_rgba(0,242,255,1)]' : 'bg-red-500'}`} />
                        <span className="text-sm font-bold tracking-wider text-[var(--color-plasma-teal)] uppercase">
                            {isCameraOn ? "SENSOR: ACTIVE" : "SENSOR: OFFLINE"}
                        </span>
                    </div>

                    <button
                        onClick={toggleWebcam}
                        className={`pointer-events-auto px-6 py-2 rounded-lg border font-bold text-sm transition-all ${isCameraOn ? 'border-red-500/50 text-red-500 hover:bg-red-500/20' : 'border-[var(--color-plasma-teal)]/50 text-[var(--color-plasma-teal)] hover:bg-[var(--color-plasma-teal)]/20 shadow-[0_0_15px_rgba(0,242,255,0.1)]'}`}
                    >
                        {isCameraOn ? "SHUTDOWN" : "INITIALIZE"}
                    </button>
                </div>

                {/* Center Target Box */}
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-72 h-72 border border-[var(--color-plasma-teal)]/20 rounded-3xl relative">
                        <div className="absolute -top-2 -left-2 w-8 h-8 border-t-4 border-l-4 border-[var(--color-plasma-teal)] rounded-tl-xl" />
                        <div className="absolute -top-2 -right-2 w-8 h-8 border-t-4 border-r-4 border-[var(--color-plasma-teal)] rounded-tr-xl" />
                        <div className="absolute -bottom-2 -left-2 w-8 h-8 border-b-4 border-l-4 border-[var(--color-plasma-teal)] rounded-bl-xl" />
                        <div className="absolute -bottom-2 -right-2 w-8 h-8 border-b-4 border-r-4 border-[var(--color-plasma-teal)] rounded-br-xl" />

                        <AnimatePresence>
                            {isDetecting && (
                                <motion.div
                                    initial={{ top: 0, opacity: 0.5 }}
                                    animate={{ top: "100%", opacity: [0.5, 1, 0.5] }}
                                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                    className="absolute left-0 right-0 h-1 bg-[var(--color-plasma-teal)] shadow-[0_0_15px_rgba(0,242,255,1)]"
                                />
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="flex justify-between items-end w-full">
                    <div className="flex flex-col gap-2">
                        {error && (
                            <div className="flex items-center text-red-400 text-sm bg-red-900/40 px-3 py-1.5 rounded-md border border-red-500/50">
                                <AlertTriangle className="w-4 h-4 mr-2" />
                                {error}
                            </div>
                        )}
                    </div>

                    <button
                        onClick={captureAndDetect}
                        disabled={isDetecting || !stream}
                        className="pointer-events-auto group relative overflow-hidden rounded-lg bg-[var(--color-plasma-teal)] hover:bg-[var(--color-plasma-teal)]/90 text-black font-bold font-mono px-8 py-4 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 shadow-[0_0_25px_rgba(0,242,255,0.4)]"
                    >
                        <div className="flex items-center tracking-tighter uppercase">
                            {isDetecting ? (
                                <>
                                    <RefreshCw className="w-5 h-5 mr-3 animate-spin" />
                                    Analyzing Payload...
                                </>
                            ) : (
                                <>
                                    <Camera className="w-5 h-5 mr-3 group-hover:rotate-12 transition-transform" />
                                    Capture & Classify
                                </>
                            )}
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}
