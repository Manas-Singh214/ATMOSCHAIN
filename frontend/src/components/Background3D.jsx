import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useTheme } from '../context/ThemeContext';

export default function Background3D() {
  const mountRef = useRef(null);
  const { isDark } = useTheme();

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const W = window.innerWidth;
    const H = window.innerHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, W / H, 0.1, 1000);
    camera.position.set(0, 0, 16);

    // ── Theme-based colors ─────────────────────────────────────────
    const planetCol    = isDark ? 0xff6622 : 0x1155cc;
    const planetInner  = isDark ? 0x110600 : 0xa8d4ee;
    const planetInnerE = isDark ? 0x1a0800 : 0x3388cc;
    const ringCol1     = isDark ? 0x00e5ff : 0x004499;
    const ringCol2     = isDark ? 0x00cccc : 0x2266bb;
    const starCol      = isDark ? 0xffffff : 0x002255;
    const starOpacity  = isDark ? 0.6      : 0.25;
    const debrisCols   = isDark
      ? [0x00e5ff, 0xff6622, 0x4455aa]
      : [0x0055cc, 0x3399cc, 0x2244aa];
    const gridCol1     = isDark ? 0x003333 : 0x5588aa;
    const gridCol2     = isDark ? 0x001a1a : 0x7799bb;
    const gridOpacity  = isDark ? 0.3      : 0.15;
    const ambientCol   = isDark ? 0x111122 : 0xaabbcc;
    const ambientInt   = isDark ? 1.0      : 1.5;
    const lightCol1    = isDark ? 0x00e5ff : 0x4488ff;
    const lightCol2    = isDark ? 0xff6600 : 0x3399cc;

    // ── Lights ──────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(ambientCol, ambientInt));
    const light1 = new THREE.PointLight(lightCol1, isDark ? 2.0 : 1.5, 60);
    light1.position.set(8, 6, 10);
    scene.add(light1);
    const light2 = new THREE.PointLight(lightCol2, isDark ? 1.2 : 1.0, 60);
    light2.position.set(-10, -4, 5);
    scene.add(light2);

    // ── Main wireframe planet ──────────────────────────────────────
    const planetGeo = new THREE.SphereGeometry(3.0, 26, 26);
    const planetMat = new THREE.MeshBasicMaterial({
      color: planetCol,
      wireframe: true,
      opacity: isDark ? 0.45 : 0.5,
      transparent: true,
    });
    const planet = new THREE.Mesh(planetGeo, planetMat);
    planet.position.set(7, 0, -4);
    scene.add(planet);

    // ── Inner solid sphere ─────────────────────────────────────────
    const innerGeo = new THREE.SphereGeometry(2.8, 14, 14);
    const innerMat = new THREE.MeshPhongMaterial({
      color: planetInner,
      emissive: planetInnerE,
      transparent: true,
      opacity: isDark ? 0.75 : 0.6,
    });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.position.copy(planet.position);
    scene.add(inner);

    // ── Orbital rings ──────────────────────────────────────────────
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(4.3, 0.055, 8, 110),
      new THREE.MeshBasicMaterial({ color: ringCol1, transparent: true, opacity: isDark ? 0.4 : 0.35 })
    );
    ring.position.copy(planet.position);
    ring.rotation.x = Math.PI / 2.3;
    ring.rotation.z = -0.15;
    scene.add(ring);

    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(4.9, 0.028, 8, 110),
      new THREE.MeshBasicMaterial({ color: ringCol2, transparent: true, opacity: isDark ? 0.2 : 0.18 })
    );
    ring2.position.copy(planet.position);
    ring2.rotation.x = Math.PI / 2.3;
    ring2.rotation.z = -0.1;
    scene.add(ring2);

    // ── Floating debris ────────────────────────────────────────────
    const debris = [];
    const debrisGeos = [
      new THREE.TetrahedronGeometry(0.28),
      new THREE.OctahedronGeometry(0.22),
      new THREE.BoxGeometry(0.3, 0.3, 0.3),
      new THREE.IcosahedronGeometry(0.20),
    ];
    for (let i = 0; i < 12; i++) {
      const geo = debrisGeos[i % debrisGeos.length];
      const mat = new THREE.MeshBasicMaterial({
        color: debrisCols[i % 3],
        wireframe: true,
        transparent: true,
        opacity: 0.3 + Math.random() * 0.25,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        (Math.random() - 0.5) * 22,
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 6 - 4
      );
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      const speed = {
        x: (Math.random() - 0.5) * 0.006,
        y: (Math.random() - 0.5) * 0.006,
        z: (Math.random() - 0.5) * 0.004,
      };
      debris.push({ mesh, speed });
      scene.add(mesh);
    }

    // ── Star field ─────────────────────────────────────────────────
    const starCount = isDark ? 320 : 120;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3]     = (Math.random() - 0.5) * 60;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 40;
      starPos[i * 3 + 2] = (Math.random() - 0.5) * 20 - 10;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: starCol, size: 0.055, transparent: true, opacity: starOpacity })
    );
    scene.add(stars);

    // ── Grid holographic floor ─────────────────────────────────────
    const gridHelper = new THREE.GridHelper(30, 30, gridCol1, gridCol2);
    gridHelper.position.set(0, -5.5, -5);
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = gridOpacity;
    scene.add(gridHelper);

    // ── Animation loop ─────────────────────────────────────────────
    let animId;
    let t = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      t += 0.005;

      planet.rotation.y += 0.0015;
      planet.rotation.x += 0.0004;
      inner.rotation.copy(planet.rotation);
      ring.rotation.z  += 0.001;
      ring2.rotation.z -= 0.0007;

      camera.position.x = Math.sin(t * 0.18) * 0.8;
      camera.position.y = Math.cos(t * 0.12) * 0.4;
      camera.lookAt(0, 0, 0);

      debris.forEach(({ mesh, speed }) => {
        mesh.rotation.x += speed.x;
        mesh.rotation.y += speed.y;
        mesh.rotation.z += speed.z;
      });

      stars.rotation.y += 0.0001;
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const W2 = window.innerWidth, H2 = window.innerHeight;
      camera.aspect = W2 / H2;
      camera.updateProjectionMatrix();
      renderer.setSize(W2, H2);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [isDark]); // Re-init when theme changes — gives new planet color

  return (
    <div
      ref={mountRef}
      style={{
        position: 'fixed', top: 0, left: 0,
        width: '100%', height: '100%',
        zIndex: -1, pointerEvents: 'none',
      }}
    />
  );
}
