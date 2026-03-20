"use client";

import React, { useState, useEffect } from "react";
import { Database, TrendingUp, ArrowUpRight, CheckCircle2, History, ShoppingCart, Wallet } from "lucide-react";

export default function CCTSPage() {
    const [systemData, setSystemData] = useState<any>(null);
    const [isMinting, setIsMinting] = useState(false);
    const [mintResult, setMintResult] = useState<any>(null);
    const [balance, setBalance] = useState(12.4502);

    useEffect(() => {
        const stored = localStorage.getItem("atmos_last_detection");
        if (stored) {
            setSystemData(JSON.parse(stored));
        }
    }, []);

    const handleMint = async () => {
        if (!systemData || !systemData.carbon_credits) return;
        setIsMinting(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/mint`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    detection_result: systemData,
                    methane_data: systemData,
                    minter_address: "0xATMOS_USER_WALLET"
                }),
            });
            const data = await res.json();
            if (data.success) {
                setMintResult(data);
                setBalance(prev => prev + systemData.carbon_credits);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsMinting(false);
        }
    };

    return (
        <main className="min-h-screen pb-12 px-8 flex flex-col items-center bg-transparent">

            <div className="w-full max-w-7xl flex justify-between items-end mb-8 border-b border-[var(--color-plasma-teal)]/30 pb-4">
                <div>
                    <h1 className="text-4xl font-bold tracking-widest text-[var(--color-plasma-teal)] flex items-center">
                        <Database className="w-10 h-10 mr-4" />
                        CCTS SMARTMARKET
                    </h1>
                    <p className="font-mono text-gray-400 mt-2">
                        MODULE 3: Immutable Carbon Credit Minting & Verified Offset Ledger
                    </p>
                </div>
                <div className="hud-panel px-6 py-3 border-l-4 border-[var(--color-plasma-teal)]">
                    <span className="text-gray-500 font-mono text-xs block mb-1">CURRENT BALANCE</span>
                    <span className="text-2xl font-bold text-white font-mono flex items-center">
                        <Wallet className="w-5 h-5 mr-3 text-[var(--color-plasma-teal)]" />
                        {balance.toFixed(4)} CCT
                    </span>
                </div>
            </div>

            <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left: Minting & Inventory */}
                <div className="lg:col-span-2 space-y-6">

                    <div className="hud-panel p-8">
                        <h2 className="text-2xl font-bold font-mono tracking-widest text-white mb-6 flex items-center border-b border-white/10 pb-3">
                            <CheckCircle2 className="w-6 h-6 mr-3 text-green-500" />
                            VERIFIED EMISSIONS REDUCTION
                        </h2>

                        {systemData ? (
                            <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                                <div className="flex-1 space-y-4">
                                    <div className="bg-black/40 p-6 border-l-4 border-[var(--color-plasma-teal)]">
                                        <span className="text-gray-500 font-mono text-xs block mb-1 text-sm uppercase">Verification Source</span>
                                        <p className="text-xl text-white font-bold">ATMOS-DS-{Math.floor(Math.random() * 10000)} / {systemData.waste_class.toUpperCase()}</p>
                                        <p className="font-mono text-sm text-[var(--color-plasma-teal)] mt-1">Status: Verified by WasteVision AI</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-black/40 border border-white/5">
                                            <span className="text-gray-500 font-mono text-xs block mb-1">CO2e SAVED</span>
                                            <span className="text-xl font-bold font-mono text-[#ff3333]">{systemData.co2e_kg?.toFixed(2)} KG</span>
                                        </div>
                                        <div className="p-4 bg-black/40 border border-white/5">
                                            <span className="text-gray-500 font-mono text-xs block mb-1">MINTABLE CREDITS</span>
                                            <span className="text-xl font-bold font-mono text-[var(--color-plasma-teal)]">{systemData.carbon_credits?.toFixed(4)} CCT</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="w-full md:w-auto">
                                    {mintResult ? (
                                        <div className="p-6 bg-[var(--color-plasma-teal)]/10 border border-[var(--color-plasma-teal)]/40 rounded-lg text-center min-w-[300px]">
                                            <CheckCircle2 className="w-12 h-12 text-[var(--color-plasma-teal)] mx-auto mb-4" />
                                            <p className="text-lg font-bold font-mono text-[var(--color-plasma-teal)] uppercase">MINT SUCCESSFUL</p>
                                            <p className="text-xs font-mono text-white mt-3 opacity-60 break-all">HASH: {mintResult.tx_hash}</p>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={handleMint}
                                            disabled={isMinting || !systemData.carbon_credits}
                                            className="w-full md:px-12 py-6 bg-[var(--color-plasma-teal)] text-black font-bold font-mono tracking-widest text-xl hover:shadow-[0_0_30px_rgba(0,242,255,0.7)] hover:scale-105 transition-all disabled:opacity-50"
                                        >
                                            {isMinting ? "EXECUTING MINT..." : "MINT CREDITS"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="py-12 text-center text-gray-500 font-mono">
                                <Database className="w-16 h-16 mx-auto mb-4 opacity-20 text-[var(--color-plasma-teal)]" />
                                <p>NO UNMINTED DATA FOUND</p>
                                <p className="text-xs mt-2">Complete a waste scan and simulation cycle to generate credits.</p>
                            </div>
                        )}
                    </div>

                    <div className="hud-panel p-6">
                        <h2 className="text-xl font-bold font-mono tracking-widest text-white mb-6 flex items-center border-b border-white/10 pb-3">
                            <History className="w-6 h-6 mr-3 text-gray-400" />
                            TRANSACTION LEDGER
                        </h2>
                        <div className="space-y-3 font-mono text-sm uppercase">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex justify-between p-4 bg-black/40 border border-white/5 hover:border-[var(--color-plasma-teal)]/30 transition-colors">
                                    <div className="flex items-center">
                                        <CheckCircle2 className="w-4 h-4 mr-3 text-green-500" />
                                        <span>Mint: Methane Avoidance (Plastic)</span>
                                    </div>
                                    <div className="flex space-x-8">
                                        <span className="text-gray-500">2026-03-07 15:{10 + i}:44</span>
                                        <span className="text-[var(--color-plasma-teal)] font-bold">+0.0042 CCT</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

                {/* Right: Live Market */}
                <div className="space-y-6">

                    <div className="hud-panel p-6 border-t-4 border-[var(--color-hazard-amber)]">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold font-mono tracking-widest text-[#FFB800] flex items-center">
                                <TrendingUp className="w-6 h-6 mr-3" />
                                LIVE MARKET
                            </h2>
                            <span className="px-2 py-1 bg-green-500/20 text-green-500 text-[10px] font-bold rounded animate-pulse font-mono">
                                TRADING OPEN
                            </span>
                        </div>

                        <div className="space-y-6">
                            <div className="p-4 bg-black/40 border border-white/5 rounded">
                                <span className="text-gray-500 font-mono text-xs block mb-2 uppercase tracking-tighter">Current Floor Price</span>
                                <div className="flex items-baseline space-x-2">
                                    <span className="text-3xl font-bold text-white">$42.80</span>
                                    <span className="text-green-500 text-sm font-mono">+4.2%</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Available Buy Orders</h4>
                                {[
                                    { buyer: "IndiGo Airlines", qty: 250, price: 42.90 },
                                    { buyer: "Adani Enterprise", qty: 5000, price: 42.75 },
                                    { buyer: "Tata Power", qty: 850, price: 42.85 }
                                ].map((order, i) => (
                                    <div key={i} className="p-3 bg-white/5 border border-white/5 flex justify-between items-center hover:bg-white/10 transition-colors cursor-pointer group">
                                        <div>
                                            <p className="text-sm font-bold text-white uppercase">{order.buyer}</p>
                                            <p className="text-[10px] font-mono text-gray-500">Seeking: {order.qty} CCT</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-green-400 font-mono">${order.price}</p>
                                            <button className="text-[10px] text-[var(--color-plasma-teal)] font-bold opacity-0 group-hover:opacity-100 transition-opacity">SELL NOW ➔</button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button className="w-full py-4 bg-white/5 border border-white/10 text-white font-bold font-mono tracking-widest text-sm hover:bg-white/20 transition-all flex items-center justify-center">
                                <ShoppingCart className="w-4 h-4 mr-3" /> VIEW FULL ORDERBOOK
                            </button>
                        </div>
                    </div>

                    <div className="hud-panel p-6">
                        <h3 className="text-sm font-bold text-gray-400 mb-4 flex items-center">
                            <Info className="w-4 h-4 mr-2" /> CARBON MARKET INSIGHT
                        </h3>
                        <p className="text-xs font-mono text-gray-500 leading-relaxed italic">
                            Carbon prices are currently trending upward in the Indian Voluntary Carbon Market (VCM) following new ESG reporting requirements for the top 100 SEBI-listed companies.
                        </p>
                    </div>

                </div>

            </div>
        </main>
    );
}

function Info({ className }: { className?: string }) {
    return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>;
}
