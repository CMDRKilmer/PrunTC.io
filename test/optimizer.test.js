/**
 * 优化器核心功能测试
 */

import CargoOptimizer from '../src/core/optimizers/CargoOptimizer.js';
import MTCOptimizer from '../src/core/optimizers/MTCOptimizer.js';

// 测试 CargoOptimizer
console.log('=== 测试 CargoOptimizer ===');
const cargoOptimizer = new CargoOptimizer();

// 添加测试物品
cargoOptimizer.addItem('GRN', 875, 187.5, 0.9, 1.0);
cargoOptimizer.addItem('NUT', 965, 187.5, 0.9, 1.0);
cargoOptimizer.addItem('MUS', 853, 187.5, 0.8, 1.0);
cargoOptimizer.addItem('DW', 224, 44.8, 0.1, 0.1);
cargoOptimizer.addItem('OVE', 28, 5.6, 0.02, 0.025);
cargoOptimizer.addItem('COF', 28, 5.6, 0.1, 0.1);
cargoOptimizer.addItem('PWO', 11, 2.24, 0.05, 0.05);

// 测试优化功能
console.log('测试 SCB 小型货舱 (500t/500m³)');
try {
    const result = cargoOptimizer.optimize(500, 500);
    console.log('优化结果:', {
        optimalDays: result.optimalDays.toFixed(2),
        fillRate: (result.fillRate * 100).toFixed(2) + '%',
        totalWeight: result.totalWeight.toFixed(2),
        totalVolume: result.totalVolume.toFixed(2),
        loadCount: result.load.length
    });
    console.log('测试通过: CargoOptimizer 优化功能正常');
} catch (error) {
    console.error('测试失败: CargoOptimizer 优化功能异常:', error);
}

// 测试 MTCOptimizer
console.log('\n=== 测试 MTCOptimizer ===');

// 测试物品数据
const testItems = [
    { code: 'BBH', name: 'BBH', qty: 10, unitWeight: 0.5, unitVolume: 0.8, totalWeight: 5, totalVolume: 8 },
    { code: 'BDE', name: 'BDE', qty: 10, unitWeight: 0.1, unitVolume: 1.5, totalWeight: 1, totalVolume: 15 },
    { code: 'BSE', name: 'BSE', qty: 6, unitWeight: 0.3, unitVolume: 0.5, totalWeight: 1.8, totalVolume: 3 },
    { code: 'BTA', name: 'BTA', qty: 4, unitWeight: 0.3, unitVolume: 0.4, totalWeight: 1.2, totalVolume: 1.6 },
    { code: 'INS', name: 'INS', qty: 4940, unitWeight: 0.06, unitVolume: 0.1, totalWeight: 296.4, totalVolume: 494 },
    { code: 'LBH', name: 'LBH', qty: 56, unitWeight: 0.2, unitVolume: 0.6, totalWeight: 11.2, totalVolume: 33.6 },
    { code: 'LDE', name: 'LDE', qty: 80, unitWeight: 0.1, unitVolume: 1.2, totalWeight: 8, totalVolume: 96 },
    { code: 'LSE', name: 'LSE', qty: 100, unitWeight: 0.3, unitVolume: 1.2, totalWeight: 30, totalVolume: 120 },
    { code: 'LTA', name: 'LTA', qty: 42, unitWeight: 0.3, unitVolume: 0.5, totalWeight: 12.6, totalVolume: 21 },
    { code: 'MCG', name: 'MCG', qty: 1976, unitWeight: 0.24, unitVolume: 0.1, totalWeight: 474.24, totalVolume: 197.6 },
    { code: 'RSE', name: 'RSE', qty: 2, unitWeight: 1.9, unitVolume: 0.7, totalWeight: 3.8, totalVolume: 1.4 },
    { code: 'RTA', name: 'RTA', qty: 4, unitWeight: 1.5, unitVolume: 0.5, totalWeight: 6, totalVolume: 2 },
    { code: 'TRU', name: 'TRU', qty: 80, unitWeight: 0.1, unitVolume: 1.5, totalWeight: 8, totalVolume: 120 }
];

// 测试最少运输次数计算
console.log('测试 SCB 小型货舱 (500t/500m³)');
try {
    const result = MTCOptimizer.optimizeTrips(testItems, 500, 500);
    console.log('优化结果:', {
        totalTrips: result.totalTrips,
        totalItems: result.totalItems,
        totalQty: result.totalQty,
        avgUtilization: result.avgUtilization + '%'
    });
    console.log('测试通过: MTCOptimizer 优化功能正常');
} catch (error) {
    console.error('测试失败: MTCOptimizer 优化功能异常:', error);
}

console.log('\n=== 测试完成 ===');
