/* ============================================
   CITYSCAPE — Three.js Outrun City Scene
   ============================================ */

const Cityscape = (() => {
  let scene, camera, renderer;
  let buildings = [];
  let sunGroup = null;
  let groundGroup = null;
  let signals = [];
  let signalPool = [];
  let matrixTextures = [];
  let matrixCanvases = [];
  let clock;
  let animationId;
  let cameraZ = 0;
  const ROAD_LENGTH = 200;
  const CAMERA_SPEED = 8;
  const BUILDING_ROWS = 20;
  const ROW_SPACING = 15;
  const BUILDING_CORRIDOR_LENGTH = BUILDING_ROWS * ROW_SPACING;

  function init(container) {
    clock = new THREE.Clock();

    // --- Scene ---
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0a12, 0.004);
    scene.background = new THREE.Color(0x0a0a12);

    // --- Camera ---
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(70, aspect, 0.1, 500);
    camera.position.set(0, 6, 0);
    camera.lookAt(0, 4, -50);

    // --- Renderer ---
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.52;
    container.appendChild(renderer.domElement);

    // Build scene elements
    createSky();
    createSun();
    createGrid();
    createBuildings();
    createSignalPool();

    // Ambient light
    const ambient = new THREE.AmbientLight(0x1a0a2e, 0.5);
    scene.add(ambient);

    // Neon point lights
    const pinkLight = new THREE.PointLight(0xff2d95, 1.9, 80);
    pinkLight.position.set(-15, 15, -30);
    scene.add(pinkLight);

    const cyanLight = new THREE.PointLight(0x00f0ff, 1.9, 80);
    cyanLight.position.set(15, 15, -30);
    scene.add(cyanLight);

    // Handle resize
    window.addEventListener("resize", () => onResize(container));

    // Start animation
    animate();
  }

  // --- SKY ---
  function createSky() {
    // Starfield
    const starCount = 300;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 400;
      starPositions[i * 3 + 1] = Math.random() * 80 + 20;
      starPositions[i * 3 + 2] = (Math.random() - 0.5) * 400 - 50;
    }
    starGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(starPositions, 3),
    );
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.5,
      transparent: true,
      opacity: 0.7,
    });
    scene.add(new THREE.Points(starGeo, starMat));
  }

  // --- OUTRUN SUN ---
  function createSun() {
    sunGroup = new THREE.Group();
    sunGroup.position.set(0, 18, -180);

    // Sun disc — top half only
    const sunRadius = 30;
    const segments = 64;

    // Full circle geometry, but we clip with horizontal bands
    const sunGeo = new THREE.CircleGeometry(sunRadius, segments);
    const sunCanvas = document.createElement("canvas");
    sunCanvas.width = 256;
    sunCanvas.height = 256;
    const sCtx = sunCanvas.getContext("2d");

    // Gradient: hot pink top -> orange -> yellow bottom
    const grad = sCtx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, "#ff4daa");
    grad.addColorStop(0.4, "#ff8c2a");
    grad.addColorStop(0.8, "#fff033");
    grad.addColorStop(1, "#fff033");
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 256, 256);

    // Horizontal cut lines (the classic segmented look)
    sCtx.fillStyle = "#0a0a12";
    const cuts = [
      { y: 140, h: 4 },
      { y: 155, h: 6 },
      { y: 170, h: 8 },
      { y: 185, h: 10 },
      { y: 202, h: 14 },
      { y: 222, h: 18 },
    ];
    cuts.forEach((c) => sCtx.fillRect(0, c.y, 256, c.h));

    // Cut the bottom half (below horizon)
    sCtx.fillRect(0, 245, 256, 20);

    const sunTex = new THREE.CanvasTexture(sunCanvas);
    const sunMat = new THREE.MeshBasicMaterial({
      map: sunTex,
      transparent: true,
      side: THREE.DoubleSide,
    });

    const sun = new THREE.Mesh(sunGeo, sunMat);
    sunGroup.add(sun);

    // Sun glow — inner
    const glowGeo = new THREE.CircleGeometry(sunRadius * 1.4, segments);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xff2d95,
      transparent: true,
      opacity: 0.11,
      side: THREE.DoubleSide,
    });
    sunGroup.add(new THREE.Mesh(glowGeo, glowMat));

    // Sun glow — outer haze
    const outerGlowGeo = new THREE.CircleGeometry(sunRadius * 2.0, segments);
    const outerGlowMat = new THREE.MeshBasicMaterial({
      color: 0xff6a00,
      transparent: true,
      opacity: 0.05,
      side: THREE.DoubleSide,
    });
    sunGroup.add(new THREE.Mesh(outerGlowGeo, outerGlowMat));

    scene.add(sunGroup);
  }

  // --- GROUND GRID ---
  function createGrid() {
    groundGroup = new THREE.Group();

    // Main grid
    const gridSize = 800;
    const gridDivisions = 160;

    // Custom grid using lines for neon effect
    const gridGeo = new THREE.BufferGeometry();
    const gridVerts = [];
    const half = gridSize / 2;
    const step = gridSize / gridDivisions;

    // Lines along Z
    for (let i = -half; i <= half; i += step) {
      gridVerts.push(i, 0, -half, i, 0, half);
    }
    // Lines along X
    for (let i = -half; i <= half; i += step) {
      gridVerts.push(-half, 0, i, half, 0, i);
    }

    gridGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(gridVerts, 3),
    );

    const gridMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.15,
    });

    const grid = new THREE.LineSegments(gridGeo, gridMat);
    grid.position.y = -0.01;
    groundGroup.add(grid);

    // Center road (brighter)
    const roadWidth = 12;
    const roadGeo = new THREE.PlaneGeometry(roadWidth, gridSize);
    const roadMat = new THREE.MeshBasicMaterial({
      color: 0x0a0a12,
      transparent: true,
      opacity: 0.8,
    });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.01;
    groundGroup.add(road);

    // Road edge lines
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0xff2d95,
      transparent: true,
      opacity: 0.6,
    });

    [-roadWidth / 2, roadWidth / 2].forEach((x) => {
      const edgeGeo = new THREE.BufferGeometry();
      edgeGeo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute([x, 0.02, -half, x, 0.02, half], 3),
      );
      groundGroup.add(new THREE.LineSegments(edgeGeo, edgeMat));
    });

    // Road center dashes
    const dashMat = new THREE.LineBasicMaterial({
      color: 0xff2d95,
      transparent: true,
      opacity: 0.3,
    });
    for (let z = -half; z < half; z += 8) {
      const dashGeo = new THREE.BufferGeometry();
      dashGeo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute([0, 0.02, z, 0, 0.02, z + 4], 3),
      );
      groundGroup.add(new THREE.LineSegments(dashGeo, dashMat));
    }

    scene.add(groundGroup);
  }

  // --- BUILDINGS ---
  function createBuildings() {
    const matrixChars =
      "アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF";

    for (let row = 0; row < BUILDING_ROWS; row++) {
      const z = -15 - row * 15;

      // Buildings on both sides of the road
      [-1, 1].forEach((side) => {
        const count = 2 + Math.floor(Math.random() * 2);
        for (let b = 0; b < count; b++) {
          const width = 4 + Math.random() * 6;
          const height = 8 + Math.random() * 25;
          const depth = 4 + Math.random() * 6;
          const x = side * (8 + b * (width + 1) + Math.random() * 2);

          // Matrix texture for this building
          const canvas = document.createElement("canvas");
          canvas.width = 128;
          canvas.height = 256;
          matrixCanvases.push({
            canvas,
            chars: matrixChars,
            columns: Math.floor(canvas.width / 10),
            drops: Array.from({ length: Math.floor(canvas.width / 10) }, () =>
              Math.floor((Math.random() * canvas.height) / 12),
            ),
            height: height,
          });

          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "rgba(10, 10, 18, 1)";
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          const texture = new THREE.CanvasTexture(canvas);
          texture.minFilter = THREE.LinearFilter;
          matrixTextures.push(texture);

          // Building mesh — wireframe edges + solid face
          const geo = new THREE.BoxGeometry(width, height, depth);

          // Solid dark face with matrix texture
          const faceMat = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0.9,
            color: 0x224444,
          });

          const building = new THREE.Mesh(geo, faceMat);
          building.position.set(x, height / 2, z);
          scene.add(building);

          // Wireframe edges — neon glow
          const edgeGeo = new THREE.EdgesGeometry(geo);
          const neonColor = Math.random() > 0.5 ? 0x00f0ff : 0xff2d95;
          const edgeMat = new THREE.LineBasicMaterial({
            color: neonColor,
            transparent: true,
            opacity: 0.5 + Math.random() * 0.3,
          });
          const wireframe = new THREE.LineSegments(edgeGeo, edgeMat);
          wireframe.position.copy(building.position);
          scene.add(wireframe);

          buildings.push({ mesh: building, wireframe, side, row });
        }
      });
    }
  }

  // --- MATRIX RAIN on buildings ---
  function updateMatrixTextures() {
    matrixCanvases.forEach((mc, i) => {
      const ctx = mc.canvas.getContext("2d");

      // Fade effect
      ctx.fillStyle = "rgba(10, 10, 18, 0.12)";
      ctx.fillRect(0, 0, mc.canvas.width, mc.canvas.height);

      // Draw falling chars
      ctx.font = "10px monospace";
      ctx.fillStyle = "#00f0ff";

      for (let c = 0; c < mc.columns; c++) {
        const char = mc.chars[Math.floor(Math.random() * mc.chars.length)];
        const x = c * 10;
        const y = mc.drops[c] * 12;

        // Brighter for leading char
        ctx.fillStyle = Math.random() > 0.9 ? "#ffffff" : "#00f0ff";
        ctx.fillText(char, x, y);

        // Dimmer trail
        if (mc.drops[c] > 1) {
          ctx.fillStyle = "rgba(0, 240, 255, 0.3)";
          ctx.fillText(
            mc.chars[Math.floor(Math.random() * mc.chars.length)],
            x,
            (mc.drops[c] - 1) * 12,
          );
        }

        if (y > mc.canvas.height && Math.random() > 0.97) {
          mc.drops[c] = 0;
        }
        mc.drops[c]++;
      }

      matrixTextures[i].needsUpdate = true;
    });
  }

  // --- MOVING LINES — simple neon lines from horizon to camera ---
  function createSignalPool() {
    const poolSize = 20;

    for (let i = 0; i < poolSize; i++) {
      // Each "line" is a thin flat ribbon (plane) so it's visible
      const lineLength = 300;
      const lineWidth = 0.12;
      const geo = new THREE.PlaneGeometry(lineWidth, lineLength, 1, 1);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x39ff14,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geo, mat);
      // Lay flat on the ground (rotate to horizontal, facing up)
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.05;

      scene.add(mesh);

      signalPool.push({
        mesh,
        active: false,
        speed: 0,
        life: 0,
        maxLife: 0,
        xLane: 0,
      });
    }
  }

  function spawnSignal() {
    const sig = signalPool.find((s) => !s.active);
    if (!sig) return;

    // Pick a lane
    const lanes = [-5.5, -3.5, -1.5, 1.5, 3.5, 5.5];
    sig.xLane = lanes[Math.floor(Math.random() * lanes.length)];

    // Position: center of the line at the horizon ahead of camera
    sig.mesh.position.x = sig.xLane;
    sig.mesh.position.z = camera.position.z - 150;

    sig.speed = CAMERA_SPEED * 2 + Math.random() * 12;
    sig.life = 0;
    sig.maxLife = 4 + Math.random() * 4;
    sig.active = true;
    sig.mesh.material.opacity = 0.7 + Math.random() * 0.3;
  }

  function updateSignals(delta) {
    signals = signalPool.filter((s) => s.active);
    signals.forEach((sig) => {
      sig.life += delta;
      if (sig.life >= sig.maxLife) {
        sig.active = false;
        sig.mesh.material.opacity = 0;
        return;
      }

      // Move toward camera
      sig.mesh.position.z += sig.speed * delta;

      // Fade in/out
      const lifeRatio = sig.life / sig.maxLife;
      let fade = 1;
      if (lifeRatio < 0.1)
        fade = lifeRatio / 0.1; // fade in
      else if (lifeRatio > 0.8) fade = 1 - (lifeRatio - 0.8) / 0.2; // fade out
      sig.mesh.material.opacity = fade * (0.7 + Math.random() * 0.05);
    });

    // Ambient spawning
    if (Math.random() < 0.03) spawnSignal();
  }

  // Called when user types in terminal — burst of signals
  function onUserType() {
    const burstCount = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < burstCount; i++) {
      setTimeout(() => spawnSignal(), i * 50);
    }
  }

  // --- ANIMATION LOOP ---
  function animate() {
    animationId = requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const elapsed = clock.getElapsedTime();

    // Camera drift forward (never resets)
    camera.position.z -= CAMERA_SPEED * delta;

    // Keep the sun always the same distance ahead of the camera
    if (sunGroup) {
      sunGroup.position.z = camera.position.z - 180;
    }

    // Keep the ground grid/road following the camera
    if (groundGroup) {
      groundGroup.position.z = camera.position.z;
    }

    // Recycle buildings that have passed behind the camera
    buildings.forEach((b) => {
      if (b.mesh.position.z > camera.position.z + 20) {
        // Move this building row to the far front of the corridor
        const newZ = b.mesh.position.z - BUILDING_CORRIDOR_LENGTH;
        b.mesh.position.z = newZ;
        b.wireframe.position.z = newZ;
      }
    });

    // Idle sway
    camera.position.x = Math.sin(elapsed * 0.2) * 1.5;
    camera.rotation.y = Math.sin(elapsed * 0.15) * 0.02;
    camera.rotation.x = -0.15 + Math.sin(elapsed * 0.1) * 0.01;

    // Update matrix textures (throttled)
    if (Math.floor(elapsed * 10) % 1 === 0) {
      updateMatrixTextures();
    }

    // Update signals
    updateSignals(delta);

    renderer.render(scene, camera);
  }

  function onResize(container) {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  function destroy() {
    if (animationId) cancelAnimationFrame(animationId);
    renderer.dispose();
  }

  return { init, onUserType, destroy };
})();
