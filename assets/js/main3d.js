import * as THREE from 'three';
import { pass, cubeTexture, screenUV, grayscale, uniform, mrt, output, emissive } from 'three/tsl';
import { anamorphic } from 'three/addons/tsl/display/AnamorphicNode.js';

import { RGBMLoader } from 'three/addons/loaders/RGBMLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { UltraHDRLoader } from 'three/addons/loaders/UltraHDRLoader.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';

// --- Global Configuration ---
const config = {
  camera: {
    fov: 30,
    near: 0.2,
    far: 3000,
    position: { x: 0, y: 30, z: 90 },
    minZ: 320,
    maxZ: 700,
  },
  ambientLight: {
    color: 0xacd0ff,
    intensity: 8,
  },
  dirLight: {
    color: 0xbfdfff,
    intensity: 10,
    position: { x: 20, y: 30, z: -40 },
    castShadow: true,
  },
  rimLight: {
    color: 0x66ccff,
    intensity: 6,
    position: { x: -30, y: 40, z: 60 },
  },
  pointLight: {
    color: 0x99ccff,
    intensity: 8,
    distance: 800,
    position: { x: 0, y: 100, z: 200 },
  },
  star: {
    count: 1800,
    diskRadius: 900,
    height: 600,
    zRange: 2000,
    speedMin: 40,
    speedMax: 80,
    size: 3,
    opacity: 0.85,
    color1: 0x99ccff,
    color2: 0xfff6e6,
  },
  meteor: {
    count: 250,
    coneRadius: 2,
    coneHeight: 32,
    coneFaces: 3,
    color: 0xff1a4b,
    emissive: 0xff1a4b,
    emissiveIntensity: 1.5,
    shininess: 100,
    rMax: 400,
    yRange: 600,
    speedMin: 350,
    speedMax: 470,
    offsetMax: 10,
    travelDistance: 2200,
    baseDistance: 1100,
    collisionDistance: 32,
    cooldown: 0.5,
  },
  fog: {
    color: 0x0a0e2a,
    density: 0.0007,
  },
  spaceship: {
    scale: 0.01,
    rotation: { x: 0, y: 75, z: 0 },
    positionY: -10,
    emissive: 0xffffff,
    emissiveIntensity: 0.7,
    roughness: 0.7,
    metalness: 1.0,
    flicker: { min: 0.2, max: 0.6, speed: 2.2 },
    sway: { z: 0.035, x: 0.035, speedZ: 1.5, speedX: 1.1 },
  },
  flame: {
    count: 20000,
    size: 120,
    colorR: [0.5, 0.7],
    colorG: 1.0,
    colorB: [0.2, 0.4],
    alpha: [0.7, 0.88],
    xRange: 18,
    yRange: 18,
    zBase: 0,
    diskRadius: 9,
    lengthMin: 30,
    lengthMax: 50,
    tailOffset: -75,
  },
  spark: {
    color: 0x39ff14,
    duration: 0.4,
    maxRadius: 100,
    minRadius: 10,
    maxOpacity: 0.45,
    textureSize: 128,
    gradient: [
      { stop: 0, color: 'rgba(255,26,75,1)' },
      { stop: 0.18, color: 'rgba(255,90,123,0.85)' },
      { stop: 0.38, color: 'rgba(255,179,198,0.45)' },
      { stop: 0.7, color: 'rgba(255,90,123,0.12)' },
      { stop: 1, color: 'rgba(255,26,75,0)' },
    ],
  },
  bloom: {
    strength: 1.2,
    radius: 1.2,
  },
  environment: {
    background: '#05051E',
    texture: 'textures/ice_planet_close.jpg',
  },
};

let camera, scene, renderer;
let postProcessing;
let mixer;
const clock = new THREE.Clock();
let meteorInfos = [];
let animateStars = null;
let animateMeteors = null;
let starGeometry = null;
let meteorGeometry = null;
let spaceship = null; // Used to save the spaceship body
let spaceshipDir = new THREE.Vector3(0, 0, -1); // Default direction for spaceship
let flameParticles = null;
let flameGeometry = null;
let flameMaterial = null;
const flameCount = config.flame.count; // Significantly increased flame particle count

let meteorMeshes = [];
let meteorGroup = null;

init();

async function init() {
  const container = document.querySelector('.canvas3D');
  // Safety: remove old canvas to avoid duplicate append or canvas misplacement
  container.querySelectorAll('canvas').forEach(c => c.remove());

  const width = container.clientWidth;
  const height = container.clientHeight;

  camera = new THREE.PerspectiveCamera(config.camera.fov, width / height, config.camera.near, config.camera.far);
  camera.position.set(config.camera.position.x, config.camera.position.y, config.camera.position.z);
  scene = new THREE.Scene();

  // Add ambient light for overall scene illumination
  scene.add(new THREE.AmbientLight(config.ambientLight.color, config.ambientLight.intensity));

  // Add main directional light for strong highlights and shadows
  const dirLight = new THREE.DirectionalLight(config.dirLight.color, config.dirLight.intensity);
  dirLight.position.set(config.dirLight.position.x, config.dirLight.position.y, config.dirLight.position.z);
  dirLight.castShadow = config.dirLight.castShadow;
  scene.add(dirLight);

  // Add rim light for edge highlighting
  const rimLight = new THREE.DirectionalLight(config.rimLight.color, config.rimLight.intensity);
  rimLight.position.set(config.rimLight.position.x, config.rimLight.position.y, config.rimLight.position.z);
  scene.add(rimLight);

  // Add soft point light for interstellar glow
  const pointLight = new THREE.PointLight(config.pointLight.color, config.pointLight.intensity, config.pointLight.distance);
  pointLight.position.set(config.pointLight.position.x, config.pointLight.position.y, config.pointLight.position.z);
  scene.add(pointLight);

  // --- Star Particle Background ---
  // Generate star field with random distribution in a disk area in front of the spaceship
  const starCount = config.star.count;
  // Regular stars
  starGeometry = new THREE.BufferGeometry();
  const starVertices = [];
  const starColors = [];
  const starBaseInfos = [];
  for (let i = 0; i < starCount; i++) {
    // Initially distributed in a disk area in front of the spaceship
    const theta = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * config.star.diskRadius; // Uniformly distributed within radius 900
    const x = Math.cos(theta) * r;
    const y = (Math.random() - 0.5) * config.star.height; // Height range
    const z = (Math.random() - 0.5) * config.star.zRange;
    starVertices.push(x, y, z);
    starBaseInfos.push({ x, y, z, speed: config.star.speedMin + Math.random() * (config.star.speedMax - config.star.speedMin) });
    const color = new THREE.Color(Math.random() > 0.5 ? config.star.color1 : config.star.color2);
    starColors.push(color.r, color.g, color.b);
  }
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
  starGeometry.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
  const starMaterial = new THREE.PointsMaterial({ size: config.star.size, vertexColors: true, transparent: true, opacity: config.star.opacity });
  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);

  // --- Star Animation ---
  // Animate star movement and reset stars that move out of range
  animateStars = function (delta) {
    let dir = new THREE.Vector3(0, 0, -1);
    if (spaceship) {
      dir.applyQuaternion(spaceship.quaternion).normalize();
      spaceshipDir.copy(dir);
    } else {
      dir.copy(spaceshipDir);
    }
    const pos = starGeometry.attributes.position.array;
    for (let i = 0; i < starBaseInfos.length; i++) {
      pos[i * 3] += dir.x * -starBaseInfos[i].speed * delta;
      pos[i * 3 + 1] += dir.y * -starBaseInfos[i].speed * delta;
      pos[i * 3 + 2] += dir.z * -starBaseInfos[i].speed * delta;
      // Reset to disk in front of spaceship if out of range
      const px = pos[i * 3], py = pos[i * 3 + 1], pz = pos[i * 3 + 2];
      const rel = new THREE.Vector3(px, py, pz);
      const cam = new THREE.Vector3(0, 0, 0);
      if (spaceship) spaceship.localToWorld(cam.set(0, 0, 0));
      const toStar = rel.clone().sub(cam);
      if (toStar.dot(dir) < -1100) {
        // Randomly distribute on the front disk
        const theta = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * config.star.diskRadius;
        const y = (Math.random() - 0.5) * config.star.height;
        const local = new THREE.Vector3(Math.cos(theta) * r, y, 0);
        // Transform to world coordinates
        local.applyQuaternion(spaceship ? spaceship.quaternion : new THREE.Quaternion());
        local.add(cam.clone().add(dir.clone().multiplyScalar(1100)));
        pos[i * 3] = local.x;
        pos[i * 3 + 1] = local.y;
        pos[i * 3 + 2] = local.z;
      }
    }
    starGeometry.attributes.position.needsUpdate = true;
  }

  // --- Meteor Geometry (Neon Red Thin Cones) ---
  // Generate meteors as thin neon red cones with random distribution
  const meteorCount = config.meteor.count;
  meteorMeshes = [];
  meteorGroup = new THREE.Group();
  scene.add(meteorGroup);
  meteorInfos = [];
  // Pre-generate a set of random distribution, shared by all meteors
  const meteorParams = [];
  for (let i = 0; i < meteorCount; i++) {
    // Geometry: thin triangular cone
    const geometry = new THREE.ConeGeometry(config.meteor.coneRadius, config.meteor.coneHeight, config.meteor.coneFaces); // radius, height, 3 faces
    // Neon red material
    const material = new THREE.MeshPhongMaterial({
      color: config.meteor.color, // neon red
      emissive: config.meteor.emissive,
      emissiveIntensity: config.meteor.emissiveIntensity,
      shininess: config.meteor.shininess,
      flatShading: true
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    meteorGroup.add(mesh);
    meteorMeshes.push(mesh);
    // Random initial position and parameters (only initialize once)
    const theta = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * config.meteor.rMax; // make meteors more concentrated
    const y = (Math.random() - 0.5) * config.meteor.yRange;
    const speed = config.meteor.speedMin + Math.random() * (config.meteor.speedMax - config.meteor.speedMin);
    const offset = Math.random() * config.meteor.offsetMax;
    meteorInfos.push({ theta, r, y, speed, offset });
  }
  // --- Meteor Animation (Neon Red Thin Cones) ---
  // Animate meteors and handle collision detection with spaceship
  // Add: cooldown state for each meteor
  if (!meteorInfos[0].hasOwnProperty('cooldown')) {
    for (let i = 0; i < meteorInfos.length; i++) {
      meteorInfos[i].cooldown = 0;
    }
  }
  animateMeteors = function (delta, elapsed) {
    let dir = new THREE.Vector3(0, 0, -1);
    if (spaceship) {
      dir.applyQuaternion(spaceship.quaternion).normalize();
      spaceshipDir.copy(dir);
    } else {
      dir.copy(spaceshipDir);
    }
    let cam = new THREE.Vector3(0, 0, 0);
    if (spaceship) spaceship.localToWorld(cam.set(0, 0, 0));
    for (let i = 0; i < meteorMeshes.length; i++) {
      const info = meteorInfos[i];
      // All meteors move synchronously, only use their own offset to determine phase
      const t = ((elapsed + info.offset) * info.speed) % config.meteor.travelDistance / config.meteor.travelDistance;
      // Reference point: 1100 in front of the spaceship
      const base = cam.clone().add(dir.clone().multiplyScalar(config.meteor.baseDistance))
        .add(new THREE.Vector3(Math.cos(info.theta) * info.r, info.y, 0).applyQuaternion(spaceship ? spaceship.quaternion : new THREE.Quaternion()));
      base.add(dir.clone().multiplyScalar(-t * config.meteor.travelDistance));
      meteorMeshes[i].position.copy(base);
      // Direction faces the flight direction
      meteorMeshes[i].quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0), // cone default faces y-axis
        dir
      );
      // Slight random rotation so each meteor is not exactly the same
      meteorMeshes[i].rotateY(info.theta);
      // --- Add: detect collision effect with spaceship ---
      if (spaceship) {
        const meteorPos = meteorMeshes[i].position;
        const shipPos = new THREE.Vector3();
        spaceship.getWorldPosition(shipPos);
        const dist = meteorPos.distanceTo(shipPos);
        if (dist < config.meteor.collisionDistance && info.cooldown <= 0) { // increase hit detection distance
          createSpark(meteorPos);
          info.cooldown = config.meteor.cooldown; // 0.5s cooldown
        }
      }
      // Cooldown countdown
      if (info.cooldown > 0) info.cooldown -= delta;
    }
  }

  // --- Space Fog ---
  // Add exponential fog for deep space effect
  scene.fog = new THREE.FogExp2(config.fog.color, config.fog.density);

  // Load HDR environment texture for reflections and lighting
  const texture = await new UltraHDRLoader().loadAsync(config.environment.texture);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = new THREE.Color(config.environment.background);
  scene.environment = texture;

  // Load spaceship model and set up materials and animation
  const loader = new GLTFLoader().setPath('models/');
  loader.load('federal_corvette.glb', (gltf) => {
    gltf.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.frustumCulled = false;
        const mat = obj.material;
        if (mat) {
          // Set material properties for sci-fi look
          mat.roughness = config.spaceship.roughness;
          mat.metalness = config.spaceship.metalness;
          mat.precision = 'highp';
          mat.needsUpdate = true;
          mat.polygonOffsetFactor = 1;
          mat.polygonOffsetUnits = 1;
          // Add emissive sci-fi effect
          mat.emissive = new THREE.Color(config.spaceship.emissive);
          mat.emissiveIntensity = config.spaceship.emissiveIntensity;
          if (mat.map) {
            mat.map.minFilter = THREE.LinearFilter;
            mat.map.magFilter = THREE.LinearFilter;
            mat.map.generateMipmaps = true;
            mat.map.anisotropy = 16;
            mat.map.needsUpdate = true;
          }
          if (mat.normalMap) {
            mat.normalScale.set(1, 1);
            mat.normalMap.needsUpdate = true;
          }
        }
      }
    });
    // Set up animation for spaceship
    mixer = new THREE.AnimationMixer(gltf.scene);
    gltf.animations.forEach((clip) => {
      mixer.clipAction(clip).play();
    });
    gltf.scene.scale.set(config.spaceship.scale, config.spaceship.scale, config.spaceship.scale);
    gltf.scene.rotation.set(config.spaceship.rotation.x, config.spaceship.rotation.y, config.spaceship.rotation.z);
    gltf.scene.position.y = config.spaceship.positionY;
    scene.add(gltf.scene);
    spaceship = gltf.scene;

    // --- Spaceship tail flame particles ---
    // Generate flame particles with random color and position for spaceship tail
    flameGeometry = new THREE.BufferGeometry();
    const flamePositions = new Float32Array(flameCount * 3);
    const flameColors = new Float32Array(flameCount * 3);
    const flameAlphas = new Float32Array(flameCount); // Alpha
    for (let i = 0; i < flameCount; i++) {
      // X, Y range enlarged (wider)
      flamePositions[i * 3] = (Math.random() - 0.5) * config.flame.xRange; // X
      flamePositions[i * 3 + 1] = (Math.random() - 0.5) * config.flame.yRange; // Y
      flamePositions[i * 3 + 2] = config.flame.zBase;
      // Color changed to neon green
      flameColors[i * 3] = config.flame.colorR[0] + Math.random() * (config.flame.colorR[1] - config.flame.colorR[0]); // R
      flameColors[i * 3 + 1] = config.flame.colorG; // G
      flameColors[i * 3 + 2] = config.flame.colorB[0] + Math.random() * (config.flame.colorB[1] - config.flame.colorB[0]); // B
      flameAlphas[i] = config.flame.alpha[0] + Math.random() * (config.flame.alpha[1] - config.flame.alpha[0]);
    }
    flameGeometry.setAttribute('position', new THREE.BufferAttribute(flamePositions, 3));
    flameGeometry.setAttribute('color', new THREE.BufferAttribute(flameColors, 3));
    flameMaterial = new THREE.PointsMaterial({
      size: config.flame.size, // Larger particles
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true // Near large, far small
    });
    flameParticles = new THREE.Points(flameGeometry, flameMaterial);
    scene.add(flameParticles);
  });

  renderer = new THREE.WebGPURenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(width, height);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);
  renderer.setAnimationLoop(render);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableZoom = false; // Disable default zoom
  controls.minDistance = config.camera.minZ;
  controls.maxDistance = config.camera.maxZ;
  controls.target.set(0, 0.5, 0); // Target slightly upward
  controls.update();

  // Custom mouse wheel zoom in/out
  // Add raycaster and mouse coordinates
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let mouseOnSpaceship = false;
  // Detect if mouse is over the spaceship
  container.addEventListener('mousemove', (e) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    if (spaceship) {
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(spaceship, true);
      mouseOnSpaceship = intersects.length > 0;
    } else {
      mouseOnSpaceship = false;
    }
  });
  container.addEventListener('wheel', (e) => {
    if (!mouseOnSpaceship) return; // Only zoom when mouse is over the spaceship
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1 : -1;
    let newZ = camera.position.distanceTo(controls.target) + delta * 30; // Calculate by distance
    newZ = Math.max(config.camera.minZ, Math.min(config.camera.maxZ, newZ));
    if (spaceship) {
      const shipWorld = new THREE.Vector3();
      spaceship.getWorldPosition(shipWorld);
      const camDir = camera.position.clone().sub(controls.target).normalize();
      camera.position.copy(shipWorld.clone().add(camDir.multiplyScalar(newZ)));
      controls.target.copy(shipWorld);
    } else {
      camera.position.z = newZ;
    }
  }, { passive: false });

  const scenePass = pass(scene, camera);
  scenePass.setMRT(mrt({ output, emissive }));
  const outputPass = scenePass.getTextureNode();
  const emissivePass = scenePass.getTextureNode('emissive');
  const bloomPass = bloom(emissivePass, config.bloom.strength, config.bloom.radius); // Stronger bloom

  postProcessing = new THREE.PostProcessing(renderer);
  postProcessing.outputNode = outputPass.add(bloomPass);

  window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Spark effect (Sprite version) ---
let sparks = [];

// --- Vector3 cache to avoid new every frame ---
const tmpVec1 = new THREE.Vector3();
const tmpVec2 = new THREE.Vector3();
const tmpVec3 = new THREE.Vector3();

// --- flame sinTable precomputed for performance ---
const FLAME_SIN_TABLE_SIZE = 1024;
const flameSinTable = Array.from({length: FLAME_SIN_TABLE_SIZE}, (_, i) => Math.sin((i / FLAME_SIN_TABLE_SIZE) * Math.PI * 2));
function getFlameSin(val) {
  // val: phase, e.g. t * 18 + i
  // Use integer part for cyclic lookup
  const idx = Math.floor((val % (Math.PI * 2)) / (Math.PI * 2) * FLAME_SIN_TABLE_SIZE);
  return flameSinTable[(idx + FLAME_SIN_TABLE_SIZE) % FLAME_SIN_TABLE_SIZE];
}

// Create a neon red circular gradient canvas for Sprite
function createSparkTexture() {
  const size = config.spark.textureSize;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  // Draw radial gradient (neon red)
  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, size * 0.1,
    size / 2, size / 2, size * 0.5
  );
  for (let i = 0; i < config.spark.gradient.length; i++) {
    const stop = config.spark.gradient[i];
    gradient.addColorStop(stop.stop, stop.color);
  }
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
}
const sparkTexture = createSparkTexture();

function createSpark(worldPos) {
  const material = new THREE.SpriteMaterial({
    map: sparkTexture,
    color: 0xffffff, // Use white to preserve canvas color
    transparent: true,
    opacity: config.spark.maxOpacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(worldPos);
  sprite.scale.set(config.spark.minRadius, config.spark.minRadius, 1);
  scene.add(sprite);
  sparks.push({
    sprite,
    start: clock.getElapsedTime(),
    center: worldPos.clone()
  });
}

// Mouse click event for spark
const container = document.querySelector('.canvas3D');
container.addEventListener('click', (e) => {
  const rect = renderer.domElement.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  );
  // Raycast to get world position on z=0 plane
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  // Intersect with z=0 plane
  const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const worldPos = new THREE.Vector3();
  raycaster.ray.intersectPlane(planeZ, worldPos);
  createSpark(worldPos);
});

function render() {
  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);
  // --- Star Animation ---
  if (animateStars && starGeometry) {
    animateStars(delta);
  }
  // --- Meteor Animation ---
  if (meteorMeshes.length) {
    animateMeteors(delta, clock.getElapsedTime());
  }
  // --- Flame particle animation ---
  if (flameParticles && spaceship) {
    // Spaceship auto sway
    const t = clock.getElapsedTime();
    spaceship.rotation.z = Math.sin(t * config.spaceship.sway.speedZ) * config.spaceship.sway.z;
    spaceship.rotation.x = Math.sin(t * config.spaceship.sway.speedX) * config.spaceship.sway.x;
    // Spaceship slow glow/flicker
    const maxGlow = config.spaceship.flicker.max; // Maximum brightness (adjustable)
    const minGlow = config.spaceship.flicker.min; // Minimum brightness (adjustable)
    spaceship.traverse(obj => {
      if (obj.isMesh && obj.material && obj.material.emissiveIntensity !== undefined) {
        obj.material.emissiveIntensity = minGlow + (maxGlow - minGlow) * (0.5 + 0.5 * Math.sin(t * config.spaceship.flicker.speed));
      }
    });
    // Flame animation
    const positions = flameGeometry.attributes.position.array;
    // Use cached Vector3 to avoid new every frame
    spaceship.localToWorld(tmpVec1.set(0, 0, 0));
    tmpVec2.set(0, 0, -1).applyQuaternion(spaceship.quaternion).normalize();
    const tailOffset = config.flame.tailOffset;
    // Calculate tail position for flame emission
    tmpVec3.copy(tmpVec1).add(tmpVec2.clone().multiplyScalar(tailOffset));
    if (!flameGeometry._randomCache) {
      // Pre-generate random attributes for each flame particle to reduce per-frame computation
      flameGeometry._randomCache = Array.from({length: flameCount}, () => ({
        angle: Math.random() * Math.PI * 2,
        radius: Math.random() * config.flame.diskRadius,
        len: config.flame.lengthMin + Math.random() * (config.flame.lengthMax - config.flame.lengthMin),
        tt: Math.random(),
        flickerSeed: Math.random()
      }));
    }
    const cache = flameGeometry._randomCache;
    for (let i = 0; i < flameCount; i++) {
      const { angle, radius, len, tt, flickerSeed } = cache[i];
      // Use sinTable for flicker effect
      const phase = t * 18 + i;
      const flicker = 1 + getFlameSin(phase) * 0.18 * flickerSeed;
      tmpVec1.set(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        tt * len * flicker
      );
      tmpVec1.applyQuaternion(spaceship.quaternion);
      tmpVec1.add(tmpVec3);
      positions[i * 3] = tmpVec1.x;
      positions[i * 3 + 1] = tmpVec1.y;
      positions[i * 3 + 2] = tmpVec1.z;
    }
    flameGeometry.attributes.position.needsUpdate = true;
  }
  // --- Sprite-based Spark animation ---
  if (sparks.length) {
    const now = clock.getElapsedTime();
    for (let i = sparks.length - 1; i >= 0; i--) {
      const spark = sparks[i];
      const t = now - spark.start;
      if (t > config.spark.duration) {
        scene.remove(spark.sprite);
        sparks.splice(i, 1);
        continue;
      }
      // Expansion and fade
      const k = t / config.spark.duration;
      const radius = config.spark.minRadius + (config.spark.maxRadius - config.spark.minRadius) * k;
      spark.sprite.scale.set(radius, radius, 1);
      spark.sprite.material.opacity = config.spark.maxOpacity * (1 - k);
    }
  }
  postProcessing.render();
}

// --- Pause/Resume animation when window is not visible (save resources) ---
let animationPaused = false;
function onVisibilityChange() {
  if (document.hidden) {
    if (!animationPaused) {
      renderer.setAnimationLoop(null);
      animationPaused = true;
    }
  } else {
    if (animationPaused) {
      renderer.setAnimationLoop(render);
      animationPaused = false;
    }
  }
}
document.addEventListener('visibilitychange', onVisibilityChange);

// --- Pause/Resume animation when canvas3D is not visible (save resources) ---
function setupCanvasVisibilityPause() {
  const container = document.querySelector('.canvas3D');
  if (!container) return;
  // Force resume animation at start to avoid observer misjudgment
  if (renderer && typeof render === 'function') {
    renderer.setAnimationLoop(render);
    animationPaused = false;
  }
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        // Skip if layout not ready
        if (entry.boundingClientRect.height === 0 || entry.boundingClientRect.width === 0) return;
        if (!renderer) return;
        // Only resume if intersectionRatio > 0.2
        if (entry.isIntersecting && entry.intersectionRatio > 0.2) {
          if (animationPaused === false) return;
          renderer.setAnimationLoop(render);
          animationPaused = false;
        } else {
          if (animationPaused === true) return;
          renderer.setAnimationLoop(null);
          animationPaused = true;
        }
      });
    }, { threshold: 0.2 });
    observer.observe(container);
  } else {
    // Fallback: scroll event (older browsers)
    window.addEventListener('scroll', () => {
      if (!renderer) return;
      const rect = container.getBoundingClientRect();
      const inView = rect.bottom > 0 && rect.top < window.innerHeight;
      if (inView) {
        if (animationPaused === false) return;
        renderer.setAnimationLoop(render);
        animationPaused = false;
      } else {
        if (animationPaused === true) return;
        renderer.setAnimationLoop(null);
        animationPaused = true;
      }
    });
  }
}
setupCanvasVisibilityPause();

// --- Auto-tune for mobile/low-end devices ---
function autoMobilePerformanceTuning() {
  // Detect low-end devices
  const isMobile = /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent);
  const lowCore = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
  const lowMem = navigator.deviceMemory && navigator.deviceMemory <= 4;
  // alert(`${navigator.userAgent}\n${navigator.hardwareConcurrency}\n${navigator.deviceMemory}`);
  // alert(`isMobile: ${isMobile}, lowCore: ${lowCore}, lowMem: ${lowMem}`);
  if (isMobile || lowCore || lowMem) {
    // Reduce particle counts
    config.star.count = 800;
    config.flame.count = 6000;
    config.meteor.count = 80;
    // Reduce particle size
    config.star.size = 2;
    config.flame.size = 80;
    // Lower bloom strength
    config.bloom.strength = 0.7;
    config.bloom.radius = 0.7;
    // Lower render FOV
    config.camera.fov = 34;
    // Optionally: disable some effects if needed
  }
}
autoMobilePerformanceTuning();