/**
 * 随机数据测试脚本 - 测试各船型运算
 * @author CMDRKilmer
 * @version 1.0
 */

// 船舱类型数据
const shipTypes = {
    "TCB": { name: "TCB 微型货舱", weight: 100, volume: 100 },
    "VSC": { name: "VSC 超小型货舱", weight: 250, volume: 250 },
    "SCB": { name: "SCB 小型货舱", weight: 500, volume: 500 },
    "MCB": { name: "MCB 中型货舱", weight: 1000, volume: 1000 },
    "LCB": { name: "LCB 大型货舱", weight: 2000, volume: 2000 },
    "HCB": { name: "HCB 超大型货舱", weight: 5000, volume: 5000 },
    "VCB": { name: "VCB 高容积货舱", weight: 1000, volume: 3000 },
    "WCB": { name: "WCB 高负荷货舱", weight: 3000, volume: 1000 }
};

// 动态加载data.js
const fs = require('fs');
const path = require('path');

// 读取并解析data.js
const dataJsPath = path.join(__dirname, 'data.js');
const dataJsContent = fs.readFileSync(dataJsPath, 'utf8');

// 提取materialDB对象
const materialDBMatch = dataJsContent.match(/const materialDB = \{[\s\S]*?^\};/m);
let materialDB = {};

if (materialDBMatch) {
    // 使用Function构造器安全地解析对象
    const extractFunc = new Function('return ' + materialDBMatch[0].replace('const materialDB = ', ''));
    materialDB = extractFunc();
}

/**
 * 高精度数值舍入
 */
function round(num, decimals = 2) {
    if (!isFinite(num)) return 0;
    const factor = Math.pow(10, decimals);
    return Math.round((num + Number.EPSILON) * factor) / factor;
}

/**
 * 货舱优化器类
 */
class CargoOptimizer {
    constructor() {
        this.items = [];
        this.nextId = 1;
    }

    addItem(code = '', inventory = 0, dailyConsume = 0, unitWeight = 0, unitVolume = 0) {
        const id = this.nextId++;
        this.items.push({
            id,
            code: code.toUpperCase(),
            inventory: round(Math.max(0, inventory)),
            dailyConsume: round(Math.max(0, dailyConsume), 3),
            unitWeight: round(Math.max(0, unitWeight), 4),
            unitVolume: round(Math.max(0, unitVolume), 4)
        });
        return this.items[this.items.length - 1];
    }

    optimize(capacityWeight, capacityVolume) {
        const validItems = this.items.filter(i => i.code && i.dailyConsume > 0);
        if (validItems.length === 0) return null;

        const inventoryDays = validItems.map(item => item.inventory / item.dailyConsume);
        const minDays = Math.max(...inventoryDays);
        
        const totalDailyWeight = validItems.reduce((sum, item) => sum + (item.dailyConsume * item.unitWeight), 0);
        const totalDailyVolume = validItems.reduce((sum, item) => sum + (item.dailyConsume * item.unitVolume), 0);
        
        const weightBasedDays = totalDailyWeight > 0 ? capacityWeight / totalDailyWeight : 100;
        const volumeBasedDays = totalDailyVolume > 0 ? capacityVolume / totalDailyVolume : 100;
        
        const maxSearchDays = Math.max(minDays + 100, minDays * 3, weightBasedDays + 50, volumeBasedDays + 50, 1);
        const precision = 0.001;

        let bestDays = minDays;
        let bestFillRate = 0;

        let left = Math.max(0.001, minDays - 10);
        let right = maxSearchDays;
        let iterations = 0;
        const maxIterations = 500;

        while (right - left > precision && iterations < maxIterations) {
            iterations++;
            const mid = round((left + right) / 2, 6);
            const result = this.calculateLoadForDays(validItems, mid);

            if (result.totalWeight <= capacityWeight && result.totalVolume <= capacityVolume) {
                const fillRate = Math.max(result.totalWeight / capacityWeight, result.totalVolume / capacityVolume);
                if (fillRate > bestFillRate) {
                    bestFillRate = fillRate;
                    bestDays = mid;
                }
                left = mid;
            } else {
                right = mid;
            }
        }

        const finalResult = this.calculateLoadForDays(validItems, bestDays);
        return {
            optimalDays: round(bestDays, 3),
            fillRate: round(bestFillRate, 6),
            totalWeight: round(finalResult.totalWeight, 2),
            totalVolume: round(finalResult.totalVolume, 2)
        };
    }

    calculateLoadForDays(validItems, days) {
        let totalWeight = 0;
        let totalVolume = 0;

        for (const item of validItems) {
            if (item.dailyConsume <= 0) continue;
            const targetInventory = days * item.dailyConsume;
            const required = targetInventory - item.inventory;
            if (required <= 0) continue;

            const loadAmount = Math.ceil(required);
            totalWeight += loadAmount * item.unitWeight;
            totalVolume += loadAmount * item.unitVolume;
        }

        return { totalWeight: round(totalWeight, 4), totalVolume: round(totalVolume, 4) };
    }
}

// 测试配置
const TEST_CONFIG = {
    numTestsPerShip: 10,
    minItems: 3,
    maxItems: 8,
    minInventory: 100,
    maxInventory: 1000,
    minDailyConsume: 10,
    maxDailyConsume: 100
};

const materialCodes = Object.keys(materialDB);
const shipTypeCodes = Object.keys(shipTypes);

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRandomItems(count) {
    const items = [];
    const usedCodes = new Set();
    
    for (let i = 0; i < count; i++) {
        let code;
        do {
            code = materialCodes[randomInt(0, materialCodes.length - 1)];
        } while (usedCodes.has(code));
        
        usedCodes.add(code);
        const material = materialDB[code];
        
        items.push({
            code: code,
            inventory: randomInt(TEST_CONFIG.minInventory, TEST_CONFIG.maxInventory),
            dailyConsume: randomInt(TEST_CONFIG.minDailyConsume, TEST_CONFIG.maxDailyConsume),
            unitWeight: material.weight,
            unitVolume: material.volume
        });
    }
    
    return items;
}

function testPrunTC(shipType, shipConfig) {
    const results = [];
    
    for (let i = 0; i < TEST_CONFIG.numTestsPerShip; i++) {
        const optimizer = new CargoOptimizer();
        const numItems = randomInt(TEST_CONFIG.minItems, TEST_CONFIG.maxItems);
        const items = generateRandomItems(numItems);
        
        items.forEach(item => {
            optimizer.addItem(item.code, item.inventory, item.dailyConsume, item.unitWeight, item.unitVolume);
        });
        
        try {
            const result = optimizer.optimize(shipConfig.weight, shipConfig.volume);
            
            if (result) {
                results.push({
                    testNum: i + 1,
                    success: true,
                    items: numItems,
                    optimalDays: result.optimalDays,
                    fillRate: (result.fillRate * 100).toFixed(2) + '%',
                    weight: result.totalWeight.toFixed(1),
                    volume: result.totalVolume.toFixed(1),
                    valid: result.totalWeight <= shipConfig.weight && result.totalVolume <= shipConfig.volume
                });
            } else {
                results.push({ testNum: i + 1, success: false, items: numItems, error: '无解' });
            }
        } catch (error) {
            results.push({ testNum: i + 1, success: false, items: numItems, error: error.message });
        }
    }
    
    return results;
}

function testMTC(shipType, shipConfig) {
    const results = [];
    
    for (let i = 0; i < TEST_CONFIG.numTestsPerShip; i++) {
        const numItems = randomInt(TEST_CONFIG.minItems, TEST_CONFIG.maxItems);
        const items = generateRandomItems(numItems);
        
        const mtcItems = items.map(item => ({
            code: item.code,
            qty: randomInt(100, 1000),
            unitWeight: item.unitWeight,
            unitVolume: item.unitVolume
        }));
        
        const totalQty = mtcItems.reduce((sum, item) => sum + item.qty, 0);
        const totalWeight = mtcItems.reduce((sum, item) => sum + (item.qty * item.unitWeight), 0);
        const totalVolume = mtcItems.reduce((sum, item) => sum + (item.qty * item.unitVolume), 0);
        
        const minTripsByWeight = Math.ceil(totalWeight / shipConfig.weight);
        const minTripsByVolume = Math.ceil(totalVolume / shipConfig.volume);
        const minTrips = Math.max(minTripsByWeight, minTripsByVolume);
        
        results.push({
            testNum: i + 1,
            success: true,
            items: numItems,
            totalQty: totalQty,
            totalWeight: totalWeight.toFixed(1),
            totalVolume: totalVolume.toFixed(1),
            minTrips: minTrips
        });
    }
    
    return results;
}

function printTable(title, headers, rows) {
    const colWidths = headers.map((h, i) => {
        const maxDataWidth = Math.max(...rows.map(r => String(r[i]).length));
        return Math.max(h.length, maxDataWidth) + 2;
    });
    
    const line = '+' + colWidths.map(w => '-'.repeat(w)).join('+') + '+';
    
    console.log('\n' + title);
    console.log(line);
    console.log('|' + headers.map((h, i) => ' ' + h.padEnd(colWidths[i] - 1)).join('|') + '|');
    console.log(line);
    
    rows.forEach(row => {
        console.log('|' + row.map((cell, i) => ' ' + String(cell).padEnd(colWidths[i] - 1)).join('|') + '|');
    });
    
    console.log(line);
}

function runTests() {
    console.log('='.repeat(100));
    console.log('🚀 普罗恩运输计算器 - 随机数据测试');
    console.log(`测试配置: 每种船型${TEST_CONFIG.numTestsPerShip}次, 物品${TEST_CONFIG.minItems}-${TEST_CONFIG.maxItems}种`);
    console.log(`材料库: ${materialCodes.length} 种材料`);
    console.log('='.repeat(100));
    
    // 补给运输计算器测试
    console.log('\n📦 补给运输计算器 (PrunTC)');
    let pruntcAllResults = [];
    
    shipTypeCodes.forEach(shipType => {
        const shipConfig = shipTypes[shipType];
        const results = testPrunTC(shipType, shipConfig);
        pruntcAllResults.push(...results.map(r => ({ ...r, shipType, shipName: shipConfig.name })));
        
        const rows = results.map(r => [
            r.testNum,
            r.success ? '✅' : '❌',
            r.items,
            r.success ? r.optimalDays : '-',
            r.success ? r.fillRate : '-',
            r.success ? `${r.weight}/${shipConfig.weight}` : '-',
            r.success ? `${r.volume}/${shipConfig.volume}` : '-',
            r.success ? (r.valid ? '✓' : '✗') : r.error
        ]);
        
        printTable(
            `\n🚢 ${shipConfig.name} (${shipType}) - ${shipConfig.weight}t/${shipConfig.volume}m³`,
            ['测试', '状态', '物品数', '天数', '填充率', '重量(t)', '体积(m³)', '验证'],
            rows
        );
    });
    
    const pruntcPass = pruntcAllResults.filter(r => r.success).length;
    const pruntcFail = pruntcAllResults.filter(r => !r.success).length;
    
    // 最少次数运输计算器测试
    console.log('\n\n🚚 最少次数运输计算器 (MTC)');
    let mtcAllResults = [];
    
    shipTypeCodes.forEach(shipType => {
        const shipConfig = shipTypes[shipType];
        const results = testMTC(shipType, shipConfig);
        mtcAllResults.push(...results.map(r => ({ ...r, shipType, shipName: shipConfig.name })));
        
        const rows = results.map(r => [
            r.testNum,
            '✅',
            r.items,
            r.totalQty,
            r.totalWeight,
            r.totalVolume,
            r.minTrips
        ]);
        
        printTable(
            `\n🚢 ${shipConfig.name} (${shipType}) - ${shipConfig.weight}t/${shipConfig.volume}m³`,
            ['测试', '状态', '物品数', '总数量', '总重量(t)', '总体积(m³)', '最少次数'],
            rows
        );
    });
    
    const mtcPass = mtcAllResults.filter(r => r.success).length;
    const mtcFail = mtcAllResults.filter(r => !r.success).length;
    
    // 汇总
    console.log('\n\n' + '='.repeat(100));
    console.log('📊 测试结果汇总');
    console.log('='.repeat(100));
    
    const summaryRows = [
        ['补给运输计算器 (PrunTC)', `${pruntcPass}/${pruntcPass + pruntcFail}`, `${(pruntcPass / (pruntcPass + pruntcFail) * 100).toFixed(1)}%`],
        ['最少次数运输计算器 (MTC)', `${mtcPass}/${mtcPass + mtcFail}`, `${(mtcPass / (mtcPass + mtcFail) * 100).toFixed(1)}%`],
        ['总计', `${pruntcPass + mtcPass}/${pruntcPass + pruntcFail + mtcPass + mtcFail}`, `${((pruntcPass + mtcPass) / (pruntcPass + pruntcFail + mtcPass + mtcFail) * 100).toFixed(1)}%`]
    ];
    
    printTable('', ['功能模块', '通过/总计', '通过率'], summaryRows);
    console.log('='.repeat(100));
}

runTests();
