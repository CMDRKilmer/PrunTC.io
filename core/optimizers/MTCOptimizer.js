/**
 * MTC 优化器核心模块
 * 最少次数运输计算器的核心算法实现
 */

const MTCConfig = Object.freeze({
    MAX_ITERATIONS: 500,
    MAX_FILL_ITERATIONS: 100,
    MAX_FINAL_ITERATIONS: 100,
    DUAL_LIMIT_MIN_CAPACITY: 10,
    SCORE_THRESHOLD: 0.95,
    WEIGHT_UTIL_FACTOR: 0.8,
    BALANCE_FACTOR: 0.15,
    DENSITY_FACTOR: 0.05
});

class MTCOptimizer {
    static optimizeTrips(items, maxWeight, maxVolume) {
        const totalWeight = items.reduce((sum, item) => sum + item.totalWeight, 0);
        const totalVolume = items.reduce((sum, item) => sum + item.totalVolume, 0);

        const minTripsByWeight = Math.ceil(totalWeight / maxWeight);
        const minTripsByVolume = Math.ceil(totalVolume / maxVolume);
        const minTrips = Math.max(minTripsByWeight, minTripsByVolume);

        const remainingItems = items.map(item => ({
            ...item,
            remainingQty: item.qty,
            density: item.unitWeight / item.unitVolume
        }));

        const targetDensity = maxWeight / maxVolume;
        const trips = [];

        for (let k = 0; k < minTrips; k++) {
            const trip = this.createEmptyTrip();

            const dualLimitResult = this.findDualLimitCombo(remainingItems, trip, maxWeight, maxVolume);
            if (dualLimitResult) {
                for (const { item, qty } of dualLimitResult) {
                    if (qty > 0) {
                        this.addItemToTrip(trip, item, qty);
                        item.remainingQty -= qty;
                    }
                }
            }

            let improved = true;
            let iterations = 0;
            let useHighDensity = true;

            while (improved && iterations < MTCConfig.MAX_ITERATIONS) {
                improved = false;
                iterations++;

                const remainingWeight = maxWeight - trip.totalWeight;
                const remainingVolume = maxVolume - trip.totalVolume;

                if (remainingWeight < 0.01 || remainingVolume < 0.01) break;

                let bestItem = null;
                let bestQty = 0;
                let bestScore = -1;

                const availableItems = remainingItems.filter(item => item.remainingQty > 0);
                if (availableItems.length === 0) break;

                const sortedByDensity = [...availableItems].sort((a, b) => b.density - a.density);
                const maxDensityItem = sortedByDensity[0];
                const minDensityItem = sortedByDensity[sortedByDensity.length - 1];

                const candidateItems = useHighDensity ?
                    [maxDensityItem, minDensityItem] :
                    [minDensityItem, maxDensityItem];

                for (const item of candidateItems) {
                    if (item.remainingQty <= 0) continue;

                    const maxByWeight = Math.floor(remainingWeight / item.unitWeight);
                    const maxByVolume = Math.floor(remainingVolume / item.unitVolume);
                    const canFit = Math.min(maxByWeight, maxByVolume, item.remainingQty);

                    if (canFit <= 0) continue;

                    for (let qty of [canFit, Math.floor(canFit * 0.75), Math.floor(canFit * 0.5), Math.floor(canFit * 0.25), 1]) {
                        if (qty <= 0 || qty > canFit) continue;

                        const newWeight = trip.totalWeight + qty * item.unitWeight;
                        const newVolume = trip.totalVolume + qty * item.unitVolume;

                        const weightUtil = newWeight / maxWeight;
                        const volumeUtil = newVolume / maxVolume;

                        const tripDensity = newWeight / newVolume;
                        const densityMatch = 1 - Math.abs(tripDensity - targetDensity) / targetDensity;

                        const balanceScore = 1 - Math.abs(weightUtil - volumeUtil);
                        const utilizationScore = (weightUtil + volumeUtil) / 2;
                        const score = utilizationScore * MTCConfig.WEIGHT_UTIL_FACTOR + balanceScore * MTCConfig.BALANCE_FACTOR + densityMatch * MTCConfig.DENSITY_FACTOR;

                        if (score > bestScore) {
                            bestScore = score;
                            bestItem = item;
                            bestQty = qty;
                        }

                        if (score > MTCConfig.SCORE_THRESHOLD) break;
                    }

                    if (bestItem) break;
                }

                if (bestItem && bestQty > 0) {
                    this.addItemToTrip(trip, bestItem, bestQty);
                    bestItem.remainingQty -= bestQty;
                    improved = true;
                    useHighDensity = !useHighDensity;
                } else {
                    for (const item of availableItems) {
                        const maxByWeight = Math.floor(remainingWeight / item.unitWeight);
                        const maxByVolume = Math.floor(remainingVolume / item.unitVolume);
                        const canFit = Math.min(maxByWeight, maxByVolume, item.remainingQty);

                        if (canFit > 0) {
                            this.addItemToTrip(trip, item, canFit);
                            item.remainingQty -= canFit;
                            improved = true;
                            break;
                        }
                    }

                    if (!improved) break;
                }
            }

            let fillImproved = true;
            let fillIterations = 0;

            while (fillImproved && fillIterations < MTCConfig.MAX_FILL_ITERATIONS) {
                fillImproved = false;
                fillIterations++;

                const remainingWeight = maxWeight - trip.totalWeight;
                const remainingVolume = maxVolume - trip.totalVolume;

                if (remainingWeight < 0.01 || remainingVolume < 0.01) break;

                const sortedItems = remainingItems
                    .filter(item => item.remainingQty > 0)
                    .map(item => {
                        const maxByWeight = Math.floor(remainingWeight / item.unitWeight);
                        const maxByVolume = Math.floor(remainingVolume / item.unitVolume);
                        const canFit = Math.min(maxByWeight, maxByVolume, item.remainingQty);
                        return { item, canFit, densityDiff: Math.abs(item.density - targetDensity) };
                    })
                    .filter(x => x.canFit > 0)
                    .sort((a, b) => a.densityDiff - b.densityDiff);

                for (const { item, canFit } of sortedItems) {
                    if (canFit > 0) {
                        this.addItemToTrip(trip, item, canFit);
                        item.remainingQty -= canFit;
                        fillImproved = true;
                        break;
                    }
                }
            }

            let finalImproved = true;
            let finalIterations = 0;

            while (finalImproved && finalIterations < MTCConfig.MAX_FINAL_ITERATIONS) {
                finalImproved = false;
                finalIterations++;

                const remainingWeight = maxWeight - trip.totalWeight;
                const remainingVolume = maxVolume - trip.totalVolume;

                if (remainingWeight < 0.01 || remainingVolume < 0.01) break;

                for (const item of remainingItems) {
                    if (item.remainingQty <= 0) continue;

                    const maxByWeight = Math.floor(remainingWeight / item.unitWeight);
                    const maxByVolume = Math.floor(remainingVolume / item.unitVolume);
                    const canFit = Math.min(maxByWeight, maxByVolume, item.remainingQty);

                    if (canFit > 0) {
                        this.addItemToTrip(trip, item, canFit);
                        item.remainingQty -= canFit;
                        finalImproved = true;
                        break;
                    }
                }
            }

            if (Object.keys(trip.items).length > 0) {
                trips.push(trip);
            }
        }

        while (remainingItems.some(item => item.remainingQty > 0)) {
            const trip = this.createEmptyTrip();

            for (const item of remainingItems) {
                if (item.remainingQty <= 0) continue;

                const maxByWeight = Math.floor((maxWeight - trip.totalWeight) / item.unitWeight);
                const maxByVolume = Math.floor((maxVolume - trip.totalVolume) / item.unitVolume);
                const qty = Math.min(maxByWeight, maxByVolume, item.remainingQty);

                if (qty > 0) {
                    this.addItemToTrip(trip, item, qty);
                    item.remainingQty -= qty;
                }
            }

            if (Object.keys(trip.items).length > 0) {
                trips.push(trip);
            } else {
                break;
            }
        }

        return {
            trips,
            totalTrips: trips.length,
            totalItems: items.length,
            totalQty: items.reduce((sum, item) => sum + item.qty, 0),
            avgUtilization: this.calculateAvgUtilization(trips, maxWeight, maxVolume)
        };
    }

    static findDualLimitCombo(remainingItems, trip, maxWeight, maxVolume) {
        const availableItems = remainingItems.filter(item => item.remainingQty > 0);
        if (availableItems.length < 2) return null;

        const remainingWeight = maxWeight - trip.totalWeight;
        const remainingVolume = maxVolume - trip.totalVolume;

        if (remainingWeight < MTCConfig.DUAL_LIMIT_MIN_CAPACITY || remainingVolume < MTCConfig.DUAL_LIMIT_MIN_CAPACITY) return null;

        let bestCombo = null;
        let bestScore = -1;

        const itemsWithDensity = availableItems.map(item => ({
            ...item,
            _original: item,
            density: item.unitWeight / item.unitVolume
        }));

        itemsWithDensity.sort((a, b) => a.density - b.density);

        const targetDensity = remainingWeight / remainingVolume;

        for (let i = 0; i < itemsWithDensity.length; i++) {
            for (let j = i + 1; j < itemsWithDensity.length; j++) {
                const item1 = itemsWithDensity[i]._original;
                const item2 = itemsWithDensity[j]._original;
                const density1 = itemsWithDensity[i].density;
                const density2 = itemsWithDensity[j].density;

                const densityDiff = Math.abs(density1 - density2);
                if (densityDiff < 0.1) continue;

                const avgDensity = (density1 + density2) / 2;
                if (Math.abs(avgDensity - targetDensity) > targetDensity * 0.5) continue;

                const w1 = item1.unitWeight, v1 = item1.unitVolume;
                const w2 = item2.unitWeight, v2 = item2.unitVolume;

                const det = w1 * v2 - w2 * v1;
                if (Math.abs(det) < 0.0001) continue;

                const x = (remainingWeight * v2 - remainingVolume * w2) / det;
                const y = (remainingVolume * w1 - remainingWeight * v1) / det;

                if (x <= 0 || y <= 0) continue;

                const qty1 = Math.floor(x);
                const qty2 = Math.floor(y);

                if (qty1 > item1.remainingQty || qty2 > item2.remainingQty) continue;

                const actualWeight = qty1 * w1 + qty2 * w2;
                const actualVolume = qty1 * v1 + qty2 * v2;

                if (actualWeight > remainingWeight || actualVolume > remainingVolume) continue;

                const weightUtil = actualWeight / remainingWeight;
                const volumeUtil = actualVolume / remainingVolume;

                const balanceScore = 1 - Math.abs(weightUtil - volumeUtil);
                const score = (weightUtil + volumeUtil) / 2 * balanceScore;

                if (score > bestScore && score > MTCConfig.SCORE_THRESHOLD) {
                    bestScore = score;
                    bestCombo = [
                        { item: item1, qty: qty1 },
                        { item: item2, qty: qty2 }
                    ];

                    if (score > 0.99) {
                        return bestCombo;
                    }
                }
            }
        }

        return bestCombo;
    }

    static createEmptyTrip() {
        return {
            items: {},
            totalWeight: 0,
            totalVolume: 0
        };
    }

    static addItemToTrip(trip, item, qty) {
        if (!trip.items[item.code]) {
            trip.items[item.code] = {
                code: item.code,
                name: item.name,
                qty: 0,
                unitWeight: item.unitWeight,
                unitVolume: item.unitVolume
            };
        }

        trip.items[item.code].qty += qty;
        trip.totalWeight += qty * item.unitWeight;
        trip.totalVolume += qty * item.unitVolume;
    }

    static calculateAvgUtilization(trips, maxWeight, maxVolume) {
        if (trips.length === 0) return 0;

        let totalUtilization = 0;
        for (const trip of trips) {
            const weightUtil = trip.totalWeight / maxWeight;
            const volumeUtil = trip.totalVolume / maxVolume;
            totalUtilization += Math.max(weightUtil, volumeUtil);
        }

        return Math.round((totalUtilization / trips.length) * 100);
    }
}

export default MTCOptimizer;