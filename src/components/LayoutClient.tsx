"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Navigation from "@/components/Navigation";
import Scene from "@/components/digital-twin/Scene";
import { ViewState } from "@/types";

export default function LayoutClient({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [activeView, setActiveView] = useState<ViewState>("SCANNER");

    useEffect(() => {
        if (pathname === "/") setActiveView("SCANNER");
        else if (pathname === "/wastevision") setActiveView("SCANNER");
        else if (pathname === "/plasmasim") setActiveView("REACTOR");
        else if (pathname === "/ccts") setActiveView("LEDGER");
    }, [pathname]);

    return (
        <div className="relative w-screen h-screen overflow-hidden flex flex-col">
            {/* Persistent 3D Background */}
            <div className="fixed inset-0 z-0 pointer-events-none bg-[#050505]">
                <Scene activeView={activeView} systemData={null} />
            </div>

            {/* Global Navigation - Fixed at top overlay */}
            <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
                <Navigation />
            </div>

            {/* Content Wrapper - Using flex grow or absolute with padding */}
            <div className="relative z-10 flex-1 w-full overflow-y-auto overflow-x-hidden scrollbar-hide pt-36">
                {children}
            </div>
        </div>
    );
}
