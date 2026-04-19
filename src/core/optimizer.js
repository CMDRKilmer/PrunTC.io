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

        this.loadCache = new Map();
        this.maxLoadCacheSize = this.config.CACHE?.LOAD_CACHE_MAX_SIZE || 200;

        /** @type {Item[]} */
        this.items = [];
        this.nextId = 1;
    }

    /**
     * 验证物品输入
     * @param {Object} item - 物品数据
     * @throws {Error} 验证失败时抛出错误
     */
    validateItemInput(item) {
        if (item.code && typeof item.code !== 'string') {
            throw new Error('物品代码必须是字符串');
        }
        if (!isFinite(item.inventory) || item.inventory < 0) {
            throw new Error('库存必须是有效的非负数');
        }
        if (!isFinite(item.dailyConsume) || item.dailyConsume < 0) {
            throw new Error('每日消耗量必须是有效的非负数');
        }
        if (!isFinite(item.unitWeight) || item.unitWeight < 0) {
            throw new Error('单位重量必须是有效的非负数');
        }
        if (!isFinite(item.unitVolume) || item.unitVolume < 0) {
            throw new Error('单位体积必须是有效的非负数');
        }
    }

    /**
     * 添加物品
     * @param {string} code - 物品代码
     * @param {number} inventory - 现有库存
     * @param {number} dailyConsume - 每日消耗量
     * @param {number} unitWeight - 单位重量
     * @param {number} unitVolume - 单位体积
     * @returns {Object} 新物品对象
     */
    addItem(code = '', inventory = 0, dailyConsume = 0, unitWeight = 0, unitVolume = 0) {
        this.validateItemInput({ code, inventory, dailyConsume, unitWeight, unitVolume });

        const id = this.nextId++;
        const newItem = {
            id,
            code: code.toUpperCase(),
            inventory: this.round(Math.max(0, inventory)),
            dailyConsume: this.round(Math.max(0, dailyConsume), 3),
            unitWeight: this.round(Math.max(0, unitWeight), 4),
            unitVolume: this.round(Math.max(0, unitVolume), 4)
        };
        this.items.push(newItem);

        this.clearCache();
        return newItem;
    }

    /**
     * 更新物品信息
     * @param {number} id - 物品ID
     * @param {string} field - 字段名
     * @param {*} value - 新值
     */
    updateItem(id, field, value) {
        const item = this.items.find(i => i.id === id);
        if (item) {
            if (field === 'code') {
                if (typeof value !== 'string') {
                    throw new Error('物品代码必须是字符串');
                }
                item[field] = value.toUpperCase();
            } else if (field === 'inventory') {
                const numValue = parseFloat(value);
                if (!isFinite(numValue) || numValue < 0) {
                    throw new Error('库存必须是有效的非负数');
                }
                item[field] = this.round(Math.max(0, numValue), 2);
            } else if (field === 'dailyConsume') {
                const numValue = parseFloat(value);
                if (!isFinite(numValue) || numValue < 0) {
                    throw new Error('每日消耗量必须是有效的非负数');
                }
                item[field] = this.round(Math.max(0, numValue), 3);
            } else if (field === 'unitWeight') {
                const numValue = parseFloat(value);
                if (!isFinite(numValue) || numValue < 0) {
                    throw new Error('单位重量必须是有效的非负数');
                }
                item[field] = this.round(Math.max(0, numValue), 4);
            } else if (field === 'unitVolume') {
                const numValue = parseFloat(value);
                if (!isFinite(numValue) || numValue < 0) {
                    throw new Error('单位体积必须是有效的非负数');
                }
                item[field] = this.round(Math.max(0, numValue), 4);
            } else {
                const numValue = parseFloat(value);
                if (isFinite(numValue)) {
                    item[field] = this.round(Math.max(0, numValue), 2);
                }
            }
            this.clearCache();
        }
    }

    /**
     * 删除物品
     * @param {number} id - 物品ID
     */
    removeItem(id) {
        this.items = this.items.filter(i => i.id !== id);
        this.clearCache();
    }

    /**
     * 清空所有物品
     */
    clearAllItems() {
        this.items = [];
        this.clearCache();
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

            const loadAmount = Math.floor(required);
            
            if (loadAmount <= 0) {
                continue;
            }
            
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

        if (this.loadCache.size >= this.maxLoadCacheSize) {
            const firstKey = this.loadCache.keys().next().value;
            this.loadCache.delete(firstKey);
        }

        this.loadCache.set(cacheKey, result);
        return result;
    }

    /**
     * 使用存储的物品列表进行优化
     * @param {number} weight - 重量容量
     * @param {number} volume - 体积容量
     * @returns {Object} 优化结果
     */
    optimize(weight, volume) {
        return this.optimizeWithItems(this.items, weight, volume);
    }

    /**
     * 使用指定的物品列表进行优化
     * @param {Item[]} items - 物品列表
     * @param {number} weight - 重量容量
     * @param {number} volume - 体积容量
     * @returns {Object} 优化结果
     */
    optimizeWithItems(items, weight, volume) {
        if (!isFinite(weight) || weight <= 0 ||
            !isFinite(volume) || volume <= 0) {
            throw new Error('容量必须是有效的正数');
        }

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

        const inventoryDays = validItems.map(item => {
            return item.dailyConsume > 0 ? item.inventory / item.dailyConsume : 0;
        });

        const currentMaxDays = Math.max(...inventoryDays);

        const totalDailyWeight = validItems.reduce((sum, item) => sum + (item.dailyConsume * item.unitWeight), 0);
        const totalDailyVolume = validItems.reduce((sum, item) => sum + (item.dailyConsume * item.unitVolume), 0);

        const weightBasedDays = totalDailyWeight > 0 ? weight / totalDailyWeight : 100;
        const volumeBasedDays = totalDailyVolume > 0 ? volume / totalDailyVolume : 100;

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

            if (result.totalWeight <= weight && result.totalVolume <= volume) {
                const weightRate = result.totalWeight / weight;
                const volumeRate = result.totalVolume / volume;
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

        const fallbackIncrement = config.FALLBACK_DAYS_INCREMENT || 1;
        if (!bestLoad || bestLoad.length === 0) {
            const fallbackDays = Math.max(minSearchDays, currentMaxDays + fallbackIncrement);
            const result = this.calculateLoadForDays(validItems, fallbackDays);
            bestLoad = result.load;
            bestDays = fallbackDays;
            bestFillRate = Math.max(result.totalWeight / weight, result.totalVolume / volume);
        }

        const finalResult = this.calculateLoadForDays(validItems, bestDays);

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
        this.loadCache.clear();
    }
}

export { CargoOptimizerCore };
