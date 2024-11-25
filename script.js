// Add these at the very top of script.js
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// Position camera to see entire grid
camera.position.set(25, 25, -100);
camera.lookAt(25, 25, 25);

// Add at the top with other configurations
//const MATCH_COLOR = 0x00ff00; // Bright green
const DEFAULT_COLOR = 0x1e90ff; // Dodger blue for default

// Update color constants at the top of script.js
const MATCH_COLORS = {
    1: 0xffd700,  // Gold for 1 match
    2: 0xff4500,  // Orange red for 2 matches
    3: 0x32cd32,  // Lime green for 3 matches
    4: 0x8a2be2,  // Blue violet for 4 matches
    5: 0xff69b4   // Hot pink for 5 matches
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
const CENTER_X = 26; // Middle of 52 columns
const CENTER_Y = 25; // Middle of 50 rows
const CENTER_Z = 1;  // First layer

// Add at top with other globals
let totalDrawings = 0;

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
        stats.dom.style.cssText = `
            position: absolute !important;
            top: 0 !important;
            right: 0 !important;
            cursor: pointer !important;
            opacity: 0.9 !important;
            z-index: 10000 !important;
        `;
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
                probabilities[i] = BASE_RADIUS * 2;
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
controls.dampingFactor = 0.05;
controls.screenSpacePanning = true;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

// Configuration
const gridSize = 50;
const spacing = 2;
const dots = {};
let currentDrawing = 1;

// Modify createLayer function
function createLayer(zLayer) {
    const probabilities = calculateProbabilities();
    
    for (let x = 1; x <= 52; x++) {
        for (let y = 1; y <= gridSize; y++) {
            const radius = probabilities[y]; // y corresponds to the number
            const geometry = new THREE.SphereGeometry(radius, 16, 16); // Reduced segments
            const material = new THREE.MeshBasicMaterial({ 
                color: DEFAULT_COLOR,
                transparent: true,
                opacity: 0
            });
            const dot = new THREE.Mesh(geometry, material);
            dot.position.set(x * spacing, y * spacing, zLayer * spacing);
            dots[`${x},${y},${zLayer}`] = {
                mesh: dot,
                created: null,
                initialOpacity: 0.95,
                targetOpacity: 0.1,
                transitionDuration: 20000
            };
            scene.add(dot);
        }
    }
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
    if (stats?.begin) {
        stats.begin();
    }
    
    requestAnimationFrame(animate);
    
    // Handle ball fading
    Object.values(dots).forEach(dot => {
        if (dot.created) {
            const age = Date.now() - dot.created;
            if (age < dot.transitionDuration) {
                const progress = age / dot.transitionDuration;
                dot.mesh.material.opacity = dot.initialOpacity + 
                    (dot.targetOpacity - dot.initialOpacity) * progress;
            } else {
                dot.mesh.material.opacity = dot.targetOpacity;
            }
        }
    });
    
    controls.update();
    renderer.render(scene, camera); // Use renderer instead of composer
    
    if (stats?.end) {
        stats.end();
    }
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
            dot.mesh.material.opacity = dot.initialOpacity;
            dot.mesh.material.color.setHex(DEFAULT_COLOR);
            dot.created = Date.now();
        }
    });

    // Then update matches for all drawings
    updateAllMatches();

    // Get current input values for prediction
    const prediction = Array.from(inputs).map(input => input.value);
    
    // Calculate match chances
    const chances = calculateMatchChances();
    
    // Update debug console with all information
    debugDiv.textContent = `Drawing #${currentDrawing}: ${Array.from(numbers).join(', ')}\n
Most common numbers: ${getMostCommonNumbers().join(',')}\n
Most common pair: ${findCommonCombinations(2).join(',')}\n
Most common triplet: ${findCommonCombinations(3).join(',')}\n
Most common quadruplet: ${findCommonCombinations(4).join(',')}\n
Most common quintuplet: ${findCommonCombinations(5).join(',')}\n
Last occurrence of Prediction: ${findLastOccurrence(prediction)}\n
Chance of pairs: ${chances.pairs.toFixed(6)}%\n
Chance of triplets: ${chances.triplets.toFixed(6)}%\n
Chance of quadruplets: ${chances.quadruplets.toFixed(6)}%\n
Chance of quintuplets: ${chances.quintuplets.toFixed(6)}%\n
Losses: ${totalLosses.toFixed(2)} EUR\n
Gains: ${totalGains.toFixed(2)} EUR\n
Balance: ${(totalGains - totalLosses).toFixed(2)} EUR`;

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
            if (dots[key]) {
                const dot = dots[key];
                dot.mesh.material.color.setHex(DEFAULT_COLOR);
                dot.mesh.material.opacity = dot.initialOpacity;
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
                if (dots[key]) {
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
                case 2: gain = getRandomGain(3, 5); break;
                case 3: gain = getRandomGain(17, 31); break;
                case 4: gain = getRandomGain(650, 3700); break;
                case 5: gain = getRandomGain(2000000, 167000000); break;
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
setInterval(generateNumbers, 100);
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
                    tooltip.style.backgroundColor = `#${colorHex}22`;
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


