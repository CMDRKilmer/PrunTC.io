/**
 * 性能测试脚本
 * 测试重构前后的代码性能
 */

const CargoOptimizer = require('../src/core/optimizers/CargoOptimizer.js');
const MTCOptimizer = require('../src/core/optimizers/MTCOptimizer.js');

// 测试数据
const testItems = [
    { code: 'GRN', inventory: 875, dailyConsume: 187.5, unitWeight: 0.9, unitVolume: 1.0 },
    { code: 'NUT', inventory: 965, dailyConsume: 187.5, unitWeight: 0.9, unitVolume: 1.0 },
    { code: 'MUS', inventory: 853, dailyConsume: 187.5, unitWeight: 0.8, unitVolume: 1.0 },
    { code: 'DW', inventory: 224, dailyConsume: 44.8, unitWeight: 0.1, unitVolume: 0.1 },
    { code: 'OVE', inventory: 28, dailyConsume: 5.6, unitWeight: 0.02, unitVolume: 0.025 },
    { code: 'COF', inventory: 28, dailyConsume: 5.6, unitWeight: 0.1, unitVolume: 0.1 },
    { code: 'PWO', inventory: 11, dailyConsume: 2.24, unitWeight: 0.05, unitVolume: 0.05 }
];

const mtcTestItems = [
    { code: 'BBH', qty: 10, unitWeight: 0.5, unitVolume: 0.8 },
    { code: 'BDE', qty: 10, unitWeight: 0.1, unitVolume: 1.5 },
    { code: 'BSE', qty: 6, unitWeight: 0.3, unitVolume: 0.5 },
    { code: 'BTA', qty: 4, unitWeight: 0.3, unitVolume: 0.4 },
    { code: 'INS', qty: 4940, unitWeight: 0.06, unitVolume: 0.1 },
    { code: 'LBH', qty: 56, unitWeight: 0.2, unitVolume: 0.6 },
    { code: 'LDE', qty: 80, unitWeight: 0.1, unitVolume: 1.2 },
    { code: 'LSE', qty: 100, unitWeight: 0.3, unitVolume: 1.2 },
    { code: 'LTA', qty: 42, unitWeight: 0.3, unitVolume: 0.5 },
    { code: 'MCG', qty: 1976, unitWeight: 0.24, unitVolume: 0.1 },
    { code: 'RSE', qty: 2, unitWeight: 1.9, unitVolume: 0.7 },
    { code: 'RTA', qty: 4, unitWeight: 1.5, unitVolume: 0.5 },
    { code: 'TRU', qty: 80, unitWeight: 0.1, unitVolume: 1.5 }
];

const capacity = {
    weight: 500,
    volume: 500
};

/**
 * 测量函数执行时间
 * @param {Function} fn - 要执行的函数
 * @param {string} name - 测试名称
 * @returns {number} 执行时间（毫秒）
 */
function measureTime(fn, name) {
    const start = performance.now();
    fn();
    const end = performance.now();
    const time = end - start;
    console.log(`${name}: ${time.toFixed(2)}ms`);
    return time;
}

/**
 * 测量内存使用
 * @param {Function} fn - 要执行的函数
 * @param {string} name - 测试名称
 * @returns {object} 内存使用情况
 */
function measureMemory(fn, name) {
    if (typeof process !== 'undefined' && process.memoryUsage) {
        const start = process.memoryUsage();
        fn();
        const end = process.memoryUsage();
        const rss = end.rss - start.rss;
        const heapTotal = end.heapTotal - start.heapTotal;
        const heapUsed = end.heapUsed - start.heapUsed;
        console.log(`${name} 内存使用:`);
        console.log(`  RSS: ${(rss / 1024 / 1024).toFixed(2)}MB`);
        console.log(`  Heap Total: ${(heapTotal / 1024 / 1024).toFixed(2)}MB`);
        console.log(`  Heap Used: ${(heapUsed / 1024 / 1024).toFixed(2)}MB`);
        return { rss, heapTotal, heapUsed };
    } else {
        console.log(`${name}: 内存测量不可用`);
        fn();
        return null;
    }
}

/**
 * 性能测试
 */
function runPerformanceTests() {
    console.log('=== 性能测试 ===\n');

    // 测试 CargoOptimizer
    console.log('1. CargoOptimizer 性能测试');
    const cargoOptimizer = new CargoOptimizer();
    testItems.forEach(item => {
        cargoOptimizer.addItem(item.code, item.inventory, item.dailyConsume, item.unitWeight, item.unitVolume);
    });

    // 测试计算速度
    console.log('\n计算速度测试:');
    const cargoTime = measureTime(() => {
        for (let i = 0; i < 100; i++) {
            cargoOptimizer.optimize(capacity.weight, capacity.volume);
        }
    }, 'CargoOptimizer 100次计算');

    // 测试内存使用
    console.log('\n内存使用测试:');
    measureMemory(() => {
        for (let i = 0; i < 1000; i++) {
            cargoOptimizer.optimize(capacity.weight, capacity.volume);
        }
    }, 'CargoOptimizer 1000次计算');

    // 测试 MTCOptimizer
    console.log('\n2. MTCOptimizer 性能测试');

    // 测试计算速度
    console.log('\n计算速度测试:');
    const mtcTime = measureTime(() => {
        for (let i = 0; i < 100; i++) {
            MTCOptimizer.optimizeTrips(mtcTestItems, capacity.weight, capacity.volume);
        }
    }, 'MTCOptimizer 100次计算');

    // 测试内存使用
    console.log('\n内存使用测试:');
    measureMemory(() => {
        for (let i = 0; i < 1000; i++) {
            MTCOptimizer.optimizeTrips(mtcTestItems, capacity.weight, capacity.volume);
        }
    }, 'MTCOptimizer 1000次计算');

    // 测试结果汇总
    console.log('\n=== 性能测试结果 ===');
    console.log(`CargoOptimizer 平均计算时间: ${(cargoTime / 100).toFixed(4)}ms/次`);
    console.log(`MTCOptimizer 平均计算时间: ${(mtcTime / 100).toFixed(4)}ms/次`);
    console.log('\n性能测试完成！');
}

// 运行性能测试
if (typeof performance === 'undefined') {
    // Node.js 环境
    global.performance = require('perf_hooks').performance;
}

runPerformanceTests();
