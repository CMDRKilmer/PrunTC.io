/**
 * 最少次数运输计算器 - MTC模块
 * @author CMDRKilmer
 * @version 1.0
 */

// MTC 全局状态
let mtcItems = [];
let mtcItemIdCounter = 0;

// 使用 Utils 模块（如果可用）
const round = typeof Utils !== 'undefined' ? Utils.round : (n, d) => Number(n.toFixed(d || 2));
const escapeHtml = typeof Utils !== 'undefined' ? Utils.escapeHtml : (t) => t;
const debounce = typeof Utils !== 'undefined' ? Utils.debounce : (f, w) => f;

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
    const shipType = document.getElementById('shipType').value;
    const weightInput = document.getElementById('maxWeightInput');
    const volumeInput = document.getElementById('maxVolumeInput');
    let weight = parseFloat(weightInput.value) || 500;
    let volume = parseFloat(volumeInput.value) || 500;
    
    // 如果选择了船舱类型，验证并限制容量不超过最大值
    if (shipType && shipTypes[shipType]) {
        const maxWeight = shipTypes[shipType].weight;
        const maxVolume = shipTypes[shipType].volume;
        
        if (weight > maxWeight) {
            weight = maxWeight;
            weightInput.value = maxWeight;
            showNotification(`重量容量不能超过船舱最大限制：${maxWeight}吨`, 'warning');
        }
        if (volume > maxVolume) {
            volume = maxVolume;
            volumeInput.value = maxVolume;
            showNotification(`体积容量不能超过船舱最大限制：${maxVolume}m³`, 'warning');
        }
    }
    
    // 确保值为正数
    if (weight <= 0) {
        weight = shipType && shipTypes[shipType] ? shipTypes[shipType].weight : 500;
        weightInput.value = weight;
    }
    if (volume <= 0) {
        volume = shipType && shipTypes[shipType] ? shipTypes[shipType].volume : 500;
        volumeInput.value = volume;
    }
    
    document.getElementById('maxWeight').textContent = weight;
    document.getElementById('maxVolume').textContent = volume;
}

/**
 * MTC 添加物品输入行
 */
function mtcAddItem() {
    const container = document.getElementById('itemsContainer');
    if (!container) {
        console.error('Items container not found');
        return;
    }
    const itemId = mtcItemIdCounter++;
    
    const row = createItemRow('', 1, itemId);
    if (row) {
        container.appendChild(row);
        mtcUpdateItemCount();
    } else {
        console.error('Failed to create item row');
    }
}

/**
 * MTC 删除物品行（带淡出动画）
 */
function mtcRemoveItem(itemId) {
    showConfirm('确定要删除这个物品吗？', () => {
        const row = document.querySelector(`[data-item-id="${itemId}"]`);
        if (row) {
            row.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => {
                row.remove();
                mtcUpdateItemCount();
            }, 300);
        }
    });
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
function mtcLoadExample() {
    const container = document.getElementById('itemsContainer');
    container.innerHTML = '';
    mtcItemIdCounter = 0;
    
    // 复杂组合示例：多种物品混合
    const examples = [
        ['BBH', 10],
        ['BDE', 10],
        ['BSE', 6],
        ['BTA', 4],
        ['INS', 4940],
        ['LBH', 56],
        ['LDE', 80],
        ['LSE', 100],
        ['LTA', 42],
        ['MCG', 1976],
        ['RSE', 2],
        ['RTA', 4],
        ['TRU', 80]
    ];
    
    // 使用 DocumentFragment 批量处理
    const fragment = document.createDocumentFragment();
    
    examples.forEach(([code, qty]) => {
        const row = createItemRow(code, qty, mtcItemIdCounter++);
        if (row) {
            fragment.appendChild(row);
        }
    });
    
    // 一次性添加到容器
    container.appendChild(fragment);
    
    mtcUpdateItemCount();
}

/**
 * 创建物品行元素（用于批量处理）
 * @param {string} code - 物品代码
 * @param {number} qty - 数量
 * @param {number} itemId - 物品ID
 * @returns {HTMLElement} 物品行元素
 */
function createItemRow(code = '', qty = 1, itemId) {
    try {
        const row = document.createElement('div');
        row.className = 'item-input-row';
        row.dataset.itemId = itemId;
        row.style.animation = 'itemSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
        row.style.display = 'grid';
        row.style.gridTemplateColumns = '100px 120px 200px 50px';
        row.style.gap = '12px';
        row.style.alignItems = 'end';
        row.style.padding = '15px';
        row.style.background = 'var(--bg-card-light)';
        row.style.borderRadius = '10px';
        row.style.marginBottom = '10px';
        row.style.border = '1px solid var(--border-color-lighter)';
        
        let infoValue = '';
        if (code && typeof materialDB !== 'undefined' && materialDB[code]) {
            const data = materialDB[code];
            infoValue = `${data.weight}t / ${data.volume}m³`;
        }
        
        row.innerHTML = `
            <div class="form-group">
                <label>物品代码</label>
                <input type="text" data-field="code" value="${code}" ${!code ? 'placeholder="如: MCG"' : ''}>
            </div>
            <div class="form-group">
                <label>数量</label>
                <input type="number" data-field="qty" min="1" step="1" value="${qty}" ${!qty ? 'placeholder="输入数量"' : ''}>
            </div>
            <div class="form-group">
                <label>单位重量/体积</label>
                <input type="text" data-field="info" readonly value="${infoValue}" ${!infoValue ? 'placeholder="自动填充"' : ''}>
            </div>
            <button class="btn-remove-item" title="删除此物品">🗑️</button>
        `;
        
        // 缓存 DOM 元素
        const codeInput = row.querySelector('[data-field="code"]');
        const qtyInput = row.querySelector('[data-field="qty"]');
        const infoInput = row.querySelector('[data-field="info"]');
        const removeBtn = row.querySelector('.btn-remove-item');
        
        // 绑定事件监听器
        codeInput.addEventListener('input', () => {
            mtcAutoMatchCode(codeInput, infoInput);
        });
        
        codeInput.addEventListener('change', () => {
            // 强制转换为大写
            codeInput.value = codeInput.value.toUpperCase();
            const code = codeInput.value;
            
            if (code && typeof materialDB !== 'undefined' && materialDB[code]) {
                const data = materialDB[code];
                infoInput.value = `${data.weight}t / ${data.volume}m³`;
                codeInput.style.borderColor = 'var(--primary-color)';
            } else {
                infoInput.value = '';
                codeInput.style.borderColor = '';
            }
        });
        
        qtyInput.addEventListener('input', () => {
            const value = parseInt(qtyInput.value);
            if (isNaN(value) || value < 1) {
                qtyInput.style.borderColor = '#ff4757';
            } else {
                qtyInput.style.borderColor = '';
            }
        });
        
        qtyInput.addEventListener('change', () => {
            const value = parseInt(qtyInput.value);
            if (isNaN(value) || value < 1) {
                qtyInput.style.borderColor = '#ff4757';
            } else {
                qtyInput.style.borderColor = '';
            }
        });
        
        removeBtn.addEventListener('click', () => {
            mtcRemoveItem(itemId);
        });
        
        // 触发代码匹配
        if (code) {
            codeInput.dispatchEvent(new Event('change'));
        }
        
        return row;
    } catch (error) {
        console.error('Error creating item row:', error);
        return null;
    }
}

/**
 * MTC 添加带有数据的物品行
 */
function mtcAddItemWithData(code, qty) {
    const container = document.getElementById('itemsContainer');
    const itemId = mtcItemIdCounter++;
    
    const row = createItemRow(code, qty, itemId);
    if (row) {
        container.appendChild(row);
        mtcUpdateItemCount();
    }
}

/**
 * MTC 重置所有
 */
function mtcResetAll() {
    showConfirm('确定要清空所有物品吗？', () => {
        document.getElementById('itemsContainer').innerHTML = '';
        mtcItemIdCounter = 0;
        mtcAddItem();
        mtcAddItem();
        mtcUpdateItemCount();
        mtcHideResult();
        mtcHideError();
    });
}

/**
 * MTC 显示错误信息（使用通知样式）
 */
function mtcShowError(message) {
    showNotification(message, 'error');
}

/**
 * MTC 隐藏错误信息（兼容性函数）
 */
function mtcHideError() {
    // 使用通知系统，无需手动隐藏
}

/**
 * MTC 收集物品数据
 */
function mtcCollectItems() {
    const rows = document.querySelectorAll('.item-input-row');
    const items = [];
    
    rows.forEach(row => {
        const codeInput = row.querySelector('[data-field="code"]');
        const qtyInput = row.querySelector('[data-field="qty"]');
        
        if (codeInput && qtyInput) {
            const code = codeInput.value;
            const qty = parseInt(qtyInput.value);
            
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
    
    // 预计算物品的密度，便于快速筛选
    // 创建新数组用于排序，同时保留对原始物品的引用
    const itemsWithDensity = availableItems.map(item => ({
        ...item,
        _original: item,
        density: item.unitWeight / item.unitVolume
    }));

    // 按密度排序，便于快速找到互补的物品
    itemsWithDensity.sort((a, b) => a.density - b.density);

    // 目标密度
    const targetDensity = remainingWeight / remainingVolume;

    // 尝试所有两种物品的组合
    for (let i = 0; i < itemsWithDensity.length; i++) {
        for (let j = i + 1; j < itemsWithDensity.length; j++) {
            const item1 = itemsWithDensity[i]._original;
            const item2 = itemsWithDensity[j]._original;
            const density1 = itemsWithDensity[i].density;
            const density2 = itemsWithDensity[j].density;

            // 跳过密度相近的物品，提高效率
            const densityDiff = Math.abs(density1 - density2);
            if (densityDiff < 0.1) continue;

            // 跳过与目标密度相差太远的组合
            const avgDensity = (density1 + density2) / 2;
            if (Math.abs(avgDensity - targetDensity) > targetDensity * 0.5) continue;
            
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
            
            // 检查是否超过容量
            if (actualWeight > remainingWeight || actualVolume > remainingVolume) continue;
            
            // 计算利用率
            const weightUtil = actualWeight / remainingWeight;
            const volumeUtil = actualVolume / remainingVolume;
            
            // 计算得分（优先选择利用率高且平衡的组合）
            const balanceScore = 1 - Math.abs(weightUtil - volumeUtil);
            const score = (weightUtil + volumeUtil) / 2 * balanceScore;
            
            if (score > bestScore && score > 0.95) {
                bestScore = score;
                bestCombo = [
                    { item: item1, qty: qty1 },
                    { item: item2, qty: qty2 }
                ];
                
                // 找到非常好的组合后，提前结束搜索
                if (score > 0.99) {
                    return bestCombo;
                }
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
    initTheme();
    mtcAddItem();
    mtcAddItem();
    mtcUpdateItemCount();
}

/**
 * 显示确认对话框（统一风格）
 */
function showConfirm(message, onConfirm, onCancel) {
    const existing = document.querySelector('.confirm-dialog');
    if (existing) existing.remove();

    const dialog = document.createElement('div');
    dialog.className = 'confirm-dialog';
    dialog.innerHTML = `
        <div class="confirm-overlay"></div>
        <div class="confirm-content">
            <div class="confirm-icon">❓</div>
            <div class="confirm-message">${escapeHtml(message)}</div>
            <div class="confirm-buttons">
                <button class="btn btn-secondary confirm-cancel">取消</button>
                <button class="btn btn-danger confirm-ok">确定</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    const cancelBtn = dialog.querySelector('.confirm-cancel');
    const okBtn = dialog.querySelector('.confirm-ok');
    const overlay = dialog.querySelector('.confirm-overlay');

    const closeDialog = () => {
        dialog.remove();
    };

    cancelBtn.addEventListener('click', () => {
        closeDialog();
        if (onCancel) onCancel();
    });

    okBtn.addEventListener('click', () => {
        closeDialog();
        if (onConfirm) onConfirm();
    });

    overlay.addEventListener('click', closeDialog);
}

// MTC 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mtcInit);
} else {
    mtcInit();
}