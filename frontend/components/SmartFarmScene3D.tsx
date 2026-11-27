'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface SmartFarmScene3DProps {
  /** Normalized scroll progress from 0 to 1 across the opening showcase */
  scrollProgress: number;
}

export default function SmartFarmScene3D({ scrollProgress }: SmartFarmScene3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef(scrollProgress);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const [webglError, setWebglError] = useState(false);

  useEffect(() => {
    progressRef.current = scrollProgress;
  }, [scrollProgress]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError(true);
      return;
    }

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    // Bright sunny sky background
    scene.background = new THREE.Color(0x93d5fa);
    scene.fog = new THREE.FogExp2(0xc7e9fb, 0.011);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 220);
    camera.position.set(-10, 44, 42);

    // --- BRIGHT DAYLIGHT LIGHTING ---
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x4d7c0f, 1.25);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 2.3);
    sunLight.position.set(22, 28, -14);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 2;
    sunLight.shadow.camera.far = 90;
    const d = 30;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    scene.add(sunLight);

    const warmFill = new THREE.DirectionalLight(0xfef08a, 0.65);
    warmFill.position.set(-18, 12, 18);
    scene.add(warmFill);

    // --- SKY SUN & SOFT CLOUDS ---
    const sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(3.2, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    sunMesh.position.set(32, 32, -45);
    scene.add(sunMesh);

    const sunHalo = new THREE.Mesh(
      new THREE.SphereGeometry(5.2, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.25 })
    );
    sunHalo.position.copy(sunMesh.position);
    scene.add(sunHalo);

    const cloudGroup = new THREE.Group();
    scene.add(cloudGroup);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      emissive: 0xf8fafc,
      emissiveIntensity: 0.2,
    });
    const cloudPositions = [
      [-24, 26, -18, 1.4],
      [14, 29, -24, 1.7],
      [-6, 33, -28, 1.3],
      [28, 25, -12, 1.3],
      [-32, 27, -4, 1.5],
      [-4, 24, 18, 1.35],
      [12, 22, 16, 1.2],
    ];
    cloudPositions.forEach(([cx, cy, cz, scale]) => {
      const c = new THREE.Group();
      const puffs = [
        [0, 0, 0, 1.6],
        [-1.3, -0.2, 0.2, 1.15],
        [1.3, -0.15, -0.1, 1.25],
        [0.4, 0.5, 0.1, 1.1],
      ];
      puffs.forEach(([px, py, pz, r]) => {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 14), cloudMat);
        puff.position.set(px, py, pz);
        c.add(puff);
      });
      c.position.set(cx, cy, cz);
      c.scale.setScalar(scale);
      cloudGroup.add(c);
    });

    // --- EXPANSIVE BRIGHT TERRACED FIELDS (RUỘNG BẬC THANG & CÁNH ĐỒNG RỘNG LỚN) ---
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    // Base rolling green meadow floor
    const groundGeo = new THREE.PlaneGeometry(140, 140, 48, 48);
    groundGeo.rotateX(-Math.PI / 2);
    const gPos = groundGeo.attributes.position;
    for (let i = 0; i < gPos.count; i++) {
      const gx = gPos.getX(i);
      const gz = gPos.getZ(i);
      const dist = Math.sqrt(gx * gx + gz * gz);
      const hill =
        Math.sin(gx * 0.08) * Math.cos(gz * 0.08) * 1.4 +
        (dist > 28 ? (dist - 28) * 0.18 : 0);
      gPos.setY(i, hill - 0.8);
    }
    groundGeo.computeVertexNormals();
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x4ade80,
      roughness: 0.85,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.receiveShadow = true;
    worldGroup.add(groundMesh);

    // Vibrant Terraced Rice / Crop Layers
    const terracePalette = [
      0x22c55e, // Fresh Emerald
      0x4ade80, // Bright Spring Green
      0x84cc16, // Vibrant Lime
      0xa3e635, // Sunlit Chartreuse
      0xfacc15, // Golden Harvest
      0x16a34a, // Deep Lush Green
    ];
    const bundMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.9 });
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.12,
      metalness: 0.15,
      transparent: true,
      opacity: 0.85,
    });

    const terraceCount = 9;
    for (let t = 0; t < terraceCount; t++) {
      const radiusX = 28 - t * 2.55;
      const radiusZ = 22 - t * 1.95;
      const elevation = t * 0.52;

      // Soil terrace wall / ridge (bờ ruộng)
      const bundGeo = new THREE.CylinderGeometry(radiusX + 0.28, radiusX + 0.45, 0.58, 28);
      bundGeo.scale(1, 1, radiusZ / radiusX);
      const bund = new THREE.Mesh(bundGeo, bundMat);
      bund.position.set(Math.sin(t * 0.4) * 1.1, elevation - 0.15, -t * 0.65);
      bund.receiveShadow = true;
      bund.castShadow = true;
      worldGroup.add(bund);

      // Lush crop / water surface on each terrace
      const isWaterTerrace = t === 2 || t === 5;
      const surfaceMat = isWaterTerrace
        ? waterMat
        : new THREE.MeshStandardMaterial({
            color: terracePalette[t % terracePalette.length],
            roughness: 0.72,
          });
      const surfaceGeo = new THREE.CylinderGeometry(radiusX, radiusX, 0.14, 28);
      surfaceGeo.scale(1, 1, radiusZ / radiusX);
      const surface = new THREE.Mesh(surfaceGeo, surfaceMat);
      surface.position.set(Math.sin(t * 0.4) * 1.1, elevation + 0.12, -t * 0.65);
      surface.receiveShadow = true;
      worldGroup.add(surface);
    }

    // Winding Turquoise Irrigation Canal across the foreground
    const canalCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-34, 0.05, 16),
      new THREE.Vector3(-12, 0.05, 19),
      new THREE.Vector3(8, 0.05, 14),
      new THREE.Vector3(32, 0.05, 18),
    ]);
    const canalGeo = new THREE.TubeGeometry(canalCurve, 48, 1.35, 8, false);
    canalGeo.scale(1, 0.12, 1);
    const canalMesh = new THREE.Mesh(canalGeo, waterMat);
    canalMesh.receiveShadow = true;
    worldGroup.add(canalMesh);

    // --- INSTANCED SWAYING CROP STALKS (GPU-ANIMATED FOR 60FPS) ---
    const stalkCount = 650;
    const stalkGeo = new THREE.ConeGeometry(0.16, 0.78, 4);
    stalkGeo.translate(0, 0.39, 0);
    const stalkUniforms = { uTime: { value: 0 } };
    const stalkMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.65,
    });
    stalkMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = stalkUniforms.uTime;
      shader.vertexShader =
        'uniform float uTime;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `
          #include <begin_vertex>
          float swayAmt = position.y;
          #ifdef USE_INSTANCING
            float phase = instanceMatrix[3][0] * 0.35 + instanceMatrix[3][2] * 0.35;
          #else
            float phase = 0.0;
          #endif
          transformed.x += sin(uTime * 2.0 + phase) * 0.14 * swayAmt;
          transformed.z += cos(uTime * 1.6 + phase) * 0.10 * swayAmt;
          `
        );
    };
    const stalks = new THREE.InstancedMesh(stalkGeo, stalkMat, stalkCount);

    const dummy = new THREE.Object3D();
    const colorChoices = [
      new THREE.Color(0x22c55e),
      new THREE.Color(0x4ade80),
      new THREE.Color(0x84cc16),
      new THREE.Color(0xeab308),
    ];

    for (let i = 0; i < stalkCount; i++) {
      const tIdx = i % terraceCount;
      let sx: number;
      let sy: number;
      let sz: number;
      let s: number;
      if (tIdx === 2 || tIdx === 5) {
        // Place on outer meadow instead of water terrace
        const ang = (i * 2.39996) % (Math.PI * 2);
        const rad = 29 + (i % 12);
        sx = Math.cos(ang) * rad;
        sy = -0.2;
        sz = Math.sin(ang) * rad * 0.8;
        s = 0.9 + (i % 4) * 0.15;
      } else {
        const radiusX = 27.2 - tIdx * 2.55;
        const radiusZ = 21.2 - tIdx * 1.95;
        const ang = (i * 2.39996) % (Math.PI * 2);
        const ringRatio = 0.88 + ((i % 7) / 7) * 0.1;
        sx = Math.sin(tIdx * 0.4) * 1.1 + Math.cos(ang) * radiusX * ringRatio;
        sz = -tIdx * 0.65 + Math.sin(ang) * radiusZ * ringRatio;
        sy = tIdx * 0.52 + 0.18;
        s = 0.85 + (i % 5) * 0.14;
      }
      dummy.position.set(sx, sy, sz);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      stalks.setMatrixAt(i, dummy.matrix);
      stalks.setColorAt(i, colorChoices[i % colorChoices.length]);
    }
    stalks.instanceMatrix.needsUpdate = true;
    if (stalks.instanceColor) stalks.instanceColor.needsUpdate = true;
    worldGroup.add(stalks);

    // --- LUSH BRIGHT TREES AROUND THE FIELD RIDGES ---
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
    const leafColors = [0x16a34a, 0x22c55e, 0x65a30d, 0x15803d];
    const treeCoords = [
      [-26, 0.2, -14, 1.3],
      [-29, 0.2, 4, 1.5],
      [-20, 0.2, 18, 1.1],
      [25, 0.2, -15, 1.4],
      [28, 0.2, 6, 1.25],
      [21, 0.2, 17, 1.35],
      [-8, 0.4, -22, 1.4],
      [10, 0.4, -21, 1.2],
      [0, 4.3, -6, 1.15],
    ];
    treeCoords.forEach(([tx, ty, tz, scale], idx) => {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, 1.8, 8), trunkMat);
      trunk.position.y = 0.9;
      trunk.castShadow = true;
      tree.add(trunk);

      const leafMat = new THREE.MeshStandardMaterial({
        color: leafColors[idx % leafColors.length],
        roughness: 0.75,
      });
      const crown1 = new THREE.Mesh(new THREE.SphereGeometry(1.35, 14, 14), leafMat);
      crown1.position.y = 2.4;
      crown1.castShadow = true;
      const crown2 = new THREE.Mesh(new THREE.SphereGeometry(1.0, 12, 12), leafMat);
      crown2.position.set(0.65, 2.0, 0.35);
      crown2.castShadow = true;
      tree.add(crown1, crown2);

      tree.position.set(tx, ty, tz);
      tree.scale.setScalar(scale);
      worldGroup.add(tree);
    });

    // --- CENTRAL FARMER'S HOUSE (NHÀ NGƯỜI DÂN Ở GIỮA CÁNH ĐỒNG) ---
    // Top terrace (t = 8) is centered at x = sin(8*0.4)*1.1 ≈ -0.06, z = -8*0.65 = -5.2, y = 8*0.52 + 0.19 = 4.35
    const houseCenter = new THREE.Vector3(-0.06, 4.35, -5.2);
    const houseGroup = new THREE.Group();
    houseGroup.position.copy(houseCenter);
    worldGroup.add(houseGroup);

    // Warm brick courtyard (Sân gạch đỏ)
    const yard = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.4, 0.16, 24),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.85 })
    );
    yard.position.y = 0.05;
    yard.receiveShadow = true;
    houseGroup.add(yard);

    // House main body (Cream / warm ivory walls)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.6 });
    const houseBody = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.85, 2.6), wallMat);
    houseBody.position.set(0, 1.0, -0.3);
    houseBody.castShadow = true;
    houseBody.receiveShadow = true;
    houseGroup.add(houseBody);

    // Terracotta / Brick-red pitched roof
    const tileRoofMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.55 });
    const houseRoof = new THREE.Mesh(new THREE.ConeGeometry(2.75, 1.45, 4), tileRoofMat);
    houseRoof.rotation.y = Math.PI / 4;
    houseRoof.scale.set(1.12, 1, 0.9);
    houseRoof.position.set(0, 2.6, -0.3);
    houseRoof.castShadow = true;
    houseGroup.add(houseRoof);

    // Front Porch Roof & Wooden Pillars
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
    const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.14, 1.0), tileRoofMat);
    porchRoof.position.set(0, 1.65, 1.35);
    porchRoof.rotation.x = 0.2;
    porchRoof.castShadow = true;
    houseGroup.add(porchRoof);

    [-1.35, 1.35].forEach((px) => {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.5, 8), woodMat);
      pillar.position.set(px, 0.85, 1.72);
      pillar.castShadow = true;
      houseGroup.add(pillar);
    });

    // Warm Glowing Door & Windows
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.85,
    });
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.25, 0.08), woodMat);
    door.position.set(0, 0.72, 1.02);
    houseGroup.add(door);

    [-0.95, 0.95].forEach((wx) => {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.08), glowMat);
      win.position.set(wx, 1.05, 1.02);
      houseGroup.add(win);
    });

    // Porch Lantern
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), glowMat);
    lantern.position.set(0, 1.48, 1.68);
    houseGroup.add(lantern);

    // Small Flower Bushes beside the porch
    const flowerColors = [0xf43f5e, 0xfbbf24, 0xec4899];
    [
      [-1.7, 0.3, 1.5],
      [1.7, 0.3, 1.5],
      [-1.9, 0.3, 0.4],
      [1.9, 0.3, 0.4],
    ].forEach(([fx, fy, fz], idx) => {
      const bush = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.8 })
      );
      bush.position.set(fx, fy, fz);
      houseGroup.add(bush);

      const blossom = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 8),
        new THREE.MeshStandardMaterial({ color: flowerColors[idx % flowerColors.length] })
      );
      blossom.position.set(fx, fy + 0.25, fz);
      houseGroup.add(blossom);
    });

    // --- 3D FARMER HOLDING PHONE + FLOATING "V-ARGON" HOLOGRAM ---
    const farmerGroup = new THREE.Group();
    farmerGroup.position.set(1.05, 0.13, 2.35);
    farmerGroup.rotation.y = -0.25;
    houseGroup.add(farmerGroup);

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xfdba74, roughness: 0.6 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.55 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.7 });
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.85 });
    const hatMat = new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.75 });

    // Legs & Boots
    [-0.14, 0.14].forEach((lx) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.58, 10), pantsMat);
      leg.position.set(lx, 0.34, 0);
      leg.castShadow = true;
      farmerGroup.add(leg);

      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.24), bootMat);
      boot.position.set(lx, 0.06, 0.04);
      boot.castShadow = true;
      farmerGroup.add(boot);
    });

    // Torso
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.66, 12), shirtMat);
    torso.position.y = 0.92;
    torso.castShadow = true;
    farmerGroup.add(torso);

    // Head + Nón Lá (Vietnamese conical hat)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 14), skinMat);
    head.position.y = 1.42;
    head.castShadow = true;
    farmerGroup.add(head);

    const nonLa = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.24, 20), hatMat);
    nonLa.position.set(0, 1.62, -0.02);
    nonLa.rotation.x = -0.08;
    nonLa.castShadow = true;
    farmerGroup.add(nonLa);

    // Left Arm (relaxed)
    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.06, 0.52, 8), shirtMat);
    leftArm.position.set(-0.3, 0.92, 0.04);
    leftArm.rotation.z = 0.22;
    leftArm.castShadow = true;
    farmerGroup.add(leftArm);

    // Right Arm (raised forward holding smartphone)
    const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.06, 0.52, 8), shirtMat);
    rightArm.position.set(0.28, 1.06, 0.25);
    rightArm.rotation.x = -Math.PI / 2.6;
    rightArm.rotation.z = -0.15;
    rightArm.castShadow = true;
    farmerGroup.add(rightArm);

    // 3D Smartphone in hand
    const phoneGroup = new THREE.Group();
    phoneGroup.position.set(0.26, 1.18, 0.54);
    phoneGroup.rotation.x = -0.35;
    farmerGroup.add(phoneGroup);

    const phoneBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.44, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.2 })
    );
    phoneGroup.add(phoneBody);

    const phoneScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.38),
      new THREE.MeshBasicMaterial({ color: 0x34d399 })
    );
    phoneScreen.position.z = 0.022;
    phoneGroup.add(phoneScreen);

    // Holographic projection cone rising from phone screen (kept strictly below the V-ARGON badge)
    const holoCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.75, 0.9, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x34d399,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    holoCone.position.set(0.26, 1.62, 0.6);
    holoCone.rotation.x = Math.PI;
    holoCone.renderOrder = 2;
    farmerGroup.add(holoCone);

    // High-DPI "V-ARGON" Hologram Texture
    const holoCanvas = document.createElement('canvas');
    holoCanvas.width = 768;
    holoCanvas.height = 280;
    const hCtx = holoCanvas.getContext('2d');
    if (hCtx) {
      hCtx.clearRect(0, 0, holoCanvas.width, holoCanvas.height);

      // Glowing rounded glass badge
      const grad = hCtx.createLinearGradient(0, 0, 768, 280);
      grad.addColorStop(0, 'rgba(6, 78, 59, 0.92)');
      grad.addColorStop(0.5, 'rgba(5, 150, 105, 0.92)');
      grad.addColorStop(1, 'rgba(13, 148, 136, 0.92)');

      hCtx.fillStyle = grad;
      hCtx.strokeStyle = '#fde047';
      hCtx.lineWidth = 8;
      hCtx.beginPath();
      hCtx.roundRect(18, 18, 732, 244, 42);
      hCtx.fill();
      hCtx.stroke();

      // Bold glowing "V-ARGON" text
      hCtx.shadowColor = 'rgba(253, 224, 71, 0.85)';
      hCtx.shadowBlur = 24;
      hCtx.fillStyle = '#ffffff';
      hCtx.font = '900 112px system-ui, -apple-system, sans-serif';
      hCtx.textAlign = 'center';
      hCtx.textBaseline = 'middle';
      hCtx.fillText('V-ARGON', 384, 126);

      // Subtitle
      hCtx.shadowBlur = 0;
      hCtx.fillStyle = '#fef08a';
      hCtx.font = '700 32px system-ui, -apple-system, sans-serif';
      hCtx.fillText('SMART AGRICULTURE AI', 384, 206);
    }

    const holoTexture = new THREE.CanvasTexture(holoCanvas);
    holoTexture.colorSpace = THREE.SRGBColorSpace;
    const holoPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(2.55, 0.94),
      new THREE.MeshBasicMaterial({
        map: holoTexture,
        transparent: true,
        side: THREE.DoubleSide,
      })
    );
    holoPlane.renderOrder = 10;
    const holoAnchor = new THREE.Group();
    holoAnchor.position.set(0.26, 2.65, 0.72);
    holoAnchor.add(holoPlane);
    farmerGroup.add(holoAnchor);

    // Floating sparkle particles framing the outside of "V-ARGON"
    const sparkGroup = new THREE.Group();
    holoAnchor.add(sparkGroup);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    for (let s = 0; s < 10; s++) {
      const sp = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), sparkMat);
      const ang = (s / 10) * Math.PI * 2;
      sp.position.set(Math.cos(ang) * 1.55, ((s % 3) - 1) * 0.42, -0.15 + Math.sin(ang) * 0.12);
      sparkGroup.add(sp);
    }

    // --- ANIMATION LOOP ---
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animId = 0;
    let isVisible = true;
    let isTabVisible = typeof document !== 'undefined' ? !document.hidden : true;
    let elapsed = 0;
    let lastTime = performance.now();
    const targetLook = new THREE.Vector3(0, 2.5, -4);
    const currentLook = new THREE.Vector3(0, 2.5, -4);

    const animate = (now: number) => {
      if (!isVisible || !isTabVisible) {
        animId = 0;
        return;
      }
      animId = requestAnimationFrame(animate);

      const delta = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      elapsed += delta;
      const t = elapsed;
      const p = Math.max(0, Math.min(1, progressRef.current));

      if (!reducedMotion) {
        // GPU-driven gentle breeze rippling across crop stalks
        stalkUniforms.uTime.value = t;

        // Drift clouds gently
        cloudGroup.children.forEach((c, idx) => {
          c.position.x += Math.sin(t * 0.12 + idx) * 0.008;
        });

        // Floating "V-ARGON" hologram bobbing & pop-up effect on scroll
        const popFactor = THREE.MathUtils.clamp((p - 0.35) / 0.45, 0.35, 1.0);
        holoAnchor.position.y = 2.65 + Math.sin(t * 2.6) * 0.1;
        holoAnchor.rotation.y = Math.sin(t * 1.1) * 0.1;
        holoAnchor.scale.setScalar(popFactor * (1 + Math.sin(t * 3.0) * 0.03));
        sparkGroup.rotation.z = t * 0.6;
      }

      // 3-Stage Sky-to-Farmer Close-up Descent (0 -> 1)
      let camX = -10;
      let camY = 46;
      let camZ = 44;
      let lookX = 0;
      let lookY = 3.0;
      let lookZ = -4;

      // World position of the farmer & V-ARGON hologram
      const farmerWorldX = houseCenter.x + 1.0;
      const farmerWorldY = houseCenter.y + 1.95;
      const farmerWorldZ = houseCenter.z + 2.35;

      if (p < 0.35) {
        // Stage 1: High in the sky above the clouds, diving down toward the terraced fields
        const k = p / 0.35;
        camX = THREE.MathUtils.lerp(-10, 14, k);
        camY = THREE.MathUtils.lerp(46, 18, k);
        camZ = THREE.MathUtils.lerp(44, 18, k);
        lookX = THREE.MathUtils.lerp(0, houseCenter.x + 0.4, k);
        lookY = THREE.MathUtils.lerp(2.5, houseCenter.y + 1.4, k);
        lookZ = THREE.MathUtils.lerp(-4, houseCenter.z + 1.0, k);
      } else if (p < 0.75) {
        // Stage 2: Swooping down across the fields toward the house & farmer
        const k = (p - 0.35) / 0.4;
        camX = THREE.MathUtils.lerp(14, farmerWorldX + 0.85, k);
        camY = THREE.MathUtils.lerp(18, farmerWorldY + 0.55, k);
        camZ = THREE.MathUtils.lerp(18, farmerWorldZ + 4.2, k);
        lookX = THREE.MathUtils.lerp(houseCenter.x + 0.4, farmerWorldX, k);
        lookY = THREE.MathUtils.lerp(houseCenter.y + 1.4, farmerWorldY, k);
        lookZ = THREE.MathUtils.lerp(houseCenter.z + 1.0, farmerWorldZ, k);
      } else {
        // Stage 3: Intimate close-up & hold on the farmer holding the phone with V-ARGON
        const k = Math.min(1, (p - 0.75) / 0.15);
        camX = THREE.MathUtils.lerp(farmerWorldX + 0.85, farmerWorldX + 0.35, k);
        camY = THREE.MathUtils.lerp(farmerWorldY + 0.55, farmerWorldY + 0.18, k);
        camZ = THREE.MathUtils.lerp(farmerWorldZ + 4.2, farmerWorldZ + 2.85, k);
        lookX = farmerWorldX;
        lookY = farmerWorldY + 0.08;
        lookZ = farmerWorldZ;
      }

      const dragX = dragOffsetRef.current.x;
      const dragY = dragOffsetRef.current.y;
      const damp = 1 - Math.exp(-10 * delta);

      camera.position.x = THREE.MathUtils.lerp(camera.position.x, camX + dragX * 10, damp);
      camera.position.y = THREE.MathUtils.lerp(
        camera.position.y,
        Math.max(houseCenter.y + 1.2, camY - dragY * 5),
        damp
      );
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, camZ, damp);

      targetLook.set(lookX, lookY, lookZ);
      currentLook.lerp(targetLook, damp);
      camera.lookAt(currentLook);

      renderer.render(scene, camera);
    };

    const startLoop = () => {
      if (!animId && isVisible && isTabVisible) {
        lastTime = performance.now();
        animId = requestAnimationFrame(animate);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        isVisible = entries[0]?.isIntersecting ?? true;
        if (isVisible) startLoop();
      },
      { threshold: 0.01 }
    );
    observer.observe(container);

    const handleVisibility = () => {
      isTabVisible = !document.hidden;
      if (isTabVisible) startLoop();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    startLoop();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('resize', handleResize);
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material?.dispose();
          }
        }
      });
      holoTexture.dispose();
      renderer.dispose();
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const dx = (e.clientX - lastPointerRef.current.x) / 220;
    const dy = (e.clientY - lastPointerRef.current.y) / 220;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    dragOffsetRef.current = {
      x: Math.max(-1.2, Math.min(1.2, dragOffsetRef.current.x + dx)),
      y: Math.max(-0.8, Math.min(0.8, dragOffsetRef.current.y + dy)),
    };
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  if (webglError) {
    return (
      <div className="w-full h-full relative overflow-hidden bg-sky-200">
        <img
          src="/images/hero-smartfarm.jpg"
          alt="Cánh đồng V-ARGON"
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="w-full h-full cursor-grab active:cursor-grabbing"
      style={{ touchAction: 'pan-y' }}
    />
  );
}
