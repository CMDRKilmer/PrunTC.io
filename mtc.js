/**
 * 最少次数运输计算器 - MTC模块
 * @author CMDRKilmer
 * @version 1.0
 */

// MTC 全局状态
let mtcItems = [];
let mtcItemIdCounter = 0;

// 船舱类型名称映射
const shipTypeNames = {
    'TCB': 'TCB 微型货舱',
    'VSC': 'VSC 超小型货舱',
    'SCB': 'SCB 小型货舱',
    'MCB': 'MCB 中型货舱',
    'LCB': 'LCB 大型货舱',
    'HCB': 'HCB 巨型货舱',
    'VCB': 'VCB 高容积货舱',
    'WCB': 'WCB 高负荷货舱'
};

/**
 * MTC 统一的自动匹配函数（防抖200ms）
 */
const mtcAutoMatchCode = debounce(function(input, infoInput) {
    // 强制转换为大写
    input.value = input.value.toUpperCase();
    const code = input.value;
    
    if (code && typeof materialDB !== 'undefined' && materialDB[code]) {
        const data = materialDB[code];
        infoInput.value = `${data.weight}t / ${data.volume}m³`;
        input.style.borderColor = 'var(--primary-color)';
    } else {
        infoInput.value = '';
        input.style.borderColor = '';
    }
}, 200);

/**
 * MTC 更新船舱容量
 */
function mtcUpdateShipCapacity() {
    const shipType = document.getElementById('shipType').value;
    if (shipType && shipTypes[shipType]) {
        const config = shipTypes[shipType];
        document.getElementById('maxWeightInput').value = config.weight;
        document.getElementById('maxVolumeInput').value = config.volume;
        mtcUpdateConstraintDisplay();
    }
}

/**
 * MTC 更新限制条件显示
 */
function mtcUpdateConstraintDisplay() {
    const weight = parseFloat(document.getElementById('maxWeightInput').value) || 500;
    const volume = parseFloat(document.getElementById('maxVolumeInput').value) || 500;
    document.getElementById('maxWeight').textContent = weight;
    document.getElementById('maxVolume').textContent = volume;
}

/**
 * MTC 添加物品输入行
 */
function mtcAddItem() {
    const container = document.getElementById('itemsContainer');
    const itemId = mtcItemIdCounter++;
    
    const row = document.createElement('div');
    row.className = 'item-input-row';
    row.dataset.itemId = itemId;
    row.style.animation = 'fadeIn 0.3s ease';
    
    row.innerHTML = `
        <div class="form-group">
            <label>物品代码</label>
            <input type="text" id="itemCode-${itemId}" placeholder="如: MCG"
                oninput="mtcOnItemCodeInput(${itemId})" onchange="mtcOnItemCodeChange(${itemId})">
        </div>
        <div class="form-group">
            <label>数量</label>
            <input type="number" id="itemQty-${itemId}" min="1" step="1" placeholder="输入数量"
                onchange="mtcValidateQty(${itemId})" oninput="mtcValidateQty(${itemId})">
        </div>
        <div class="form-group">
            <label>单位重量/体积</label>
            <input type="text" id="itemInfo-${itemId}" readonly placeholder="自动填充"
                style="background: var(--bg-input-readonly); cursor: not-allowed;">
        </div>
        <button class="btn-remove-item" onclick="mtcRemoveItem(${itemId})" title="删除此物品">🗑️</button>
    `;
    
    container.appendChild(row);
    mtcUpdateItemCount();
}

/**
 * MTC 物品代码输入时自动匹配（使用防抖）
 */
function mtcOnItemCodeInput(itemId) {
    const input = document.getElementById(`itemCode-${itemId}`);
    const infoInput = document.getElementById(`itemInfo-${itemId}`);
    mtcAutoMatchCode(input, infoInput);
}

/**
 * MTC 物品代码改变时自动填充信息（立即执行）
 */
function mtcOnItemCodeChange(itemId) {
    const input = document.getElementById(`itemCode-${itemId}`);
    const infoInput = document.getElementById(`itemInfo-${itemId}`);
    
    // 强制转换为大写
    input.value = input.value.toUpperCase();
    const code = input.value;
    
    if (code && typeof materialDB !== 'undefined' && materialDB[code]) {
        const data = materialDB[code];
        infoInput.value = `${data.weight}t / ${data.volume}m³`;
        input.style.borderColor = 'var(--primary-color)';
    } else {
        infoInput.value = '';
        input.style.borderColor = '';
    }
}

/**
 * MTC 验证数量输入
 */
function mtcValidateQty(itemId) {
    const input = document.getElementById(`itemQty-${itemId}`);
    const value = parseInt(input.value);
    
    if (isNaN(value) || value < 1) {
        input.style.borderColor = '#ff4757';
        return false;
    } else {
        input.style.borderColor = '';
        return true;
    }
}

/**
 * MTC 删除物品行（带淡出动画）
 */
function mtcRemoveItem(itemId) {
    const row = document.querySelector(`[data-item-id="${itemId}"]`);
    if (row) {
        row.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => {
            row.remove();
            mtcUpdateItemCount();
        }, 300);
    }
}

/**
 * MTC 更新物品计数
 */
function mtcUpdateItemCount() {
    const count = document.querySelectorAll('.item-input-row').length;
    document.getElementById('itemCount').textContent = `${count} 种物品`;
}

/**
 * MTC 加载示例数据
 */
function mtcLoadExample(type) {
    const container = document.getElementById('itemsContainer');
    container.innerHTML = '';
    mtcItemIdCounter = 0;
    
    if (type === 'INS-MCG') {
        // 复杂组合示例：多种物品混合
        // BBH: 10个 (0.5t / 0.8m³) = 5t / 8m³
        // BDE: 10个 (0.1t / 1.5m³) = 1t / 15m³
        // BSE: 6个 (0.3t / 0.5m³) = 1.8t / 3m³
        // BTA: 4个 (0.3t / 0.4m³) = 1.2t / 1.6m³
        // INS: 4940个 (0.06t / 0.1m³) = 296.4t / 494m³
        // LBH: 56个 (0.2t / 0.6m³) = 11.2t / 33.6m³
        // LDE: 80个 (0.1t / 1.2m³) = 8t / 96m³
        // LSE: 100个 (0.3t / 1.2m³) = 30t / 120m³
        // LTA: 42个 (0.3t / 0.5m³) = 12.6t / 21m³
        // MCG: 1976个 (0.24t / 0.1m³) = 474.24t / 197.6m³
        // PSL: 12个 (需要查询数据)
        // RSE: 2个 (1.9t / 0.7m³) = 3.8t / 1.4m³
        // RTA: 4个 (1.5t / 0.5m³) = 6t / 2m³
        // TRU: 80个 (0.1t / 1.5m³) = 8t / 120m³
        mtcAddItemWithData('BBH', 10);
        mtcAddItemWithData('BDE', 10);
        mtcAddItemWithData('BSE', 6);
        mtcAddItemWithData('BTA', 4);
        mtcAddItemWithData('INS', 4940);
        mtcAddItemWithData('LBH', 56);
        mtcAddItemWithData('LDE', 80);
        mtcAddItemWithData('LSE', 100);
        mtcAddItemWithData('LTA', 42);
        mtcAddItemWithData('MCG', 1976);
        mtcAddItemWithData('RSE', 2);
        mtcAddItemWithData('RTA', 4);
        mtcAddItemWithData('TRU', 80);
    }
    
    mtcUpdateItemCount();
}

/**
 * MTC 添加带有数据的物品行
 */
function mtcAddItemWithData(code, qty) {
    const container = document.getElementById('itemsContainer');
    const itemId = mtcItemIdCounter++;
    
    const row = document.createElement('div');
    row.className = 'item-input-row';
    row.dataset.itemId = itemId;
    row.style.animation = 'fadeIn 0.3s ease';
    
    let infoValue = '';
    if (typeof materialDB !== 'undefined' && materialDB[code]) {
        const data = materialDB[code];
        infoValue = `${data.weight}t / ${data.volume}m³`;
    }
    
    row.innerHTML = `
        <div class="form-group">
            <label>物品代码</label>
            <input type="text" id="itemCode-${itemId}" value="${code}"
                oninput="mtcOnItemCodeInput(${itemId})" onchange="mtcOnItemCodeChange(${itemId})">
        </div>
        <div class="form-group">
            <label>数量</label>
            <input type="number" id="itemQty-${itemId}" min="1" step="1" value="${qty}"
                onchange="mtcValidateQty(${itemId})" oninput="mtcValidateQty(${itemId})">
        </div>
        <div class="form-group">
            <label>单位重量/体积</label>
            <input type="text" id="itemInfo-${itemId}" readonly value="${infoValue}"
                style="background: var(--bg-input-readonly); cursor: not-allowed;">
        </div>
        <button class="btn-remove-item" onclick="mtcRemoveItem(${itemId})" title="删除此物品">🗑️</button>
    `;
    
    container.appendChild(row);
    
    // 触发代码匹配
    mtcOnItemCodeChange(itemId);
}

/**
 * MTC 重置所有
 */
function mtcResetAll() {
    if (confirm('确定要清空所有物品吗？')) {
        document.getElementById('itemsContainer').innerHTML = '';
        mtcItemIdCounter = 0;
        mtcAddItem();
        mtcAddItem();
        mtcUpdateItemCount();
        mtcHideResult();
        mtcHideError();
    }
}

/**
 * MTC 显示错误信息
 */
function mtcShowError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
    setTimeout(() => errorDiv.classList.remove('show'), 5000);
}

/**
 * MTC 隐藏错误信息
 */
function mtcHideError() {
    document.getElementById('errorMessage').classList.remove('show');
}

/**
 * MTC 收集物品数据
 */
function mtcCollectItems() {
    const rows = document.querySelectorAll('.item-input-row');
    const items = [];
    
    rows.forEach(row => {
        const itemId = row.dataset.itemId;
        const code = document.getElementById(`itemCode-${itemId}`).value;
        const qty = parseInt(document.getElementById(`itemQty-${itemId}`).value);
        
        if (code && !isNaN(qty) && qty > 0) {
            const material = materialDB[code];
            if (material) {
                items.push({
                    code: code,
                    name: code,
                    qty: qty,
                    unitWeight: material.weight,
                    unitVolume: material.volume,
                    totalWeight: qty * material.weight,
                    totalVolume: qty * material.volume
                });
            }
        }
    });
    
    return items;
}

/**
 * MTC 验证输入
 */
function mtcValidateInput() {
    const items = mtcCollectItems();
    
    if (items.length === 0) {
        mtcShowError('请至少添加一种物品并输入有效数量');
        return null;
    }
    
    const maxWeight = parseFloat(document.getElementById('maxWeightInput').value);
    const maxVolume = parseFloat(document.getElementById('maxVolumeInput').value);
    
    if (!maxWeight || maxWeight <= 0 || !maxVolume || maxVolume <= 0) {
        mtcShowError('请设置有效的运输容量');
        return null;
    }
    
    // 检查是否有物品超过单次运输容量
    for (const item of items) {
        if (item.unitWeight > maxWeight || item.unitVolume > maxVolume) {
            mtcShowError(`物品 ${item.code} 的单位重量或体积超过单次运输容量，无法运输`);
            return null;
        }
    }
    
    return { items, maxWeight, maxVolume };
}

/**
 * MTC 计算最少运输次数（使用贪心算法 + 首次适应递减算法）
 */
function mtcCalculateMinTrips() {
    mtcHideError();
    
    const input = mtcValidateInput();
    if (!input) return;
    
    const { items, maxWeight, maxVolume } = input;
    
    // 显示计算中
    document.getElementById('calculating').classList.add('show');
    mtcHideResult();
    
    // 使用 setTimeout 让 UI 有机会更新
    setTimeout(() => {
        try {
            const result = mtcOptimizeTrips(items, maxWeight, maxVolume);
            mtcDisplayResult(result);
        } catch (error) {
            mtcShowError('计算过程中发生错误: ' + error.message);
        } finally {
            document.getElementById('calculating').classList.remove('show');
        }
    }, 100);
}

/**
 * MTC 优化运输次数算法
 * 基于最大化运输模型，实现两阶段优化策略
 * 优化目标：确保单次运输的重量和体积都达到极限
 * 核心策略：优先寻找能达到双极限的物品组合（如MCG+INS）
 */
function mtcOptimizeTrips(items, maxWeight, maxVolume) {
    // 计算总重量和总体积
    const totalWeight = items.reduce((sum, item) => sum + item.totalWeight, 0);
    const totalVolume = items.reduce((sum, item) => sum + item.totalVolume, 0);
    
    // 第一阶段：计算最小运输次数 m*
    const minTripsByWeight = Math.ceil(totalWeight / maxWeight);
    const minTripsByVolume = Math.ceil(totalVolume / maxVolume);
    const minTrips = Math.max(minTripsByWeight, minTripsByVolume);
    
    // 创建物品副本用于跟踪剩余数量，并计算密度
    const remainingItems = items.map(item => ({
        ...item,
        remainingQty: item.qty,
        density: item.unitWeight / item.unitVolume
    }));
    
    // 系统目标密度
    const targetDensity = maxWeight / maxVolume;
    
    const trips = [];
    
    // 第二阶段：按顺序最大化每个批次的利用率
    for (let k = 0; k < minTrips; k++) {
        const trip = mtcCreateEmptyTrip();
        
        // 阶段0：优先尝试双极限组合（如MCG+INS）
        // 寻找能达到重量和体积双极限的最佳两种物品组合
        const dualLimitResult = mtcFindDualLimitCombo(remainingItems, trip, maxWeight, maxVolume);
        if (dualLimitResult) {
            // 应用双极限组合
            for (const { item, qty } of dualLimitResult) {
                if (qty > 0) {
                    mtcAddItemToTrip(trip, item, qty);
                    item.remainingQty -= qty;
                }
            }
        }
        
        // 阶段1：优先装载密度最大和最小的物品（密度互补策略）
        let improved = true;
        let iterations = 0;
        const maxIterations = 500;
        let useHighDensity = true; // 交替使用高密度和低密度物品
        
        while (improved && iterations < maxIterations) {
            improved = false;
            iterations++;
            
            // 计算当前批次的剩余容量
            const remainingWeight = maxWeight - trip.totalWeight;
            const remainingVolume = maxVolume - trip.totalVolume;
            
            // 如果已经接近极限，停止添加
            if (remainingWeight < 0.01 || remainingVolume < 0.01) break;
            
            // 找出最佳物品和数量组合
            let bestItem = null;
            let bestQty = 0;
            let bestScore = -1;
            
            // 筛选有剩余数量的物品
            const availableItems = remainingItems.filter(item => item.remainingQty > 0);
            if (availableItems.length === 0) break;
            
            // 按密度排序
            const sortedByDensity = [...availableItems].sort((a, b) => b.density - a.density);
            const maxDensityItem = sortedByDensity[0];
            const minDensityItem = sortedByDensity[sortedByDensity.length - 1];
            
            // 交替选择高密度和低密度物品
            const candidateItems = useHighDensity ? 
                [maxDensityItem, minDensityItem] : 
                [minDensityItem, maxDensityItem];
            
            for (const item of candidateItems) {
                if (item.remainingQty <= 0) continue;
                
                // 计算能装多少（受限于重量、体积和剩余数量）
                const maxByWeight = Math.floor(remainingWeight / item.unitWeight);
                const maxByVolume = Math.floor(remainingVolume / item.unitVolume);
                const canFit = Math.min(maxByWeight, maxByVolume, item.remainingQty);
                
                if (canFit <= 0) continue;
                
                // 尝试不同的数量，找到最佳平衡点
                for (let qty of [canFit, Math.floor(canFit * 0.75), Math.floor(canFit * 0.5), Math.floor(canFit * 0.25), 1]) {
                    if (qty <= 0 || qty > canFit) continue;
                    
                    const newWeight = trip.totalWeight + qty * item.unitWeight;
                    const newVolume = trip.totalVolume + qty * item.unitVolume;
                    
                    // 计算利用率
                    const weightUtil = newWeight / maxWeight;
                    const volumeUtil = newVolume / maxVolume;
                    
                    // 计算密度匹配度
                    const tripDensity = newWeight / newVolume;
                    const densityMatch = 1 - Math.abs(tripDensity - targetDensity) / targetDensity;
                    
                    // 计算综合得分 - 最大化利用率
                    const balanceScore = 1 - Math.abs(weightUtil - volumeUtil);
                    const utilizationScore = (weightUtil + volumeUtil) / 2;
                    // 优先最大化利用率
                    const score = utilizationScore * 0.8 + balanceScore * 0.15 + densityMatch * 0.05;
                    
                    if (score > bestScore) {
                        bestScore = score;
                        bestItem = item;
                        bestQty = qty;
                    }
                    
                    // 如果已经找到很好的解，不需要继续尝试
                    if (score > 0.95) break;
                }
                
                if (bestItem) break; // 找到候选物品就跳出
            }
            
            // 如果找到更好的物品组合，添加到批次
            if (bestItem && bestQty > 0) {
                mtcAddItemToTrip(trip, bestItem, bestQty);
                bestItem.remainingQty -= bestQty;
                improved = true;
                useHighDensity = !useHighDensity; // 切换密度类型
            } else {
                // 如果没有找到密度极端物品，尝试所有可用物品
                for (const item of availableItems) {
                    const maxByWeight = Math.floor(remainingWeight / item.unitWeight);
                    const maxByVolume = Math.floor(remainingVolume / item.unitVolume);
                    const canFit = Math.min(maxByWeight, maxByVolume, item.remainingQty);
                    
                    if (canFit > 0) {
                        mtcAddItemToTrip(trip, item, canFit);
                        item.remainingQty -= canFit;
                        improved = true;
                        break;
                    }
                }
                
                if (!improved) break;
            }
        }
        
        // 阶段2：尝试用剩余物品填满剩余空间
        // 循环直到无法再添加任何物品
        let fillImproved = true;
        let fillIterations = 0;
        const maxFillIterations = 100;
        
        while (fillImproved && fillIterations < maxFillIterations) {
            fillImproved = false;
            fillIterations++;
            
            const remainingWeight = maxWeight - trip.totalWeight;
            const remainingVolume = maxVolume - trip.totalVolume;
            
            // 如果已经接近极限，停止添加
            if (remainingWeight < 0.01 || remainingVolume < 0.01) break;
            
            // 按密度排序，优先选择能更好匹配目标密度的物品
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
                    mtcAddItemToTrip(trip, item, canFit);
                    item.remainingQty -= canFit;
                    fillImproved = true;
                    break;
                }
            }
        }
        
        // 阶段3：最后尝试添加单个物品来填满剩余空间
        let finalImproved = true;
        let finalIterations = 0;
        const maxFinalIterations = 100;
        
        while (finalImproved && finalIterations < maxFinalIterations) {
            finalImproved = false;
            finalIterations++;
            
            const remainingWeight = maxWeight - trip.totalWeight;
            const remainingVolume = maxVolume - trip.totalVolume;
            
            // 如果已经接近极限，停止添加
            if (remainingWeight < 0.01 || remainingVolume < 0.01) break;
            
            for (const item of remainingItems) {
                if (item.remainingQty <= 0) continue;
                
                const maxByWeight = Math.floor(remainingWeight / item.unitWeight);
                const maxByVolume = Math.floor(remainingVolume / item.unitVolume);
                const canFit = Math.min(maxByWeight, maxByVolume, item.remainingQty);
                
                if (canFit > 0) {
                    mtcAddItemToTrip(trip, item, canFit);
                    item.remainingQty -= canFit;
                    finalImproved = true;
                    break;
                }
            }
        }
        
        // 添加批次到运输列表
        if (Object.keys(trip.items).length > 0) {
            trips.push(trip);
        }
    }
    
    // 处理剩余物品（如果有的话）
    while (remainingItems.some(item => item.remainingQty > 0)) {
        const trip = mtcCreateEmptyTrip();
        
        for (const item of remainingItems) {
            if (item.remainingQty <= 0) continue;
            
            const maxByWeight = Math.floor((maxWeight - trip.totalWeight) / item.unitWeight);
            const maxByVolume = Math.floor((maxVolume - trip.totalVolume) / item.unitVolume);
            const qty = Math.min(maxByWeight, maxByVolume, item.remainingQty);
            
            if (qty > 0) {
                mtcAddItemToTrip(trip, item, qty);
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
        trips: trips,
        totalTrips: trips.length,
        totalItems: items.length,
        totalQty: items.reduce((sum, item) => sum + item.qty, 0),
        avgUtilization: mtcCalculateAvgUtilization(trips, maxWeight, maxVolume)
    };
}

/**
 * MTC 寻找能达到双极限的最佳两种物品组合
 * 例如：MCG(0.24t/0.1m³) + INS(0.06t/0.1m³) = 500t/500m³
 * 解方程组：
 *   0.24x + 0.06y = 500 (重量)
 *   0.1x + 0.1y = 500 (体积)
 * 解得：x = 1111, y = 3889
 */
function mtcFindDualLimitCombo(remainingItems, trip, maxWeight, maxVolume) {
    // 筛选有剩余数量的物品
    const availableItems = remainingItems.filter(item => item.remainingQty > 0);
    if (availableItems.length < 2) return null;
    
    // 计算剩余容量
    const remainingWeight = maxWeight - trip.totalWeight;
    const remainingVolume = maxVolume - trip.totalVolume;
    
    // 如果剩余容量已经很小，不需要寻找双极限组合
    if (remainingWeight < 10 || remainingVolume < 10) return null;
    
    let bestCombo = null;
    let bestScore = -1;
    
    // 尝试所有两种物品的组合
    for (let i = 0; i < availableItems.length; i++) {
        for (let j = i + 1; j < availableItems.length; j++) {
            const item1 = availableItems[i];
            const item2 = availableItems[j];
            
            // 解线性方程组
            // w1*x + w2*y = remainingWeight
            // v1*x + v2*y = remainingVolume
            const w1 = item1.unitWeight, v1 = item1.unitVolume;
            const w2 = item2.unitWeight, v2 = item2.unitVolume;
            
            const det = w1 * v2 - w2 * v1;
            if (Math.abs(det) < 0.0001) continue; // 行列式为0，无解
            
            // 计算理论解
            const x = (remainingWeight * v2 - remainingVolume * w2) / det;
            const y = (remainingVolume * w1 - remainingWeight * v1) / det;
            
            // 检查解是否为正数
            if (x <= 0 || y <= 0) continue;
            
            // 取整数解
            const qty1 = Math.floor(x);
            const qty2 = Math.floor(y);
            
            // 检查是否满足约束
            if (qty1 > item1.remainingQty || qty2 > item2.remainingQty) continue;
            
            // 计算实际装载的重量和体积
            const actualWeight = qty1 * w1 + qty2 * w2;
            const actualVolume = qty1 * v1 + qty2 * v2;
            
            // 计算利用率
            const weightUtil = actualWeight / remainingWeight;
            const volumeUtil = actualVolume / remainingVolume;
            
            // 计算得分（优先选择利用率高的组合）
            const score = (weightUtil + volumeUtil) / 2;
            
            if (score > bestScore && score > 0.95) {
                bestScore = score;
                bestCombo = [
                    { item: item1, qty: qty1 },
                    { item: item2, qty: qty2 }
                ];
            }
        }
    }
    
    return bestCombo;
}

/**
 * MTC 计算物品可以装入运输批次的最大数量
 */
function mtcCalculateMaxFit(item, trip, maxWeight, maxVolume) {
    const remainingWeight = maxWeight - trip.totalWeight;
    const remainingVolume = maxVolume - trip.totalVolume;
    
    if (remainingWeight <= 0 || remainingVolume <= 0) return 0;
    
    const maxByWeight = Math.floor(remainingWeight / item.unitWeight);
    const maxByVolume = Math.floor(remainingVolume / item.unitVolume);
    
    return Math.min(maxByWeight, maxByVolume);
}

/**
 * MTC 创建空运输批次
 */
function mtcCreateEmptyTrip() {
    return {
        items: {},
        totalWeight: 0,
        totalVolume: 0
    };
}

/**
 * MTC 添加物品到运输批次
 */
function mtcAddItemToTrip(trip, item, qty) {
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

/**
 * MTC 通过合并优化运输批次
 */
function mtcOptimizeTripsByMerging(trips, maxWeight, maxVolume) {
    let improved = true;
    let iterations = 0;
    const maxIterations = 100;
    
    while (improved && iterations < maxIterations) {
        improved = false;
        iterations++;
        
        for (let i = trips.length - 1; i >= 0; i--) {
            for (let j = i - 1; j >= 0; j--) {
                if (mtcCanMergeTrips(trips[j], trips[i], maxWeight, maxVolume)) {
                    mtcMergeTrips(trips[j], trips[i]);
                    trips.splice(i, 1);
                    improved = true;
                    break;
                }
            }
            if (improved) break;
        }
    }
}

/**
 * MTC 检查两个运输批次是否可以合并
 */
function mtcCanMergeTrips(trip1, trip2, maxWeight, maxVolume) {
    const combinedWeight = trip1.totalWeight + trip2.totalWeight;
    const combinedVolume = trip1.totalVolume + trip2.totalVolume;
    return combinedWeight <= maxWeight && combinedVolume <= maxVolume;
}

/**
 * MTC 合并两个运输批次
 */
function mtcMergeTrips(target, source) {
    for (const [code, item] of Object.entries(source.items)) {
        if (target.items[code]) {
            target.items[code].qty += item.qty;
        } else {
            target.items[code] = { ...item };
        }
    }
    target.totalWeight += source.totalWeight;
    target.totalVolume += source.totalVolume;
}

/**
 * MTC 计算平均容量利用率
 */
function mtcCalculateAvgUtilization(trips, maxWeight, maxVolume) {
    if (trips.length === 0) return 0;
    
    let totalUtilization = 0;
    for (const trip of trips) {
        const weightUtil = trip.totalWeight / maxWeight;
        const volumeUtil = trip.totalVolume / maxVolume;
        totalUtilization += Math.max(weightUtil, volumeUtil);
    }
    
    return Math.round((totalUtilization / trips.length) * 100);
}

/**
 * MTC 显示计算结果
 */
function mtcDisplayResult(result) {
    // 获取容量设置
    const maxWeight = parseFloat(document.getElementById('maxWeightInput').value);
    const maxVolume = parseFloat(document.getElementById('maxVolumeInput').value);
    
    // 计算总重量和总体积（所有运输批次的总和）
    let totalWeight = 0;
    let totalVolume = 0;
    result.trips.forEach(trip => {
        totalWeight += trip.totalWeight;
        totalVolume += trip.totalVolume;
    });
    
    // 计算填充率
    const weightRate = totalWeight / (maxWeight * result.totalTrips);
    const volumeRate = totalVolume / (maxVolume * result.totalTrips);
    const fillRate = Math.max(weightRate, volumeRate);
    const bottleneck = weightRate > volumeRate ? '重量' : '体积';
    
    // 更新统计摘要
    document.getElementById('totalTrips').textContent = result.totalTrips;
    document.getElementById('fillRate').textContent = (fillRate * 100).toFixed(2) + '%';
    document.getElementById('totalWeight').textContent = totalWeight.toFixed(2);
    document.getElementById('totalVolume').textContent = totalVolume.toFixed(2);
    
    // 更新进度条
    document.getElementById('weightText').textContent = totalWeight.toFixed(2) + ' / ' + (maxWeight * result.totalTrips) + ' t';
    document.getElementById('volumeText').textContent = totalVolume.toFixed(2) + ' / ' + (maxVolume * result.totalTrips) + ' m³';
    document.getElementById('bottleneckText').textContent = bottleneck + ' (' + (fillRate * 100).toFixed(2) + '%)';
    
    // 使用 transform 设置进度条
    document.getElementById('weightProgress').style.transform = `scaleX(${Math.min(weightRate, 1)})`;
    document.getElementById('volumeProgress').style.transform = `scaleX(${Math.min(volumeRate, 1)})`;
    document.getElementById('bottleneckProgress').style.transform = `scaleX(${Math.min(fillRate, 1)})`;
    
    // 生成运输方案详情
    const container = document.getElementById('tripPlans');
    container.innerHTML = '';
    
    result.trips.forEach((trip, index) => {
        const tripDiv = document.createElement('div');
        tripDiv.className = 'trip-plan';
        
        const weightUtil = Math.round((trip.totalWeight / maxWeight) * 100);
        const volumeUtil = Math.round((trip.totalVolume / maxVolume) * 100);
        
        let itemsHtml = '';
        for (const item of Object.values(trip.items)) {
            itemsHtml += `
                <div class="trip-item">
                    <span class="trip-item-name">${item.code} - ${item.name}</span>
                    <span class="trip-item-qty">×${item.qty}</span>
                </div>
            `;
        }
        
        tripDiv.innerHTML = `
            <div class="trip-header">
                <span class="trip-number">🚚 第 ${index + 1} 次运输</span>
                <div class="trip-utilization">
                    <span>⚖️ ${trip.totalWeight.toFixed(1)}/${maxWeight}t (${weightUtil}%)</span>
                    <span>📦 ${trip.totalVolume.toFixed(1)}/${maxVolume}m³ (${volumeUtil}%)</span>
                </div>
            </div>
            <div class="trip-items">
                ${itemsHtml}
            </div>
        `;
        
        container.appendChild(tripDiv);
    });
    
    // 显示结果卡片
    mtcShowResult();
}

/**
 * MTC 显示结果区域
 */
function mtcShowResult() {
    document.getElementById('resultCard').classList.add('show');
}

/**
 * MTC 隐藏结果区域
 */
function mtcHideResult() {
    document.getElementById('resultCard').classList.remove('show');
}

/**
 * MTC 初始化
 */
function mtcInit() {
    // 加载保存的主题
    initTheme();
    // 添加默认物品行
    mtcAddItem();
    mtcAddItem();
    mtcUpdateItemCount();
}

/**
 * 高精度数值舍入
 * @param {number} num - 要舍入的数字
 * @param {number} decimals - 小数位数
 * @returns {number} 舍入后的数字
 */
function round(num, decimals = 2) {
    if (!isFinite(num)) return 0;
    const factor = Math.pow(10, decimals);
    return Math.round((num + Number.EPSILON) * factor) / factor;
}

/**
 * 转义HTML特殊字符，防止XSS攻击
 * @param {string} text - 要转义的文本
 * @returns {string} 转义后的文本
 */
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 防抖函数
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * 初始化主题
 */
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

// MTC 页面加载完成后初始化
if (window.location.pathname.includes('MTC.html')) {
    window.onload = function() {
        mtcInit();
    };
}