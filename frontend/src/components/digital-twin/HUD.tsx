"use client";

import React, { useRef, useState, useEffect } from "react";
import { Activity, Camera, Flame, Factory, Zap, Database, CheckCircle2 } from "lucide-react";
import { ViewState } from "@/types";
import WebcamDetector from "@/components/digital-twin/WebcamDetector";

interface HUDProps {
    activeView: ViewState;
    setActiveView: (view: ViewState) => void;
    systemData: any;
    onDataUpdate: (data: any) => void;
}

export default function HUD({ activeView, setActiveView, systemData, onDataUpdate }: HUDProps) {

    const [isMinting, setIsMinting] = useState(false);
    const [mintResult, setMintResult] = useState<any>(null);

    const handleDetect = (data: any) => {
        onDataUpdate(data.combined);
    };

    const handleMint = async () => {
        if (!systemData || !systemData.carbon_credits) return;
        setIsMinting(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/mint`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    detection_result: systemData,
                    methane_data: {
                        carbon_credits: systemData.carbon_credits,
                        co2e_tonnes: systemData.co2e_tonnes,
                        ch4_kg: systemData.ch4_kg,
                        revenue_usd_mid: systemData.revenue_usd_mid,
                        revenue_inr_mid: systemData.revenue_inr_mid,
                    },
                    minter_address: "0xATMOS_DIGITAL_TWIN"
                }),
            });
            const data = await res.json();
            if (data.success) {
                setMintResult(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsMinting(false);
        }
    };

    return (
        <div className="w-full h-full flex flex-col justify-between p-6 pointer-events-none">

            {/* TOP BAR */}
            <div className="w-full flex justify-between items-start pointer-events-auto">

                {/* Logo / System Info */}
                <div className="hud-panel p-4 flex flex-col min-w-[300px]">
                    <h1 className="text-3xl font-bold tracking-widest text-glow-teal text-white flex items-center">
                        <Activity className="w-8 h-8 mr-3 text-[var(--color-plasma-teal)]" />
                        ATMOSCHAIN <span className="text-[var(--color-plasma-teal)] ml-3 text-lg font-normal">v1.0</span>
                    </h1>
                    <div className="mt-3 text-sm font-mono text-[var(--color-plasma-teal)]">
                        SYSTEM STATUS: <span className="animate-pulse text-white text-base">ONLINE</span>
                        <br />
                        TELEMETRY: <span className="text-[var(--color-hazard-amber)] text-base">SYNCED</span>
                    </div>
                </div>

                {/* View Selection Navigation */}
                <div className="hud-panel p-2 flex space-x-2">
                    {["SCANNER", "REACTOR", "LEDGER"].map((view) => (
                        <button
                            key={view}
                            onClick={() => setActiveView(view as ViewState)}
                            className={`px-8 py-3 text-lg font-mono tracking-wider transition-all duration-300 ${activeView === view
                                ? "bg-[var(--color-plasma-teal)] text-black font-bold shadow-[0_0_20px_rgba(0,242,255,0.8)] scale-105"
                                : "text-gray-400 hover:text-white hover:bg-white/5"
                                }`}
                        >
                            {view}
                        </button>
                    ))}
                </div>

            </div>

            {/* DYNAMIC SIDE PANELS DEPENDING ON VIEW */}
            <div className="flex-1 flex items-center justify-between pointer-events-none mt-6 mb-6">

                {/* LEFT PANEL */}
                <div className="w-[500px] pointer-events-auto transition-opacity duration-500">

                    {activeView === "SCANNER" && (
                        <div className="hud-panel p-6 h-full flex flex-col">
                            <h2 className="text-xl font-bold tracking-widest text-[#00F2FF] mb-6 flex items-center border-b border-[var(--color-glass-border)] pb-3">
                                <Camera className="w-6 h-6 mr-3" /> OPTICAL SENSOR ALIGNMENT
                            </h2>
                            <div className="flex-1 min-h-[350px] relative mt-2">
                                <WebcamDetector onDetect={handleDetect} />
                            </div>
                            <div className="mt-6 text-sm font-mono text-gray-300 space-y-1">
                                <p>AI MODEL: GEMINI 2.0 FLASH VISION</p>
                                <p>PROCESSING: IPCC FOD DOC MAPPING</p>
                                {systemData && (
                                    <div className="mt-4 p-3 bg-black/40 border border-[#00F2FF]/30 rounded text-[#00F2FF]">
                                        <p className="font-bold text-lg mb-1">LAST SCAN:</p>
                                        <p className="uppercase text-white text-base">Type: {systemData.waste_class || "UNKNOWN"}</p>

                                        <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-[#00F2FF]/20">
                                            <p className="text-sm">BIODEGRADABLE:
                                                <span className={systemData.biodegradable ? "text-green-400 ml-2 font-bold" : "text-gray-500 ml-2 font-bold"}>
                                                    {systemData.biodegradable ? "YES" : "NO"}
                                                </span>
                                            </p>
                                            <p className="text-sm">RECYCLABLE:
                                                <span className={systemData.recyclable ? "text-green-400 ml-2 font-bold" : "text-gray-500 ml-2 font-bold"}>
                                                    {systemData.recyclable ? "YES" : "NO"}
                                                </span>
                                            </p>
                                            <p className="text-sm col-span-2">HAZARDOUS:
                                                <span className={systemData.hazardous ? "text-red-500 ml-2 font-bold animate-pulse" : "text-green-400 ml-2 font-bold"}>
                                                    {systemData.hazardous ? "YES (DANGER)" : "NO"}
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeView === "REACTOR" && systemData && (
                        <div className="hud-panel p-8 h-full flex flex-col">
                            <h2 className="text-xl font-bold tracking-widest text-[var(--color-hazard-amber)] mb-6 flex items-center border-b border-[var(--color-hazard-amber)]/20 pb-3">
                                <Flame className="w-6 h-6 mr-3" /> 5500°C PLASMA CORE INTAKE
                            </h2>

                            <div className="space-y-6 font-mono text-lg mt-4">
                                <div className="flex justify-between border-b border-white/10 pb-3">
                                    <span className="text-gray-400">INPUT MATERIAL</span>
                                    <span className="text-white uppercase font-bold text-xl">{systemData.waste_class}</span>
                                </div>
                                <div className="flex justify-between border-b border-white/10 pb-3">
                                    <span className="text-gray-400">EST. MASS (KG)</span>
                                    <span className="text-[var(--color-plasma-teal)] font-bold text-xl">{systemData.mass_kg}</span>
                                </div>
                                <div className="flex justify-between border-b border-white/10 pb-3">
                                    <span className="text-gray-400">AVOIDED METHANE</span>
                                    <span className="text-[var(--color-hazard-amber)] font-bold">{systemData.ch4_kg?.toFixed(3)} kg</span>
                                </div>
                                <div className="flex justify-between pb-3">
                                    <span className="text-gray-400">AVOIDED CO2E</span>
                                    <span className="text-[#ff3333] font-bold">{systemData.co2e_kg?.toFixed(2)} kg</span>
                                </div>
                            </div>

                            <button
                                onClick={() => setActiveView("LEDGER")}
                                className="mt-10 w-full scan-btn py-5 font-bold tracking-widest text-lg"
                            >
                                INITIATE TOKENIZATION ➔
                            </button>
                        </div>
                    )}

                    {activeView === "LEDGER" && (
                        <div className="hud-panel p-8 h-full flex flex-col">
                            <h2 className="text-xl font-bold tracking-widest text-[var(--color-plasma-teal)] mb-6 flex items-center border-b border-[var(--color-plasma-teal)]/20 pb-3">
                                <Database className="w-6 h-6 mr-3" /> IMMUTABLE LEDGER
                            </h2>

                            <p className="text-base text-gray-300 leading-relaxed font-mono">
                                The CCTS SmartMarket prevents double-counting by tokenizing verified physical waste destruction into ERC-20 Carbon Credits.
                            </p>

                            {systemData && systemData.carbon_credits > 0 && !mintResult && (
                                <button
                                    onClick={handleMint}
                                    disabled={isMinting}
                                    className="mt-10 w-full bg-[var(--color-plasma-teal)] text-black font-bold py-5 text-lg hover:shadow-[0_0_25px_rgba(0,242,255,0.8)] transition-all disabled:opacity-50"
                                >
                                    {isMinting ? "WRITING TO CHAIN..." : `MINT ${systemData.carbon_credits.toFixed(4)} CCT`}
                                </button>
                            )}

                            {mintResult && (
                                <div className="mt-8 p-6 bg-[var(--color-plasma-teal)]/10 border border-[var(--color-plasma-teal)]/40 text-center rounded-lg">
                                    <CheckCircle2 className="w-12 h-12 text-[var(--color-plasma-teal)] mx-auto mb-4" />
                                    <p className="text-lg font-bold font-mono text-[var(--color-plasma-teal)] uppercase">MINT SUCCESSFUL</p>
                                    <p className="text-sm font-mono text-white mt-3 break-all">TX: {mintResult.tx_hash}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* RIGHT PANEL (Always shows current thermodynamic/AI metrics to simulate HUD density) */}
                {systemData && (
                    <div className="w-[400px] pointer-events-auto hud-panel p-6 font-mono text-sm text-gray-300 self-end mb-4">
                        <h3 className="text-white font-bold text-lg border-b border-white/20 pb-3 mb-4">IPCC / FOD CALCULATION</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between"><span>DOC_f:</span><span className="text-white font-bold">0.5</span></div>
                            <div className="flex justify-between"><span>METHANE CORR (MCF):</span><span className="text-white font-bold">1.0</span></div>
                            <div className="flex justify-between"><span>OXIDATION (OX):</span><span className="text-white font-bold">0.1</span></div>
                            <div className="flex justify-between mt-6 pt-3 border-t border-white/10 text-base">
                                <span>GWP_100:</span><span className="text-[#FFB800] font-bold">28x CO2</span>
                            </div>
                        </div>
                    </div>
                )}

            </div>

            {/* BOTTOM BAR */}
            <div className="w-full hud-panel p-4 flex justify-between items-center px-8 pointer-events-auto">
                <div className="flex items-center space-x-10">
                    <div className="flex items-center"><Zap className="w-6 h-6 text-yellow-400 mr-3" /> <span className="text-base font-bold font-mono text-white">THERMAL EFF: 68%</span></div>
                    <div className="flex items-center"><Factory className="w-6 h-6 text-gray-400 mr-3" /> <span className="text-base font-bold font-mono text-white">TURBINE EFF: 35%</span></div>
                </div>
                <div className="text-sm font-bold font-mono text-[var(--color-plasma-teal)] px-4 py-2 border border-[var(--color-plasma-teal)]/30 bg-black/50 rounded">
                    POLYGON MAINNET RPC OK
                </div>
            </div>
        </div>
    );
}
