import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

let scene, camera, renderer, model, controls;
const clock = new THREE.Clock();

let sonicModel, sonicMixer, sonicAnimationClips;
const SONIC_MODEL_PATH = "sonic_spinning/scene.gltf";

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
};

let isGhostMode = false;
const GHOST_MODE_SPEED_MULTIPLIER = 2.0;

const PLAYER_EYE_HEIGHT = 10.5;
const PLAYER_COLLISION_HEIGHT = 1.8;
const GRAVITY = 20.0;
const JUMP_IMPULSE = 8.0;
const MAX_STEP_HEIGHT = 0.6;
const playerRadiusBuffer = 4.0;
const PLAYER_FEET_RADIUS = playerRadiusBuffer * 0.8;
const INTERACTION_DISTANCE = 15.0;

let player = {
  position: new THREE.Vector3(),
  velocity: new THREE.Vector3(),
  isGrounded: false,
  canJump: true,
  boundingBox: new THREE.Box3(),
};

const raycaster = new THREE.Raycaster();
const interactionRaycaster = new THREE.Raycaster();
const collidableMeshes = [];
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
];
const interactiveObjectNames = [
  "Object_13108",
  "Object_23",
  "Object_18",
  "Object_23025",
];
const collisionBoundingBoxes = new Map();

const blocker = document.getElementById("blocker");
const instructions = document.getElementById("instructions");

const _worldDirection = new THREE.Vector3();
const _movementDirection = new THREE.Vector3();
const _upVector = new THREE.Vector3(0, 1, 0);
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();

let tvScreenMesh, steamObject;
let isTVOn = false;
let originalTVMaterial, staticTVMaterial;
let staticTexture;

let isSteamActive = false;
let steamAnimationTime = 0;
const STEAM_LOOP_DURATION = 2.0;
const STEAM_MAX_HEIGHT_OFFSET = 10.0;
let originalSteamPosition;
let originalSteamOpacity;

let paperMesh;
let paperPrintTexture;
let originalPaperMaterial;
let paperPrintMaterial;
let isPaperTextureVisible = false;
let paperAnimationActive = false;
let paperAnimationTime = 0;
const PAPER_ANIMATION_DURATION = 1.0;
let paperTargetOpacity = 0;
let paperCurrentOpacity = 0;

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
  if (instructions) {
    instructions.addEventListener("click", () => controls.lock());
  }
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

  const loader = new GLTFLoader();
  loader.load(
    "EDGEHOG ISLAND LABOLATORY.glb",
    (gltf) => {
      console.log("Main lab model GLTF loaded.");
      model = gltf.scene;
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (collidableObjectNames.includes(child.name)) {
            collidableMeshes.push(child);
            collisionBoundingBoxes.set(
              child.name,
              new THREE.Box3().setFromObject(child)
            );
          }
          if (child.name === "Object_23045") {
            paperMesh = child;
            originalPaperMaterial = paperMesh.material
              ? paperMesh.material.clone()
              : new THREE.MeshStandardMaterial({
                  color: 0xffffff,
                  roughness: 0.8,
                });
          }
        }
      });

      tvScreenMesh = model.getObjectByName("Object_13105");
      if (tvScreenMesh && tvScreenMesh.isMesh && tvScreenMesh.material) {
        originalTVMaterial = tvScreenMesh.material.clone();
      }

      steamObject = model.getObjectByName("Object_17");
      if (steamObject && steamObject.isMesh) {
        originalSteamPosition = steamObject.position.clone();
        if (steamObject.material) {
          steamObject.material.transparent = true;
          originalSteamOpacity = steamObject.material.opacity;
          steamObject.visible = false;
        }
      }

      model.scale.set(0.05, 0.05, 0.05);
      scene.add(model);

      const targetObjectName = "Object_6";
      let targetObject = model.getObjectByName(targetObjectName);
      if (targetObject) {
        const boundingBox = new THREE.Box3().setFromObject(targetObject);
        targetObject.getWorldPosition(player.position);
        player.position.y = boundingBox.max.y;
        console.log("Player initial position (on Object_6):", player.position);
      } else {
        // Mengatur Y agar player.position.y adalah dasar kaki
        player.position.set(0, PLAYER_COLLISION_HEIGHT / 2, 5);
        console.log("Player initial position (fallback):", player.position);
      }
      player.isGrounded = true;

      // Atur kamera berdasarkan posisi player (kaki) + tinggi mata
      controls.getObject().position.set(
        player.position.x,
        player.position.y + PLAYER_EYE_HEIGHT - PLAYER_COLLISION_HEIGHT / 2, // Sesuaikan agar eye height relatif ke tengah collider
        player.position.z
      );

      controls.getObject().updateMatrixWorld();
      camera.updateMatrixWorld();

      player.boundingBox.setFromCenterAndSize(
        new THREE.Vector3(
          player.position.x,
          player.position.y,
          player.position.z
        ), // Bounding box berpusat di player.position
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

function loadSonicModel() {
  console.log("loadSonicModel function was called!");
  const loader = new GLTFLoader();
  loader.load(
    SONIC_MODEL_PATH,
    (gltf) => {
      sonicModel = gltf.scene;
      sonicAnimationClips = gltf.animations;

      console.log("Sonic model loaded successfully in loadSonicModel.");

      const playerCamera = controls.getObject();
      const playerWorldPosition = new THREE.Vector3();
      playerCamera.getWorldPosition(playerWorldPosition);

      const playerWorldDirection = new THREE.Vector3();
      playerCamera.getWorldDirection(playerWorldDirection);

      console.log(
        "Player camera world position for Sonic placement:",
        playerWorldPosition
      );
      console.log(
        "Player camera world direction for Sonic placement:",
        playerWorldDirection
      );

      const distanceFromPlayer = 10;
      const sonicTargetPosition = playerWorldPosition
        .clone()
        .add(playerWorldDirection.multiplyScalar(distanceFromPlayer));

      sonicTargetPosition.y = player.position.y;

      sonicModel.position.copy(sonicTargetPosition);
      console.log("Attempting to position Sonic at:", sonicTargetPosition);

      sonicModel.scale.set(1, 1, 1);
      console.log("Sonic scale set to:", sonicModel.scale);

      sonicModel.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      scene.add(sonicModel);
      console.log("Sonic model added to scene.");

      const sonicBoxHelper = new THREE.BoxHelper(sonicModel, 0xffff00);
      scene.add(sonicBoxHelper);
      console.log("Sonic BoxHelper added to scene.");

      const testCubeGeo = new THREE.BoxGeometry(2, 2, 2);
      const testCubeMat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
      const testCube = new THREE.Mesh(testCubeGeo, testCubeMat);
      if (sonicModel && sonicModel.position) {
        testCube.position.copy(sonicModel.position);
        testCube.position.y += 3;
      } else {
        testCube.position.set(
          player.position.x,
          player.position.y + 3,
          player.position.z - 10
        );
      }
      scene.add(testCube);
      console.log("Test Cube added at:", testCube.position);

      if (sonicAnimationClips && sonicAnimationClips.length) {
        sonicMixer = new THREE.AnimationMixer(sonicModel);
        const action = sonicMixer.clipAction(sonicAnimationClips[0]);
        action.play();
      }
    },
    (xhr) => {
      console.log(`Sonic model: ${(xhr.loaded / xhr.total) * 100}% loaded`);
    },
    (error) => {
      console.error("Error loading Sonic GLTF model:", error);
    }
  );
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
      if (isGhostMode) {
        keys.Q_GHOST_DOWN = true;
      }
      break;
    case "KeyG":
      if (!keys.G) {
        isGhostMode = !isGhostMode;
        console.log("Ghost Mode:", isGhostMode ? "ON" : "OFF");
        if (isGhostMode) {
          player.velocity.y = 0;
        }
      }
      keys.G = true;
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
    (obj) => obj.children.length > 0 || obj.isMesh
  );
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

    if (current) {
      interactiveObjectName = current.name;
    } else {
      if (interactiveObjectNames.includes(intersectedRawObject.name)) {
        interactiveObjectName = intersectedRawObject.name;
      } else {
        return;
      }
    }

    if (
      interactiveObjectName === "Object_13108" &&
      tvScreenMesh &&
      originalTVMaterial &&
      staticTVMaterial
    ) {
      isTVOn = !isTVOn;
      tvScreenMesh.material = isTVOn ? staticTVMaterial : originalTVMaterial;
    } else if (
      interactiveObjectName === "Object_23" ||
      interactiveObjectName === "Object_23025"
    ) {
      if (
        paperMesh &&
        originalPaperMaterial &&
        paperPrintMaterial &&
        !paperAnimationActive
      ) {
        isPaperTextureVisible = !isPaperTextureVisible;
        startPaperAnimation(isPaperTextureVisible);
      }
    } else if (interactiveObjectName === "Object_18" && steamObject) {
      isSteamActive = !isSteamActive;
      if (isSteamActive) {
        steamAnimationTime = 0;
        if (originalSteamPosition)
          steamObject.position.copy(originalSteamPosition);
        if (steamObject.material)
          steamObject.material.opacity = originalSteamOpacity;
        steamObject.visible = true;
      } else {
        steamObject.visible = false;
      }
    }
  }
}

function updatePlayerAndCamera(deltaTime) {
  if (controls.isLocked) {
    const camRef = controls.getObject();
    let baseSpeed = 8.0;
    let currentSpeed = (keys.SHIFT_LEFT ? 1.5 : 1) * baseSpeed;

    if (isGhostMode) {
      currentSpeed *= GHOST_MODE_SPEED_MULTIPLIER;
    }

    const actualSpeed = currentSpeed * deltaTime;

    camRef.getWorldDirection(_forward);
    if (!isGhostMode) {
      _forward.y = 0;
    }
    _forward.normalize();
    _right.crossVectors(camRef.up, _forward).normalize();

    _movementDirection.set(0, 0, 0);
    if (keys.W) _movementDirection.add(_forward);
    if (keys.S) _movementDirection.sub(_forward);
    if (keys.A) _movementDirection.add(_right);
    if (keys.D) _movementDirection.sub(_right);

    if (_movementDirection.lengthSq() > 0) {
      _movementDirection.normalize();
    }

    const dX = _movementDirection.x * actualSpeed;
    const dYfromWASD = _movementDirection.y * actualSpeed;
    const dZ = _movementDirection.z * actualSpeed;

    // Simpan posisi kamera sebelum diubah oleh logika player
    const prevCamY = camRef.position.y;

    if (isGhostMode) {
      player.velocity.y = 0;
      player.position.x += dX;
      player.position.y += dYfromWASD;
      player.position.z += dZ;

      if (keys.SPACE) player.position.y += actualSpeed;
      if (keys.Q_GHOST_DOWN) player.position.y -= actualSpeed;

      player.isGrounded = false;
      // Langsung update posisi kamera di mode ghost
      camRef.position.copy(player.position);
    } else {
      // Mode Normal
      if (!player.isGrounded) {
        player.velocity.y -= GRAVITY * deltaTime;
      }

      if (keys.SPACE && player.isGrounded && player.canJump) {
        player.velocity.y = JUMP_IMPULSE;
        player.isGrounded = false;
        player.canJump = false;
      }
      if (!keys.SPACE) {
        player.canJump = true;
      }

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
        player.position.y = groundHits[0].point.y + PLAYER_COLLISION_HEIGHT / 2; // Set ke dasar collider
        player.velocity.y = 0;
        player.isGrounded = true;
      }

      player.position.y += player.velocity.y * deltaTime;

      if (player.velocity.y > 0) {
        const headOrigin = player.position
          .clone()
          .add(new THREE.Vector3(0, PLAYER_COLLISION_HEIGHT / 2 - 0.1, 0)); // Dari atas collider
        raycaster.set(headOrigin, new THREE.Vector3(0, 1, 0));
        raycaster.far = player.velocity.y * deltaTime + 0.2;
        const headHits = raycaster.intersectObjects(collidableMeshes, true);
        if (headHits.length > 0) {
          player.position.y = headHits[0].point.y - PLAYER_COLLISION_HEIGHT / 2;
          player.velocity.y = 0;
        }
      }

      const tempPos = player.position.clone(); // Gunakan player.position yang sudah diupdate Y-nya
      tempPos.x += dX;
      tempPos.z += dZ;

      // Bounding box sekarang berpusat di player.position
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
            // Cek ruang kepala untuk step, relatif terhadap player.position (pusat collider)
            const headClearOrigin = player.position.clone();
            headClearOrigin.x +=
              _movementDirection.x * playerRadiusBuffer * 0.5;
            headClearOrigin.z +=
              _movementDirection.z * playerRadiusBuffer * 0.5;
            headClearOrigin.y += MAX_STEP_HEIGHT + 0.1; // Dari pusat collider + step

            raycaster.set(headClearOrigin, _movementDirection);
            raycaster.far = playerRadiusBuffer;

            if (raycaster.intersectObject(mesh, true).length === 0) {
              // Raycast dari posisi potensial step ke bawah
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
      // Update posisi kamera setelah semua logika player mode normal selesai
      camRef.position.set(
        player.position.x,
        player.position.y + PLAYER_EYE_HEIGHT - PLAYER_COLLISION_HEIGHT / 2,
        player.position.z
      );
    }
  } else {
    // Controls not locked
    player.velocity.x = 0;
    player.velocity.z = 0;
    if (!isGhostMode) {
      // Hanya terapkan gravitasi jika tidak ghost mode
      if (!player.isGrounded) {
        player.velocity.y -= GRAVITY * deltaTime;
        player.position.y += player.velocity.y * deltaTime;
        // Cek tanah saat jatuh dengan controls unlocked
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
          player.position.y =
            groundHits[0].point.y + PLAYER_COLLISION_HEIGHT / 2;
          player.velocity.y = 0;
          player.isGrounded = true;
        }
        // Update posisi kamera juga
        controls
          .getObject()
          .position.set(
            player.position.x,
            player.position.y + PLAYER_EYE_HEIGHT - PLAYER_COLLISION_HEIGHT / 2,
            player.position.z
          );
      }
    }
  }

  if (
    isTVOn &&
    staticTexture &&
    tvScreenMesh &&
    staticTVMaterial === tvScreenMesh.material
  ) {
    staticTexture.offset.x += Math.random() * 0.1 - 0.05;
    staticTexture.offset.y += Math.random() * 0.1 - 0.05;
    staticTexture.offset.x = ((staticTexture.offset.x % 1) + 1) % 1;
    staticTexture.offset.y = ((staticTexture.offset.y % 1) + 1) % 1;
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

  if (sonicMixer) {
    sonicMixer.update(deltaTime);
  }

  renderer.render(scene, camera);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
