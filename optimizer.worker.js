/**
 * 货物优化 Web Worker
 * 处理计算密集型的装载优化任务
 */

// 导入工具函数（Worker 中需要独立实现）
function round(num, decimals) {
    return Number(num.toFixed(decimals || 2));
}

// 货物优化器类（Worker 版本）
class CargoOptimizerWorker {
    // 私有字段声明
    #loadCache;
    
    constructor() {
        this.cache = new Map();
        this.maxCacheSize = 50; // 增加缓存大小
        this.cacheAccessOrder = []; // 用于 LRU 缓存
        this.#loadCache = new Map(); // 装载计算缓存
    }

    /**
     * 生成更紧凑的缓存键
     * @param {number} capacityWeight - 重量容量
     * @param {number} capacityVolume - 体积容量
     * @param {Array} items - 物品数组
     * @returns {string} 缓存键
     */
    generateCacheKey(capacityWeight, capacityVolume, items) {
        // 使用更紧凑的格式，只包含关键信息
        const itemsKey = items
            .sort((a, b) => a.code.localeCompare(b.code)) // 排序确保顺序一致
            .map(i => `${i.code}:${i.inventory}:${i.dailyConsume}:${i.unitWeight}:${i.unitVolume}`)
            .join('|');
        
        // 使用哈希函数生成更短的键
        const hash = this.simpleHash(itemsKey);
        return `${capacityWeight}:${capacityVolume}:${hash}`;
    }

    /**
     * 简单哈希函数
     * @param {string} str - 输入字符串
     * @returns {number} 哈希值
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return Math.abs(hash);
    }

    /**
     * 设置缓存（LRU 策略）
     * @param {string} key - 缓存键
     * @param {OptimizeResult} value - 缓存值
     */
    setCache(key, value) {
        // 移除已存在的键（如果有）
        if (this.cache.has(key)) {
            const index = this.cacheAccessOrder.indexOf(key);
            if (index > -1) {
                this.cacheAccessOrder.splice(index, 1);
            }
        } else if (this.cache.size >= this.maxCacheSize) {
            // 删除最久未使用的项
            const lruKey = this.cacheAccessOrder.shift();
            if (lruKey) {
                this.cache.delete(lruKey);
            }
        }
        
        // 添加到缓存和访问顺序
        this.cache.set(key, value);
        this.cacheAccessOrder.push(key);
    }

    /**
     * 获取缓存（更新访问顺序）
     * @param {string} key - 缓存键
     * @returns {OptimizeResult|null} 缓存值
     */
    getCache(key) {
        if (this.cache.has(key)) {
            // 更新访问顺序
            const index = this.cacheAccessOrder.indexOf(key);
            if (index > -1) {
                this.cacheAccessOrder.splice(index, 1);
                this.cacheAccessOrder.push(key);
            }
            return this.cache.get(key);
        }
        return null;
    }

    /**
     * 计算特定天数的装载量
     * @param {Array} items - 物品数组
     * @param {number} days - 天数
     * @returns {Object} 装载结果
     */
    calculateLoadForDays(items, days) {
        // 生成更精确的缓存键
        const itemsKey = items
            .sort((a, b) => a.code.localeCompare(b.code))
            .map(i => `${i.code}:${i.inventory}:${i.dailyConsume}:${i.unitWeight}:${i.unitVolume}`)
            .join('|');
        const cacheKey = `load_${days.toFixed(6)}_${this.simpleHash(itemsKey)}`;
        
        // 检查缓存
        if (this.#loadCache.has(cacheKey)) {
            return this.#loadCache.get(cacheKey);
        }

        let totalWeight = 0;
        let totalVolume = 0;
        const load = [];

        for (const item of items) {
            const targetInventory = item.dailyConsume * days;
            const neededAmount = Math.max(0, targetInventory - item.inventory);

            if (neededAmount > 0) {
                const weight = neededAmount * item.unitWeight;
                const volume = neededAmount * item.unitVolume;

                totalWeight += weight;
                totalVolume += volume;

                load.push({
                    code: item.code,
                    loadAmount: Math.ceil(neededAmount),
                    weight: round(weight, 2),
                    volume: round(volume, 2),
                    targetInventory: Math.ceil(targetInventory),
                    days: round(days, 2)
                });
            }
        }

        const result = {
            totalWeight: round(totalWeight, 2),
            totalVolume: round(totalVolume, 2),
            load
        };

        // 缓存结果（限制大小）
        if (this.#loadCache.size >= 200) {
            const firstKey = this.#loadCache.keys().next().value;
            this.#loadCache.delete(firstKey);
        }
        this.#loadCache.set(cacheKey, result);

        return result;
    }

    /**
     * 优化装载方案
     * @param {Object} params - 优化参数
     * @returns {Object} 优化结果
     */
    optimize(params) {
        const { capacityWeight, capacityVolume, items } = params;

        // 检查缓存
        const cacheKey = this.generateCacheKey(capacityWeight, capacityVolume, items);
        const cachedResult = this.getCache(cacheKey);
        if (cachedResult) {
            return cachedResult;
        }

        // 验证容量
        if (!isFinite(capacityWeight) || capacityWeight <= 0 || 
            !isFinite(capacityVolume) || capacityVolume <= 0) {
            throw new Error('容量必须是有效的正数');
        }

        const validItems = items.filter(i => i.code && i.dailyConsume > 0);
        
        if (validItems.length === 0) {
            return null;
        }

        // 计算初始库存天数
        const inventoryDays = validItems.map(item => {
            if (item.dailyConsume <= 0) return 0;
            return item.inventory / item.dailyConsume;
        });
        
        const minDays = Math.max(...inventoryDays);
        
        // 优化搜索范围：基于容量和物品消耗率自动计算
        const totalDailyWeight = validItems.reduce((sum, item) => sum + (item.dailyConsume * item.unitWeight), 0);
        const totalDailyVolume = validItems.reduce((sum, item) => sum + (item.dailyConsume * item.unitVolume), 0);
        
        const weightBasedDays = totalDailyWeight > 0 ? capacityWeight / totalDailyWeight : 100;
        const volumeBasedDays = totalDailyVolume > 0 ? capacityVolume / totalDailyVolume : 100;
        
        const maxSearchDays = Math.max(
            minDays + 100,
            minDays * 3,
            weightBasedDays + 50,
            volumeBasedDays + 50,
            1
        );
        
        const precision = 0.001;
        const earlyTerminationThreshold = 0.999; // 99.9% 填充率时提前终止

        let bestDays = minDays;
        let bestFillRate = 0;
        let bestLoad = null;

        let left = Math.max(0.001, minDays - 10);
        let right = maxSearchDays;
        let iterations = 0;
        const maxIterations = 500; // 减少最大迭代次数

        while (right - left > precision && iterations < maxIterations) {
            iterations++;
            const mid = round((left + right) / 2, 6);
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

                // 提前终止：当填充率达到阈值时
                if (fillRate >= earlyTerminationThreshold) {
                    break;
                }

                left = mid;
            } else {
                right = mid;
            }
        }

        // 回退方案
        if (!bestLoad) {
            const fallbackDays = Math.max(0.001, minDays - 10);
            const result = this.calculateLoadForDays(validItems, fallbackDays);
            bestLoad = result.load;
            bestDays = fallbackDays;
            bestFillRate = Math.max(result.totalWeight / capacityWeight, result.totalVolume / capacityVolume);
        }

        // 计算最终结果
        const finalResult = this.calculateLoadForDays(validItems, bestDays);
        
        const result = {
            optimalDays: round(bestDays, 3),
            fillRate: round(bestFillRate, 6),
            totalWeight: round(finalResult.totalWeight, 2),
            totalVolume: round(finalResult.totalVolume, 2),
            load: finalResult.load
        };

        // 缓存结果
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(cacheKey, result);

        return result;
    }
}

const optimizer = new CargoOptimizerWorker();

// 监听消息
self.addEventListener('message', (event) => {
    const { id, action, params } = event.data;
    
    try {
        let result;
        
        switch (action) {
            case 'optimize':
                result = optimizer.optimize(params);
                break;
            default:
                throw new Error('Unknown action');
        }
        
        self.postMessage({ id, success: true, result });
    } catch (error) {
        self.postMessage({ id, success: false, error: error.message });
    }
});