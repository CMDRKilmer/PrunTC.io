// 全局变量
let items = [];
let nextId = 1;

// 页面加载完成后初始化
window.onload = function() {
    // 设置默认船舱类型
    document.getElementById('shipType').value = 'SCB';
    updateShipCapacity();
};

// 更新船舱容量
function updateShipCapacity() {
    const shipType = document.getElementById('shipType').value;
    if (shipType && shipTypes[shipType]) {
        document.getElementById('capacityWeight').value = shipTypes[shipType].weight;
        document.getElementById('capacityVolume').value = shipTypes[shipType].volume;
    }
}

// 验证容量输入
function validateCapacityInput(type) {
    const shipType = document.getElementById('shipType').value;
    if (shipType && shipTypes[shipType]) {
        if (type === 'weight') {
            const input = document.getElementById('capacityWeight');
            const value = parseFloat(input.value);
            if (value > shipTypes[shipType].weight) {
                input.value = shipTypes[shipType].weight;
            }
        } else if (type === 'volume') {
            const input = document.getElementById('capacityVolume');
            const value = parseFloat(input.value);
            if (value > shipTypes[shipType].volume) {
                input.value = shipTypes[shipType].volume;
            }
        }
    }
}

// 自动匹配材料
function autoMatchMaterial(id, code) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    
    const dbItem = materialDB[code];
    if (dbItem) {
        item.unitWeight = dbItem.weight;
        item.unitVolume = dbItem.volume;
        
        // 更新输入框的值
        const row = document.querySelector(`[data-id="${id}"]`);
        if (row) {
            const weightInput = row.querySelector('[data-field="unitWeight"]');
            const volumeInput = row.querySelector('[data-field="unitVolume"]');
            const hint = document.getElementById('matchHint');
            
            if (weightInput) weightInput.value = dbItem.weight;
            if (volumeInput) volumeInput.value = dbItem.volume;
            if (hint) {
                hint.textContent = '✓ 已自动匹配';
                setTimeout(() => { hint.textContent = ''; }, 2000);
            }
        }
    } else {
        const hint = document.getElementById('matchHint');
        if (hint) {
            hint.textContent = '⚠ 未找到材料';
            setTimeout(() => { hint.textContent = ''; }, 2000);
        }
    }
}

// 添加物品
function addItem(code, inventory, dailyConsume, unitWeight, unitVolume) {
    const id = nextId++;
    const newItem = {
        id: id,
        code: code || '',
        inventory: inventory || 0,
        dailyConsume: dailyConsume || 0,
        unitWeight: unitWeight || 0,
        unitVolume: unitVolume || 0
    };
    items.push(newItem);
    renderItems();
}

// 渲染物品列表
function renderItems() {
    const container = document.getElementById('itemContainer');
    container.innerHTML = '';
    document.getElementById('itemCount').textContent = items.length + ' 种物品';
    
    items.forEach((item) => {
        const div = document.createElement('div');
        div.className = 'item-input-row';
        div.setAttribute('data-id', item.id);
        div.innerHTML = `
            <div class="form-group">
                <input type="text" placeholder="如: GRN" value="${item.code}" 
                    onchange="updateItem(${item.id}, 'code', this.value.toUpperCase())" 
                    onblur="autoMatchMaterial(${item.id}, this.value.toUpperCase())" 
                    style="text-transform: uppercase; font-weight: bold;">
            </div>
            <div class="form-group">
                <input type="number" placeholder="库存" value="${item.inventory}" 
                    onchange="updateItem(${item.id}, 'inventory', parseFloat(this.value) || 0)" min="0">
            </div>
            <div class="form-group">
                <input type="number" placeholder="每日消耗" value="${item.dailyConsume}" 
                    onchange="updateItem(${item.id}, 'dailyConsume', parseFloat(this.value) || 0)" min="0" step="0.01">
            </div>
            <div class="form-group">
                <input type="number" placeholder="单位重量" value="${item.unitWeight}" 
                    data-field="unitWeight"
                    onchange="updateItem(${item.id}, 'unitWeight', parseFloat(this.value) || 0)" 
                    step="0.001" min="0" readonly>
            </div>
            <div class="form-group">
                <input type="number" placeholder="单位体积" value="${item.unitVolume}" 
                    data-field="unitVolume"
                    onchange="updateItem(${item.id}, 'unitVolume', parseFloat(this.value) || 0)" 
                    step="0.001" min="0" readonly>
            </div>
            <div class="form-group">
                <button class="btn btn-danger" onclick="removeItem(${item.id})")">删除</button>
            </div>
        `;
        container.appendChild(div);
    });
}

// 更新物品信息
function updateItem(id, field, value) {
    const item = items.find(i => i.id === id);
    if (item) {
        item[field] = value;
    }
}

// 删除物品
function removeItem(id) {
    items = items.filter(i => i.id !== id);
    renderItems();
}

// 优化装载方案
function optimize() {
    const capacityWeight = parseFloat(document.getElementById('capacityWeight').value) || 2000;
    const capacityVolume = parseFloat(document.getElementById('capacityVolume').value) || 2000;
    
    if (items.length === 0) {
        alert('请添加物品！');
        return;
    }
    
    const validItems = items.filter(i => i.code && i.dailyConsume > 0);
    if (validItems.length === 0) {
        alert('请输入有效的物品代码和每日消耗量！');
        return;
    }
    
    // 计算初始库存天数
    const inventoryDays = validItems.map(item => item.inventory / item.dailyConsume);
    const minDays = Math.max(...inventoryDays);
    
    console.log('初始库存天数:', inventoryDays);
    console.log('最小天数:', minDays);
    console.log('船舱容量:', { capacityWeight, capacityVolume });
    
    // 搜索最优平衡天数
    let bestDays = minDays;
    let bestFillRate = 0;
    let bestLoad = null;
    
    // 使用更精细的步长进行搜索
    const maxSearchDays = Math.max(minDays + 100, minDays * 3);
    const step = 0.001;
    
    console.log('搜索范围:', { minDays, maxSearchDays, step });
    
    for (let days = minDays; days <= maxSearchDays; days += step) {
        let totalWeight = 0;
        let totalVolume = 0;
        const load = [];
        
        for (const item of validItems) {
            const targetInventory = days * item.dailyConsume;
            const loadAmount = Math.max(0, targetInventory - item.inventory);
            const weight = loadAmount * item.unitWeight;
            const volume = loadAmount * item.unitVolume;
            
            totalWeight += weight;
            totalVolume += volume;
            
            load.push({
                code: item.code,
                loadAmount: loadAmount,
                weight: weight,
                volume: volume,
                targetInventory: item.inventory + loadAmount,
                days: days
            });
        }
        
        // 检查容量约束
        if (totalWeight > capacityWeight || totalVolume > capacityVolume) {
            continue;
        }
        
        // 计算填充率（按瓶颈资源）
        const weightRate = totalWeight / capacityWeight;
        const volumeRate = totalVolume / capacityVolume;
        const fillRate = Math.max(weightRate, volumeRate);
        
        if (fillRate > bestFillRate) {
            bestFillRate = fillRate;
            bestDays = days;
            bestLoad = load;
            console.log('找到更好的方案:', { days, fillRate, totalWeight, totalVolume });
        }
    }
    
    if (!bestLoad) {
        // 尝试降低最小天数，可能初始最小天数就超过了容量
        console.log('初始搜索未找到方案，尝试降低天数...');
        
        for (let days = minDays - 10; days < minDays; days += step) {
            if (days <= 0) break;
            
            let totalWeight = 0;
            let totalVolume = 0;
            const load = [];
            
            for (const item of validItems) {
                const targetInventory = days * item.dailyConsume;
                const loadAmount = Math.max(0, targetInventory - item.inventory);
                const weight = loadAmount * item.unitWeight;
                const volume = loadAmount * item.unitVolume;
                
                totalWeight += weight;
                totalVolume += volume;
                
                load.push({
                    code: item.code,
                    loadAmount: loadAmount,
                    weight: weight,
                    volume: volume,
                    targetInventory: item.inventory + loadAmount,
                    days: days
                });
            }
            
            // 检查容量约束
            if (totalWeight > capacityWeight || totalVolume > capacityVolume) {
                continue;
            }
            
            // 计算填充率（按瓶颈资源）
            const weightRate = totalWeight / capacityWeight;
            const volumeRate = totalVolume / capacityVolume;
            const fillRate = Math.max(weightRate, volumeRate);
            
            if (fillRate > bestFillRate) {
                bestFillRate = fillRate;
                bestDays = days;
                bestLoad = load;
                console.log('找到更好的方案:', { days, fillRate, totalWeight, totalVolume });
            }
        }
    }
    
    if (!bestLoad) {
        alert('无法找到满足约束的装载方案！请检查输入数据。');
        return;
    }
    
    // 重新计算最终结果
    let finalWeight = 0;
    let finalVolume = 0;
    const finalResults = [];
    
    for (const item of validItems) {
        const targetInventory = bestDays * item.dailyConsume;
        const loadAmount = Math.max(0, targetInventory - item.inventory);
        const weight = loadAmount * item.unitWeight;
        const volume = loadAmount * item.unitVolume;
        
        finalWeight += weight;
        finalVolume += volume;
        
        finalResults.push({
            code: item.code,
            loadAmount: Math.round(loadAmount),
            weight: weight,
            volume: volume,
            targetInventory: Math.round(item.inventory + loadAmount),
            days: bestDays
        });
    }
    
    const weightRate = finalWeight / capacityWeight;
    const volumeRate = finalVolume / capacityVolume;
    const bottleneck = weightRate > volumeRate ? '重量' : '体积';
    
    // 更新UI
    document.getElementById('optimalDays').textContent = bestDays.toFixed(2);
    document.getElementById('fillRate').textContent = (bestFillRate * 100).toFixed(2) + '%';
    document.getElementById('totalWeight').textContent = finalWeight.toFixed(2);
    document.getElementById('totalVolume').textContent = finalVolume.toFixed(2);
    
    document.getElementById('weightText').textContent = finalWeight.toFixed(2) + ' / ' + capacityWeight + ' t';
    document.getElementById('volumeText').textContent = finalVolume.toFixed(2) + ' / ' + capacityVolume + ' m³';
    document.getElementById('bottleneckText').textContent = bottleneck + ' (' + (Math.max(weightRate, volumeRate) * 100).toFixed(2) + '%)';
    
    document.getElementById('weightProgress').style.width = Math.min(weightRate * 100, 100) + '%';
    document.getElementById('volumeProgress').style.width = Math.min(volumeRate * 100, 100) + '%';
    document.getElementById('bottleneckProgress').style.width = Math.min(Math.max(weightRate, volumeRate) * 100, 100) + '%';
    
    // 渲染结果表格
    const resultList = document.getElementById('resultList');
    resultList.innerHTML = '';
    
    finalResults.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="highlight">${r.code}</span></td>
            <td>${r.loadAmount.toLocaleString()}</td>
            <td>${r.weight.toFixed(2)}</td>
            <td>${r.volume.toFixed(2)}</td>
            <td>${r.targetInventory.toLocaleString()}</td>
            <td>${r.days.toFixed(2)} 天</td>
        `;
        resultList.appendChild(tr);
    });
    
    // 显示结果卡片
    document.getElementById('resultCard').classList.add('show');
    document.getElementById('resultCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
