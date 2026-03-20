"use client";

import React, { useState } from "react";
import WebcamDetector from "@/components/digital-twin/WebcamDetector";
import { Camera, Activity, FileJson, Beaker } from "lucide-react";

export default function WasteVisionPage() {
    const [detectionResult, setDetectionResult] = useState<any>(null);

    return (
        <main className="min-h-screen pb-12 px-8 flex flex-col items-center bg-transparent">

            <div className="w-full max-w-7xl flex justify-between items-end mb-8 border-b border-[#00F2FF]/30 pb-4">
                <div>
                    <h1 className="text-4xl font-bold tracking-widest text-[#00F2FF] flex items-center">
                        <Camera className="w-10 h-10 mr-4" />
                        WASTEVISION AI PLATFORM
                    </h1>
                    <p className="font-mono text-gray-400 mt-2">
                        MODULE 1: Real-time source classification using Gemini 2.0 Flash Vision
                    </p>
                </div>
                <div className="text-right font-mono text-xs text-[#00F2FF]">
                    <span className="animate-pulse">● LIVE CONNECTION</span>
                </div>
            </div>

            <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Visual Input Panel */}
                <div className="flex flex-col space-y-6">
                    <div className="hud-panel p-6 shadow-[0_0_30px_rgba(0,242,255,0.05)]">
                        <h2 className="text-xl font-bold font-mono tracking-widest text-white mb-4 flex items-center">
                            OPTICAL SENSOR FEED
                        </h2>
                        <div className="h-[450px]">
                            <WebcamDetector onDetect={(data) => setDetectionResult(data)} />
                        </div>
                    </div>

                    <div className="hud-panel p-6">
                        <h3 className="text-lg font-bold text-[#FFB800] mb-3 flex items-center border-b border-[#FFB800]/20 pb-2">
                            <Activity className="w-5 h-5 mr-3" />
                            IPCC FOD CALCULATION ENGINE
                        </h3>
                        <p className="text-sm font-mono text-gray-400 mb-4">
                            The First-Order Decay model estimates methane release from solid waste based on its Degradable Organic Carbon (DOC) fraction.
                        </p>
                        <div className="grid grid-cols-2 gap-4 font-mono text-sm">
                            <div className="bg-black/40 p-3 border border-white/10 rounded">
                                <span className="text-gray-500 block mb-1">DOC (Fraction)</span>
                                <span className="text-white text-lg">
                                    {detectionResult ? detectionResult.detection.doc_value : "—"}
                                </span>
                            </div>
                            <div className="bg-black/40 p-3 border border-white/10 rounded">
                                <span className="text-gray-500 block mb-1">Mass (KG)</span>
                                <span className="text-[#00F2FF] text-lg">
                                    {detectionResult ? detectionResult.combined.mass_kg : "—"}
                                </span>
                            </div>
                            <div className="bg-black/40 p-3 border border-white/10 rounded">
                                <span className="text-gray-500 block mb-1">Global Warming Pot.</span>
                                <span className="text-[#FFB800] text-lg">28x CO2</span>
                            </div>
                            <div className="bg-[#FFB800]/10 p-3 border border-[#FFB800]/30 rounded">
                                <span className="text-[#FFB800] block mb-1 font-bold">AVOIDED METHANE</span>
                                <span className="text-white text-xl font-bold">
                                    {detectionResult ? `${detectionResult.combined.ch4_kg.toFixed(3)} kg` : "—"}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Analysis Output Panel */}
                <div className="flex flex-col space-y-6">
                    <div className="hud-panel p-6 flex-1 shadow-[0_0_30px_rgba(0,242,255,0.05)]">
                        <h2 className="text-xl font-bold font-mono tracking-widest text-[#00F2FF] mb-6 flex items-center border-b border-[#00F2FF]/30 pb-3">
                            <FileJson className="w-6 h-6 mr-3" />
                            AI CLASSIFICATION RESULTS
                        </h2>

                        {detectionResult ? (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-black/40 border-l-4 border-[#00F2FF]">
                                        <span className="text-gray-500 font-mono text-xs block mb-1">PRIMARY CLASS</span>
                                        <span className="text-2xl font-bold text-white uppercase">{detectionResult.combined.waste_class}</span>
                                    </div>
                                    <div className="p-4 bg-black/40 border-l-4 border-green-500">
                                        <span className="text-gray-500 font-mono text-xs block mb-1">CONFIDENCE</span>
                                        <span className="text-2xl font-bold text-white">{(detectionResult.combined.confidence * 100).toFixed(1)}%</span>
                                    </div>
                                </div>

                                <div className="p-4 bg-black/40 rounded border border-white/10">
                                    <span className="text-gray-500 font-mono text-xs block mb-2">ITEM DESCRIPTION</span>
                                    <p className="text-lg text-white">{detectionResult.combined.item}</p>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className={`p-4 rounded border flex justify-between items-center ${detectionResult.combined.biodegradable ? 'bg-green-500/10 border-green-500 text-green-400' : 'bg-gray-900 border-gray-700 text-gray-500'}`}>
                                        <span className="font-mono font-bold">BIODEGRADABLE</span>
                                        <span>{detectionResult.combined.biodegradable ? "YES" : "NO"}</span>
                                    </div>
                                    <div className={`p-4 rounded border flex justify-between items-center ${detectionResult.combined.recyclable ? 'bg-[#00F2FF]/10 border-[#00F2FF] text-[#00F2FF]' : 'bg-gray-900 border-gray-700 text-gray-500'}`}>
                                        <span className="font-mono font-bold">RECYCLABLE</span>
                                        <span>{detectionResult.combined.recyclable ? "YES" : "NO"}</span>
                                    </div>
                                    <div className={`p-4 rounded border flex justify-between items-center ${detectionResult.combined.hazardous ? 'bg-red-500/20 border-red-500 text-red-500 animate-pulse' : 'bg-gray-900 border-gray-700 text-green-500'}`}>
                                        <span className="font-mono font-bold">HAZARDOUS</span>
                                        <span>{detectionResult.combined.hazardous ? "YES" : "NO"}</span>
                                    </div>
                                </div>

                                <div className="p-4 bg-black/40 rounded border border-white/10">
                                    <span className="text-gray-500 font-mono text-xs block mb-2 flex items-center">
                                        <Beaker className="w-4 h-4 mr-2" /> GAS RELEASE COMPOSITION (IF LANDFILLED)
                                    </span>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {detectionResult.detection.gas_release_composition?.map((gas: string, i: number) => (
                                            <span key={i} className="px-3 py-1 bg-[#FFB800]/20 text-[#FFB800] border border-[#FFB800]/50 rounded text-sm font-mono">
                                                {gas}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <button className="w-full mt-8 py-4 bg-[#00F2FF] text-black font-bold font-mono tracking-widest text-lg hover:shadow-[0_0_20px_rgba(0,242,255,0.6)] transition-all">
                                    SEND TO PLASMA REACTOR ➔
                                </button>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500 font-mono py-20">
                                <Camera className="w-16 h-16 mb-4 opacity-50" />
                                <p>WAITING FOR OPTICAL INPUT...</p>
                                <p className="text-xs mt-2">Activate camera and scan waste to see analysis.</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </main>
    );
}
