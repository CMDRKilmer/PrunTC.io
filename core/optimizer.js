/**
 * PrunTC 核心优化算法
 * 独立的装载优化算法实现，可被主线程和 Worker 共用
 */

/**
 * @typedef {Object} Item
 * @property {number} id - 物品唯一标识
 * @property {string} code - 物品代码
 * @property {number} inventory - 现有库存
 * @property {number} dailyConsume - 每日消耗量
 * @property {number} unitWeight - 单位重量
 * @property {number} unitVolume - 单位体积
 */

/**
 * @typedef {Object} LoadItem
 * @property {string} code - 物品代码
 * @property {number} loadAmount - 装载数量
 * @property {number} weight - 总重量
 * @property {number} volume - 总体积
 * @property {number} targetInventory - 目标库存
 * @property {number} days - 目标天数
 */

/**
 * @typedef {Object} LoadResult
 * @property {number} totalWeight - 总重量
 * @property {number} totalVolume - 总体积
 * @property {LoadItem[]} load - 装载详情
 */

/**
 * @typedef {Object} OptimizeResult
 * @property {number} optimalDays - 最优平衡天数
 * @property {number} fillRate - 填充率
 * @property {number} totalWeight - 总重量
 * @property {number} totalVolume - 总体积
 * @property {LoadItem[]} load - 装载方案
 */

/**
 * 货舱优化器核心类
 * 负责计算最优装载方案
 */
class CargoOptimizerCore {
    /**
     * @param {Object} config - 配置对象
     * @param {Function} config.round - 四舍五入函数
     * @param {Function} config.simpleHash - 哈希函数
     * @param {Function} config.generateLoadCacheKey - 缓存键生成函数
     * @param {Object} config.config - CONFIG 配置对象
     */
    constructor(config) {
        this.round = config.round || ((n, d) => Number(n.toFixed(d || 2)));
        this.simpleHash = config.simpleHash || ((str) => Math.abs((hash => {
            let h = 0;
            for (let i = 0; i < str.length; i++) {
                h = ((h << 5) - h) + str.charCodeAt(i);
                h = h & h;
            }
            return h;
        })(str)));
        this.generateLoadCacheKey = config.generateLoadCacheKey || ((items, days, hashFn) => {
            const itemsKey = items
                .sort((a, b) => a.code.localeCompare(b.code))
                .map(i => `${i.code}:${i.inventory}:${i.dailyConsume}:${i.unitWeight}:${i.unitVolume}`)
                .join('|');
            return `load_${days.toFixed(6)}_${hashFn(itemsKey)}`;
        });
        this.config = config.config || {};

        this.cache = new Map();
        this.maxCacheSize = this.config.CACHE?.MAX_SIZE || 50;
        this.cacheAccessOrder = [];
        this.loadCache = new Map();
        this.maxLoadCacheSize = this.config.CACHE?.LOAD_CACHE_MAX_SIZE || 200;
    }

    /**
     * 计算指定天数下的装载方案
     * @param {Item[]} items - 物品列表
     * @param {number} days - 目标天数
     * @returns {LoadResult} 装载方案
     */
    calculateLoadForDays(items, days) {
        const cacheKey = this.generateLoadCacheKey(items, days, this.simpleHash);

        if (this.loadCache.has(cacheKey)) {
            return this.loadCache.get(cacheKey);
        }

        let totalWeight = 0;
        let totalVolume = 0;
        const load = [];
        const daysFixed = this.round(days, 3);

        // 按库存天数排序，优先填充库存天数低的物品
        const sortedItems = [...items].sort((a, b) => {
            const daysA = a.dailyConsume > 0 ? a.inventory / a.dailyConsume : Infinity;
            const daysB = b.dailyConsume > 0 ? b.inventory / b.dailyConsume : Infinity;
            return daysA - daysB;
        });

        for (const item of sortedItems) {
            if (item.dailyConsume <= 0 || !isFinite(item.dailyConsume)) {
                continue;
            }

            const targetInventory = days * item.dailyConsume;

            if (!isFinite(targetInventory) || targetInventory > 1e15) {
                continue;
            }

            const required = targetInventory - item.inventory;

            if (required <= 0) {
                continue;
            }

            const loadAmount = Math.ceil(required);
            const weight = loadAmount * item.unitWeight;
            const volume = loadAmount * item.unitVolume;

            totalWeight += weight;
            totalVolume += volume;

            load.push({
                code: item.code,
                loadAmount: loadAmount,
                weight: this.round(weight, 4),
                volume: this.round(volume, 4),
                targetInventory: this.round(item.inventory + loadAmount),
                days: daysFixed
            });
        }

        const result = {
            totalWeight: this.round(totalWeight, 4),
            totalVolume: this.round(totalVolume, 4),
            load
        };

        // 限制缓存大小
        if (this.loadCache.size >= this.maxLoadCacheSize) {
            const firstKey = this.loadCache.keys().next().value;
            this.loadCache.delete(firstKey);
        }

        this.loadCache.set(cacheKey, result);
        return result;
    }

    /**
     * 使用二分查找优化算法寻找最优装载方案
     * @param {Item[]} items - 物品列表
     * @param {number} capacityWeight - 重量容量
     * @param {number} capacityVolume - 体积容量
     * @returns {OptimizeResult|null} 优化结果
     */
    optimize(items, capacityWeight, capacityVolume) {
        // 验证容量
        if (!isFinite(capacityWeight) || capacityWeight <= 0 ||
            !isFinite(capacityVolume) || capacityVolume <= 0) {
            throw new Error('容量必须是有效的正数');
        }

        // 过滤有效物品
        const validItems = items.filter(item => {
            return item.code && item.dailyConsume > 0;
        });

        if (validItems.length === 0) {
            return {
                optimalDays: 0,
                fillRate: 0,
                totalWeight: 0,
                totalVolume: 0,
                load: []
            };
        }

        // 计算初始库存天数
        const inventoryDays = validItems.map(item => {
            return item.dailyConsume > 0 ? item.inventory / item.dailyConsume : 0;
        });

        const currentMaxDays = Math.max(...inventoryDays);

        // 优化搜索范围
        const totalDailyWeight = validItems.reduce((sum, item) => sum + (item.dailyConsume * item.unitWeight), 0);
        const totalDailyVolume = validItems.reduce((sum, item) => sum + (item.dailyConsume * item.unitVolume), 0);

        const weightBasedDays = totalDailyWeight > 0 ? capacityWeight / totalDailyWeight : 100;
        const volumeBasedDays = totalDailyVolume > 0 ? capacityVolume / totalDailyVolume : 100;

        const config = this.config.OPTIMIZE || {};
        const searchBoost = config.SEARCH_BOOST || 50;
        const minSearchDays = config.MIN_SEARCH_DAYS || 0.001;

        const maxSearchDays = Math.max(
            currentMaxDays + 100,
            currentMaxDays * 3,
            weightBasedDays + searchBoost,
            volumeBasedDays + searchBoost,
            1
        );

        const precision = this.config.CACHE?.PRECISION || 0.001;
        const earlyTerminationThreshold = this.config.CACHE?.EARLY_TERMINATION_THRESHOLD || 0.999;

        let bestDays = currentMaxDays;
        let bestFillRate = 0;
        let bestLoad = null;

        let left = Math.max(minSearchDays, currentMaxDays - 10);
        let right = maxSearchDays;
        let iterations = 0;
        const maxIterations = config.MAX_ITERATIONS || 500;

        while (right - left > precision && iterations < maxIterations) {
            iterations++;
            const mid = this.round((left + right) / 2, 6);
            const result = this.calculateLoadForDays(validItems, mid);

            if (result.totalWeight <= capacityWeight && result.totalVolume <= capacityVolume) {
                const weightRate = result.totalWeight / capacityWeight;
                const volumeRate = result.totalVolume / capacityVolume;
                const fillRate = Math.max(weightRate, volumeRate);

                if (fillRate > bestFillRate) {
                    bestFillRate = fillRate;
                    bestDays = mid;
                    bestLoad = result.load;
                }

                if (fillRate >= earlyTerminationThreshold) {
                    break;
                }

                left = mid;
            } else {
                right = mid;
            }
        }

        // 回退方案
        const fallbackIncrement = config.FALLBACK_DAYS_INCREMENT || 1;
        if (!bestLoad || bestLoad.length === 0) {
            const fallbackDays = Math.max(minSearchDays, currentMaxDays + fallbackIncrement);
            const result = this.calculateLoadForDays(validItems, fallbackDays);
            bestLoad = result.load;
            bestDays = fallbackDays;
            bestFillRate = Math.max(result.totalWeight / capacityWeight, result.totalVolume / capacityVolume);
        }

        // 计算最终结果
        const finalDays = bestDays + fallbackIncrement;
        const finalResult = this.calculateLoadForDays(validItems, finalDays);

        return {
            optimalDays: this.round(bestDays, 3),
            fillRate: this.round(bestFillRate, 6),
            totalWeight: this.round(finalResult.totalWeight, 2),
            totalVolume: this.round(finalResult.totalVolume, 2),
            load: finalResult.load
        };
    }

    /**
     * 清空所有缓存
     */
    clearCache() {
        this.cache.clear();
        this.loadCache.clear();
        this.cacheAccessOrder = [];
    }
}

// 导出优化器核心类（用于模块化）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CargoOptimizerCore };
}

// ES6 模块导出
export { CargoOptimizerCore };
