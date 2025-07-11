import * as THREE from 'three';
import { pass, cubeTexture, screenUV, grayscale, uniform, mrt, output, emissive } from 'three/tsl';
import { anamorphic } from 'three/addons/tsl/display/AnamorphicNode.js';

import { RGBMLoader } from 'three/addons/loaders/RGBMLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { UltraHDRLoader } from 'three/addons/loaders/UltraHDRLoader.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { SVGLoader } from '../../jsm/loaders/SVGLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// --- Global Configuration ---
const config = {
  camera: {
    fov: 40,
    near: 0.2,
    far: 3000,
    position: { x: 0, y: 30, z: 90 },
    minZ: 420,
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
    count: 180,
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
    positionX: 25,
    positionY: 35,
    emissive: 0xffffff,
    emissiveIntensity: 0.7,
    roughness: 0.7,
    metalness: 1.0,
    flicker: { min: 0.2, max: 0.6, speed: 2.2 },
    sway: { z: 0.035, x: 0.035, speedZ: 1.5, speedX: 1.1 },
  },
  flame: {
    count: 14000,
    size: 130,
    colorR: [0.5, 0.7],
    colorG: 1.0,
    colorB: [0.2, 0.4],
    alpha: [0.7, 0.88],
    xRange: 18,
    yRange: 18,
    zBase: 0,
    diskRadius: 9,
    lengthMin: 10,
    lengthMax: 30,
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

// --- Detect if device is mobile ---
function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent) || window.innerWidth <= 600;
}

// --- Mobile-only scaling function ---
function autoScaleConfigForMobile(container) {
  // You can adjust the base resolution for mobile
  const BASE_WIDTH = 750;
  const BASE_HEIGHT = 600;
  const width = container.clientWidth;
  const height = container.clientHeight;
  const scaleX = BASE_WIDTH / width;
  const scaleY = BASE_HEIGHT / height;
  // On mobile, spaceship is larger, camera is closer, Y axis is lower
  config.spaceship.positionX = 10 * scaleX;
  config.spaceship.positionY = 18 * scaleY;
  config.camera.minZ = 210 * scaleX;
  config.camera.maxZ = 320 * scaleX;
}

// --- Dynamically scale parameters (auto switch desktop/mobile) ---
function autoScaleConfigForResolution(container) {
  if (isMobileDevice()) {
    autoScaleConfigForMobile(container);
    return;
  }
  const BASE_WIDTH = 1000;
  const BASE_HEIGHT = 500;
  const width = container.clientWidth;
  const height = container.clientHeight;
  const scaleX = BASE_WIDTH / width;
  const scaleY = BASE_HEIGHT / height;
  // Desktop: the larger the screen, the smaller the scale, the closer the camera
  config.spaceship.positionX = 35 * scaleX;
  config.spaceship.positionY = 35 * scaleY;
  config.camera.minZ = 420 * scaleX;
  config.camera.maxZ = 700 * scaleX;
}

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
let flameCount = config.flame.count; // Significantly increased flame particle count

let meteorMeshes = [];
let meteorGroup = null;

let hitTimes = 0;

init();

async function init() {
  const container = document.querySelector('.canvas3D');
  // Safety: remove old canvas to avoid duplicate append or canvas misplacement
  container.querySelectorAll('canvas').forEach(c => c.remove());

  // --- New: auto scaling ---
  autoScaleConfigForResolution(container);

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
    // Gradually update speed
    let targetSpeed = 800 + Math.random() * 900; // 800~1700 km/s
    // Smoothly display speed
    speedDisplay += (targetSpeed - speedDisplay) * Math.min(1, delta * 2.5); // The larger the delta, the faster the change
    updateSpeedDisplay(speedDisplay);
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
        if (dist < config.meteor.collisionDistance && info.cooldown <= 0) {
          createSpark(meteorPos);
          info.cooldown = config.meteor.cooldown;
          hitTimes++;
          const hitDom = document.getElementById('hitTimes');
          if (hitDom) {
            hitDom.textContent = hitTimes <= 999 ? hitTimes : '∞';
          }
          updateHitsCircle(hitTimes);
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
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('jsm/libs/draco/');
  loader.setDRACOLoader(dracoLoader);
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
    gltf.scene.position.x = config.spaceship.positionX;
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
  const container = document.querySelector('.canvas3D');
  if (container) autoScaleConfigForResolution(container);
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

let speedDisplay = 1200; // Initial displayed speed
function updateSpeedDisplay(speed) {
  // speed: km/s
  const speedBar = document.getElementById('speedBar');
  const speedValue = document.getElementById('speedValue');
  // max speed 99999 km/s
  const maxSpeed = 99999;
  const barMaxWidth = 76; // svg rect width
  const barWidth = Math.max(0, Math.min(barMaxWidth, (speed / maxSpeed) * barMaxWidth));
  if (speedBar) {
    if (speed == maxSpeed) speedBar.setAttribute('width', barMaxWidth+12);
    else speedBar.setAttribute('width', barWidth);
  }
  if (speedValue) {
    speedValue.textContent = Math.round(speed);
  }
}

// Update hit times circle stroke based on hit count
function updateHitsCircle(value, max = 999) {
  const circle = document.getElementById('hitsCircle');
  if (!circle) return;
  const percent = Math.min(1, value / max);
  const radius = circle.r.baseVal.value;
  const circumference = 2 * Math.PI * radius;
  circle.style.strokeDasharray = `${circumference}`;
  circle.style.strokeDashoffset = `${circumference * (1 - percent)}`;
}

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
  if (flameParticles && spaceship && !isBoosting) {
    // Added: pause sway when boosting
    const t = clock.getElapsedTime();
    if (!isSwayPaused) {
      spaceship.rotation.z = Math.sin(t * config.spaceship.sway.speedZ) * config.spaceship.sway.z;
      spaceship.rotation.x = Math.sin(t * config.spaceship.sway.speedX) * config.spaceship.sway.x;
    } else {
      spaceship.rotation.z = 0;
      spaceship.rotation.x = 0;
    }
    // Spaceship slow glow/flicker
    const maxGlow = config.spaceship.flicker.max;
    const minGlow = config.spaceship.flicker.min;
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
  // Added: pause SPEED animation
  if (!isSpeedPaused) {
    // Gradually update speed
    let targetSpeed = 40000 + Math.random() * 80000; // 40000~120000 km/s, average about 70000
    speedDisplay += (targetSpeed - speedDisplay) * Math.min(1, delta * 3.5); // Increased smoothing factor
    updateSpeedDisplay(speedDisplay);
  } else {
    // Force display 99999
    updateSpeedDisplay(99999);
  }
  // Added: spaceship Z-axis smooth animation
  if (spaceship) {
    if (typeof spaceshipTargetZ === 'number') {
      // Ease to target Z
      const diff = spaceshipTargetZ - spaceship.position.z;
      if (Math.abs(diff) > 0.1) {
        spaceship.position.z += diff * Math.min(1, delta * 6);
      } else {
        spaceship.position.z = spaceshipTargetZ;
        // Reset target Z when reached
        if (spaceshipTargetZ === spaceshipOriginZ && !isBoosting) {
          spaceshipTargetZ = null;
        }
      }
    }
  }
  // --- Capsule flame animation (boost only) ---
  if (isBoosting && spaceship) {
    showCapsuleFlame();
  } else {
    hideCapsuleFlame();
  }
  postProcessing.render();
}

// === ShipVate LOGO fly-in animation ===
let logoFlyMesh = null;
let logoFlyGlow = null;
let logoFlyProgress = 0;
let logoFlyAnimating = false;
let logoFlyDuration = 3; // Animation duration in seconds

async function startLogoFlyInAnimation() {
  if (!spaceship) return;
  // Remove old animated LOGO
  if (logoFlyMesh) { scene.remove(logoFlyMesh); logoFlyMesh = null; }
  if (logoFlyGlow) { scene.remove(logoFlyGlow); logoFlyGlow = null; }
  logoFlyProgress = 0;
  logoFlyAnimating = true;
  // Load SVG
  const loader = new SVGLoader();
  const svgText = await fetch('assets/img/banner/logo.svg').then(r => r.text());
  const svgData = loader.parse(svgText);
  const shapes = [];
  svgData.paths.forEach(path => {
    const subShapes = SVGLoader.createShapes(path);
    shapes.push(...subShapes);
  });
  const extrudeSettings = { depth: 8, bevelEnabled: true, bevelThickness: 1.2, bevelSize: 1.5, bevelSegments: 4 };
  const geometry = new THREE.ExtrudeGeometry(shapes, extrudeSettings);
  // Material: exactly the same as the logo on the ship
  const logoMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x43CEA2,
    metalness: 0.85,
    roughness: 0.13,
    emissive: 0x185A9D,
    emissiveIntensity: 0.5,
    clearcoat: 0.7,
    transparent: true,
    opacity: 0.98
  });
  logoFlyMesh = new THREE.Mesh(geometry, logoMaterial);
  logoFlyMesh.name = 'shipvateLogoFly';
  logoFlyMesh.scale.set(0.18, -0.18, 0.18);
  // Glow
  const logoColor = 0x43CEA2;
  const glowMaterial = new THREE.MeshPhysicalMaterial({
    color: logoColor,
    metalness: 0.5,
    roughness: 0.1,
    emissive: logoColor,
    emissiveIntensity: 2.5,
    transparent: true,
    opacity: 0.10,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  logoFlyGlow = new THREE.Mesh(geometry, glowMaterial);
  logoFlyGlow.name = 'shipvateLogoFlyGlow';
  logoFlyGlow.scale.set(0.22, -0.22, 0.22);
  // Initial position: 700 units in front of the spaceship (was 400)
  const shipPos = new THREE.Vector3();
  spaceship.getWorldPosition(shipPos);
  const shipDir = new THREE.Vector3(0, 0, -1).applyQuaternion(spaceship.quaternion).normalize();
  const startPos = shipPos.clone().add(shipDir.clone().multiplyScalar(700));
  logoFlyMesh.position.copy(startPos);
  logoFlyGlow.position.copy(startPos);
  // Parallel to the width of the spaceship
  logoFlyMesh.quaternion.copy(spaceship.quaternion);
  logoFlyGlow.quaternion.copy(spaceship.quaternion);
  scene.add(logoFlyGlow);
  // scene.add(logoFlyMesh);
}

// Add animation update in render()
const oldRender = render;
render = function() {
  // ...existing code...
  if (logoFlyAnimating && logoFlyMesh && spaceship) {
    logoFlyProgress += clock.getDelta() / logoFlyDuration;
    // Let the LOGO fly from 700 in front of the spaceship, pass through the nose at 0, and continue to -200 behind
    let t = logoFlyProgress;
    if (t > 1.3) t = 1.3; // 1.0 = nose, 1.3 = after passing through
    const shipPos = new THREE.Vector3();
    spaceship.getWorldPosition(shipPos);
    const shipDir = new THREE.Vector3(0, 0, -1).applyQuaternion(spaceship.quaternion).normalize();
    const from = shipPos.clone().add(shipDir.clone().multiplyScalar(700));
    const to = shipPos.clone().add(shipDir.clone().multiplyScalar(-200)); // Pass through to behind the spaceship
    const pos = from.clone().lerp(to, t);
    // === Fix Y axis: logo Y position automatically aligns with the spaceship nose ===
    const bbox = new THREE.Box3().setFromObject(spaceship);
    const noseY = bbox.max.y; // Nose height
    pos.x = pos.x - 25;
    pos.y = noseY + 10;
    logoFlyMesh.position.copy(pos);
    logoFlyGlow.position.copy(pos);
    // scale/opacity animation
    let scale = 0.18 + 0.09 * (1-t); // 1.5x size
    if (t > 1) scale = 0.18 - 0.06 * (t-1)/0.3; // shrink after passing through (1.5x)
    logoFlyMesh.scale.set(scale, -scale, scale);
    logoFlyGlow.scale.set(scale*1.22, -scale*1.22, scale*1.22);
    // opacity animation
    let opacity = 0.98 * (1-t);
    if (t > 1) opacity = 0.98 * (1.3-t)/0.3; // fade out after passing through
    logoFlyMesh.material.opacity = Math.max(0, opacity);
    logoFlyGlow.material.opacity = Math.max(0, 0.10 * (1.3-t)/0.3);
    // orientation follows the spaceship
    logoFlyMesh.quaternion.copy(spaceship.quaternion);
    logoFlyGlow.quaternion.copy(spaceship.quaternion);
    if (logoFlyProgress >= 1.3) {
      // End animation
      scene.remove(logoFlyMesh);
      scene.remove(logoFlyGlow);
      logoFlyMesh = null;
      logoFlyGlow = null;
      logoFlyAnimating = false;
      // === Only fade in the main LOGO after the LOGO animation ends, and change the button after fade-in ===
      fadeInLogoOnSpaceshipTop(1.2, function() {
        // Button style change (originally in triggerBoostEasterEgg)
        const btn = document.querySelector('.default-btn');
        if (btn) {
          btn.style.background = 'linear-gradient(135deg, #43CEA2 60%, #185A9D 100%)';
          btn.style.color = '#fff';
          btn.style.boxShadow = '0 0 24px #FFB30099, 0 0 0 2px #FFD70044 inset';
          btn.textContent = '立即索取 VIP 優惠折扣';
          btn.setAttribute('href', 'mailto:patrick.lin@shipvate.com');
          btn.setAttribute('target', '_blank');
        }
      });
    }
  }
  oldRender();
}

// 1. Remove auto call to addLogoOnSpaceshipTop
// tryAddLogoAfterSpaceshipLoaded();

// 2. Wrap addLogoOnSpaceshipTop to support fade-in animation
async function fadeInLogoOnSpaceshipTop(duration = 1.2, onComplete) {
  if (!spaceship) return;
  // First create logo but set opacity 0
  const loader = new SVGLoader();
  const svgText = await fetch('assets/img/banner/logo.svg').then(r => r.text());
  const svgData = loader.parse(svgText);
  const shapes = [];
  svgData.paths.forEach(path => {
    const subShapes = SVGLoader.createShapes(path);
    shapes.push(...subShapes);
  });
  const extrudeSettings = { depth: 8, bevelEnabled: true, bevelThickness: 1.2, bevelSize: 1.5, bevelSegments: 4 };
  const geometry = new THREE.ExtrudeGeometry(shapes, extrudeSettings);
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x43CEA2,
    metalness: 0.85,
    roughness: 0.13,
    emissive: 0x185A9D,
    emissiveIntensity: 0.5,
    clearcoat: 0.7,
    transparent: true,
    opacity: 0 // start transparent
  });
  const logoMesh = new THREE.Mesh(geometry, material);
  logoMesh.scale.set(0.06, 0.06, 0.06);
  logoMesh.scale.y *= -1;
  const bbox = new THREE.Box3().setFromObject(spaceship);
  const center = bbox.getCenter(new THREE.Vector3());
  const top = bbox.max.y;
  logoMesh.position.set(center.x, top + 15, center.z - 53);
  logoMesh.quaternion.copy(spaceship.quaternion);
  scene.add(logoMesh);
  // Fade-in animation
  let fade = 0;
  function fadeInStep() {
    fade += 1/60/duration;
    logoMesh.material.opacity = Math.min(0.98, fade * 0.98);
    if (fade < 1) {
      requestAnimationFrame(fadeInStep);
    } else {
      logoMesh.material.opacity = 0.98;
      if (typeof onComplete === 'function') onComplete();
    }
  }
  fadeInStep();
}

// Modify the call in render after LOGO animation ends
render = function() {
  // ...existing code...
  if (logoFlyAnimating && logoFlyMesh && spaceship) {
    logoFlyProgress += clock.getDelta() / logoFlyDuration;
    // Let the LOGO fly from 700 in front of the spaceship, pass through the nose at 0, and continue to -200 behind
    let t = logoFlyProgress;
    if (t > 1.3) t = 1.3; // 1.0 = nose, 1.3 = after passing through
    const shipPos = new THREE.Vector3();
    spaceship.getWorldPosition(shipPos);
    const shipDir = new THREE.Vector3(0, 0, -1).applyQuaternion(spaceship.quaternion).normalize();
    const from = shipPos.clone().add(shipDir.clone().multiplyScalar(700));
    const to = shipPos.clone().add(shipDir.clone().multiplyScalar(-200)); // Pass through to behind the spaceship
    const pos = from.clone().lerp(to, t);
    // === Fix Y axis: logo Y position automatically aligns with the spaceship nose ===
    const bbox = new THREE.Box3().setFromObject(spaceship);
    const noseY = bbox.max.y; // Nose height
    pos.x = pos.x - 25;
    pos.y = noseY + 50;
    logoFlyMesh.position.copy(pos);
    logoFlyGlow.position.copy(pos);
    // scale/opacity animation
    let scale = 0.18 + 0.09 * (1-t); // 1.5x size
    if (t > 1) scale = 0.18 - 0.06 * (t-1)/0.3; // shrink after passing through (1.5x)
    logoFlyMesh.scale.set(scale, -scale, scale);
    logoFlyGlow.scale.set(scale*1.22, -scale*1.22, scale*1.22);
    // opacity animation
    let opacity = 0.98 * (1-t);
    if (t > 1) opacity = 0.98 * (1.3-t)/0.3; // fade out after passing through
    logoFlyMesh.material.opacity = Math.max(0, opacity);
    logoFlyGlow.material.opacity = Math.max(0, 0.10 * (1.3-t)/0.3);
    // orientation follows the spaceship
    logoFlyMesh.quaternion.copy(spaceship.quaternion);
    logoFlyGlow.quaternion.copy(spaceship.quaternion);
    if (logoFlyProgress >= 1.3) {
      // End animation
      scene.remove(logoFlyMesh);
      scene.remove(logoFlyGlow);
      logoFlyMesh = null;
      logoFlyGlow = null;
      logoFlyAnimating = false;
      // === Only fade in the main LOGO after the LOGO animation ends, and change the button after fade-in ===
      fadeInLogoOnSpaceshipTop(1.2, function() {
        // Button style change (originally in triggerBoostEasterEgg)
        const btn = document.querySelector('.default-btn');
        if (btn) {
          btn.style.background = 'linear-gradient(135deg, #43CEA2 60%, #185A9D 100%)';
          btn.style.color = '#fff';
          btn.style.boxShadow = '0 0 24px #FFB30099, 0 0 0 2px #FFD70044 inset';
          btn.textContent = '立即索取 VIP 優惠折扣';
          btn.setAttribute('href', 'mailto:patrick.lin@shipvate.com');
          btn.setAttribute('target', '_blank');
        }
      });
    }
  }
  oldRender();
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
function getDeviceLevel() {
  const cpu = navigator.hardwareConcurrency || 1;
  const ram = navigator.deviceMemory || 1;
  if (cpu > 8 || ram > 16) return 5;
  if (cpu > 6 || ram > 8) return 4;
  if (cpu > 4 || ram > 4) return 3;
  if (cpu > 2 || ram > 1) return 2;
  return 1;
}

let deviceLevel = getDeviceLevel();
if (!navigator.deviceMemory) deviceLevel--;
// document.querySelector('#dev-tool').innerHTML =
//   `${navigator.hardwareConcurrency || 0}/${navigator.deviceMemory || 0}/${deviceLevel}`;

if (deviceLevel === 5) {
  config.star.count = 1800;
  config.flame.count = 14000;
  config.meteor.count = 180;
  config.star.size = 3;
  config.flame.size = 130;
  config.bloom.strength = 1.2;
  config.bloom.radius = 1.2;
  config.camera.fov = 40;
} else if (deviceLevel === 4) {
  config.star.count = 1200;
  config.flame.count = 9000;
  config.meteor.count = 120;
  config.star.size = 2.5;
  config.flame.size = 110;
  config.bloom.strength = 1.0;
  config.bloom.radius = 1.0;
  config.camera.fov = 38;
} else if (deviceLevel === 3) {
  config.star.count = 800;
  config.flame.count = 6000;
  config.meteor.count = 80;
  config.star.size = 2.2;
  config.flame.size = 90;
  config.bloom.strength = 0.8;
  config.bloom.radius = 0.8;
  config.camera.fov = 36;
} else if (deviceLevel === 2) {
  config.star.count = 500;
  config.flame.count = 3500;
  config.meteor.count = 40;
  config.star.size = 1.8;
  config.flame.size = 70;
  config.bloom.strength = 0.6;
  config.bloom.radius = 0.6;
  config.camera.fov = 32;
} else {
  config.star.count = 300;
  config.flame.count = 2000;
  config.meteor.count = 20;
  config.star.size = 1.5;
  config.flame.size = 60;
  config.bloom.strength = 0.5;
  config.bloom.radius = 0.5;
  config.camera.fov = 30;
}

// --- Boost (Jet Acceleration) Button Function ---
let isBoosting = false;
let meteorSpeedBackup = null;
const BOOST_SPEED_FACTOR = 5; // Meteor speed boost multiplier
const BOOST_FLAME_FACTOR = 4; // Flame density and length boost multiplier
let flameCountBackup = null;
let flameLengthBackup = null;
let isSwayPaused = false; // Added: Control spaceship sway
let isSpeedPaused = false; // Added: Control SPEED animation
let spaceshipTargetZ = null; // Target Z position (null represents no boost)
let spaceshipOriginZ = 0; // Original Z position
let spaceshipBoostZ = -40; // Z position when boosting forward
let bloomOriginStrength = config.bloom.strength;
let bloomBoostStrength = bloomOriginStrength * 2.2; // Stronger bloom when boosting

const easterEggAudio = new Audio('assets/sound/trigger.mp3');
const boostAudio = new Audio('assets/sound/boost.mp3');

window.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('boostBtn');
  if (btn) {
    // On press: start boost
    btn.addEventListener('mousedown', () => {
      if (boostAudio) {
        boostAudio.currentTime = 0;
        boostAudio.play();
      }
      if (isBoosting) return;
      isBoosting = true;
      // Backup original speed
      if (!meteorSpeedBackup) {
        meteorSpeedBackup = {
          speedMin: config.meteor.speedMin,
          speedMax: config.meteor.speedMax
        };
      }
      // Backup flame parameters
      if (!flameCountBackup) {
        flameCountBackup = config.flame.count;
      }
      if (!flameLengthBackup) {
        flameLengthBackup = {
          lengthMin: config.flame.lengthMin,
          lengthMax: config.flame.lengthMax
        };
      }
      // Increase speed
      config.meteor.speedMin = meteorSpeedBackup.speedMin * BOOST_SPEED_FACTOR;
      config.meteor.speedMax = meteorSpeedBackup.speedMax * BOOST_SPEED_FACTOR;
      // Increase flame density and length
      config.flame.count = Math.floor(flameCountBackup * BOOST_FLAME_FACTOR);
      config.flame.lengthMin = Math.floor(flameLengthBackup.lengthMin * BOOST_FLAME_FACTOR);
      config.flame.lengthMax = Math.floor(flameLengthBackup.lengthMax * BOOST_FLAME_FACTOR);
      // Immediately update speed in meteorInfos
      for (let i = 0; i < meteorInfos.length; i++) {
        meteorInfos[i].speed = config.meteor.speedMin + Math.random() * (config.meteor.speedMax - config.meteor.speedMin);
      }
      // Regenerate flame particles
      if (flameParticles && spaceship) {
        scene.remove(flameParticles);
        flameParticles.visible = false;
        hideCapsuleFlame();
      }
      showCapsuleFlame();
      // Added: Spaceship moves forward
      if (spaceship) {
        spaceshipOriginZ = spaceship.position.z;
        spaceshipTargetZ = spaceshipBoostZ;
      }
      // Added: Stronger bloom blur
      if (postProcessing && postProcessing.outputNode && postProcessing.outputNode.children) {
        postProcessing.outputNode.children.forEach(pass => {
          if (pass.constructor && pass.constructor.name === 'BloomNode') {
            pass.strength = bloomBoostStrength;
          }
        });
      }
      // Added: SPEED value jumps to 2000 and animation pauses
      isSpeedPaused = true;
      updateSpeedDisplay(2000);
      // Added: Spaceship stops swaying
      isSwayPaused = true;
      if (spaceship) {
        spaceship.rotation.x = 0;
        spaceship.rotation.z = 0;
      }
      // Button animation effect
      btn.classList.add('boosting');
    });
    const stopBoostSound = () => {
      if (boostAudio) {
        boostAudio.pause();
        boostAudio.currentTime = 0;
      }
    };
    btn.addEventListener('mouseup', stopBoostSound);
    btn.addEventListener('mouseleave', stopBoostSound);
    btn.addEventListener('touchend', stopBoostSound);
    btn.addEventListener('touchcancel', stopBoostSound);
    // On release: restore
    const stopBoost = () => {
      if (!isBoosting) return;
      if (meteorSpeedBackup) {
        config.meteor.speedMin = meteorSpeedBackup.speedMin;
        config.meteor.speedMax = meteorSpeedBackup.speedMax;
        for (let i = 0; i < meteorInfos.length; i++) {
          meteorInfos[i].speed = config.meteor.speedMin + Math.random() * (config.meteor.speedMax - config.meteor.speedMin);
        }
      }
      if (flameCountBackup) {
        config.flame.count = flameCountBackup;
      }
      if (flameLengthBackup) {
        config.flame.lengthMin = flameLengthBackup.lengthMin;
        config.flame.lengthMax = flameLengthBackup.lengthMax;
      }
      // Regenerate flame particles (on restore)
      if (flameParticles && spaceship) {
        scene.remove(flameParticles);
        flameParticles.visible = false;
        hideCapsuleFlame();
      }
      // Show particle flame
      if (flameParticles && spaceship) {
        scene.add(flameParticles);
        flameParticles.visible = true;
      }
      // Added: Spaceship returns to original position
      if (spaceship) {
        spaceshipTargetZ = spaceshipOriginZ;
      }
      // Added: Restore bloom
      if (postProcessing && postProcessing.outputNode && postProcessing.outputNode.children) {
        postProcessing.outputNode.children.forEach(pass => {
          if (pass.constructor && pass.constructor.name === 'BloomNode') {
            pass.strength = bloomOriginStrength;
          }
        });
      }
      // Added: Resume SPEED animation
      isSpeedPaused = false;
      // Added: Resume spaceship sway
      isSwayPaused = false;
      isBoosting = false;
      // Restore button animation effect
      btn.classList.remove('boosting');
    };
    btn.addEventListener('mouseup', stopBoost);
    btn.addEventListener('mouseleave', stopBoost);
    // If mouse is released outside, also restore
    document.addEventListener('mouseup', stopBoost);
    // Mobile touch support
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (boostAudio) {
        boostAudio.currentTime = 0;
        boostAudio.play();
      }
      if (isBoosting) return;
      isBoosting = true;
      if (!meteorSpeedBackup) {
        meteorSpeedBackup = {
          speedMin: config.meteor.speedMin,
          speedMax: config.meteor.speedMax
        };
      }
      if (!flameCountBackup) {
        flameCountBackup = config.flame.count;
      }
      if (!flameLengthBackup) {
        flameLengthBackup = {
          lengthMin: config.flame.lengthMin,
          lengthMax: config.flame.lengthMax
        };
      }
      config.meteor.speedMin = meteorSpeedBackup.speedMin * BOOST_SPEED_FACTOR;
      config.meteor.speedMax = meteorSpeedBackup.speedMax * BOOST_SPEED_FACTOR;
      config.flame.count = Math.floor(flameCountBackup * BOOST_FLAME_FACTOR);
      config.flame.lengthMin = Math.floor(flameLengthBackup.lengthMin * BOOST_FLAME_FACTOR);
      config.flame.lengthMax = Math.floor(flameLengthBackup.lengthMax * BOOST_FLAME_FACTOR);
      for (let i = 0; i < meteorInfos.length; i++) {
        meteorInfos[i].speed = config.meteor.speedMin + Math.random() * (config.meteor.speedMax - config.meteor.speedMin);
      }
      if (flameParticles && spaceship) {
        scene.remove(flameParticles);
        flameParticles.visible = false;
        hideCapsuleFlame();
      }
      showCapsuleFlame();
      // Added: Spaceship moves forward
      if (spaceship) {
        spaceshipOriginZ = spaceship.position.z;
        spaceshipTargetZ = spaceshipBoostZ;
      }
      // Added: Stronger bloom blur
      if (postProcessing && postProcessing.outputNode && postProcessing.outputNode.children) {
        postProcessing.outputNode.children.forEach(pass => {
          if (pass.constructor && pass.constructor.name === 'BloomNode') {
            pass.strength = bloomBoostStrength;
          }
        });
      }
      // Added: SPEED value jumps to 2000 and animation pauses
      isSpeedPaused = true;
      updateSpeedDisplay(2000);
      // Added: Spaceship stops swaying
      isSwayPaused = true;
      if (spaceship) {
        spaceship.rotation.x = 0;
        spaceship.rotation.z = 0;
      }
      btn.classList.add('boosting');
    }, { passive: false });
    btn.addEventListener('touchend', stopBoost);
    btn.addEventListener('touchcancel', stopBoost);
  }
});

// --- Boost Capsule Flame ---
let capsuleFlame = null;
let capsuleFlameMaterial = null;
let capsuleFlameColor = new THREE.Color(0x3bbcff); // Blue color when boosting
let capsuleFlameLength = 120; // Adjustable
let capsuleFlameRadius = 7; // Adjustable

function showCapsuleFlame() {
  if (!spaceship) return;
  if (!capsuleFlameMaterial) {
    capsuleFlameMaterial = new THREE.MeshPhysicalMaterial({
      color: capsuleFlameColor,
      emissive: capsuleFlameColor,
      emissiveIntensity: 2.5,
      roughness: 0.25,
      metalness: 0.7,
      transparent: true,
      opacity: 0.85,
      transmission: 0.7,
      thickness: 0.8,
      clearcoat: 0.7,
      clearcoatRoughness: 0.2,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
  }
  if (!capsuleFlame) {
    capsuleFlame = new THREE.Mesh(
      new THREE.CapsuleGeometry(capsuleFlameRadius, capsuleFlameLength, 8, 16),
      capsuleFlameMaterial
    );
    capsuleFlame.visible = false;
    scene.add(capsuleFlame);
  }
  capsuleFlame.visible = true;
  // Dynamic position and direction
  const t = clock.getElapsedTime();
  // Tail emission point
  spaceship.localToWorld(tmpVec1.set(0, 0, 0));
  tmpVec2.set(0, 0, -1).applyQuaternion(spaceship.quaternion).normalize();
  const tailOffset = config.flame.tailOffset;
  tmpVec3.copy(tmpVec1).add(tmpVec2.clone().multiplyScalar(tailOffset - capsuleFlameLength * 0.5));
  capsuleFlame.position.copy(tmpVec3);
  capsuleFlame.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tmpVec2);
  // Dynamic scale/flicker
  // const flicker = 1 + getFlameSin(t * 8) * 0.12;
  // capsuleFlame.scale.set(1, flicker, 1);
  capsuleFlame.scale.set(1, 1, 1); // Fixed, no stretch
}

function hideCapsuleFlame() {
  if (capsuleFlame) capsuleFlame.visible = false;
}

const boostBtn = document.getElementById('boostBtn');
if (boostBtn) {
  boostBtn.addEventListener('mousedown', function() {
    boostBtn.style.boxShadow = '0 0 32px #00ffd0cc, 0 0 0 4px #00ffd044 inset';
    boostBtn.style.background = 'linear-gradient(135deg, #00eaff 60%, #00ffd0 100%)';
    boostBtn.style.color = '#0a1428';
  });
  boostBtn.addEventListener('mouseup', function() {
    boostBtn.style.boxShadow = '0 0 16px #00eaff99, 0 0 0 2px #00eaff44 inset';
    boostBtn.style.background = 'linear-gradient(135deg, rgba(0,234,255,0.18) 60%, rgba(10,20,40,0.92) 100%)';
    boostBtn.style.color = '#00eaff';
  });
  boostBtn.addEventListener('mouseleave', function() {
    boostBtn.style.boxShadow = '0 0 16px #00eaff99, 0 0 0 2px #00eaff44 inset';
    boostBtn.style.background = 'linear-gradient(135deg, rgba(0,234,255,0.18) 60%, rgba(10,20,40,0.92) 100%)';
    boostBtn.style.color = '#00eaff';
  });
  boostBtn.addEventListener('mouseover', function() {
    boostBtn.style.boxShadow = '0 0 32px #00ffd0cc, 0 0 0 4px #00ffd044 inset';
    boostBtn.style.background = 'linear-gradient(135deg, #00eaff 60%, #00ffd0 100%)';
    boostBtn.style.color = '#0a1428';
  });
}


// === BOOST hold 10s Easter Egg ===
let boostHoldTimer = null;
let boostHoldStart = null;
let boostEasterEggTriggered = false;
const BOOST_EASTER_EGG_TIME = 10000;

function triggerBoostEasterEgg() {
  if (boostEasterEggTriggered) return;
  boostEasterEggTriggered = true;

  if (easterEggAudio) {
    easterEggAudio.currentTime = 0;
    easterEggAudio.play();
  }
  // Only trigger LOGO fly-in animation
  if (typeof startLogoFlyInAnimation === 'function') {
    startLogoFlyInAnimation();
  }
}

const boostBtnMain = document.getElementById('boostBtn');
if (boostBtnMain) {
  boostBtnMain.addEventListener('mousedown', () => {
    if (boostEasterEggTriggered) return;
    boostHoldStart = Date.now();
    boostHoldTimer = setTimeout(triggerBoostEasterEgg, BOOST_EASTER_EGG_TIME);
  });
  boostBtnMain.addEventListener('mouseup', () => {
    clearTimeout(boostHoldTimer);
    boostHoldTimer = null;
  });
  boostBtnMain.addEventListener('mouseleave', () => {
    clearTimeout(boostHoldTimer);
    boostHoldTimer = null;
  });
  // Mobile touch support
  boostBtnMain.addEventListener('touchstart', (e) => {
    if (boostEasterEggTriggered) return;
    boostHoldStart = Date.now();
    boostHoldTimer = setTimeout(triggerBoostEasterEgg, BOOST_EASTER_EGG_TIME);
  }, { passive: false });
  boostBtnMain.addEventListener('touchend', () => {
    clearTimeout(boostHoldTimer);
    boostHoldTimer = null;
  });
  boostBtnMain.addEventListener('touchcancel', () => {
    clearTimeout(boostHoldTimer);
    boostHoldTimer = null;
  });
}

// === Draw ShipVate Logo (SVG-accurate) on top of the spaceship ===
async function addLogoOnSpaceshipTop() {
  if (!spaceship) return;
  // Load SVG file
  const loader = new SVGLoader();
  // Use fetch to get SVG content
  const svgText = await fetch('assets/img/banner/logo.svg').then(r => r.text());
  const svgData = loader.parse(svgText);
  // Only take the first path (logo has only one main path)
  const shapes = [];
  svgData.paths.forEach(path => {
    const subShapes = SVGLoader.createShapes(path);
    shapes.push(...subShapes);
  });
  // Create 3D geometry
  const extrudeSettings = { depth: 8, bevelEnabled: true, bevelThickness: 1.2, bevelSize: 1.5, bevelSegments: 4 };
  const geometry = new THREE.ExtrudeGeometry(shapes, extrudeSettings);
  // Material: blue-green metallic
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x43CEA2,
    metalness: 0.85,
    roughness: 0.13,
    emissive: 0x185A9D,
    emissiveIntensity: 0.5,
    clearcoat: 0.7,
    transparent: true,
    opacity: 0.98
  });
  const logoMesh = new THREE.Mesh(geometry, material);
  // Scale and center according to SVG viewBox size
  logoMesh.scale.set(0.06, 0.06, 0.06); // Based on viewBox 400x342
  logoMesh.scale.y *= -1; // Fix upside down
  // Get the top position of the spaceship
  const bbox = new THREE.Box3().setFromObject(spaceship);
  const center = bbox.getCenter(new THREE.Vector3());
  const top = bbox.max.y;
  logoMesh.position.set(center.x, top + 15, center.z + 33);
  // Make the logo parallel to the width of the spaceship
  logoMesh.quaternion.copy(spaceship.quaternion);
  scene.add(logoMesh);
}
// Call after spaceship is loaded
// function tryAddLogoAfterSpaceshipLoaded() {
//   if (spaceship) {
//     addLogoOnSpaceshipTop();
//   } else {
//     setTimeout(tryAddLogoAfterSpaceshipLoaded, 400);
//   }
// }
// tryAddLogoAfterSpaceshipLoaded();