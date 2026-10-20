(function initialiseLotteryCore(global) {
    "use strict";

    const NUMBER_COUNT = 50;
    const DRAW_SIZE = 5;

    function parseTicket(values) {
        const numbers = values.map(value => Number.parseInt(String(value), 10));
        const inRange = numbers.every(number => Number.isInteger(number) && number >= 1 && number <= NUMBER_COUNT);
        const unique = new Set(numbers);
        const populatedNumbers = numbers.filter(
            (number, index) => String(values[index]).trim() !== "" && Number.isInteger(number),
        );

        return {
            numbers,
            isComplete: values.every(value => String(value).trim() !== ""),
            isValid: values.length === DRAW_SIZE && inRange && unique.size === DRAW_SIZE,
            hasDuplicates: new Set(populatedNumbers).size !== populatedNumbers.length,
        };
    }

    function generateDrawing(random = Math.random) {
        const pool = Array.from({ length: NUMBER_COUNT }, (_, index) => index + 1);
        for (let index = 0; index < DRAW_SIZE; index += 1) {
            const selected = index + Math.floor(random() * (NUMBER_COUNT - index));
            [pool[index], pool[selected]] = [pool[selected], pool[index]];
        }
        return pool.slice(0, DRAW_SIZE);
    }

    function countMatches(drawing, ticketNumbers) {
        if (ticketNumbers.length !== DRAW_SIZE && !(ticketNumbers instanceof Set && ticketNumbers.size === DRAW_SIZE)) {
            return 0;
        }
        const ticket = ticketNumbers instanceof Set ? ticketNumbers : new Set(ticketNumbers);
        return drawing.reduce((total, number) => total + Number(ticket.has(number)), 0);
    }

    function calculateMatchStats(drawings, ticketNumbers) {
        const counts = { pairs: 0, triplets: 0, quadruplets: 0, quintuplets: 0 };
        if (drawings.length === 0 || new Set(ticketNumbers).size !== DRAW_SIZE) {
            return { counts, percentages: { ...counts } };
        }
        for (const drawing of drawings) {
            const matches = countMatches(drawing.numbers, ticketNumbers);
            if (matches === 2) counts.pairs += 1;
            if (matches === 3) counts.triplets += 1;
            if (matches === 4) counts.quadruplets += 1;
            if (matches === 5) counts.quintuplets += 1;
        }
        return {
            counts,
            percentages: Object.fromEntries(
                Object.entries(counts).map(([key, count]) => [key, (count / drawings.length) * 100]),
            ),
        };
    }

    function updateFrequencyCounts(counts, numbers) {
        for (const number of numbers) counts[number] += 1;
        return counts;
    }

    function calculateRadii(counts, baseRadius = 0.15) {
        const radii = new Float32Array(NUMBER_COUNT + 1).fill(baseRadius);
        const positive = Array.from(counts).slice(1).filter(count => count > 0);
        if (positive.length === 0) return radii;
        const minimum = Math.min(...positive);
        const maximum = Math.max(...positive);
        const spread = maximum - minimum;
        for (let number = 1; number <= NUMBER_COUNT; number += 1) {
            if (counts[number] === 0 || spread === 0) continue;
            radii[number] = baseRadius * (1 + (counts[number] - minimum) / spread);
        }
        return radii;
    }

    function mostCommonNumbers(drawings, limit = 3) {
        const counts = new Uint32Array(NUMBER_COUNT + 1);
        for (const drawing of drawings) updateFrequencyCounts(counts, drawing.numbers);
        return Array.from({ length: NUMBER_COUNT }, (_, index) => index + 1)
            .sort((left, right) => counts[right] - counts[left] || left - right)
            .slice(0, limit);
    }

    function getCombinations(numbers, size) {
        const result = [];
        function visit(start, combination) {
            if (combination.length === size) {
                result.push(combination.slice());
                return;
            }
            for (let index = start; index <= numbers.length - (size - combination.length); index += 1) {
                combination.push(numbers[index]);
                visit(index + 1, combination);
                combination.pop();
            }
        }
        visit(0, []);
        return result;
    }

    function mostCommonCombination(drawings, size, minimumOccurrences = 2) {
        if (size < 1 || size > DRAW_SIZE) return [];
        const counts = new Map();
        for (const drawing of drawings) {
            const sorted = [...drawing.numbers].sort((left, right) => left - right);
            for (const combination of getCombinations(sorted, size)) {
                const key = combination.join(",");
                counts.set(key, (counts.get(key) ?? 0) + 1);
            }
        }
        const best = [...counts.entries()]
            .filter(([, count]) => count >= minimumOccurrences)
            .sort(([leftKey, leftCount], [rightKey, rightCount]) => {
                if (rightCount !== leftCount) return rightCount - leftCount;
                return leftKey.localeCompare(rightKey, undefined, { numeric: true });
            })[0];
        return best ? best[0].split(",").map(Number) : [];
    }

    function drawingsSinceOccurrence(drawings, ticketNumbers) {
        if (new Set(ticketNumbers).size !== DRAW_SIZE) return null;
        for (let index = drawings.length - 1; index >= 0; index -= 1) {
            if (countMatches(drawings[index].numbers, ticketNumbers) === DRAW_SIZE) {
                return drawings.length - index - 1;
            }
        }
        return null;
    }

    global.LotteryCore = Object.freeze({
        NUMBER_COUNT,
        DRAW_SIZE,
        parseTicket,
        generateDrawing,
        countMatches,
        calculateMatchStats,
        updateFrequencyCounts,
        calculateRadii,
        mostCommonNumbers,
        getCombinations,
        mostCommonCombination,
        drawingsSinceOccurrence,
    });
}(globalThis));
