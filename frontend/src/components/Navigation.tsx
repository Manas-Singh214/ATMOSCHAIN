"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Camera, Flame, Database, Home } from "lucide-react";

export default function Navigation() {
    const pathname = usePathname();

    const links = [
        { href: "/", label: "OVERVIEW", icon: <Home className="w-4 h-4 mr-2" /> },
        { href: "/wastevision", label: "WASTEVISION AI", icon: <Camera className="w-4 h-4 mr-2" /> },
        { href: "/plasmasim", label: "PLASMA REACTOR", icon: <Flame className="w-4 h-4 mr-2" /> },
        { href: "/ccts", label: "CCT MARKET", icon: <Database className="w-4 h-4 mr-2" /> },
    ];

    return (
        <nav className="w-full flex justify-between items-center p-6 pointer-events-none">
            {/* Logo */}
            <Link href="/" className="hud-panel p-3 flex flex-col min-w-[250px] hover:scale-105 transition-transform cursor-pointer border-l-2 border-[var(--color-plasma-teal)] pointer-events-auto">
                <h1 className="text-2xl font-bold tracking-widest text-glow-teal text-white flex items-center">
                    <Activity className="w-6 h-6 mr-3 text-[var(--color-plasma-teal)]" />
                    ATMOSCHAIN <span className="text-[var(--color-plasma-teal)] ml-2 text-sm font-normal">v1.0</span>
                </h1>
                <div className="mt-1 text-[10px] font-mono text-[var(--color-plasma-teal)] flex justify-between">
                    <span>SYSTEM STATUS: <span className="animate-pulse text-white">ONLINE</span></span>
                    <span className="ml-4">TELEMETRY: <span className="text-[var(--color-hazard-amber)]">SYNCED</span></span>
                </div>
            </Link>

            {/* Global Nav Links */}
            <div className="hud-panel p-2 flex space-x-2 pointer-events-auto">
                {links.map((link) => {
                    const isActive = pathname === link.href;
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`px-4 py-2 flex items-center text-sm font-mono tracking-wider transition-all duration-300 ${isActive
                                ? "bg-[var(--color-plasma-teal)] text-black font-bold shadow-[0_0_20px_rgba(0,242,255,0.8)] scale-105"
                                : "text-gray-400 hover:text-white hover:bg-white/5"
                                }`}
                        >
                            {link.icon}
                            {link.label}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
