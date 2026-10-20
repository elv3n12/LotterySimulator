const {
    DRAW_SIZE,
    NUMBER_COUNT,
    calculateRadii,
    countMatches,
    generateDrawing,
    getCombinations,
    parseTicket,
    updateFrequencyCounts,
} = window.LotteryCore;

const THREE = window.THREE;
if (!THREE?.OrbitControls) throw new Error("Three.js and OrbitControls must load before the application.");

const CONFIG = Object.freeze({
    columnsPerLayer: 52,
    instancesPerLayer: 52 * DRAW_SIZE,
    maxVisibleLayers: 40,
    spacing: 2.35,
    layerDepth: 3.6,
    baseRadius: 0.62,
    drawIntervalMs: 100,
    fadeDurationMs: 30_000,
    initialOpacity: 0.86,
    restingOpacity: 0.09,
    initialScale: 1,
    restingScale: 0.46,
    highlightedOpacity: 1,
    highlightedScale: 1,
    ticketPrice: 2.5,
});
const DEFAULT_COLOR = 0x2f73ff;
const MATCH_COLORS = Object.freeze({ 2: 0xff3300, 3: 0x00ff00, 4: 0xff00ff, 5: 0xff0000 });
const PAYOUT_RANGES = Object.freeze({ 2: [3, 5], 3: [17, 31], 4: [650, 3_700], 5: [2_000_000, 167_000_000] });

const inputs = [...document.querySelectorAll(".number-input")];
const statsElement = document.querySelector("#stats");
const tooltip = document.querySelector("#tooltip");
const validationMessage = document.querySelector("#validation-message");
const pauseButton = document.querySelector("#pause-button");
const drawings = [];
const frequencyCounts = new Uint32Array(NUMBER_COUNT + 1);
const layers = [];
const activeFades = new Map();
const payoutByDrawing = new Map();
const combinationCounts = new Map([2, 3, 4, 5].map(size => [size, new Map()]));
const bestCombinations = new Map();
const analyticsCache = {
    ticketKey: null,
    counts: { pairs: 0, triplets: 0, quadruplets: 0, quintuplets: 0 },
    gains: 0,
    lastFullMatchIndex: null,
};
let timerId = null;
let isRunning = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 1_000);
camera.position.set(78, 64, -98);
camera.lookAt(0, 0, CONFIG.layerDepth);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
document.body.prepend(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.screenSpacePanning = true;
controls.target.set(0, 0, CONFIG.layerDepth);

scene.add(new THREE.HemisphereLight(0x9fc7ff, 0x07101f, 1.15));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
keyLight.position.set(-28, 42, -36);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x4f88ff, 0.65);
rimLight.position.set(38, -20, 30);
scene.add(rimLight);

const sphereGeometry = new THREE.SphereGeometry(1, 16, 12);
const sphereMaterial = createSphereMaterial();
const color = new THREE.Color();
const transform = new THREE.Matrix4();
const position = new THREE.Vector3();
const scale = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function createSphereMaterial() {
    const material = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        specular: 0x8fbaff,
        shininess: 72,
        transparent: true,
        opacity: 1,
        depthWrite: false,
    });
    material.onBeforeCompile = shader => {
        shader.vertexShader = shader.vertexShader
            .replace(
                "void main() {",
                "attribute float instanceOpacity;\nvarying float vInstanceOpacity;\nvoid main() {\n    vInstanceOpacity = instanceOpacity;",
            );
        shader.fragmentShader = shader.fragmentShader
            .replace("void main() {", "varying float vInstanceOpacity;\nvoid main() {")
            .replace(
                "vec4 diffuseColor = vec4( diffuse, opacity );",
                "vec4 diffuseColor = vec4( diffuse, opacity * vInstanceOpacity );",
            );
    };
    material.customProgramCacheKey = () => "lottery-transparent-instances-v2";
    return material;
}

function createLayer(layerIndex) {
    const geometry = sphereGeometry.clone();
    const instanceOpacity = new THREE.InstancedBufferAttribute(
        new Float32Array(CONFIG.instancesPerLayer),
        1,
    );
    instanceOpacity.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("instanceOpacity", instanceOpacity);
    const mesh = new THREE.InstancedMesh(geometry, sphereMaterial, CONFIG.instancesPerLayer);
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(
        new Float32Array(CONFIG.instancesPerLayer * 3).fill(1),
        3,
    );
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.userData.layerIndex = layerIndex;
    mesh.frustumCulled = false;
    scene.add(mesh);
    const layer = { mesh, instanceOpacity, entries: new Array(CONFIG.instancesPerLayer), used: 0 };
    layers[layerIndex] = layer;
    const expiredLayerIndex = layerIndex - CONFIG.maxVisibleLayers;
    const expiredLayer = layers[expiredLayerIndex];
    if (expiredLayer) {
        scene.remove(expiredLayer.mesh);
        expiredLayer.mesh.geometry.dispose();
        layers[expiredLayerIndex] = null;
        for (const [key, fade] of activeFades) {
            if (fade.layerIndex === expiredLayerIndex) activeFades.delete(key);
        }
    }
    followVisibleLayers(layerIndex);
    return layer;
}

function followVisibleLayers(newestLayerIndex) {
    const oldestLayerIndex = Math.max(0, newestLayerIndex - CONFIG.maxVisibleLayers + 1);
    const centreLayer = (oldestLayerIndex + newestLayerIndex) / 2 + 1;
    const nextTargetZ = centreLayer * CONFIG.layerDepth;
    const deltaZ = nextTargetZ - controls.target.z;
    controls.target.z = nextTargetZ;
    camera.position.z += deltaZ;
}

function addDrawingToScene(drawing, drawingIndex) {
    const layerIndex = Math.floor(drawingIndex / CONFIG.columnsPerLayer);
    const column = drawingIndex % CONFIG.columnsPerLayer;
    const layer = layers[layerIndex] ?? createLayer(layerIndex);
    const radii = calculateRadii(frequencyCounts, CONFIG.baseRadius);

    for (const number of drawing.numbers) {
        const instanceId = layer.used;
        const x = (column - (CONFIG.columnsPerLayer - 1) / 2) * CONFIG.spacing;
        const y = (number - (NUMBER_COUNT + 1) / 2) * CONFIG.spacing;
        const z = (layerIndex + 1) * CONFIG.layerDepth;
        const entry = {
            drawingIndex,
            number,
            x,
            y,
            z,
            baseRadius: radii[number],
            ageProgress: 0,
            matches: 0,
        };
        layer.entries[instanceId] = entry;
        setInstanceTransform(layer, instanceId, entry, CONFIG.initialScale);
        setInstanceColor(layer, instanceId, DEFAULT_COLOR, 1);
        layer.instanceOpacity.setX(instanceId, CONFIG.initialOpacity);
        layer.used += 1;
        layer.mesh.count = layer.used;
        startFade(layerIndex, instanceId);
    }
    layer.mesh.instanceMatrix.needsUpdate = true;
    layer.mesh.instanceColor.needsUpdate = true;
    layer.instanceOpacity.needsUpdate = true;
}

function setInstanceColor(layer, instanceId, hex, intensity = 1) {
    layer.mesh.setColorAt(instanceId, color.setHex(hex).multiplyScalar(intensity));
}

function setInstanceTransform(layer, instanceId, entry, ageScale) {
    position.set(entry.x, entry.y, entry.z);
    scale.setScalar(entry.baseRadius * ageScale);
    transform.compose(position, quaternion, scale);
    layer.mesh.setMatrixAt(instanceId, transform);
}

function fadeKey(layerIndex, instanceId) {
    return `${layerIndex}:${instanceId}`;
}

function startFade(layerIndex, instanceId) {
    const entry = layers[layerIndex].entries[instanceId];
    activeFades.set(fadeKey(layerIndex, instanceId), {
        layerIndex,
        instanceId,
        startedAt: performance.now() - entry.ageProgress * CONFIG.fadeDurationMs,
    });
}

function mix(start, end, progress) {
    return start + (end - start) * progress;
}

function applyEntryAppearance(layer, instanceId, entry) {
    const easedAge = 1 - (1 - entry.ageProgress) ** 2;
    const ageOpacity = mix(CONFIG.initialOpacity, CONFIG.restingOpacity, easedAge);
    const ageScale = mix(CONFIG.initialScale, CONFIG.restingScale, easedAge);
    const highlighted = entry.matches >= 2;
    const opacity = highlighted ? Math.max(ageOpacity, CONFIG.highlightedOpacity) : ageOpacity;
    const visibleScale = highlighted ? Math.max(ageScale, CONFIG.highlightedScale) : ageScale;
    const hex = highlighted ? MATCH_COLORS[entry.matches] : DEFAULT_COLOR;
    const colorIntensity = highlighted ? 1 : mix(1, 0.58, easedAge);

    setInstanceColor(layer, instanceId, hex, colorIntensity);
    layer.instanceOpacity.setX(instanceId, opacity);
    setInstanceTransform(layer, instanceId, entry, visibleScale);
}

function updateFades(now) {
    const dirtyLayers = new Set();
    for (const [key, fade] of activeFades) {
        const progress = Math.min((now - fade.startedAt) / CONFIG.fadeDurationMs, 1);
        const layer = layers[fade.layerIndex];
        if (!layer) {
            activeFades.delete(key);
            continue;
        }
        const entry = layer.entries[fade.instanceId];
        entry.ageProgress = progress;
        applyEntryAppearance(layer, fade.instanceId, entry);
        dirtyLayers.add(layer);
        if (progress === 1) activeFades.delete(key);
    }
    for (const layer of dirtyLayers) {
        layer.mesh.instanceColor.needsUpdate = true;
        layer.mesh.instanceMatrix.needsUpdate = true;
        layer.instanceOpacity.needsUpdate = true;
    }
}

function currentTicket() {
    return parseTicket(inputs.map(input => input.value));
}

function validateTicket({ announce = false } = {}) {
    const ticket = currentTicket();
    const valueCounts = new Map();
    for (const number of ticket.numbers) {
        if (Number.isInteger(number)) valueCounts.set(number, (valueCounts.get(number) ?? 0) + 1);
    }
    inputs.forEach((input, index) => {
        const number = ticket.numbers[index];
        const invalid = input.value !== "" && (
            !Number.isInteger(number) || number < 1 || number > NUMBER_COUNT || valueCounts.get(number) > 1
        );
        input.setAttribute("aria-invalid", String(invalid));
    });
    if (announce) {
        validationMessage.textContent = ticket.hasDuplicates
            ? "Each number must be unique."
            : ticket.isComplete && !ticket.isValid ? "Use five numbers from 1 to 50." : "";
    }
    return ticket;
}

function updateAllDrawingStyles() {
    const ticket = validateTicket({ announce: true });
    const ticketSet = ticket.isValid ? new Set(ticket.numbers) : new Set();
    for (let layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
        const layer = layers[layerIndex];
        if (!layer) continue;
        for (let instanceId = 0; instanceId < layer.used; instanceId += 1) {
            const entry = layer.entries[instanceId];
            const matches = countMatches(drawings[entry.drawingIndex].numbers, ticketSet);
            entry.matches = matches;
            applyEntryAppearance(layer, instanceId, entry);
            const key = fadeKey(layerIndex, instanceId);
            if (entry.ageProgress < 1 && !activeFades.has(key)) {
                startFade(layerIndex, instanceId);
            }
        }
        if (layer.mesh.instanceColor) layer.mesh.instanceColor.needsUpdate = true;
        layer.mesh.instanceMatrix.needsUpdate = true;
        layer.instanceOpacity.needsUpdate = true;
    }
    renderStats();
}

function randomPayout(drawingIndex, matches) {
    if (matches < 2) return 0;
    const key = `${drawingIndex}:${matches}`;
    if (payoutByDrawing.has(key)) return payoutByDrawing.get(key);
    const [minimum, maximum] = PAYOUT_RANGES[matches];
    const payout = Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
    payoutByDrawing.set(key, payout);
    return payout;
}

function ticketKey(ticket) {
    return ticket.isValid ? [...ticket.numbers].sort((a, b) => a - b).join(",") : null;
}

function addMatchToAnalytics(matches, drawingIndex) {
    if (matches === 2) analyticsCache.counts.pairs += 1;
    if (matches === 3) analyticsCache.counts.triplets += 1;
    if (matches === 4) analyticsCache.counts.quadruplets += 1;
    if (matches === 5) analyticsCache.counts.quintuplets += 1;
    if (matches === 5) analyticsCache.lastFullMatchIndex = drawingIndex;
    analyticsCache.gains += randomPayout(drawingIndex, matches);
}

function ensureAnalytics(ticket) {
    const key = ticketKey(ticket);
    if (key === null) {
        return {
            counts: { pairs: 0, triplets: 0, quadruplets: 0, quintuplets: 0 },
            gains: 0,
            lastFullMatchIndex: null,
        };
    }
    if (analyticsCache.ticketKey !== key) {
        analyticsCache.ticketKey = key;
        analyticsCache.counts = { pairs: 0, triplets: 0, quadruplets: 0, quintuplets: 0 };
        analyticsCache.gains = 0;
        analyticsCache.lastFullMatchIndex = null;
        drawings.forEach((drawing, index) => addMatchToAnalytics(countMatches(drawing.numbers, ticket.numbers), index));
    }
    return analyticsCache;
}

function updateCombinationStatistics(numbers) {
    const sorted = [...numbers].sort((a, b) => a - b);
    for (let size = 2; size <= DRAW_SIZE; size += 1) {
        const counts = combinationCounts.get(size);
        for (const combination of getCombinations(sorted, size)) {
            const key = combination.join(",");
            const count = (counts.get(key) ?? 0) + 1;
            counts.set(key, count);
            const best = bestCombinations.get(size);
            if (count >= 2 && (!best || count > best.count || (count === best.count && key.localeCompare(best.key, undefined, { numeric: true }) < 0))) {
                bestCombinations.set(size, { key, count });
            }
        }
    }
}

function currentMostCommonNumbers(limit = 3) {
    return Array.from({ length: NUMBER_COUNT }, (_, index) => index + 1)
        .sort((left, right) => frequencyCounts[right] - frequencyCounts[left] || left - right)
        .slice(0, limit);
}

function formatCombination(size) {
    return bestCombinations.get(size)?.key.replaceAll(",", ", ") ?? "not repeated yet";
}

function renderStats() {
    const ticket = currentTicket();
    const analytics = ensureAnalytics(ticket);
    const percentages = Object.fromEntries(
        Object.entries(analytics.counts).map(([key, count]) => [key, drawings.length ? (count / drawings.length) * 100 : 0]),
    );
    const lastDrawing = drawings.at(-1);
    const since = analytics.lastFullMatchIndex === null ? null : drawings.length - analytics.lastFullMatchIndex - 1;
    const losses = ticket.isValid ? drawings.length * CONFIG.ticketPrice : 0;
    const gains = analytics.gains;
    statsElement.textContent = [
        `Drawings: ${drawings.length}${isRunning ? " (running)" : " (paused)"}`,
        `Latest: ${lastDrawing ? lastDrawing.numbers.join(", ") : "waiting…"}`,
        `Most common numbers: ${drawings.length ? currentMostCommonNumbers().join(", ") : "—"}`,
        `Most common pair: ${formatCombination(2)}`,
        `Most common triplet: ${formatCombination(3)}`,
        `Most common quadruplet: ${formatCombination(4)}`,
        `Most common quintuplet: ${formatCombination(5)}`,
        `Last full ticket match: ${since === null ? "never" : `${since} draws ago (≈ ${Math.floor(since / 104)} years)`}`,
        `Pair rate: ${percentages.pairs.toFixed(4)}%`,
        `Triplet rate: ${percentages.triplets.toFixed(4)}%`,
        `Quadruplet rate: ${percentages.quadruplets.toFixed(4)}%`,
        `Quintuplet rate: ${percentages.quintuplets.toFixed(4)}%`,
        `Losses: ${losses.toFixed(2)} EUR`,
        `Gains: ${gains.toFixed(2)} EUR`,
        `Balance: ${(gains - losses).toFixed(2)} EUR`,
    ].join("\n");
}

function addDrawing() {
    const drawing = { numbers: generateDrawing() };
    const drawingIndex = drawings.length;
    drawings.push(drawing);
    updateFrequencyCounts(frequencyCounts, drawing.numbers);
    updateCombinationStatistics(drawing.numbers);
    addDrawingToScene(drawing, drawingIndex);
    const ticket = currentTicket();
    if (ticket.isValid && analyticsCache.ticketKey === ticketKey(ticket)) {
        addMatchToAnalytics(countMatches(drawing.numbers, ticket.numbers), drawingIndex);
    }
    if (ticket.isValid && countMatches(drawing.numbers, ticket.numbers) >= 2) updateAllDrawingStyles();
    else renderStats();
}

function setSimulationRunning(nextRunning) {
    isRunning = nextRunning;
    window.clearInterval(timerId);
    timerId = isRunning ? window.setInterval(addDrawing, CONFIG.drawIntervalMs) : null;
    pauseButton.textContent = isRunning ? "Pause" : "Resume";
    pauseButton.setAttribute("aria-pressed", String(!isRunning));
    renderStats();
}

inputs.forEach((input, index) => {
    input.addEventListener("input", () => {
        input.value = input.value.replace(/\D/g, "").slice(0, 2);
        const ticket = validateTicket();
        if (input.value.length === 2 && input.getAttribute("aria-invalid") === "false") inputs[index + 1]?.focus();
        if (ticket.isValid || !ticket.isComplete) updateAllDrawingStyles();
    });
    input.addEventListener("blur", () => updateAllDrawingStyles());
    input.addEventListener("keydown", event => {
        if (event.key === "Backspace" && input.value === "" && index > 0) inputs[index - 1].focus();
    });
});

document.querySelector("#ticket").addEventListener("submit", event => event.preventDefault());
document.querySelector("#flash-button").addEventListener("click", () => {
    const numbers = generateDrawing();
    inputs.forEach((input, index) => {
        input.value = String(numbers[index]);
        input.setAttribute("aria-invalid", "false");
    });
    validationMessage.textContent = "";
    updateAllDrawingStyles();
});
pauseButton.addEventListener("click", () => setSimulationRunning(!isRunning));

function toggleInterface() {
    document.body.classList.toggle("ui-hidden");
    tooltip.hidden = true;
}
document.querySelector("#hide-button").addEventListener("click", toggleInterface);
document.addEventListener("keydown", event => {
    if (event.key.toLowerCase() === "h" && !inputs.includes(document.activeElement)) toggleInterface();
});

renderer.domElement.addEventListener("click", event => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(layers.filter(Boolean).map(layer => layer.mesh), false)[0];
    if (!hit || hit.instanceId === undefined) {
        tooltip.hidden = true;
        return;
    }
    const layer = layers[hit.object.userData.layerIndex];
    const entry = layer.entries[hit.instanceId];
    if (!entry) return;
    const drawing = drawings[entry.drawingIndex];
    const ticket = currentTicket();
    const matches = ticket.isValid ? countMatches(drawing.numbers, ticket.numbers) : 0;
    const matchColor = MATCH_COLORS[matches];
    tooltip.hidden = false;
    tooltip.style.left = `${Math.max(10, Math.min(event.clientX + 15, window.innerWidth - 405))}px`;
    tooltip.style.top = `${Math.max(10, Math.min(event.clientY + 15, window.innerHeight - 190))}px`;
    tooltip.style.borderColor = matchColor ? `#${matchColor.toString(16).padStart(6, "0")}` : "#444";
    tooltip.textContent = [
        `Drawing #${entry.drawingIndex + 1}`,
        `Ball number: ${entry.number}`,
        `Drawn numbers: ${[...drawing.numbers].sort((a, b) => a - b).join(", ")}`,
        ...(ticket.isValid ? [`Matches found: ${matches}`, `Your numbers: ${[...ticket.numbers].sort((a, b) => a - b).join(", ")}`] : []),
    ].join("\n");
});

document.addEventListener("visibilitychange", () => {
    if (document.hidden && isRunning) {
        window.clearInterval(timerId);
        timerId = null;
    } else if (!document.hidden && isRunning && timerId === null) {
        timerId = window.setInterval(addDrawing, CONFIG.drawIntervalMs);
    }
});

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate(now) {
    requestAnimationFrame(animate);
    updateFades(now);
    controls.update();
    renderer.render(scene, camera);
}

renderStats();
setSimulationRunning(true);
requestAnimationFrame(animate);
