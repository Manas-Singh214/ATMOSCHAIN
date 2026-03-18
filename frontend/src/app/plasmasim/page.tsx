"use client";

import React, { useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls, Sparkles } from "@react-three/drei";
import PlasmaCore from "@/components/digital-twin/PlasmaCore";
import { Flame, Zap, Database, Info, ThermometerSun } from "lucide-react";

export default function PlasmaSimPage() {
    const [systemData, setSystemData] = useState<any>(null);

    // Mock detection data load for simulation if user hasn't scanned anything yet
    useEffect(() => {
        const stored = localStorage.getItem("atmos_last_detection");
        if (stored) {
            setSystemData(JSON.parse(stored));
        } else {
            // Default demo payload
            setSystemData({
                waste_class: "plastic",
                mass_kg: 2.5,
                ch4_kg: 0,
                co2e_kg: 0,
            });
        }
    }, []);

    const energyGenerated = systemData ? (systemData.mass_kg * 1.8 * 1000).toFixed(0) : 0;
    const syngasYield = systemData ? (systemData.mass_kg * 0.85).toFixed(2) : 0;

    return (
        <main className="w-screen h-screen overflow-hidden bg-transparent relative flex flex-col selection:bg-plasma-teal selection:text-black">

            {/* 3D background is now handled by layout */}

            {/* UI Overlay */}
            <div className="absolute inset-0 z-10 pointer-events-none p-8 flex flex-col justify-between">

                {/* Header */}
                <div className="w-full flex justify-between items-start">
                    <div className="hud-panel p-6 pointer-events-auto max-w-xl">
                        <h1 className="text-3xl font-bold tracking-widest text-[#FFB800] flex items-center mb-2">
                            <Flame className="w-8 h-8 mr-4" />
                            PLASMA GASIFICATION REACTOR
                        </h1>
                        <p className="font-mono text-gray-300">
                            MODULE 2: 5500°C Thermal Cracking & Syngas Yield Simulation
                        </p>
                    </div>

                    <div className="hud-panel p-4 pointer-events-auto flex space-x-8 font-mono text-sm border-t-4 border-[#FFB800]">
                        <div>
                            <span className="text-gray-500 block mb-1">CORE TEMP</span>
                            <span className="text-[#FFB800] font-bold text-xl drop-shadow-[0_0_8px_rgba(255,184,0,0.8)] animate-pulse flex items-center">
                                <ThermometerSun className="w-5 h-5 mr-2" /> 5500°C
                            </span>
                        </div>
                        <div>
                            <span className="text-gray-500 block mb-1">PLASMA ARC</span>
                            <span className="text-white font-bold text-xl">ACTIVE</span>
                        </div>
                    </div>
                </div>

                {/* Left Side Metrics */}
                <div className="flex-1 flex items-center justify-between pointer-events-none mt-10">
                    <div className="w-[450px] space-y-6 pointer-events-auto">

                        <div className="hud-panel p-6">
                            <h3 className="text-lg font-bold text-white mb-4 border-b border-white/20 pb-2">INPUT PAYLOAD</h3>
                            {systemData ? (
                                <div className="space-y-4 font-mono text-lg">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">MATERIAL</span>
                                        <span className="text-white uppercase font-bold text-xl">{systemData.waste_class}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">TOTAL MASS</span>
                                        <span className="text-[#00F2FF] font-bold text-xl">{systemData.mass_kg} KG</span>
                                    </div>
                                    <div className="p-3 bg-red-900/30 border border-red-500/50 rounded mt-4">
                                        <span className="text-red-400 text-sm block mb-1">AVOIDED EMISSIONS DESTRUCTION</span>
                                        <span className="text-white font-bold">{systemData.co2e_kg || 0} KG CO2e PREVENTED</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-gray-500 font-mono text-sm">NO PAYLOAD LOADED</div>
                            )}
                        </div>

                        <div className="hud-panel p-6 border-l-4 border-yellow-500">
                            <h3 className="text-lg font-bold text-yellow-500 mb-4 border-b border-yellow-500/20 pb-2 flex items-center">
                                <Zap className="w-5 h-5 mr-2" /> THERMODYNAMIC YIELD EXPECTATION
                            </h3>
                            <div className="space-y-5 font-mono">
                                <div>
                                    <span className="text-gray-400 block mb-1">SYNGAS PRODUCTION (H2 + CO)</span>
                                    <span className="text-3xl font-bold text-white">{syngasYield} KG <span className="text-sm font-normal text-gray-500 ml-2">@ 85% RECOVERY</span></span>
                                </div>
                                <div className="h-px bg-white/10 w-full" />
                                <div>
                                    <span className="text-gray-400 block mb-1">THEORETICAL ENERGY RECOVERY</span>
                                    <span className="text-3xl font-bold text-yellow-400 drop-shadow-[0_0_10px_rgba(255,184,0,0.5)]">{energyGenerated} kWh <span className="text-sm font-normal text-gray-500 ml-2">@ 35% TURBINE EFF.</span></span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </main>
    );
}
