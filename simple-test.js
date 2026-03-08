// 简化的性能测试

// 手动定义 Optimizer 类的核心部分进行测试
class TestOptimizer {
    constructor() {
        this.items = [];
        this.cache = new Map();
        this.#loadCache = new Map();
    }

    addItem(code, inventory, unitWeight, unitVolume, dailyConsume) {
        this.items.push({
            id: Date.now() + Math.random(),
            code,
            inventory,
            unitWeight,
            unitVolume,
            dailyConsume
        });
        this.clearCache();
    }

    clearCache() {
        this.cache.clear();
        this.#loadCache.clear();
    }

    generateCacheKey(weight, volume) {
        return `opt_${weight.toFixed(2)}_${volume.toFixed(2)}`;
    }

    // 缓存 calculateLoadForDays 结果
    #loadCache = new Map();

    calculateLoadForDays(validItems, days) {
        const cacheKey = `load_${days.toFixed(6)}`;
        if (this.#loadCache.has(cacheKey)) {
            return this.#loadCache.get(cacheKey);
        }

        let totalWeight = 0;
        let totalVolume = 0;
        const load = [];

        // 预计算常量值
        const daysFixed = this.round(days, 3);

        for (const item of validItems) {
            // 边界检查：跳过无效物品
            if (item.dailyConsume <= 0 || !isFinite(item.dailyConsume)) {
                continue;
            }

            const targetInventory = days * item.dailyConsume;
            
            // 防止数值溢出
            if (!isFinite(targetInventory) || targetInventory > 1e15) {
                continue;
            }

            const required = targetInventory - item.inventory;
            if (required <= 0) {
                // 不需要装载，跳过
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
        this.#loadCache.set(cacheKey, result);
        return result;
    }

    round(num, decimals = 2) {
        if (!isFinite(num)) return 0;
        return Number(num.toFixed(decimals));
    }

    optimize(capacityWeight, capacityVolume) {
        // 检查缓存
        const cacheKey = this.generateCacheKey(capacityWeight, capacityVolume);
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        // 验证容量
        if (!isFinite(capacityWeight) || capacityWeight <= 0 || 
            !isFinite(capacityVolume) || capacityVolume <= 0) {
            throw new Error('容量必须是有效的正数');
        }

        const validItems = this.items.filter(i => i.code && i.dailyConsume > 0);
        
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
            optimalDays: this.round(bestDays, 3),
            fillRate: this.round(bestFillRate, 6),
            totalWeight: this.round(finalResult.totalWeight, 2),
            totalVolume: this.round(finalResult.totalVolume, 2),
            load: finalResult.load
        };

        // 缓存结果
        this.cache.set(cacheKey, result);
        return result;
    }
}

// 测试代码
const optimizer = new TestOptimizer();

// 添加测试数据
optimizer.addItem('TEST1', 100, 2.5, 1.2, 5);
optimizer.addItem('TEST2', 200, 1.8, 0.8, 3);
optimizer.addItem('TEST3', 150, 3.2, 1.5, 7);
optimizer.addItem('TEST4', 50, 4.1, 2.0, 2);
optimizer.addItem('TEST5', 250, 1.5, 0.5, 4);

// 测试参数
const capacityWeight = 500;
const capacityVolume = 500;
const testRuns = 1000;

console.log('开始性能测试...');
console.log(`物品数量: ${optimizer.items.length}`);
console.log(`测试次数: ${testRuns}`);

// 预热
for (let i = 0; i < 10; i++) {
    optimizer.optimize(capacityWeight, capacityVolume);
}

// 测试性能
const startTime = Date.now();

for (let i = 0; i < testRuns; i++) {
    optimizer.optimize(capacityWeight, capacityVolume);
}

const endTime = Date.now();
const totalTime = endTime - startTime;
const averageTime = totalTime / testRuns;

console.log(`\n测试完成！`);
console.log(`总时间: ${totalTime}ms`);
console.log(`平均时间: ${averageTime.toFixed(3)}ms`);
console.log(`每秒处理: ${Math.round(1000 / averageTime)}次`);

// 测试不同容量
const capacities = [
    { weight: 300, volume: 300 },
    { weight: 500, volume: 500 },
    { weight: 1000, volume: 1000 }
];

console.log('\n不同容量测试:');
for (const cap of capacities) {
    const start = Date.now();
    for (let i = 0; i < 100; i++) {
        optimizer.optimize(cap.weight, cap.volume);
    }
    const end = Date.now();
    const avg = (end - start) / 100;
    console.log(`${cap.weight}t/${cap.volume}m³: ${avg.toFixed(3)}ms`);
}

console.log('\n性能测试完成！');
