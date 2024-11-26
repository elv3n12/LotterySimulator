// Add these at the very top of script.js
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// Position camera to see entire grid
camera.position.set(100, 100, 50);
camera.lookAt(100, 100, 100);

// Add at the top with other configurations
const DEFAULT_COLOR = 0x16304C; // Dodger blue for default

// Update color constants at the top of script.js
const MATCH_COLORS = {
    2: 0xff4500,  // Orange red for 2 matches
    3: 0x32cd32,  // Lime green for 3 matches
    4: 0x8a2be2,  // Blue violet for 4 matches
    5: 0xffd700,  // Gold for 5 match
};

// Add at top with other configurations
const drawings = [];

// Add at top with other configurations
const BASE_RADIUS = 0.15; // Current ball size as average

// Add at the top with other configurations
let totalLosses = 0;
let totalGains = 0;

// Add to top of file
const matchGains = new Map(); // Store gains per drawing and match count

// Add these configurations at the top
const CENTER_X = 100; // Middle of 52 columns
const CENTER_Y = 100; // Middle of 50 rows
const CENTER_Z = 1;  // First layer

// Add at top with other globals
let totalDrawings = 0;

// Add at top with other globals
let needsUpdate = false;

// Add at top with other globals
const MAX_LAYERS = 52;
let activeLayerIndices = []; // Track which layers are currently displayed

// Add CSS classes at the top with other configurations
const CSS_CLASSES = `
    .negative { color: #ff4444; }
    .positive { color: #44ff44; }
    .zero { color: #ff4444; }
    .use-link {
        color: #4488ff;
        cursor: pointer;
        margin-left: 10px;
        font-size: 0.8em;
    }
    .use-link:hover {
        text-decoration: underline;
    }
`;

// Add this flag at the top with other globals
let isProcessingClick = false;

// Replace the existing initStats function
function initStats() {
    if (typeof Stats === 'undefined') {
        console.error('Stats.js library not loaded');
        return null;
    }

    try {
        const stats = new Stats();
        if (!stats || !stats.dom) {
            console.error('Failed to create Stats instance');
            return null;
        }

        stats.showPanel(0);
        stats.dom.style.cssText = 'visibility:hidden!important; position: fixed !important; !important; cursor: pointer !important; z-index: 10000 !important;';
        document.body.appendChild(stats.dom);
        return stats;
    } catch (error) {
        console.error('Error initializing Stats:', error);
        return null;
    }
}

// Initialize stats
const stats = initStats();

// Modify calculateProbabilities()
function calculateProbabilities() {
    // Initialize array with default size for all balls
    const probabilities = new Array(51);
    probabilities.fill(BASE_RADIUS, 1);
    
    // Update totalDrawings based on drawings array length
    totalDrawings = drawings.length;
    
    // If no drawings yet, return default sizes
    if (totalDrawings === 0) {
        return probabilities;
    }

    // Get current input numbers
    const inputNumbers = getCurrentInputNumbers();

    // Make matched balls twice the size
    if (inputNumbers.size === 5) {
        for (let i = 1; i <= 50; i++) {
            if (inputNumbers.has(i)) {
                probabilities[i] = BASE_RADIUS * 1.5;
            }
        }
    }

    return probabilities;
}

// Scene setup
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.domElement.style.position = 'fixed';
renderer.domElement.style.top = '0';
renderer.domElement.style.left = '0';
renderer.domElement.style.zIndex = '1';
document.body.insertBefore(renderer.domElement, document.body.firstChild);

// Remove Bokeh effect setup
// const composer = new THREE.EffectComposer(renderer);
// const renderPass = new THREE.RenderPass(scene, camera);
// composer.addPass(renderPass);

// const bokehPass = new THREE.BokehPass(scene, camera, {
//     focus: 200,
//     aperture: 2.2,
//     maxblur: 0.005,
//     width: window.innerWidth,
//     height: window.innerHeight
// });
// composer.addPass(bokehPass);

// Add controls after renderer is created
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.04;
controls.screenSpacePanning = true;

// Lighting
const ambientLight = new THREE.AmbientLight(0xFFFFFF);
scene.add(ambientLight);
//const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
//directionalLight.position.set(10, 10, 10);
//scene.add(directionalLight);

// Configuration
const gridSize = 50;
const spacing = 2.5;
const dots = {};
let currentDrawing = 1;

// 1. Create shared geometry and materials
const sphereGeometry = new THREE.SphereGeometry(1, 16, 16);
const materials = {
    default: new THREE.MeshPhongMaterial({
        color: DEFAULT_COLOR,
        transparent: true,
    }),
    matched: new THREE.MeshPhongMaterial({
        color: MATCH_COLORS[2],
        transparent: false,    // No transparency needed
        opacity: 1.0          // Fully opaque
    })
};

// 2. Use InstancedMesh for all balls
const MAX_INSTANCES = 50 * 52; // Max number of balls
const instancedMesh = new THREE.InstancedMesh(
    sphereGeometry,
    materials.default,
    MAX_INSTANCES
);
scene.add(instancedMesh);

// 3. Optimize matrix updates
const matrix = new THREE.Matrix4();
const updateBallPosition = (index, x, y, z, scale) => {
    matrix.setPosition(x * spacing, y * spacing, z * spacing);
    matrix.scale(new THREE.Vector3(scale, scale, scale));
    instancedMesh.setMatrixAt(index, matrix);
    needsUpdate = true; // Flag for batch updates
};

// 4. Add frustum culling
const frustum = new THREE.Frustum();
const projScreenMatrix = new THREE.Matrix4();

// Function to remove oldest layer
function removeOldestLayer() {
    if (activeLayerIndices.length > 0) {
        const oldestZ = activeLayerIndices[0];
        
        // Remove all balls in oldest layer
        Object.entries(dots).forEach(([key, dot]) => {
            const [_, __, z] = key.split(',').map(Number);
            if (z === oldestZ) {
                scene.remove(dot.mesh);
                dot.mesh.geometry.dispose();
                dot.mesh.material.dispose();
                delete dots[key];
            }
        });
        
        // Remove from tracking array
        activeLayerIndices.shift();
        needsUpdate = true;
    }
}

// Update the createLayer function
function createLayer(zLayer) {
    // Remove oldest layer if we exceed MAX_LAYERS
    if (activeLayerIndices.length >= MAX_LAYERS) {
        removeOldestLayer();
    }
    
    // Add new layer
    const probabilities = calculateProbabilities();
    
    for (let x = 1; x <= 52; x++) {
        for (let y = 1; y <= gridSize; y++) {
            const radius = probabilities[y];
            const geometry = new THREE.SphereGeometry(radius, 32, 32);
            const material = new THREE.MeshPhongMaterial({ 
                color: DEFAULT_COLOR,
                shininess: 50
            });
            const dot = new THREE.Mesh(geometry, material);
            dot.position.set(x * spacing, y * spacing, zLayer * spacing);
            dot.visible = false; // Start invisible
            
            dots[`${x},${y},${zLayer}`] = {
                mesh: dot,
                drawn: false // Track if ball has been drawn
            };
            scene.add(dot);
        }
    }
    
    // Track new layer
    activeLayerIndices.push(zLayer);
    needsUpdate = true;
}

// Input handling
const inputs = document.querySelectorAll('.number-input');
const usedNumbers = new Set();

function validateInput(input, skipCurrent = false) {
    const value = input.value;
    if (!value) return true;
    
    const num = parseInt(value);
    // Check used numbers except current input when validating during input
    const isUsed = skipCurrent ? 
        Array.from(inputs).some(other => other !== input && other.value === value) :
        usedNumbers.has(num);
        
    const isValid = num >= 1 && num <= 50 && !isUsed;
    input.style.color = isValid ? '#fff' : '#666';
    return isValid;
}

function updateUsedNumbers() {
    usedNumbers.clear();
    inputs.forEach(input => {
        if (input.value) {
            usedNumbers.add(parseInt(input.value));
        }
    });
}

inputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
        let value = e.target.value.replace(/[^0-9]/g, '');
        if (value.length > 2) {
            value = value.slice(0, 2);
        }
        input.value = value;
        
        // Validate on second digit
        if (value.length === 2) {
            if (!validateInput(input, true)) {
                input.value = '';
                return;
            }
            // Move to next field if valid
            if (index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
        }
    });

    // Validate on blur
    input.addEventListener('blur', () => {
        if (input.value && !validateInput(input)) {
            input.value = '';
        }
        updateUsedNumbers();
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && e.target.value.length === 0 && index > 0) {
            inputs[index - 1].focus();
        }
    });
});

inputs.forEach(input => {
    input.addEventListener('change', () => {
        updateAllMatches();
    });
});

// Add this function after input handling
function getCurrentInputNumbers() {
    const numbers = new Set();
    inputs.forEach(input => {
        if (input.value) {
            numbers.add(parseInt(input.value));
        }
    });
    return numbers;
}

// Add function to calculate match chances
function calculateMatchChances() {
    if (drawings.length === 0) return { pairs: 0, triplets: 0, quadruplets: 0, quintuplets: 0 };
    
    let pairs = 0, triplets = 0, quadruplets = 0, quintuplets = 0;
    const inputNumbers = getCurrentInputNumbers();
    
    if (inputNumbers.size !== 5) return { pairs: 0, triplets: 0, quadruplets: 0, quintuplets: 0 };
    
    drawings.forEach(drawing => {
        const matches = new Set();
        drawing.numbers.forEach(num => {
            if (inputNumbers.has(num)) {
                matches.add(num);
            }
        });
        
        switch(matches.size) {
            case 2: pairs++; break;
            case 3: triplets++; break;
            case 4: quadruplets++; break;
            case 5: quintuplets++; break;
        }
    });
    
    const total = drawings.length;
    return {
        pairs: (pairs / total) * 100,
        triplets: (triplets / total) * 100,
        quadruplets: (quadruplets / total) * 100,
        quintuplets: (quintuplets / total) * 100
    };
}

// Simplify animation loop to only handle ball fading
function animate() {
    if (stats) stats.begin();

    // Update frustum for culling
    camera.updateMatrixWorld();
    projScreenMatrix.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(projScreenMatrix);

    // Check each dot against frustum
    Object.values(dots).forEach(dot => {
        if (dot.mesh.boundingSphere) {
            dot.mesh.visible = frustum.intersectsSphere(dot.mesh.boundingSphere);
        }
    });

    controls.update();
    renderer.render(scene, camera);

    if (stats) stats.end();
    requestAnimationFrame(animate);
}

// Helper function to find most common numbers
function getMostCommonNumbers() {
    const counts = new Array(51).fill(0);
    drawings.forEach(drawing => {
        drawing.numbers.forEach(num => counts[num]++);
    });
    return Array.from({length: 50}, (_, i) => i + 1)
        .sort((a, b) => counts[b] - counts[a])
        .slice(0, 3);
}

// Helper function to find common combinations
function findCommonCombinations(size) {
    const combinations = {};
    drawings.forEach(drawing => {
        const nums = drawing.numbers;
        const combo = nums.slice(0, size).sort((a, b) => a - b).join(',');
        combinations[combo] = (combinations[combo] || 0) + 1;
    });
    
    // Require at least 2 occurrences for all combination sizes
    const minOccurrences = 2;
    
    const sorted = Object.entries(combinations)
        .filter(([_, count]) => count >= minOccurrences)
        .sort((a, b) => b[1] - a[1]);
        
    return sorted.length > 0 ? sorted[0][0].split(',').map(Number) : [];
}

// Helper function to find last prediction occurrence
function findLastOccurrence(prediction) {
    if (prediction.length !== 5) return "never";
    
    let lastIndex = -1;
    drawings.forEach((drawing, index) => {
        const predictionMatches = prediction.every(num => 
            drawing.numbers.includes(parseInt(num))
        );
        if (predictionMatches) lastIndex = index;
    });
    
    if (lastIndex === -1) return "never";
    
    const drawingsSince = drawings.length - lastIndex - 1;
    const years = Math.floor(drawingsSince / 104);
    return `${drawingsSince} [${years} years]`;
}

// Update generateNumbers to recalculate probabilities for new layers
function generateNumbers() {
    let numbers = new Set();
    while(numbers.size < 5) {
        numbers.add(Math.floor(Math.random() * 50) + 1);
    }

    const zLayer = Math.floor((currentDrawing - 1) / 52) + 1;
    const xPosition = ((currentDrawing - 1) % 52) + 1;

    if (!dots[`1,1,${zLayer}`]) {
        createLayer(zLayer);
    }

    // Store drawing for later comparison
    drawings.push({
        numbers: Array.from(numbers),
        position: { x: xPosition, z: zLayer }
    });

    // First make all drawn numbers visible with default color
    Array.from(numbers).forEach(number => {
        const key = `${xPosition},${number},${zLayer}`;
        if (dots[key]) {
            const dot = dots[key];
            dot.mesh.visible = true;
            dot.mesh.material.color.setHex(DEFAULT_COLOR);
            dot.mesh.material.emissive.setHex(0x444444);
            dot.drawn = true;
        }
    });

    // Then update matches for all drawings
    updateAllMatches();

    // Get current input values for prediction
    const prediction = Array.from(inputs).map(input => input.value);
    
    // Calculate match chances
    const chances = calculateMatchChances();
    
    // Get all combinations
    const pairs = findCommonCombinations(2);
    const triplets = findCommonCombinations(3);
    const quadruplets = findCommonCombinations(4);
    const quintuplets = findCommonCombinations(5);

    // Create text with conditional Use buttons
    const pairText = pairs.length > 0 
        ? `${pairs.join(',')} <a class="use-link" data-type="2">Use</a>`
        : pairs.join(',');
    const tripletText = triplets.length > 0 
        ? `${triplets.join(',')} <a class="use-link" data-type="3">Use</a>`
        : triplets.join(',');
    const quadrupletText = quadruplets.length > 0 
        ? `${quadruplets.join(',')} <a class="use-link" data-type="4">Use</a>`
        : quadruplets.join(',');
    const quintupletText = quintuplets.length > 0 
        ? `${quintuplets.join(',')} <a class="use-link" data-type="5">Use</a>`
        : quintuplets.join(',');
    
    debugDiv.innerHTML = `Drawing #${currentDrawing}: ${Array.from(numbers).join(', ')}\n
Most common numbers: ${getMostCommonNumbers().join(',')}\n
Most common pair: ${pairText}\n
Most common triplet: ${tripletText}\n
Most common quadruplet: ${quadrupletText}\n
Most common quintuplet: ${quintupletText}\n
Last occurrence of Prediction: ${findLastOccurrence(prediction)}\n
Chance of pairs: ${formatDebugValue(chances.pairs, 'chance')}\n
Chance of triplets: ${formatDebugValue(chances.triplets, 'chance')}\n
Chance of quadruplets: ${formatDebugValue(chances.quadruplets, 'chance')}\n
Chance of quintuplets: ${formatDebugValue(chances.quintuplets, 'chance')}\n
Losses: ${formatDebugValue(-totalLosses, 'money')}\n
Gains: ${formatDebugValue(totalGains, 'money')}\n
Balance: ${formatDebugValue(totalGains - totalLosses, 'money')}`;

    currentDrawing++;
}

// Helper function for random gain in range
function getRandomGain(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Update updateAllMatches function
function updateAllMatches() {
    const inputNumbers = getCurrentInputNumbers();
    
    // Reset totals when recalculating
    totalGains = 0;
    totalLosses = 0;
    
    // Calculate losses for all drawings where inputs were filled
    if (inputNumbers.size === 5) {
        totalLosses = currentDrawing * 2.5;
    }

    // First reset all balls to default state
    drawings.forEach(drawing => {
        drawing.numbers.forEach(number => {
            const key = `${drawing.position.x},${number},${drawing.position.z}`;
            if (dots[key] && dots[key].drawn) {
                const dot = dots[key];
                dot.mesh.material.color.setHex(DEFAULT_COLOR);
                dot.mesh.material.emissive.setHex(0x444444);
                dot.mesh.scale.set(1, 1, 1); // Reset scale
                dot.created = Date.now(); // Restart fade animation
            }
        });
    });

    // Then process matches and apply colors
    drawings.forEach((drawing, index) => {
        const matches = new Set();
        drawing.numbers.forEach(num => {
            if (inputNumbers.has(num)) {
                matches.add(num);
            }
        });

        if (matches.size >= 2) {
            // Apply colors and scale to all numbers in matching drawing
            drawing.numbers.forEach(number => {
                const key = `${drawing.position.x},${number},${drawing.position.z}`;
                if (dots[key] && dots[key].drawn) {
                    const dot = dots[key];
                    const matchColor = MATCH_COLORS[matches.size];
                    dot.mesh.material.color.setHex(matchColor);
                    dot.mesh.scale.set(2, 2, 2); // Scale up matched balls
                    dot.created = null; // Stop fade animation
                }
            });
        }

        // Calculate gains
        const drawingKey = `${index}-${matches.size}`;
        if (!matchGains.has(drawingKey)) {
            let gain = 0;
            switch(matches.size) {
                case 2: gain = getRandomGain(10,15); break;
                case 3: gain = getRandomGain(60, 80); break;
                case 4: gain = getRandomGain(1300, 1500); break;
                case 5: gain = getRandomGain(15000000, 167000000); break;
            }
            matchGains.set(drawingKey, gain);
        }
        totalGains += matchGains.get(drawingKey);
    });
}

// Update window resize handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    // composer.setSize(window.innerWidth, window.innerHeight); // Remove composer resize
});

// Debug panel
const debugDiv = document.createElement('div');
debugDiv.className = 'debug-panel';
debugDiv.style.whiteSpace = 'pre';
document.body.appendChild(debugDiv);

// Initialize
createLayer(1);
animate();
clearInterval(); // Clear any existing interval
setInterval(generateNumbers, 125); // Slow down to 500ms
renderer.domElement.style.zIndex = "1";

// Add to your HTML after input container
const flashButton = document.createElement('button');
flashButton.textContent = 'Flash';
flashButton.className = 'flash-button';
flashButton.style.display = 'block';  // Makes button go to new line
document.querySelector('.input-container').appendChild(flashButton);

// Add CSS styles
const style = document.createElement('style');
document.head.appendChild(style);

// Add style element after other style definitions
const debugStyle = document.createElement('style');
debugStyle.textContent = CSS_CLASSES;
document.head.appendChild(debugStyle);

// Add flash function
function generateUniqueRandomNumbers() {
    const numbers = new Set();
    while(numbers.size < 5) {
        numbers.add(Math.floor(Math.random() * 50) + 1);
    }
    return Array.from(numbers);
}

// Add click handler
flashButton.addEventListener('click', () => {
    const numbers = generateUniqueRandomNumbers();
    
    // Clear existing numbers
    usedNumbers.clear();
    
    // Fill inputs
    inputs.forEach((input, index) => {
        input.value = numbers[index];
        input.classList.add('valid');
        usedNumbers.add(numbers[index]);
    });
    
    // Update matches
    updateAllMatches();
});



// Interface toggle
let interfaceVisible = true;
document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        // Check if any input is focused
        const activeElement = document.activeElement;
        const isInputFocused = Array.from(inputs).includes(activeElement);
        
        if (!isInputFocused) {
            // Only handle tab if no input is focused
            e.preventDefault();
            interfaceVisible = !interfaceVisible;
            document.querySelector('.input-container').classList.toggle('hidden');
            debugDiv.classList.toggle('hidden');
            if (stats?.dom) {
                stats.dom.classList.toggle('hidden');
            }
        }
        // Let default tab behavior work if input is focused
    }
});

// Tooltip setup
const tooltip = document.createElement('div');
tooltip.className = 'tooltip';
tooltip.style.cssText = `
    position: fixed;
    z-index: 3000;
    background-color: rgba(0, 0, 0, 0.8);
    color: #fff;
    padding: 12px 16px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 14px;
    pointer-events: none;
    white-space: pre-line;
    line-height: 1.8;
    border: 1px solid #444;
    display: none;
`;
document.body.appendChild(tooltip);

// Single click handler for tooltip
renderer.domElement.addEventListener('click', (event) => {
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(scene.children);
    
    if (intersects.length > 0) {
        const intersected = intersects[0].object;
        const ballData = Object.entries(dots).find(([_, dot]) => 
            dot.mesh === intersected
        );
        
        if (ballData) {
            const [key, dot] = ballData;
            const [x, y, z] = key.split(',').map(Number);
            const drawingIndex = (z - 1) * 52 + (x - 1);
            const drawing = drawings[drawingIndex];
            
            if (drawing) {
                const inputNumbers = getCurrentInputNumbers();
                const matches = drawing.numbers.filter(num => 
                    inputNumbers.has(num)
                ).length;

                tooltip.style.display = 'block';
                tooltip.style.left = event.clientX + 15 + 'px';
                tooltip.style.top = event.clientY + 15 + 'px';

                // Style tooltip based on matches
                if (matches >= 2) {
                    const colorHex = MATCH_COLORS[matches].toString(16).padStart(6, '0');
                    tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
                    tooltip.style.borderColor = `#${colorHex}`;
                    tooltip.textContent = 
                        `Drawing #${drawingIndex + 1}\n` +
                        `Ball number: ${y}\n` +
                        `Matches found: ${matches}\n` +
                        `Winning numbers: ${drawing.numbers.sort((a,b) => a-b).join(', ')}\n`;
                } else {
                    tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
                    tooltip.style.borderColor = '#444';
                    tooltip.textContent = 
                        `Drawing #${drawingIndex + 1}\n` +
                        `Ball number: ${y}\n` +
                        `Drawn numbers: ${drawing.numbers.sort((a,b) => a-b).join(', ')}`;
                }
            }
        }
    } else {
        tooltip.style.display = 'none';
    }
});

// Hide tooltip when clicking elsewhere
document.addEventListener('click', (event) => {
    if (event.target !== renderer.domElement) {
        tooltip.style.display = 'none';
    }
});

// 5. Optimized animate loop
function animate() {
    if (stats) stats.begin();

    // Update only if camera moved
    if (controls.changed) {
        projScreenMatrix.multiplyMatrices(
            camera.projectionMatrix,
            camera.matrixWorldInverse
        );
        frustum.setFromProjectionMatrix(projScreenMatrix);
    }

    // Batch matrix updates
    if (needsUpdate) {
        instancedMesh.instanceMatrix.needsUpdate = true;
        needsUpdate = false;
    }

    controls.update();
    renderer.render(scene, camera);

    if (stats) stats.end();
    requestAnimationFrame(animate);
}

// 6. Add LOD based on distance
const updateLOD = () => {
    const cameraPosition = camera.position;
    sphereGeometry.dispose();
    
    if (cameraPosition.z > 100) {
        sphereGeometry = new THREE.SphereGeometry(1, 8, 8);
    } else {
        sphereGeometry = new THREE.SphereGeometry(1, 16, 16);
    }
};

// 7. Additional optimizations
renderer.powerPreference = "high-performance";
renderer.antialias = false;

// Debug helpers
renderer.info.reset();
console.log(renderer.info.render.calls);
console.log(renderer.info.memory.geometries);

// Add helper function for console formatting
function formatConsoleOutput(value, type) {
    const isZeroChance = type === 'chance' && value === 0;
    const isLoss = type === 'money' && value < 0;
    const isGain = type === 'money' && value > 0;
    
    if (isZeroChance || isLoss) {
        return `%c${value}`, 'color: #ff0000'; // Red
    } else if (isGain) {
        return `%c${value}`, 'color: #00ff00'; // Green
    }
    return value;
}

// Update console logging
function updateConsoleStats() {
    console.log(
        'Chances:', 
        formatConsoleOutput(chances, 'chance'),
        '\nLosses:', 
        formatConsoleOutput(totalLosses, 'money'),
        '\nGains:', 
        formatConsoleOutput(totalGains, 'money'),
        '\nBalance:', 
        formatConsoleOutput(totalGains - totalLosses, 'money')
    );
}

// Replace the debug console update in generateNumbers function
function formatDebugValue(value, type) {
    if (type === 'chance') {
        return value === 0 ? `<span class="zero">${value.toFixed(6)}%</span>` : `${value.toFixed(6)}%`;
    }
    if (type === 'money') {
        return value < 0 
            ? `<span class="negative">${value.toFixed(2)} EUR</span>`
            : value > 0 
                ? `<span class="positive">${value.toFixed(2)} EUR</span>`
                : `${value.toFixed(2)} EUR`;
    }
    return value;
}

// Add helper function after other helper functions
function fillInputsWithCombination(numbers) {
    usedNumbers.clear();
    inputs.forEach(input => input.value = '');
    
    // Fill inputs with the combination
    numbers.forEach((num, index) => {
        if (index < 5) {  // Only use up to 5 numbers
            inputs[index].value = num;
            usedNumbers.add(num);
        }
    });
    
    // Fill remaining inputs with random numbers if needed
    let filledCount = Math.min(numbers.length, 5);
    while (filledCount < 5) {
        const num = Math.floor(Math.random() * 50) + 1;
        if (!usedNumbers.has(num)) {
            inputs[filledCount].value = num;
            usedNumbers.add(num);
            filledCount++;
        }
    }
    
    updateAllMatches();
}

// Add click handler after debugDiv creation
debugDiv.addEventListener('click', async (e) => {
    if (e.target.classList.contains('use-link') && !isProcessingClick) {
        isProcessingClick = true;
        const type = parseInt(e.target.dataset.type);
        const combination = findCommonCombinations(type);
        if (combination.length > 0) {
            await fillInputsWithCombination(combination);
        }
        // Add small delay before allowing next click
        setTimeout(() => {
            isProcessingClick = false;
        }, 200);
    }
});