import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { EXRLoader } from "three/addons/loaders/EXRLoader.js"; // <--- TAMBAHKAN IMPORT INI

let scene, camera, renderer, model, controls;
const clock = new THREE.Clock();

let sonicModel, sonicMixer, sonicAnimationClips, sonicBoundingBoxHelper;
const SONIC_MODEL_PATH = "sonic_spinning/scene.gltf";
const SONIC_SCALE_IN_LAB = 1000.0; // Atau skala yang Anda inginkan

// --- Sonic Settings ---
const SONIC_SPAWN_TARGET_OBJECT_NAME = "Object_25"; // Contoh
const SONIC_SPAWN_X_OFFSET = 0;
const SONIC_SPAWN_Y_OFFSET = -26; // Sesuaikan berdasarkan skala Sonic
const SONIC_SPAWN_Z_OFFSET = 3;
// Variabel untuk penyesuaian posisi Sonic secara dinamis
let sonicBasePosition = new THREE.Vector3();
let sonicPositionOffset = new THREE.Vector3(0, 0, 0);
let isSonicAdjustMode = false;
const SONIC_ADJUST_STEP = 50.0;

let isSonicAnimationPlaying = false;
let currentSonicAnimationAction = null;

// --- Player Controls & Physics ---
const keys = {
  W: false,
  A: false,
  S: false,
  D: false,
  SHIFT_LEFT: false,
  SPACE: false,
  E_INTERACT: false,
  G: false,
  Q_GHOST_DOWN: false,
  T: false, // No longer tracking state for T if it's a toggle trigger
};

let isGhostMode = false;
const GHOST_MODE_SPEED_MULTIPLIER = 3.0; // Meningkatkan kecepatan ghost mode

const PLAYER_EYE_HEIGHT = 10.5;
const PLAYER_COLLISION_HEIGHT = 1.8;
const GRAVITY = 20.0;
const JUMP_IMPULSE = 8.0;
const MAX_STEP_HEIGHT = 8.0; // Meningkatkan kemampuan melangkah
const playerRadiusBuffer = 5; // Mengurangi buffer radius
const PLAYER_FEET_RADIUS = playerRadiusBuffer * 0.8;
const INTERACTION_DISTANCE = 30.0; // Meningkatkan jarak interaksi

let player = {
  position: new THREE.Vector3(),
  velocity: new THREE.Vector3(),
  isGrounded: false,
  canJump: true,
  boundingBox: new THREE.Box3(),
};

// --- Other Interactive Objects ---
let object3Mesh, originalObject3Material, glowingObject3Material;
let isObject3On = false;
const OBJECT3_NAME = "Object_3";

// --- Raycasters & Collision ---
const raycaster = new THREE.Raycaster();
const interactionRaycaster = new THREE.Raycaster();
const collidableMeshes = [];
// !!! PENTING: Jika jembatan sekarang adalah bagian dari model utama,
// pastikan nama mesh jembatan ada di sini agar bisa dipijak.
// Contoh: "Mesh_Jembatan_Kiri_Bagian1", "Mesh_Jembatan_Kanan_Utama", dll.
const collidableObjectNames = [
  "Object_13108",
  "Object_13105",
  "Object_22",
  "Object_23",
  "Object_14",
  "Object_15",
  "Object_16",
  "Object_18",
  "Object_6",
  "Object_20",
  "Object_25",
  "Object_24",
  "model_0010",
  "model_0014",
  "model_0022",
  "model_0029",
  "model_0030",
  "model_0034",
  "model_0040",
  "model_0042",
  "model_0047",
  "model_0050",
  "model_0058",
  "model_0080",
  "model_0085",
  "model_0100",
  "model_0197",
  "model_0002",
  "model_0003",
  "model_0005",
  "model_0006",
  "model_0009",
  "model_0011",
  "model_0012",
  "model_0015",
  "model_0016",
  "model_0017",
  "model_0018",
  "model_0020",
  "model_0021",
  "model_0025",
  "model_0026",
  // Tambahkan nama mesh jembatan Anda di sini jika belum ada
];
const interactiveObjectNames = [
  // Objek yang bisa diinteraksi dengan tombol 'E'
  "Object_13108",
  "Object_23",
  "Object_18",
  "Object_23025",
];
const collisionBoundingBoxes = new Map();

// --- UI Elements ---
const blocker = document.getElementById("blocker");
const instructions = document.getElementById("instructions");

// --- Helper Vectors ---
const _worldDirection = new THREE.Vector3();
const _movementDirection = new THREE.Vector3();
const _upVector = new THREE.Vector3(0, 1, 0);
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();

// --- TV, Steam, Paper variables ---
let tvScreenMesh, originalTVMaterial, staticTVMaterial, staticTexture;
let isTVOn = false;
let steamObject, originalSteamPosition, originalSteamOpacity;
let isSteamActive = false;
let steamAnimationTime = 0;
const STEAM_LOOP_DURATION = 2.0;
const STEAM_MAX_HEIGHT_OFFSET = 10.0;
let paperMesh, paperPrintTexture, originalPaperMaterial, paperPrintMaterial;
let isPaperTextureVisible = false;
let paperAnimationActive = false;
let paperAnimationTime = 0;
const PAPER_ANIMATION_DURATION = 1.0;
let paperTargetOpacity = 0,
  paperCurrentOpacity = 0;

function init() {
  console.log("Init function started.");
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    20000
  );

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  document.body.appendChild(renderer.domElement);

  controls = new PointerLockControls(camera, document.body);
  if (instructions)
    instructions.addEventListener("click", () => controls.lock());
  controls.addEventListener("lock", () => {
    if (instructions) instructions.style.display = "none";
    if (blocker) blocker.style.display = "none";
    const controlsHelp = document.getElementById("controls-help");
    if (controlsHelp) controlsHelp.style.display = "block";
  });
  controls.addEventListener("unlock", () => {
    if (blocker) blocker.style.display = "flex";
    if (instructions) instructions.style.display = "";
    const controlsHelp = document.getElementById("controls-help");
    if (controlsHelp) controlsHelp.style.display = "none";
  });
  const controlsHelp = document.getElementById("controls-help");
  if (controlsHelp) controlsHelp.style.display = "none";

  setupLighting();

  loadEXRBackground("background.exr");

  const textureLoader = new THREE.TextureLoader();
  staticTexture = textureLoader.load(
    "television.jpeg",
    (texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      staticTVMaterial = new THREE.MeshStandardMaterial({
        map: staticTexture,
        emissiveMap: staticTexture,
        emissive: 0xffffff,
        emissiveIntensity: 0.5,
      });
    },
    undefined,
    (error) => {
      console.error("Error loading static screen texture:", error);
      staticTVMaterial = new THREE.MeshStandardMaterial({
        color: 0x888888,
        emissive: 0x333333,
        emissiveIntensity: 1,
      });
    }
  );

  paperPrintTexture = textureLoader.load(
    "kertasprint.jpeg",
    (texture) => {
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      paperPrintMaterial = new THREE.MeshStandardMaterial({
        map: paperPrintTexture,
        roughness: 0.8,
        metalness: 0.1,
        transparent: true,
        opacity: 0,
      });
    },
    undefined,
    (error) => {
      console.error("ERROR loading 'kertasprint.jpeg':", error);
      paperPrintMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.8,
        metalness: 0.1,
        transparent: true,
        opacity: 0,
      });
    }
  );

  const labLoader = new GLTFLoader();
  labLoader.load(
    "EDGEHOG ISLAND LABOLATORY.glb", // Ganti dengan nama file GLB utama Anda yang sudah termasuk jembatan
    (gltf) => {
      console.log("Main lab model (with integrated bridge) GLTF loaded.");
      model = gltf.scene;
      const labModelScale = 0.05; // Skala model utama Anda
      model.scale.set(labModelScale, labModelScale, labModelScale);

      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          // Logika untuk menambahkan mesh ke daftar collidable
          // dan membuat bounding box untuk collision
          if (collidableObjectNames.includes(child.name)) {
            collidableMeshes.push(child);
            collisionBoundingBoxes.set(
              child.name,
              new THREE.Box3().setFromObject(child)
            );
            console.log(`Added ${child.name} to collidables with BBox.`);
          } else {
            // Jika nama tidak ada di collidableObjectNames, tapi Anda ingin semua mesh collidable secara default:
            // collidableMeshes.push(child);
            // if (child.name) { // Hanya buat BBox jika ada nama untuk sistem collision AABB saat ini
            //    collisionBoundingBoxes.set(child.name, new THREE.Box3().setFromObject(child));
            //    console.log(`Auto-added ${child.name} to collidables with BBox (not in list).`);
            // } else {
            //    console.warn(`Mesh without name found, not added to BBox map:`, child);
            // }
          }

          if (child.name === "Object_23045") {
            // Setup untuk kertas
            paperMesh = child;
            originalPaperMaterial = paperMesh.material
              ? paperMesh.material.clone()
              : new THREE.MeshStandardMaterial({
                  color: 0xffffff,
                  roughness: 0.8,
                  metalness: 0.1,
                });
          }
        }
      });
      scene.add(model);

      // Setup objek interaktif lainnya
      object3Mesh = model.getObjectByName(OBJECT3_NAME);
      if (object3Mesh && object3Mesh.isMesh) {
        /* ... */
      } else console.warn(`${OBJECT3_NAME} not found or is not a mesh.`);
      tvScreenMesh = model.getObjectByName("Object_13105");
      if (tvScreenMesh && tvScreenMesh.isMesh && tvScreenMesh.material)
        originalTVMaterial = tvScreenMesh.material.clone();
      steamObject = model.getObjectByName("Object_17");
      if (steamObject && steamObject.isMesh) {
        originalSteamPosition = steamObject.position.clone();
        if (steamObject.material) {
          steamObject.material.transparent = true;
          originalSteamOpacity = steamObject.material.opacity;
          steamObject.visible = false;
        }
      }

      // Setup posisi awal player
      const targetObjectName = "Object_6";
      let targetObject = model.getObjectByName(targetObjectName);
      if (targetObject) {
        const boundingBox = new THREE.Box3().setFromObject(targetObject);
        targetObject.getWorldPosition(player.position);
        player.position.y = boundingBox.max.y;
      } else {
        player.position.set(0, PLAYER_COLLISION_HEIGHT / 2, 5); // Posisi default jika target tidak ditemukan
      }
      player.isGrounded = true;
      controls
        .getObject()
        .position.set(
          player.position.x,
          player.position.y + PLAYER_EYE_HEIGHT - PLAYER_COLLISION_HEIGHT / 2,
          player.position.z
        );
      player.boundingBox.setFromCenterAndSize(
        player.position,
        new THREE.Vector3(
          playerRadiusBuffer * 2,
          PLAYER_COLLISION_HEIGHT,
          playerRadiusBuffer * 2
        )
      );

      loadSonicModel();
      // Tidak perlu loadBridge() lagi

      animate();
    },
    (xhr) =>
      console.log(`Main Lab Model: ${(xhr.loaded / xhr.total) * 100}% loaded`),
    (error) => console.error("Main Lab GLTF Loading Error:", error)
  );

  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);
  window.addEventListener("resize", onWindowResize, false);
  console.log("Init function finished.");
}

function setupLighting() {
  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const dirLight = new THREE.DirectionalLight(0xffffff, 3.0);
  dirLight.position.set(40, 60, 35);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 200;
  dirLight.shadow.bias = -0.0005;
  scene.add(dirLight);
}

// Letakkan fungsi ini di mana saja di luar fungsi init() atau animate()
// Misalnya, setelah setupLighting() atau sebelum onKeyDown()

function loadEXRBackground(filePath) {
  if (!scene || !renderer) {
    // Renderer juga dibutuhkan untuk PMREMGenerator
    console.error(
      "Scene or Renderer is not initialized yet. Cannot load EXR background."
    );
    return;
  }

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader(); // Pre-compile shader

  new EXRLoader().load(
    filePath, // e.g., 'hdri/background.exr'
    (texture) => {
      console.log(`EXR background loaded from ${filePath}`);

      // PMREMGenerator memproses tekstur equirectangular menjadi environment map
      const envMap = pmremGenerator.fromEquirectangular(texture).texture;

      scene.background = envMap;
      scene.environment = envMap; // Sangat penting untuk pencahayaan berbasis gambar (IBL)

      texture.dispose(); // Kita tidak butuh tekstur asli lagi setelah diproses
      pmremGenerator.dispose(); // Bersihkan generator setelah selesai

      console.log("EXR background and environment map set.");
    },
    // onProgress callback (opsional)
    (xhr) => {
      console.log(`EXR background loading: ${(xhr.loaded / xhr.total) * 100}%`);
    },
    // onError callback
    (error) => {
      console.error(`Error loading EXR background from ${filePath}:`, error);
      pmremGenerator.dispose(); // Bersihkan generator jika ada error
    }
  );
}

function loadSonicModel() {
  if (!SONIC_MODEL_PATH) {
    console.warn("Sonic model path is not defined.");
    return;
  }
  const loader = new GLTFLoader();
  loader.load(
    SONIC_MODEL_PATH,
    (gltf) => {
      console.log("DEBUG: GLTF Sonic loaded successfully into gltf object.");
      sonicModel = gltf.scene;
      if (!sonicModel) {
        console.error(
          "CRITICAL DEBUG: sonicModel is undefined after GLTF load!"
        );
        return;
      }
      sonicModel.name = "SonicTheHedgehog_DEBUG";

      const FORCED_DEBUG_SCALE = 1000.0;
      sonicModel.scale.set(
        FORCED_DEBUG_SCALE,
        FORCED_DEBUG_SCALE,
        FORCED_DEBUG_SCALE
      );
      console.log(`DEBUG: Sonic FORCED scale: ${FORCED_DEBUG_SCALE}`);

      let sonicTargetPosition = new THREE.Vector3();
      let positionSetByTargetObject = false;

      if (model && SONIC_SPAWN_TARGET_OBJECT_NAME) {
        const targetObject = model.getObjectByName(
          SONIC_SPAWN_TARGET_OBJECT_NAME
        );
        if (targetObject) {
          console.log(
            `DEBUG: Found target object for Sonic spawn: ${SONIC_SPAWN_TARGET_OBJECT_NAME}`
          );
          targetObject.updateWorldMatrix(true, true);
          const targetBoundingBox = new THREE.Box3().setFromObject(
            targetObject
          );

          if (!targetBoundingBox.isEmpty()) {
            const targetWorldCenter = new THREE.Vector3();
            targetBoundingBox.getCenter(targetWorldCenter);
            sonicTargetPosition.x = targetWorldCenter.x + SONIC_SPAWN_X_OFFSET; // MODIFIED
            sonicTargetPosition.y =
              targetBoundingBox.max.y + SONIC_SPAWN_Y_OFFSET;
            sonicTargetPosition.z = targetWorldCenter.z + SONIC_SPAWN_Z_OFFSET; // MODIFIED
          } else {
            console.warn(
              `DEBUG: Target object ${SONIC_SPAWN_TARGET_OBJECT_NAME} bounding box is empty. Using its origin + offsets.`
            );
            targetObject.getWorldPosition(sonicTargetPosition);
            sonicTargetPosition.x += SONIC_SPAWN_X_OFFSET; // MODIFIED
            sonicTargetPosition.y += SONIC_SPAWN_Y_OFFSET;
            sonicTargetPosition.z += SONIC_SPAWN_Z_OFFSET; // MODIFIED
          }
          positionSetByTargetObject = true;
        } else {
          console.warn(
            `CRITICAL DEBUG: Target object "${SONIC_SPAWN_TARGET_OBJECT_NAME}" for Sonic spawn not found. Using fallback.`
          );
        }
      }

      if (!positionSetByTargetObject) {
        console.log(
          "DEBUG: Using camera-relative fallback for Sonic position."
        );
        if (camera) {
          const cameraWorldPos = new THREE.Vector3();
          camera.getWorldPosition(cameraWorldPos);
          const cameraWorldDir = new THREE.Vector3();
          camera.getWorldDirection(cameraWorldDir);
          sonicTargetPosition = cameraWorldPos
            .clone()
            .add(cameraWorldDir.multiplyScalar(-10));
        } else {
          sonicTargetPosition.set(0, FORCED_DEBUG_SCALE * 0.1, 0);
          console.warn(
            "CRITICAL DEBUG: Camera object not ready for Sonic spawn fallback, using specified default."
          );
        }
      }

      sonicModel.position.copy(sonicTargetPosition);
      console.log("DEBUG: Sonic initial world position:", sonicModel.position);

      sonicBasePosition.copy(sonicModel.position);
      sonicPositionOffset.set(0, 0, 0);
      console.log(
        "DEBUG: Sonic base position for adjustment saved:",
        sonicBasePosition
      );

      sonicModel.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.visible = true;
          if (child.material) {
            const applyChanges = (material) => {
              if (material.map) material.map.colorSpace = THREE.SRGBColorSpace;
              if (material.emissiveMap)
                material.emissiveMap.colorSpace = THREE.SRGBColorSpace;
              if (material.transparent && material.opacity < 0.1)
                material.opacity = 1.0;
              material.needsUpdate = true;
            };
            if (Array.isArray(child.material))
              child.material.forEach(applyChanges);
            else applyChanges(child.material);
          }
        }
      });

      if (scene) {
        scene.add(sonicModel);
        console.log("DEBUG: sonicModel was added to scene.");
      } else {
        console.error(
          "CRITICAL DEBUG: Scene is undefined when trying to add sonicModel!"
        );
        return;
      }

      sonicModel.updateMatrixWorld(true);
      const sonicBox = new THREE.Box3().setFromObject(sonicModel);

      if (!sonicBox.isEmpty()) {
        if (sonicBoundingBoxHelper) {
          scene.remove(sonicBoundingBoxHelper);
          sonicBoundingBoxHelper.dispose();
        }
        sonicBoundingBoxHelper = new THREE.Box3Helper(sonicBox, 0x00ff00);
        if (scene) {
          scene.add(sonicBoundingBoxHelper);
          console.log("DEBUG: sonicBoundingBoxHelper was added to scene.");
        } else {
          console.error(
            "CRITICAL DEBUG: Scene is undefined when trying to add sonicBoundingBoxHelper!"
          );
        }
        const size = new THREE.Vector3();
        sonicBox.getSize(size);
        console.log("DEBUG: Sonic's FORCED bounding box world size:", size);
        const center = new THREE.Vector3();
        sonicBox.getCenter(center);
        console.log("DEBUG: Sonic's FORCED bounding box world center:", center);
      } else {
        console.error(
          "CRITICAL DEBUG: Sonic's bounding box is EMPTY after FORCED loading and scaling!"
        );
      }

      // Setup animations but do not play immediately
      sonicAnimationClips = gltf.animations;
      if (sonicAnimationClips && sonicAnimationClips.length) {
        sonicMixer = new THREE.AnimationMixer(sonicModel);
        console.log(
          "Sonic model has animations, ready to be played on command via toggleSonicAnimation()."
        );
      } else {
        console.log("Sonic model has no animations.");
      }
    },
    (xhr) =>
      console.log(`Sonic Model: ${(xhr.loaded / xhr.total) * 100}% loaded`),
    (error) => console.error("CRITICAL DEBUG: Sonic GLTF Loading Error:", error)
  );
}

// Fungsi helper untuk log posisi Sonic yang disesuaikan
function logSonicAdjustedPosition() {
  if (sonicModel && sonicBasePosition) {
    const adjustedPos = new THREE.Vector3()
      .copy(sonicBasePosition)
      .add(sonicPositionOffset);
    console.log(
      `Sonic Offset: {x: ${sonicPositionOffset.x.toFixed(
        2
      )}, y: ${sonicPositionOffset.y.toFixed(
        2
      )}, z: ${sonicPositionOffset.z.toFixed(
        2
      )}}. New World Pos: {x: ${adjustedPos.x.toFixed(
        2
      )}, y: ${adjustedPos.y.toFixed(2)}, z: ${adjustedPos.z.toFixed(2)}}`
    );
  }
}

// Function to toggle Sonic's animation
function toggleSonicAnimation() {
  if (
    !sonicModel ||
    !sonicMixer ||
    !sonicAnimationClips ||
    sonicAnimationClips.length === 0
  ) {
    console.log("Sonic model or animations not ready to toggle.");
    return;
  }

  if (isSonicAnimationPlaying) {
    if (currentSonicAnimationAction) {
      currentSonicAnimationAction.stop();
      console.log("Sonic animation stopped.");
    }
    isSonicAnimationPlaying = false;
  } else {
    let animToPlay =
      sonicAnimationClips.find((clip) =>
        clip.name.toLowerCase().includes("spin")
      ) ||
      sonicAnimationClips.find((clip) =>
        clip.name.toLowerCase().includes("idle")
      ) ||
      sonicAnimationClips[0];

    if (animToPlay) {
      currentSonicAnimationAction = sonicMixer.clipAction(animToPlay);
      currentSonicAnimationAction.reset().play();
      // To play animation only once:
      // currentSonicAnimationAction.setLoop(THREE.LoopOnce);
      // currentSonicAnimationAction.clampWhenFinished = true;
      console.log(`Playing Sonic animation: ${animToPlay.name}`);
    } else {
      console.log("No suitable animation found for Sonic to play.");
    }
    isSonicAnimationPlaying = true;
  }
}

// Fungsi loadBridge, addCollisionForBridge, removeCollisionForBridge, updateBridgeAnimation TELAH DIHAPUS

function onKeyDown(event) {
  switch (event.code) {
    case "KeyW":
      keys.W = true;
      break;
    case "KeyA":
      keys.A = true;
      break;
    case "KeyS":
      keys.S = true;
      break;
    case "KeyD":
      keys.D = true;
      break;
    case "ShiftLeft":
      keys.SHIFT_LEFT = true;
      break;
    case "Space":
      keys.SPACE = true;
      break;
    case "KeyE":
      keys.E_INTERACT = true;
      if (controls.isLocked) handleInteraction();
      break;
    case "KeyQ":
      if (isGhostMode) keys.Q_GHOST_DOWN = true;
      break;
    case "KeyG":
      if (!keys.G) {
        // Check G state to prevent rapid toggling if key is held
        isGhostMode = !isGhostMode;
        console.log("Ghost Mode:", isGhostMode ? "ON" : "OFF");
        if (isGhostMode) player.velocity.y = 0;
      }
      keys.G = true; // Set G state to true when pressed
      break;

    case "KeyT": // Use 'T' to toggle Sonic's animation
      if (sonicModel) {
        toggleSonicAnimation();
      }
      break;

    case "KeyP":
      if (sonicModel) {
        isSonicAdjustMode = !isSonicAdjustMode;
        console.log("Sonic Adjust Mode:", isSonicAdjustMode ? "ON" : "OFF");
        if (isSonicAdjustMode) {
          console.log(
            "Use J/L (X), U/O (Y), I/K (Z) to adjust Sonic. Current offset:",
            sonicPositionOffset
          );
          const currentSonicPos = new THREE.Vector3()
            .copy(sonicBasePosition)
            .add(sonicPositionOffset);
          console.log("Sonic current world position:", currentSonicPos);
        }
      }
      break;
    case "KeyJ":
      if (isSonicAdjustMode && sonicModel) {
        sonicPositionOffset.x -= SONIC_ADJUST_STEP;
        logSonicAdjustedPosition();
      }
      break;
    case "KeyL":
      if (isSonicAdjustMode && sonicModel) {
        sonicPositionOffset.x += SONIC_ADJUST_STEP;
        logSonicAdjustedPosition();
      }
      break;
    case "KeyU":
      if (isSonicAdjustMode && sonicModel) {
        sonicPositionOffset.y += SONIC_ADJUST_STEP;
        logSonicAdjustedPosition();
      }
      break;
    case "KeyO":
      if (isSonicAdjustMode && sonicModel) {
        sonicPositionOffset.y -= SONIC_ADJUST_STEP;
        logSonicAdjustedPosition();
      }
      break;
    case "KeyI":
      if (isSonicAdjustMode && sonicModel) {
        sonicPositionOffset.z += SONIC_ADJUST_STEP;
        logSonicAdjustedPosition();
      }
      break;
    case "KeyK":
      if (isSonicAdjustMode && sonicModel) {
        // Corrected typo from isSonicModeAjuste
        sonicPositionOffset.z -= SONIC_ADJUST_STEP;
        logSonicAdjustedPosition();
      }
      break;
  }
}

function onKeyUp(event) {
  switch (event.code) {
    case "KeyW":
      keys.W = false;
      break;
    case "KeyA":
      keys.A = false;
      break;
    case "KeyS":
      keys.S = false;
      break;
    case "KeyD":
      keys.D = false;
      break;
    case "ShiftLeft":
      keys.SHIFT_LEFT = false;
      break;
    case "Space":
      keys.SPACE = false;
      break;
    case "KeyE":
      keys.E_INTERACT = false;
      break;
    case "KeyQ":
      keys.Q_GHOST_DOWN = false;
      break;
    case "KeyG":
      keys.G = false;
      break; // Reset G state on key up
    // case "KeyT": keys.T = false; break; // Not needed if T is a one-shot trigger
  }
}

function startPaperAnimation(showTexture) {
  if (!paperAnimationActive) {
    paperAnimationActive = true;
    paperAnimationTime = 0;
    paperTargetOpacity = showTexture ? 1.0 : 0.0;
    paperCurrentOpacity = showTexture ? 0.0 : 1.0;
    if (showTexture && paperMesh && paperPrintMaterial) {
      paperMesh.material = paperPrintMaterial;
      if (paperMesh.material) paperMesh.material.opacity = paperCurrentOpacity;
    }
  }
}
function updatePaperAnimation(deltaTime) {
  if (paperAnimationActive) {
    paperAnimationTime += deltaTime;
    const progress = Math.min(
      paperAnimationTime / PAPER_ANIMATION_DURATION,
      1.0
    );
    const easeProgress =
      progress < 0.5
        ? 2 * progress * progress
        : -1 + (4 - 2 * progress) * progress;
    paperCurrentOpacity =
      paperCurrentOpacity +
      (paperTargetOpacity - paperCurrentOpacity) * easeProgress;
    if (
      paperMesh &&
      paperPrintMaterial &&
      paperMesh.material === paperPrintMaterial
    ) {
      if (paperMesh.material) paperMesh.material.opacity = paperCurrentOpacity;
    }
    if (progress >= 1.0) {
      paperAnimationActive = false;
      if (paperTargetOpacity === 0 && paperMesh && originalPaperMaterial) {
        paperMesh.material = originalPaperMaterial;
      }
    }
  }
}

function handleInteraction() {
  interactionRaycaster.setFromCamera({ x: 0, y: 0 }, camera);
  const interactableSceneObjects = [];
  interactiveObjectNames.forEach((name) => {
    const obj = model.getObjectByName(name);
    if (obj) interactableSceneObjects.push(obj);
  });
  const actualInteractables = interactableSceneObjects.filter(
    (obj) => obj.children.length > 0 || obj.isMesh || obj.isGroup
  );
  if (actualInteractables.length === 0) return;
  const intersects = interactionRaycaster.intersectObjects(
    actualInteractables,
    true
  );

  if (intersects.length > 0 && intersects[0].distance < INTERACTION_DISTANCE) {
    const intersectedRawObject = intersects[0].object;
    let interactiveObjectName = intersectedRawObject.name;
    let current = intersectedRawObject;
    while (current && !interactiveObjectNames.includes(current.name)) {
      current = current.parent;
      if (current && current.isScene) {
        current = null;
        break;
      }
    }
    if (current) interactiveObjectName = current.name;
    else if (interactiveObjectNames.includes(intersectedRawObject.name))
      interactiveObjectName = intersectedRawObject.name;
    else return;

    console.log("Interacting with:", interactiveObjectName);

    if (interactiveObjectName === "Object_13108") {
      if (tvScreenMesh && originalTVMaterial && staticTVMaterial) {
        isTVOn = !isTVOn;
        tvScreenMesh.material = isTVOn ? staticTVMaterial : originalTVMaterial;
      }
      if (object3Mesh && originalObject3Material && glowingObject3Material) {
        isObject3On = !isObject3On;
        object3Mesh.material = isObject3On
          ? glowingObject3Material
          : originalObject3Material;
      }
    } else if (
      (interactiveObjectName === "Object_23" ||
        interactiveObjectName === "Object_23025") &&
      paperMesh &&
      originalPaperMaterial &&
      paperPrintMaterial &&
      !paperAnimationActive
    ) {
      isPaperTextureVisible = !isPaperTextureVisible;
      startPaperAnimation(isPaperTextureVisible);
    } else if (interactiveObjectName === "Object_18" && steamObject) {
      isSteamActive = !isSteamActive;
      if (isSteamActive) {
        steamAnimationTime = 0;
        if (originalSteamPosition)
          steamObject.position.copy(originalSteamPosition);
        if (steamObject.material)
          steamObject.material.opacity = originalSteamOpacity;
        steamObject.visible = true;
      } else steamObject.visible = false;
    }
    // Logika interaksi jembatan dihapus
    // else if (interactiveObjectName === "Object_21055" || interactiveObjectName === "Object_21103") {
    //   console.log("Interacted with a former bridge activator. No action defined.");
    // }
  }
}

function updatePlayerAndCamera(deltaTime) {
  if (controls.isLocked) {
    const camRef = controls.getObject();
    let baseSpeed = 8.0;
    let currentSpeed = (keys.SHIFT_LEFT ? 1.5 : 1) * baseSpeed;
    if (isGhostMode) currentSpeed *= GHOST_MODE_SPEED_MULTIPLIER;
    const actualSpeed = currentSpeed * deltaTime;

    camRef.getWorldDirection(_forward);
    if (!isGhostMode) _forward.y = 0;
    _forward.normalize();
    _right.crossVectors(camRef.up, _forward).normalize();

    _movementDirection.set(0, 0, 0);
    if (keys.W) _movementDirection.add(_forward);
    if (keys.S) _movementDirection.sub(_forward);
    if (keys.A) _movementDirection.add(_right);
    if (keys.D) _movementDirection.sub(_right);
    if (_movementDirection.lengthSq() > 0) _movementDirection.normalize();

    const dX = _movementDirection.x * actualSpeed;
    const dYfromWASD = isGhostMode ? _movementDirection.y * actualSpeed : 0;
    const dZ = _movementDirection.z * actualSpeed;

    if (isGhostMode) {
      player.velocity.y = 0;
      player.position.x += dX;
      player.position.y += dYfromWASD;
      player.position.z += dZ;
      if (keys.SPACE) player.position.y += actualSpeed;
      if (keys.Q_GHOST_DOWN) player.position.y -= actualSpeed;
      player.isGrounded = false;
      camRef.position.copy(player.position);
    } else {
      if (!player.isGrounded) player.velocity.y -= GRAVITY * deltaTime;
      if (keys.SPACE && player.isGrounded && player.canJump) {
        player.velocity.y = JUMP_IMPULSE;
        player.isGrounded = false;
        player.canJump = false;
      }
      if (!keys.SPACE) player.canJump = true;

      const groundRayOrigin = new THREE.Vector3(
        player.position.x,
        player.position.y + PLAYER_FEET_RADIUS * 0.5,
        player.position.z
      );
      raycaster.set(groundRayOrigin, new THREE.Vector3(0, -1, 0));
      raycaster.far = Math.max(
        PLAYER_FEET_RADIUS * 1.1,
        Math.abs(player.velocity.y * deltaTime) + PLAYER_FEET_RADIUS
      );
      const groundHits = raycaster.intersectObjects(collidableMeshes, true);
      player.isGrounded = false;
      if (
        player.velocity.y <= 0 &&
        groundHits.length > 0 &&
        groundHits[0].distance <= PLAYER_FEET_RADIUS * 1.01
      ) {
        player.position.y = groundHits[0].point.y + PLAYER_COLLISION_HEIGHT / 2;
        player.velocity.y = 0;
        player.isGrounded = true;
      }
      player.position.y += player.velocity.y * deltaTime;

      if (player.velocity.y > 0) {
        const headOrigin = player.position
          .clone()
          .add(new THREE.Vector3(0, PLAYER_COLLISION_HEIGHT / 2 - 0.1, 0));
        raycaster.set(headOrigin, new THREE.Vector3(0, 1, 0));
        raycaster.far = player.velocity.y * deltaTime + 0.2;
        const headHits = raycaster.intersectObjects(collidableMeshes, true);
        if (headHits.length > 0) {
          player.position.y = headHits[0].point.y - PLAYER_COLLISION_HEIGHT / 2;
          player.velocity.y = 0;
        }
      }

      const tempPos = player.position.clone();
      tempPos.x += dX;
      tempPos.z += dZ;
      player.boundingBox.setFromCenterAndSize(
        new THREE.Vector3(tempPos.x, player.position.y, tempPos.z),
        new THREE.Vector3(
          playerRadiusBuffer * 2,
          PLAYER_COLLISION_HEIGHT,
          playerRadiusBuffer * 2
        )
      );
      let canMoveHorizontally = true;
      let steppedUp = false;
      if (dX !== 0 || dZ !== 0) {
        for (const mesh of collidableMeshes) {
          const meshBoundingBox = collisionBoundingBoxes.get(mesh.name);
          if (
            meshBoundingBox &&
            !meshBoundingBox.isEmpty() &&
            player.boundingBox.intersectsBox(meshBoundingBox)
          ) {
            let didStep = false;
            const headClearOrigin = player.position.clone();
            headClearOrigin.x +=
              _movementDirection.x * playerRadiusBuffer * 0.5;
            headClearOrigin.z +=
              _movementDirection.z * playerRadiusBuffer * 0.5;
            headClearOrigin.y += MAX_STEP_HEIGHT + 0.1;
            raycaster.set(headClearOrigin, _movementDirection);
            raycaster.far = playerRadiusBuffer;
            if (raycaster.intersectObject(mesh, true).length === 0) {
              const stepSurfaceOrigin = new THREE.Vector3(
                tempPos.x,
                player.position.y + MAX_STEP_HEIGHT + PLAYER_FEET_RADIUS,
                tempPos.z
              );
              raycaster.set(stepSurfaceOrigin, new THREE.Vector3(0, -1, 0));
              raycaster.far = MAX_STEP_HEIGHT + PLAYER_FEET_RADIUS * 1.5;
              const stepHits = raycaster.intersectObject(mesh, true);
              if (stepHits.length > 0) {
                const yDiff =
                  stepHits[0].point.y +
                  PLAYER_COLLISION_HEIGHT / 2 -
                  player.position.y;
                if (yDiff >= -0.01 && yDiff <= MAX_STEP_HEIGHT) {
                  player.position.set(
                    tempPos.x,
                    stepHits[0].point.y + PLAYER_COLLISION_HEIGHT / 2,
                    tempPos.z
                  );
                  player.isGrounded = true;
                  player.velocity.y = 0;
                  steppedUp = true;
                  didStep = true;
                  break;
                }
              }
            }
            if (!didStep) {
              canMoveHorizontally = false;
              break;
            }
          }
        }
      }
      if (!steppedUp && canMoveHorizontally) {
        player.position.x = tempPos.x;
        player.position.z = tempPos.z;
      }
      camRef.position.set(
        player.position.x,
        player.position.y + PLAYER_EYE_HEIGHT - PLAYER_COLLISION_HEIGHT / 2,
        player.position.z
      );
    }
  } else {
    player.velocity.x = 0;
    player.velocity.z = 0;
    if (!isGhostMode && !player.isGrounded) {
      player.velocity.y -= GRAVITY * deltaTime;
      player.position.y += player.velocity.y * deltaTime;
      const groundRayOrigin = new THREE.Vector3(
        player.position.x,
        player.position.y + PLAYER_FEET_RADIUS * 0.5,
        player.position.z
      );
      raycaster.set(groundRayOrigin, new THREE.Vector3(0, -1, 0));
      raycaster.far = Math.max(
        PLAYER_FEET_RADIUS * 1.1,
        Math.abs(player.velocity.y * deltaTime) + PLAYER_FEET_RADIUS
      );
      const groundHits = raycaster.intersectObjects(collidableMeshes, true);
      if (
        player.velocity.y <= 0 &&
        groundHits.length > 0 &&
        groundHits[0].distance <= PLAYER_FEET_RADIUS * 1.01
      ) {
        player.position.y = groundHits[0].point.y + PLAYER_COLLISION_HEIGHT / 2;
        player.velocity.y = 0;
        player.isGrounded = true;
      }
      controls
        .getObject()
        .position.set(
          player.position.x,
          player.position.y + PLAYER_EYE_HEIGHT - PLAYER_COLLISION_HEIGHT / 2,
          player.position.z
        );
    }
  }

  if (
    isTVOn &&
    staticTexture &&
    tvScreenMesh &&
    staticTVMaterial === tvScreenMesh.material
  ) {
    staticTexture.offset.x =
      (((staticTexture.offset.x + (Math.random() * 0.1 - 0.05)) % 1) + 1) % 1;
    staticTexture.offset.y =
      (((staticTexture.offset.y + (Math.random() * 0.1 - 0.05)) % 1) + 1) % 1;
  }
  if (
    isSteamActive &&
    steamObject &&
    originalSteamPosition &&
    steamObject.material
  ) {
    steamAnimationTime += deltaTime;
    let loopProgress =
      (steamAnimationTime % STEAM_LOOP_DURATION) / STEAM_LOOP_DURATION;
    steamObject.position.set(
      originalSteamPosition.x,
      originalSteamPosition.y + loopProgress * STEAM_MAX_HEIGHT_OFFSET,
      originalSteamPosition.z
    );
    if (steamObject.material)
      steamObject.material.opacity = originalSteamOpacity * (1 - loopProgress);
  }
  updatePaperAnimation(deltaTime);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  const deltaTime = Math.min(0.05, clock.getDelta());

  updatePlayerAndCamera(deltaTime);

  if (sonicMixer) sonicMixer.update(deltaTime);

  if (sonicModel && sonicBasePosition) {
    sonicModel.position.copy(sonicBasePosition).add(sonicPositionOffset);
  }

  if (sonicBoundingBoxHelper && sonicModel) {
    // Update bounding box helper if adjust mode is active
    const sonicBox = new THREE.Box3().setFromObject(sonicModel);
    if (!sonicBox.isEmpty()) {
      sonicBoundingBoxHelper.box.copy(sonicBox);
    }
  }

  renderer.render(scene, camera);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
