"use client";

import React, { useRef, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Float, Preload, Text, Sparkles } from "@react-three/drei";

import * as THREE from "three";
import { ViewState } from "@/types";
import PlasmaCore from "@/components/digital-twin/PlasmaCore";
import ScannerBed from "@/components/digital-twin/ScannerBed";
import LedgerChain from "@/components/digital-twin/LedgerChain";

// Camera Controller to smoothly transition between views
const CameraController = ({ activeView }: { activeView: ViewState }) => {
    useFrame((state) => {
        let targetPos = new THREE.Vector3(0, 2, 8); // Default Scanner view
        let targetLookAt = new THREE.Vector3(0, 0, 0);

        if (activeView === "SCANNER") {
            targetPos.set(0, 4, 10);
            targetLookAt.set(0, 0, 0);
        } else if (activeView === "REACTOR") {
            targetPos.set(8, 2, 2);
            targetLookAt.set(5, 0, 0);
        } else if (activeView === "LEDGER") {
            targetPos.set(-8, 5, -5);
            targetLookAt.set(-10, 0, 0);
        }

        state.camera.position.lerp(targetPos, 0.05);
        state.camera.lookAt(targetLookAt);
    });
    return null;
};

// Floating background points representing CO2 / data dust
const ParticleField = () => {
    return (
        <Sparkles count={1500} scale={40} size={5} speed={0.4} opacity={0.3} color="#00F2FF" />
    );
};

interface SceneProps {
    activeView: ViewState;
    systemData: any;
}

export default function Scene({ activeView, systemData }: SceneProps) {
    return (
        <Canvas camera={{ position: [0, 4, 10], fov: 50 }}>
            {/* Lights */}
            <ambientLight intensity={0.2} />
            <directionalLight position={[10, 10, 5]} intensity={1} color="#FFB800" />
            <pointLight position={[-10, -10, -10]} intensity={2} color="#00F2FF" />

            {/* Environment for reflections */}
            <Environment preset="night" />

            {/* The 3 Core 3D Modules arranged in space */}

            {/* Center: Scanner Bed */}
            <group position={[0, -1, 0]}>
                <ScannerBed systemData={systemData} />
            </group>

            {/* Right side: Plasma Reactor */}
            <group position={[5, 0, 0]}>
                <PlasmaCore systemData={systemData} activeView={activeView} />
            </group>

            {/* Left side: Immutable Ledger Blocks */}
            <group position={[-10, 0, 0]}>
                <LedgerChain systemData={systemData} />
            </group>

            {/* Camera Transition Logic */}
            <CameraController activeView={activeView} />

            {/* Background Particles */}
            <ParticleField />



            <Preload all />
            {/* <OrbitControls makeDefault /> */}
            {/* Disabled OrbitControls since camera logic overrides it smoothly */}
        </Canvas>
    );
}
