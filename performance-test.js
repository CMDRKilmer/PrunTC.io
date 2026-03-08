// 性能测试脚本
// 加载 script.js 文件
const fs = require('fs');
eval(fs.readFileSync('script.js', 'utf8'));

const optimizer = new Optimizer();

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
