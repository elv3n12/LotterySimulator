import test from "node:test";
import assert from "node:assert/strict";
import "../lottery-core.js";

const {
    calculateMatchStats,
    calculateRadii,
    countMatches,
    drawingsSinceOccurrence,
    generateDrawing,
    getCombinations,
    mostCommonCombination,
    parseTicket,
    updateFrequencyCounts,
} = globalThis.LotteryCore;

test("parseTicket accepts five unique in-range values", () => {
    assert.equal(parseTicket(["1", "12", "23", "34", "50"]).isValid, true);
    assert.equal(parseTicket(["1", "1", "2", "3", "4"]).isValid, false);
    assert.equal(parseTicket(["", "", "", "", ""]).hasDuplicates, false);
    assert.equal(parseTicket(["0", "2", "3", "4", "5"]).isValid, false);
});

test("generateDrawing produces five unique values in range", () => {
    const drawing = generateDrawing(() => 0.5);
    assert.equal(drawing.length, 5);
    assert.equal(new Set(drawing).size, 5);
    assert.ok(drawing.every(number => number >= 1 && number <= 50));
});

test("countMatches and match statistics use exact match buckets", () => {
    const drawings = [
        { numbers: [1, 2, 3, 20, 21] },
        { numbers: [1, 2, 30, 31, 32] },
    ];
    assert.equal(countMatches(drawings[0].numbers, [1, 2, 3, 4, 5]), 3);
    const stats = calculateMatchStats(drawings, [1, 2, 3, 4, 5]);
    assert.deepEqual(stats.counts, { pairs: 1, triplets: 1, quadruplets: 0, quintuplets: 0 });
    assert.equal(stats.percentages.pairs, 50);
});

test("frequency radii remain finite when counts are equal", () => {
    const counts = new Uint32Array(51);
    updateFrequencyCounts(counts, [1, 2, 3, 4, 5]);
    const radii = calculateRadii(counts);
    assert.ok(Array.from(radii).every(Number.isFinite));
    assert.equal(radii[1].toFixed(2), "0.15");
});

test("combination analysis considers every subset, not only the prefix", () => {
    assert.equal(getCombinations([1, 2, 3, 4, 5], 2).length, 10);
    const drawings = [
        { numbers: [1, 2, 9, 10, 11] },
        { numbers: [3, 4, 9, 10, 12] },
    ];
    assert.deepEqual(mostCommonCombination(drawings, 2), [9, 10]);
});

test("drawingsSinceOccurrence reports recency and never as null", () => {
    const drawings = [
        { numbers: [1, 2, 3, 4, 5] },
        { numbers: [6, 7, 8, 9, 10] },
    ];
    assert.equal(drawingsSinceOccurrence(drawings, [1, 2, 3, 4, 5]), 1);
    assert.equal(drawingsSinceOccurrence(drawings, [11, 12, 13, 14, 15]), null);
});
