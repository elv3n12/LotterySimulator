# 3D Lottery Visualisation

An interactive Three.js simulation that generates five-number lottery drawings, compares them with a player ticket, and plots the results as a navigable 3D history.

> [!IMPORTANT]
> This is a visual simulation, not an official lottery product or a prediction system. The drawings, payouts, probabilities, and balance are generated locally for demonstration purposes. Past frequency does not make a number more likely to appear in a future random drawing.

## Lottery rules

### Your ticket

- A ticket contains exactly **five different numbers**.
- Every number must be between **1 and 50**, inclusive.
- Duplicate and out-of-range values are rejected.
- **Flash** creates a random valid ticket for you.

### Simulated drawings

- Each drawing contains five unique random numbers from 1 to 50.
- Numbers are selected without replacement, so the same number cannot appear twice in one drawing.
- The simulation creates one drawing every **100 milliseconds** while it is running.
- **Pause** stops new drawings without clearing the current history.

### Match categories

The ticket is compared with every simulated drawing. A drawing belongs to exactly one category according to the number of shared values:

| Matches | Name | Colour | Behaviour |
|---:|---|---|---|
| 0–1 | No winning match | Blue `#2F73FF` | Shrinks and fades with age |
| 2 | Pair | Orange `#FF3300` | Remains fully visible |
| 3 | Triplet | Green `#00FF00` | Remains fully visible |
| 4 | Quadruplet | Magenta `#FF00FF` | Remains fully visible |
| 5 | Quintuplet | Red `#FF0000` | Remains fully visible |

When a drawing has at least two matches, **all five balls in that drawing** receive the category colour. This makes the complete winning row visible, including the drawn numbers that are not present on the ticket.

Changing the ticket immediately recalculates every visible drawing. A formerly highlighted drawing returns to its correct age, size, transparency, and blue colour if it no longer matches the new ticket.

## How drawings are represented

Each drawing is represented by a vertical group of five spheres in a 3D coordinate system.

### Axes

- **Horizontal axis — drawing order:** drawings progress from left to right.
- **Vertical axis — lottery number:** number 1 is near the bottom and number 50 is near the top.
- **Depth axis — history layers:** after 52 drawings, the next group begins on a new layer farther into the scene.

For example, if drawing 12 contains `4, 18, 27, 39, 46`, five balls appear in drawing column 12 at the vertical positions for those five numbers.

### Layers and retained history

- One layer contains **52 drawings**.
- Each drawing contributes five balls, for a maximum of **260 balls per layer**.
- The renderer retains the latest **40 layers**, or up to **2,080 visible drawings**.
- Older visual layers are removed from GPU memory, but their data continues to contribute to lifetime statistics.
- The camera automatically follows the retained layers as the simulation advances.

### Ball size: frequency and age

Ball size carries two different pieces of information.

1. **Frequency at creation time** determines the ball's base radius. A number that has appeared more often is drawn larger than one that has appeared less often. The radius is normalised between the current least-frequent and most-frequent observed numbers.
2. **Age** applies an additional scale to ordinary blue balls. New balls begin at full scale and progressively shrink to 46% of that scale over 30 seconds.

The frequency radius is a snapshot taken when the ball is created. Existing balls are not resized when later frequency counts change. Highlighted pair, triplet, quadruplet, and quintuplet rows stay at full age scale, but their frequency-based size difference remains.

### Transparency and age

Ordinary blue balls visually recede as they get older:

- They begin at **86% opacity**.
- They fade to **9% opacity** over 30 seconds.
- Their colour also becomes less intense.
- Their size decreases at the same time.

Orange, green, magenta, and red match rows do not fade or shrink while they match the active ticket. This keeps rare results visible inside a large drawing history.

The transition uses an ease-out curve, so the difference between recent and older drawings becomes visible quickly and then settles gradually.

## Statistics panel

The panel in the lower-left corner reports:

- **Drawings:** total simulated drawings generated during the session.
- **Latest:** the five values in the newest drawing.
- **Most common numbers:** the three numbers with the highest lifetime occurrence counts.
- **Most common pair/triplet/quadruplet/quintuplet:** the most frequently repeated combination of that size. A combination is shown only after appearing at least twice.
- **Last full ticket match:** how many drawings have occurred since the current five-number ticket last appeared exactly.
- **Pair/triplet/quadruplet/quintuplet rate:** the percentage of all simulated drawings with exactly that many matches. These are empirical simulation rates, not theoretical odds and not “at least” percentages.
- **Losses, gains, and balance:** an illustrative financial simulation for the active ticket.

The displayed year estimate assumes **104 drawings per year**, equivalent to two drawings per week. It translates the number of simulated drawings into a hypothetical lottery timescale; it is not elapsed real time.

## Illustrative gains and losses

A valid ticket is assigned an illustrative cost of **€2.50 per drawing**. Matching drawings receive a randomly selected demonstration payout:

| Matches | Simulated payout |
|---:|---:|
| 2 | €3–€5 |
| 3 | €17–€31 |
| 4 | €650–€3,700 |
| 5 | €2,000,000–€167,000,000 |

A generated payout remains stable for that drawing and match category during the session. These ranges are not connected to a real lottery, jackpot, operator, or live prize table.

## Controls

- **Left-drag:** orbit around the 3D history.
- **Scroll:** zoom in or out.
- **Right-drag:** pan the camera.
- **Click a ball:** inspect its drawing number, ball value, complete draw, and current match count.
- **Flash:** generate a new valid five-number ticket.
- **Pause / Resume:** stop or restart drawing generation.
- **Hide UI:** hide the controls and statistics.
- **H:** hide or show the interface without overriding normal Tab-key navigation.

## Run locally

Open `index.html` directly, or start the included local server:

```sh
npm run serve
```

Then open <http://localhost:8000>.

## Tests

```sh
npm test
```

The tests cover ticket validation, drawing uniqueness, match buckets, frequency-radius edge cases, complete combination analysis, occurrence recency, and direct browser entrypoint compatibility.

## Architecture

- `index.html` contains the semantic controls and loads the browser scripts.
- `styles.css` defines the responsive pixel-style interface.
- `lottery-core.js` contains pure, independently tested lottery logic and supports direct `index.html` usage without an ES-module server.
- `script.js` owns the simulation state, incremental statistics, Three.js scene, controls, and interaction handling.
- Each 52-drawing layer uses one `THREE.InstancedMesh`. Custom per-instance colour and opacity attributes plus instance transforms provide match colours, transparency, frequency sizing, and age scaling without allocating a mesh and material for every ball.
- GPU memory remains bounded by disposing visual layers older than the latest 40 while retaining their statistical data.
