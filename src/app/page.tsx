"use client";

import React, { useState, useEffect } from "react";
import { ArrowRight, ShieldCheck, Zap, Globe } from "lucide-react";
import Link from "next/link";

export default function LandingPage() {
  const [systemData, setSystemData] = useState<any>(null);

  useEffect(() => {
    const stored = localStorage.getItem("atmos_last_detection");
    if (stored) {
      setSystemData(JSON.parse(stored));
    }
  }, []);

  return (
    <main className="w-screen h-screen relative selection:bg-plasma-teal selection:text-black bg-transparent">
      {/* Overlay Content */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none p-6">
        <div className="max-w-4xl w-full flex flex-col items-center text-center space-y-12 mb-20 pointer-events-auto">

          <div className="space-y-4">
            <h2 className="text-[#00F2FF] font-mono tracking-[0.5em] text-sm animate-pulse">ENVIRONMENTAL INTELLIGENCE PROTOCOL</h2>
            <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter drop-shadow-[0_0_30px_rgba(0,242,255,0.3)]">
              ATMOSCHAIN
            </h1>
            <p className="text-xl text-gray-400 font-mono max-w-2xl mx-auto">
              Decentralized waste-to-energy monitoring system utilizing AI vision and plasma gasification simulation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
            <div className="hud-panel p-6 border-t-2 border-[#00F2FF]/50 bg-black/60 backdrop-blur-xl hover:scale-105 transition-transform">
              <Globe className="w-8 h-8 text-[#00F2FF] mb-4 mx-auto" />
              <h3 className="text-white font-bold mb-2">WASTE AI</h3>
              <p className="text-xs text-gray-500 font-mono">Real-time classification using computer vision.</p>
            </div>
            <div className="hud-panel p-6 border-t-2 border-[#FFB800]/50 bg-black/60 backdrop-blur-xl hover:scale-105 transition-transform">
              <Zap className="w-8 h-8 text-[#FFB800] mb-4 mx-auto" />
              <h3 className="text-white font-bold mb-2">PLASMA SIM</h3>
              <p className="text-xs text-gray-500 font-mono">Thermodynamic energy recovery simulation.</p>
            </div>
            <div className="hud-panel p-6 border-t-2 border-green-500/50 bg-black/60 backdrop-blur-xl hover:scale-105 transition-transform">
              <ShieldCheck className="w-8 h-8 text-green-500 mb-4 mx-auto" />
              <h3 className="text-white font-bold mb-2">CCT LEDGER</h3>
              <p className="text-xs text-gray-500 font-mono">Immutable carbon credit generation.</p>
            </div>
          </div>

          <Link href="/wastevision" className="group relative px-12 py-5 bg-[#00F2FF] text-black font-black tracking-widest text-xl hover:scale-110 transition-all hover:shadow-[0_0_50px_rgba(0,242,255,0.5)]">
            INITIALIZE SYSTEM <ArrowRight className="inline-block ml-3 group-hover:translate-x-2 transition-transform" />
          </Link>

        </div>
      </div>
    </main>
  );
}
