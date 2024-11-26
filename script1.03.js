// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(
  window.devicePixelRatio > 2 ? 2 : window.devicePixelRatio
); // Higher resolution for 4K
document.body.appendChild(renderer.domElement);

// Controls
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const pointLight = new THREE.PointLight(0xffffff, 0.8);
pointLight.position.set(50, 50, 50);
scene.add(pointLight);

// Constants and Variables
const gridCols = 52;
const gridRows = 50;
const gridDepth = 80;
const spacing = 1.5;
const zSpacing = 2;
const dotMaxRadius = 0.3;
const dotMinRadius = 0.05;
const totalDrawings = gridDepth * gridCols;

const frequency = Array(gridRows).fill(0);
const dots = [];
let currentDraw = 0;
let currentCycle = 0;

let totalLoss = 0;
let totalGains = 0;
let matchCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
let starMatchCounts = { 1: 0, 2: 0 };

// Objects to track combinations
const pairCounts = {};
const tripletCounts = {};
const quadrupletCounts = {};

// Debug Console Elements
const totalDrawsElement = document.getElementById('totalDraws');
const topNumbersElement = document.getElementById('topNumbers');
const starNumbersElement = document.getElementById('starNumbers');
const totalLossElement = document.getElementById('totalLoss');
const totalGainsElement = document.getElementById('totalGains');
const balanceElement = document.getElementById('balance');
const predictionFields = [];
for (let i = 1; i <= 7; i++) {
  predictionFields.push(document.getElementById(`field${i}`));
}
const chanceElements = {
  1: document.getElementById('chance1'),
  2: document.getElementById('chance2'),
  3: document.getElementById('chance3'),
  4: document.getElementById('chance4'),
  5: document.getElementById('chance5'),
};

// New Elements for Star Chances and Counts
const starChance1Element = document.getElementById('starChance1');
const starChance2Element = document.getElementById('starChance2');
const starCount1Element = document.getElementById('starCount1');
const starCount2Element = document.getElementById('starCount2');

// Elements for Most Frequent Combinations
const mostFrequentPairElement = document.getElementById('mostFrequentPair');
const mostFrequentTripletElement = document.getElementById('mostFrequentTriplet');
const mostFrequentQuadrupletElement = document.getElementById('mostFrequentQuadruplet');

// Camera and navigation parameters
const cameraSpeed = 2;
let keyboardOffset = { x: 0, y: 0, z: 0 };
let wiggleTime = 0;

// Keyboard navigation
document.addEventListener('keydown', (event) => {
  switch (event.key) {
    case 'ArrowUp':
      keyboardOffset.y += cameraSpeed;
      break;
    case 'ArrowDown':
      keyboardOffset.y -= cameraSpeed;
      break;
    case 'ArrowLeft':
      keyboardOffset.x -= cameraSpeed;
      break;
    case 'ArrowRight':
      keyboardOffset.x += cameraSpeed;
      break;
    case 'w':
      keyboardOffset.z -= cameraSpeed;
      break;
    case 's':
      keyboardOffset.z += cameraSpeed;
      break;
  }
});

// Function to simulate a draw
function simulateDraw() {
  if (currentDraw >= totalDrawings) {
    currentDraw = 0;
    currentCycle = 0;
  }

  // Generate 5 unique numbers for the draw
  const numbers = new Set();
  while (numbers.size < 5) {
    const number = Math.floor(Math.random() * gridRows) + 1;
    numbers.add(number);
    frequency[number - 1]++;
  }

  // Generate Star Numbers A and B
  let A, B;
  do {
    A = Math.floor(Math.random() * 12) + 1;
    B = Math.floor(Math.random() * 12) + 1;
  } while (A === B);
  starNumbersElement.textContent = `${A}, ${B}`;

  // Update total loss
  const { numbers: userNumbers, starNumbers: userStarNumbers, isValid } = getEnteredNumbers();
  if (userNumbers.length === 5 && userStarNumbers.length === 2) {
    if (isValid) {
      totalLoss += 2.5;
    } else {
      resetCalculations();
    }
  }

  // Create dots for the drawn numbers
  const zPosition = currentCycle * zSpacing;
  const numberArray = Array.from(numbers);
  numberArray.forEach((num) => {
    const yPosition = (num - 1) * spacing;
    const xPosition = (currentDraw % gridCols) * spacing;
    const dot = createDot(xPosition, yPosition, zPosition, num);
    scene.add(dot);
    dots.push({ number: num, mesh: dot, age: 0 });
  });

  // Update combination counts
  updateCombinationCounts(numberArray);

  // Gain Calculation
  if (userNumbers.length === 5 && userStarNumbers.length === 2 && isValid) {
    const matchedNumbers = userNumbers.filter((num) => numberArray.includes(num));
    const matchedCount = matchedNumbers.length;

    const matchedStars = userStarNumbers.filter((num) => num === A || num === B);
    const matchedStarCount = matchedStars.length;
    const bothStarsMatched = userStarNumbers.includes(A) && userStarNumbers.includes(B);

    // Update match counts
    if (matchedCount >= 1 && matchedCount <= 5) {
      matchCounts[matchedCount]++;
    }

    // Update star match counts
    if (matchedStarCount === 1) {
      starMatchCounts[1]++;
    } else if (matchedStarCount === 2) {
      starMatchCounts[2]++;
    }

    let gain = 0;
    if (matchedCount === 1) {
      if (bothStarsMatched) {
        gain += 2.5;
      }
    } else if (matchedCount === 2) {
      gain += Math.random() * (5 - 3) + 3;
      if (matchedStarCount === 1) {
        gain += 10;
      } else if (bothStarsMatched) {
        gain += 20;
      }
    } else if (matchedCount === 3) {
      gain += Math.random() * (31 - 17) + 17;
      if (matchedStarCount === 1) {
        gain += 50;
      } else if (bothStarsMatched) {
        gain += 90;
      }
    } else if (matchedCount === 4) {
      gain += Math.random() * (3700 - 650) + 650;
      if (matchedStarCount === 1) {
        gain += 1000;
      } else if (bothStarsMatched) {
        gain += 5000;
      }
    } else if (matchedCount === 5) {
      gain += Math.random() * (167000000 - 2000000) + 2000000;
      if (matchedStarCount === 1) {
        gain += 100000;
      } else if (bothStarsMatched) {
        gain += 5000000;
      }
    }

    totalGains += gain;
    totalLossElement.textContent = `${totalLoss.toFixed(2)}€`;
    totalGainsElement.textContent = `${totalGains.toFixed(2)}€`;
    balanceElement.textContent = `${(totalGains - totalLoss).toFixed(2)}€`;
  } else if (!isValid) {
    resetCalculations();
  }

  currentDraw++;
  currentCycle = Math.floor(currentDraw / gridCols);

  updateDotColors();
  updateDotSizes();
  updateDebugConsole();

  // Update chances after each draw
  updateChances();

  setTimeout(simulateDraw, 100);
}

// Function to create a dot
function createDot(x, y, z, number) {
  const geometry = new THREE.SphereGeometry(dotMaxRadius, 16, 16);
  const material = new THREE.MeshStandardMaterial({
    color: calculateColor(number),
    transparent: true,
    opacity: 0.8,
  });
  const sphere = new THREE.Mesh(geometry, material);
  sphere.position.set(x, y, z);
  return sphere;
}

// Function to calculate color based on frequency
function calculateColor(number) {
  const freq = frequency[number - 1];
  const maxFreq = Math.max(...frequency);
  const hue = maxFreq > 0 ? (freq / maxFreq) * 255 : 0;
  return new THREE.Color(`hsl(${hue}, 100%, 50%)`);
}

// Update dot colors
function updateDotColors() {
  const { numbers: userNumbers } = getEnteredNumbers();
  dots.forEach(({ number, mesh }) => {
    if (userNumbers.includes(number)) {
      mesh.material.color.set(0xffffff);
    } else {
      mesh.material.color.set(calculateColor(number));
    }
  });
}

// Update dot sizes
function updateDotSizes() {
  dots.forEach((dot) => {
    dot.age++;
    const decayFactor = Math.max(1 - dot.age / 1000, 0);
    const newRadius = dotMinRadius + decayFactor * (dotMaxRadius - dotMinRadius);
    dot.mesh.scale.set(
      newRadius / dotMaxRadius,
      newRadius / dotMaxRadius,
      newRadius / dotMaxRadius
    );
  });
}

// Function to get entered numbers
function getEnteredNumbers() {
  const numbers = [];
  const starNumbers = [];
  let isValid = true;
  const numberSet = new Set();
  const starNumberSet = new Set();

  for (let i = 1; i <= 7; i++) {
    const field = document.getElementById(`field${i}`);
    const num = parseInt(field.value);
    if (!isNaN(num)) {
      if (i <= 5) {
        if (num > 50 || num < 1) {
          isValid = false;
        }
        if (numberSet.has(num)) {
          isValid = false;
        }
        numberSet.add(num);
        numbers.push(num);
      } else {
        if (num > 12 || num < 1) {
          isValid = false;
        }
        if (starNumberSet.has(num)) {
          isValid = false;
        }
        starNumberSet.add(num);
        starNumbers.push(num);
      }
    }
  }

  if (numbers.length !== numberSet.size || starNumbers.length !== starNumberSet.size) {
    isValid = false;
  }

  return { numbers, starNumbers, isValid };
}

// Update Prediction Function
function updatePrediction(field) {
  if (field !== undefined && field < 7 && predictionFields[field - 1].value !== '') {
    predictionFields[field].disabled = false;
  }

  // Update chances
  updateChances();
}

// Function to reset calculations
function resetCalculations() {
  totalLoss = 0;
  totalGains = 0;
  matchCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  starMatchCounts = { 1: 0, 2: 0 };

  totalLossElement.textContent = `0€`;
  totalGainsElement.textContent = `0€`;
  balanceElement.textContent = `0€`;

  // Reset chance elements
  for (let i = 1; i <= 5; i++) {
    chanceElements[i].textContent = `--%`;
    const countElement = document.getElementById(`count${i}`);
    countElement.textContent = `0`;
  }

  // Reset star chance elements
  starChance1Element.textContent = `--%`;
  starChance2Element.textContent = `--%`;
  starCount1Element.textContent = `0`;
  starCount2Element.textContent = `0`;
}

// Function to update chances
function updateChances() {
  const { numbers: userNumbers, starNumbers: userStarNumbers, isValid } = getEnteredNumbers();
  if (
    currentDraw > 0 &&
    userNumbers.length === 5 &&
    userStarNumbers.length === 2 &&
    isValid
  ) {
    for (let i = 1; i <= 5; i++) {
      const count = matchCounts[i];
      const chance = (count / currentDraw) * 100;
      chanceElements[i].textContent = `${chance.toFixed(6)}%`;

      // Update counts
      const countElement = document.getElementById(`count${i}`);
      countElement.textContent = `${count}`;
    }

    // Update star chance calculations and counts
    const starCount1 = starMatchCounts[1];
    const starCount2 = starMatchCounts[2];
    const starChance1 = (starCount1 / currentDraw) * 100;
    const starChance2 = (starCount2 / currentDraw) * 100;
    starChance1Element.textContent = `${starChance1.toFixed(6)}%`;
    starChance2Element.textContent = `${starChance2.toFixed(6)}%`;

    // Update star counts
    starCount1Element.textContent = `${starCount1}`;
    starCount2Element.textContent = `${starCount2}`;
  } else {
    resetCalculations();
  }
}

// Function to update combination counts
function updateCombinationCounts(numbers) {
  // Sort the numbers to ensure consistent key ordering
  const sortedNumbers = numbers.slice().sort((a, b) => a - b);

  // Generate pairs
  const pairs = getCombinations(sortedNumbers, 2);
  pairs.forEach((pair) => {
    const key = pair.join(',');
    pairCounts[key] = (pairCounts[key] || 0) + 1;
  });

  // Generate triplets
  const triplets = getCombinations(sortedNumbers, 3);
  triplets.forEach((triplet) => {
    const key = triplet.join(',');
    tripletCounts[key] = (tripletCounts[key] || 0) + 1;
  });

  // Generate quadruplets
  const quadruplets = getCombinations(sortedNumbers, 4);
  quadruplets.forEach((quadruplet) => {
    const key = quadruplet.join(',');
    quadrupletCounts[key] = (quadrupletCounts[key] || 0) + 1;
  });
}

// Function to get combinations
function getCombinations(array, size) {
  function combine(arr, size, start, initialStuff, output) {
    if (initialStuff.length >= size) {
      output.push(initialStuff);
    } else {
      let i;
      for (i = start; i < arr.length; ++i) {
        combine(arr, size, i + 1, initialStuff.concat([arr[i]]), output);
      }
    }
  }

  const output = [];
  combine(array, size, 0, [], output);
  return output;
}

// Update Debug Console
function updateDebugConsole() {
  totalDrawsElement.textContent = currentDraw;
  const topNumbers = frequency
    .map((count, index) => ({ number: index + 1, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((entry) => `${entry.number} [${entry.count}]`);
  topNumbersElement.textContent = topNumbers.join('    ');

  // Update most frequent combinations
  if (currentDraw > 0) {
    const mostFrequentPair = getMostFrequentCombination(pairCounts);
    const mostFrequentTriplet = getMostFrequentCombination(tripletCounts);
    const mostFrequentQuadruplet = getMostFrequentCombination(quadrupletCounts);

    mostFrequentPairElement.textContent = mostFrequentPair || '--';
    mostFrequentTripletElement.textContent = mostFrequentTriplet || '--';
    mostFrequentQuadrupletElement.textContent = mostFrequentQuadruplet || '--';
  }
}

// Function to get the most frequent combination
function getMostFrequentCombination(counts) {
  let maxCount = 0;
  let mostFrequent = null;
  for (const combo in counts) {
    if (counts[combo] > maxCount) {
      maxCount = counts[combo];
      mostFrequent = `${combo} [${counts[combo]}]`;
    }
  }
  return mostFrequent;
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();

  // Apply keyboard navigation
  camera.position.x += keyboardOffset.x * 0.1;
  camera.position.y += keyboardOffset.y * 0.1;
  camera.position.z += keyboardOffset.z * 0.1;

  keyboardOffset.x *= 0.9; // Smooth deceleration
  keyboardOffset.y *= 0.9;
  keyboardOffset.z *= 0.9;

  // Camera wiggle (reduced amplitude and speed)
  wiggleTime += 0.0025; // Reduced speed
  camera.position.x += Math.sin(wiggleTime) * 0.025; // Reduced amplitude
  camera.position.y += Math.cos(wiggleTime) * 0.025;

  camera.lookAt(
    (gridCols * spacing) / 2,
    (gridRows * spacing) / 2,
    (gridDepth * zSpacing) / 2
  );
  updateDotSizes();
  renderer.render(scene, camera);
}

// Event listener for window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize the simulation
simulateDraw();
animate();