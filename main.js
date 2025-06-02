import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { EXRLoader } from "three/addons/loaders/EXRLoader.js";

let scene, camera, renderer, model, controls;
const clock = new THREE.Clock();

let sonicModel, sonicMixer, sonicAnimationClips;
const SONIC_MODEL_PATH = "sonic_spinning/scene.gltf";
const SONIC_SCALE_IN_LAB = 1000.0;

// --- Sonic Settings ---
const SONIC_SPAWN_TARGET_OBJECT_NAME = "Object_25";
const SONIC_SPAWN_X_OFFSET = 2;
const SONIC_SPAWN_Y_OFFSET = -26;
const SONIC_SPAWN_Z_OFFSET = 3;
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
  T: false,
};

let isGhostMode = false;
const GHOST_MODE_SPEED_MULTIPLIER = 3.0;

const PLAYER_EYE_HEIGHT = 10.5;
const PLAYER_COLLISION_HEIGHT = 1.8;
const GRAVITY = 20.0;
const JUMP_IMPULSE = 8.0;
const MAX_STEP_HEIGHT = 8.0;
const playerRadiusBuffer = 5;
const PLAYER_FEET_RADIUS = playerRadiusBuffer * 0.8;
const INTERACTION_DISTANCE = 30.0;

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
// Daftar nama objek yang diperbarui untuk collidables
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
  "model_0003",
  "model_0005",
  "model_0006",
  "model_0009",
  "model_0010",
  "model_0011",
  "model_0012",
  "model_0013",
  "model_0014",
  "model_0015",
  "model_0016",
  "model_0017",
  "model_0018",
  "model_0019",
  "model_0020",
  "model_0022",
  "model_0024",
  "model_0025",
  "model_0026",
  "model_0027",
  "model_0029",
  "model_0030",
  "model_0034",
  "model_0040",
  "model_0042",
  "model_0047",
  "model_0050",
  "model_0053",
  "model_0061",
  "model_0062",
  "model_0066",
  "model_0076",
  "model_0080",
  "model_0085",
  "model_0100",
  "model_0119",
  "model_0139",
  "model_0167",
  "model_0197",
];
const interactiveObjectNames = [
  "Object_13108",
  "Object_23",
  "Object_18",
  "Object_23025",
  "Object_16",
  "Object_14",
];
const collisionBoundingBoxes = new Map();

// --- UI Elements ---
let blocker, instructions, controlsHelpElement;

// --- Helper Vectors ---
const _worldDirection = new THREE.Vector3();
const _movementDirection = new THREE.Vector3();
const _upVector = new THREE.Vector3(0, 1, 0);
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _tempVec = new THREE.Vector3();

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

// --- Dynamic Falling Objects --- (Nama diubah dari STATIC_FALL_OBJECT_NAMES untuk konsistensi dengan logika)
// Daftar nama objek yang diperbarui untuk dynamic fall
const DYNAMIC_FALL_OBJECT_NAMES = [
  "model_0003",
  "model_0005",
  "model_0006",
  "model_0009",
  "model_0010",
  "model_0011",
  "model_0012",
  "model_0013",
  "model_0014",
  "model_0015",
  "model_0016",
  "model_0017",
  "model_0018",
  "model_0019",
  "model_0020",
  "model_0022",
  "model_0024",
  "model_0025",
  "model_0026",
  "model_0027",
  "model_0029",
  "model_0030",
  "model_0034",
  "model_0040",
  "model_0042",
  "model_0047",
  "model_0050",
  "model_0053",
  "model_0061",
  "model_0062",
  "model_0066",
  "model_0076",
  "model_0080",
  "model_0085",
  "model_0100",
  "model_0119",
  "model_0139",
  "model_0167",
  "model_0197",
];
let dynamicFallObjectsData = [];
let isDynamicFallActive = false;
let object14Triggered = false;

const OBJECT_LOCAL_GRAVITY_FALL = 300.0;
const INITIAL_FALL_HORIZONTAL_DRIFT_MAX = 50.0; // Tambahkan drift horizontal untuk variasi arah
const INITIAL_FALL_ANGULAR_VELOCITY_MAX_RAD = 0.0;
const MIN_Y_THRESHOLD_LOCAL = -8000.0;
const FALL_DELAY_MAX = 2.0; // Delay maksimum antara objek jatuh (dalam detik)

function init() {
  console.log("Init function started.");

  blocker = document.getElementById("blocker");
  instructions = document.getElementById("instructions");
  controlsHelpElement = document.getElementById("controls-help");

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
  if (instructions) {
    instructions.addEventListener("click", () => controls.lock());
  } else {
    console.warn("Element 'instructions' tidak ditemukan di DOM.");
  }

  controls.addEventListener("lock", () => {
    if (instructions) instructions.style.display = "none";
    if (blocker) blocker.style.display = "none";
    if (controlsHelpElement) controlsHelpElement.style.display = "block";
  });
  controls.addEventListener("unlock", () => {
    if (blocker) blocker.style.display = "flex";
    if (instructions) instructions.style.display = "";
    if (controlsHelpElement) controlsHelpElement.style.display = "none";
  });
  if (controlsHelpElement) controlsHelpElement.style.display = "none";

  // loadEXRBackground("background.exr");
  setupLighting();

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
    "EDGEHOG ISLAND LABOLATORY.glb",
    (gltf) => {
      console.log("Main lab model GLTF loaded.");
      model = gltf.scene;
      const labModelScale = 0.05;
      model.scale.set(labModelScale, labModelScale, labModelScale);

      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (collidableObjectNames.includes(child.name)) {
            // Objek yang termasuk DYNAMIC_FALL_OBJECT_NAMES akan dihapus dari collidables saat object14Triggered
            if (
              !DYNAMIC_FALL_OBJECT_NAMES.includes(child.name) ||
              !object14Triggered
            ) {
              collidableMeshes.push(child);
              collisionBoundingBoxes.set(
                child.name,
                new THREE.Box3().setFromObject(child)
              );
            }
          }

          if (child.name === "Object_23045") {
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

      dynamicFallObjectsData = [];
      DYNAMIC_FALL_OBJECT_NAMES.forEach((name, index) => {
        const obj = model.getObjectByName(name);
        if (obj) {
          dynamicFallObjectsData.push({
            mesh: obj,
            initialPosition: obj.position.clone(),
            initialRotation: obj.rotation.clone(),
            velocity: new THREE.Vector3(),
            angularVelocity: new THREE.Vector3(),
            isFalling: false,
            hasLanded: false,
            fallDelay: Math.random() * FALL_DELAY_MAX, // Random delay untuk setiap objek
            delayTimer: 0,
            horizontalDirection: new THREE.Vector3(
              (Math.random() - 0.5) * 2, // Random X direction (-1 to 1)
              0,
              (Math.random() - 0.5) * 2 // Random Z direction (-1 to 1)
            ).normalize(),
          });
        } else {
          console.warn(
            `Dynamic fall object candidate "${name}" not found in the model.`
          );
        }
      });

      object3Mesh = model.getObjectByName(OBJECT3_NAME);
      if (object3Mesh && object3Mesh.isMesh) {
        originalObject3Material = object3Mesh.material
          ? object3Mesh.material.clone()
          : new THREE.MeshStandardMaterial({ color: 0xcccccc });
        if (object3Mesh.material)
          object3Mesh.material = originalObject3Material.clone();
        else object3Mesh.material = originalObject3Material;
        glowingObject3Material = new THREE.MeshStandardMaterial({
          emissive: 0xffff00,
          emissiveIntensity: 1.5,
        });
      } else {
        console.warn(`${OBJECT3_NAME} not found or is not a mesh.`);
      }

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

      const targetObjectName = "Object_6";
      let targetObject = model.getObjectByName(targetObjectName);
      if (targetObject) {
        const boundingBox = new THREE.Box3().setFromObject(targetObject);
        targetObject.getWorldPosition(player.position);
        player.position.y = boundingBox.max.y;
      } else {
        player.position.set(0, PLAYER_COLLISION_HEIGHT / 2 + 50, 5);
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
  scene.add(new THREE.AmbientLight(0xffffff, 0.02));
  const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
  dirLight.position.set(50, 80, 40);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  const shadowCamSize = 150;
  dirLight.shadow.camera.left = -shadowCamSize;
  dirLight.shadow.camera.right = shadowCamSize;
  dirLight.shadow.camera.top = shadowCamSize;
  dirLight.shadow.camera.bottom = -shadowCamSize;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 500;
  dirLight.shadow.bias = -0.0005;
  scene.add(dirLight);
  scene.add(dirLight.target);
}

function loadEXRBackground(filePath) {
  if (!scene || !renderer) {
    console.error("Scene or Renderer not initialized for EXR.");
    return;
  }
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  new EXRLoader().load(
    filePath,
    (texture) => {
      const envMap = pmremGenerator.fromEquirectangular(texture).texture;
      scene.background = envMap;
      scene.environment = envMap;
      texture.dispose();
      pmremGenerator.dispose();
      console.log("EXR background and environment map set.");
    },
    (xhr) => console.log(`EXR loading: ${(xhr.loaded / xhr.total) * 100}%`),
    (error) => {
      console.error(`Error loading EXR: ${filePath}:`, error);
      pmremGenerator.dispose();
    }
  );
}

function loadSonicModel() {
  if (!SONIC_MODEL_PATH) {
    console.warn("Sonic model path undefined.");
    return;
  }
  const loader = new GLTFLoader();
  loader.load(
    SONIC_MODEL_PATH,
    (gltf) => {
      sonicModel = gltf.scene;
      if (!sonicModel) {
        console.error("Sonic model undefined after load!");
        return;
      }
      sonicModel.name = "SonicTheHedgehog_DEBUG";
      sonicModel.scale.set(
        SONIC_SCALE_IN_LAB,
        SONIC_SCALE_IN_LAB,
        SONIC_SCALE_IN_LAB
      );

      let sonicTargetPosition = new THREE.Vector3();
      let positionSetByTargetObject = false;
      if (model && SONIC_SPAWN_TARGET_OBJECT_NAME) {
        const targetObject = model.getObjectByName(
          SONIC_SPAWN_TARGET_OBJECT_NAME
        );
        if (targetObject) {
          targetObject.updateWorldMatrix(true, true);
          const targetBoundingBox = new THREE.Box3().setFromObject(
            targetObject
          );
          if (!targetBoundingBox.isEmpty()) {
            targetBoundingBox.getCenter(_tempVec);
            sonicTargetPosition.set(
              _tempVec.x + SONIC_SPAWN_X_OFFSET,
              targetBoundingBox.max.y + SONIC_SPAWN_Y_OFFSET,
              _tempVec.z + SONIC_SPAWN_Z_OFFSET
            );
          } else {
            targetObject.getWorldPosition(sonicTargetPosition);
            sonicTargetPosition.add(
              new THREE.Vector3(
                SONIC_SPAWN_X_OFFSET,
                SONIC_SPAWN_Y_OFFSET,
                SONIC_SPAWN_Z_OFFSET
              )
            );
          }
          positionSetByTargetObject = true;
        } else {
          console.warn(
            `Target "${SONIC_SPAWN_TARGET_OBJECT_NAME}" for Sonic not found.`
          );
        }
      }
      if (!positionSetByTargetObject) {
        if (camera)
          camera
            .getWorldPosition(sonicTargetPosition)
            .add(camera.getWorldDirection(_tempVec).multiplyScalar(-10));
        else sonicTargetPosition.set(0, SONIC_SCALE_IN_LAB * 0.1, 0);
      }
      sonicModel.position.copy(sonicTargetPosition);
      sonicBasePosition.copy(sonicModel.position);
      sonicPositionOffset.set(0, 0, 0);

      sonicModel.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.visible = true;
          if (child.material) {
            const applyChanges = (mat) => {
              if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
              if (mat.emissiveMap)
                mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
              if (mat.transparent && mat.opacity < 0.1) mat.opacity = 1.0;
              mat.needsUpdate = true;
            };
            if (Array.isArray(child.material))
              child.material.forEach(applyChanges);
            else applyChanges(child.material);
          }
        }
      });
      if (scene) scene.add(sonicModel);
      else {
        console.error("Scene undefined for Sonic model!");
        return;
      }

      sonicAnimationClips = gltf.animations;
      if (sonicAnimationClips && sonicAnimationClips.length) {
        sonicMixer = new THREE.AnimationMixer(sonicModel);
        console.log("Sonic animations ready.");
      } else {
        console.log("Sonic model has no animations.");
      }
    },
    (xhr) =>
      console.log(`Sonic Model: ${(xhr.loaded / xhr.total) * 100}% loaded`),
    (error) => console.error("Sonic GLTF Loading Error:", error)
  );
}

function logSonicAdjustedPosition() {
  if (sonicModel && sonicBasePosition) {
    const adjPos = sonicBasePosition.clone().add(sonicPositionOffset);
    console.log(
      `Sonic Offset: {x:${sonicPositionOffset.x.toFixed(
        2
      )},y:${sonicPositionOffset.y.toFixed(
        2
      )},z:${sonicPositionOffset.z.toFixed(
        2
      )}}. New World Pos: {x:${adjPos.x.toFixed(2)},y:${adjPos.y.toFixed(
        2
      )},z:${adjPos.z.toFixed(2)}}`
    );
  }
}

function toggleSonicAnimation() {
  if (
    !sonicModel ||
    !sonicMixer ||
    !sonicAnimationClips ||
    !sonicAnimationClips.length
  ) {
    console.log("Sonic not ready to animate.");
    return;
  }
  if (isSonicAnimationPlaying) {
    if (currentSonicAnimationAction) currentSonicAnimationAction.stop();
    isSonicAnimationPlaying = false;
    console.log("Sonic animation stopped.");
  } else {
    let anim =
      sonicAnimationClips.find((c) => c.name.toLowerCase().includes("spin")) ||
      sonicAnimationClips.find((c) => c.name.toLowerCase().includes("idle")) ||
      sonicAnimationClips[0];
    if (anim) {
      currentSonicAnimationAction = sonicMixer.clipAction(anim).reset().play();
      console.log(`Playing Sonic animation: ${anim.name}`);
    } else console.log("No suitable Sonic animation found.");
    isSonicAnimationPlaying = true;
  }
}

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
        isGhostMode = !isGhostMode;
        console.log("Ghost Mode:", isGhostMode ? "ON" : "OFF");
        if (isGhostMode) player.velocity.y = 0;
      }
      keys.G = true;
      break;
    case "KeyT":
      if (sonicModel) toggleSonicAnimation();
      break;
    case "KeyP":
      if (sonicModel) {
        isSonicAdjustMode = !isSonicAdjustMode;
        console.log("Sonic Adjust Mode:", isSonicAdjustMode ? "ON" : "OFF");
        if (isSonicAdjustMode) logSonicAdjustedPosition();
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
      break;
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
    } else if (
      !showTexture &&
      paperMesh &&
      paperPrintMaterial &&
      paperMesh.material === paperPrintMaterial
    ) {
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
    paperCurrentOpacity =
      paperTargetOpacity === 1.0 ? progress : 1.0 - progress;
    if (
      paperMesh &&
      paperPrintMaterial &&
      paperMesh.material === paperPrintMaterial
    ) {
      if (paperMesh.material) paperMesh.material.opacity = paperCurrentOpacity;
    }
    if (progress >= 1.0) {
      paperAnimationActive = false;
      if (paperTargetOpacity === 0 && paperMesh && originalPaperMaterial)
        paperMesh.material = originalPaperMaterial;
      else if (
        paperTargetOpacity === 1.0 &&
        paperMesh &&
        paperPrintMaterial &&
        paperMesh.material
      )
        paperMesh.material.opacity = 1.0;
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
    (obj) =>
      obj &&
      obj.visible &&
      (obj.isMesh || obj.isGroup || obj.children.length > 0)
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
    else if (!interactiveObjectNames.includes(intersectedRawObject.name))
      return;

    console.log("Interacting with:", interactiveObjectName);

    if (interactiveObjectName === "Object_13108") {
      if (tvScreenMesh && originalTVMaterial && staticTVMaterial) {
        isTVOn = !isTVOn;
        tvScreenMesh.material = isTVOn ? staticTVMaterial : originalTVMaterial;
        console.log("TV Toggled:", isTVOn ? "ON" : "OFF");
      }
      if (object3Mesh && originalObject3Material && glowingObject3Material) {
        isObject3On = !isObject3On;
        object3Mesh.material = isObject3On
          ? glowingObject3Material
          : originalObject3Material;
        console.log(
          `${OBJECT3_NAME} Light Toggled:`,
          isObject3On ? "ON (Yellow)" : "OFF"
        );
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
      console.log(
        "Paper texture toggled:",
        isPaperTextureVisible ? "Visible" : "Hidden"
      );
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
      console.log("Steam toggled:", isSteamActive ? "Active" : "Inactive");
    } else if (interactiveObjectName === "Object_16") {
      console.log("Attempting to toggle Sonic animation via Object_16.");
      toggleSonicAnimation();
    } else if (interactiveObjectName === "Object_14" && !object14Triggered) {
      console.log("Triggering dynamic fall for objects via Object_14.");
      isDynamicFallActive = true;
      object14Triggered = true;

      dynamicFallObjectsData.forEach((objData) => {
        // Reset timer dan set status waiting to fall
        objData.delayTimer = 0;
        objData.isFalling = false;
        objData.hasLanded = false;
        objData.velocity.set(0, 0, 0);
        objData.angularVelocity.set(0, 0, 0);

        // Hapus objek dari collidables agar tidak mengganggu player
        const meshIndex = collidableMeshes.indexOf(objData.mesh);
        if (meshIndex > -1) {
          collidableMeshes.splice(meshIndex, 1);
          collisionBoundingBoxes.delete(objData.mesh.name);
        }
      });
    }
  }
}

function updateDynamicFall(deltaTime) {
  if (!isDynamicFallActive) return;
  let allObjectsLanded = true;

  dynamicFallObjectsData.forEach((objData) => {
    // Jika objek belum mulai jatuh, cek delay timer
    if (!objData.isFalling && !objData.hasLanded) {
      objData.delayTimer += deltaTime;
      if (objData.delayTimer >= objData.fallDelay) {
        // Mulai jatuh dengan kecepatan horizontal random
        objData.isFalling = true;
        objData.velocity.set(
          objData.horizontalDirection.x * INITIAL_FALL_HORIZONTAL_DRIFT_MAX,
          0,
          objData.horizontalDirection.z * INITIAL_FALL_HORIZONTAL_DRIFT_MAX
        );
        console.log(
          `Object ${
            objData.mesh.name
          } started falling after ${objData.fallDelay.toFixed(2)}s delay`
        );
      } else {
        allObjectsLanded = false; // Masih ada objek yang menunggu
      }
    }

    // Update objek yang sedang jatuh
    if (objData.isFalling && !objData.hasLanded) {
      allObjectsLanded = false;

      // Apply gravity
      objData.velocity.y -= OBJECT_LOCAL_GRAVITY_FALL * deltaTime;

      // Update position
      objData.mesh.position.addScaledVector(objData.velocity, deltaTime);

      // Optional: Add slight air resistance to horizontal movement
      objData.velocity.x *= 0.98;
      objData.velocity.z *= 0.98;

      // Check if hit ground threshold
      if (objData.mesh.position.y <= MIN_Y_THRESHOLD_LOCAL) {
        objData.mesh.position.y = MIN_Y_THRESHOLD_LOCAL;
        objData.velocity.set(0, 0, 0);
        objData.angularVelocity.set(0, 0, 0);
        objData.isFalling = false;
        objData.hasLanded = true;
        console.log(`Object ${objData.mesh.name} has landed`);
      }
    }
  });

  if (allObjectsLanded && object14Triggered) {
    isDynamicFallActive = false;
    console.log(
      "All dynamic fall objects have landed or passed the minimum Y threshold."
    );
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

      const groundRayOrigin = player.position.clone();
      groundRayOrigin.y += PLAYER_FEET_RADIUS * 0.5;
      raycaster.set(groundRayOrigin, _upVector.clone().negate());
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
        const headOrigin = player.position.clone();
        headOrigin.y += PLAYER_COLLISION_HEIGHT / 2 - 0.1;
        raycaster.set(headOrigin, _upVector);
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
              const stepSurfOrigin = new THREE.Vector3(
                tempPos.x,
                player.position.y + MAX_STEP_HEIGHT + PLAYER_FEET_RADIUS,
                tempPos.z
              );
              raycaster.set(stepSurfOrigin, _upVector.clone().negate());
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
      const groundRayOriginPaused = player.position.clone();
      groundRayOriginPaused.y += PLAYER_FEET_RADIUS * 0.5;
      raycaster.set(groundRayOriginPaused, _upVector.clone().negate());
      raycaster.far = Math.max(
        PLAYER_FEET_RADIUS * 1.1,
        Math.abs(player.velocity.y * deltaTime) + PLAYER_FEET_RADIUS
      );
      const groundHitsPaused = raycaster.intersectObjects(
        collidableMeshes,
        true
      );
      if (
        player.velocity.y <= 0 &&
        groundHitsPaused.length > 0 &&
        groundHitsPaused[0].distance <= PLAYER_FEET_RADIUS * 1.01
      ) {
        player.position.y =
          groundHitsPaused[0].point.y + PLAYER_COLLISION_HEIGHT / 2;
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
  updateDynamicFall(deltaTime);

  if (sonicMixer) sonicMixer.update(deltaTime);
  if (sonicModel && sonicBasePosition) {
    sonicModel.position.copy(sonicBasePosition).add(sonicPositionOffset);
  }

  renderer.render(scene, camera);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
