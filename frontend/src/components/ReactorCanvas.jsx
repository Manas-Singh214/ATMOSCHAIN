import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function ReactorCanvas({ isRunning, progress }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.1, 1000);
    camera.position.set(0, 2, 6);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0x111111);
    scene.add(ambientLight);
    const bluePoint = new THREE.PointLight(0x00d4ff, 2, 20);
    bluePoint.position.set(4, 4, 4);
    scene.add(bluePoint);
    const greenPoint = new THREE.PointLight(0x00ff88, 1.5, 20);
    greenPoint.position.set(-4, -2, 2);
    scene.add(greenPoint);

    // Core reactor cube
    const coreGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const coreMat = new THREE.MeshPhongMaterial({
      color: 0x00d4ff,
      emissive: 0x003344,
      specular: 0x00ffff,
      shininess: 120,
      wireframe: false,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    scene.add(core);

    // Wireframe overlay
    const wireGeo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x00d4ff, wireframe: true, opacity: 0.3, transparent: true });
    const wireCore = new THREE.Mesh(wireGeo, wireMat);
    scene.add(wireCore);

    // Turbine ring
    const ringGeo = new THREE.TorusGeometry(2.2, 0.08, 16, 80);
    const ringMat = new THREE.MeshPhongMaterial({
      color: 0x00ff88,
      emissive: 0x003322,
      specular: 0x00ff88,
      shininess: 100,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);

    // Second ring (tilted)
    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(2.5, 0.05, 16, 80),
      new THREE.MeshPhongMaterial({ color: 0x7c3aed, emissive: 0x220033, specular: 0x9966ff, shininess: 80 })
    );
    ring2.rotation.x = Math.PI / 4;
    ring2.rotation.z = Math.PI / 6;
    scene.add(ring2);

    // Particles (gas bubbles)
    const particleCount = 80;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const particleData = [];

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 1.2;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 4;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
      particleData.push({
        speed: 0.005 + Math.random() * 0.015,
        startY: positions[i * 3 + 1],
      });
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x00ff88,
      size: 0.08,
      transparent: true,
      opacity: 0.7,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    sceneRef.current = { core, wireCore, ring, ring2, particles, particleData, positions };

    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const running = sceneRef.current?.isRunning || false;
      const prog = sceneRef.current?.progress || 0;

      const speed = running ? 0.008 + prog * 0.04 : 0.003;

      core.rotation.x += speed * 0.7;
      core.rotation.y += speed;
      wireCore.rotation.x -= speed * 0.5;
      wireCore.rotation.y -= speed * 1.2;
      ring.rotation.z += running ? 0.02 + prog * 0.05 : 0.005;
      ring2.rotation.y += running ? 0.015 + prog * 0.04 : 0.004;

      // Animate particles if running
      const pos = particles.geometry.attributes.position.array;
      for (let i = 0; i < particleCount; i++) {
        if (running) {
          pos[i * 3 + 1] += particleData[i].speed * (1 + prog * 3);
          if (pos[i * 3 + 1] > 2.5) {
            pos[i * 3 + 1] = -2.5;
          }
        }
      }
      particles.geometry.attributes.position.needsUpdate = true;

      // Emissive glow based on progress
      if (running) {
        coreMat.emissive.setRGB(0, prog * 0.3, prog * 0.5);
        particleMat.opacity = 0.4 + prog * 0.6;
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  // Update refs when props change
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.isRunning = isRunning;
      sceneRef.current.progress = progress;
    }
  }, [isRunning, progress]);

  return (
    <div ref={mountRef} style={{ width: '100%', height: '100%', borderRadius: '12px', overflow: 'hidden' }} />
  );
}
