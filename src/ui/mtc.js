/**
 * MTC UI 控制模块
 * 负责处理最少次数运输计算器的界面交互
 */

import MTCOptimizer from '../core/optimizers/MTCOptimizer.js';
import { round, debounce, escapeHtml, showNotification, showConfirm, initTheme } from '../utils/index.js';
import { getMaterialByCode, getShipTypeByType } from '../data/index.js';

// MTC 全局状态
let mtcItems = [];
let mtcItemIdCounter = 0;

/**
 * MTC 统一的自动匹配函数（防抖200ms）
 */
const mtcAutoMatchCode = debounce(function(input, infoInput) {
    // 强制转换为大写
    input.value = input.value.toUpperCase();
    const code = input.value;
    
    if (code) {
        const data = getMaterialByCode(code);
        if (data) {
            infoInput.value = `${data.weight}t / ${data.volume}m³`;
            input.style.borderColor = 'var(--primary-color)';
        } else {
            infoInput.value = '';
            input.style.borderColor = '';
        }
    } else {
        infoInput.value = '';
        input.style.borderColor = '';
    }
}, 200);

/**
 * MTC 更新船舱容量
 */
export function mtcUpdateShipCapacity() {
    const shipType = document.getElementById('shipType').value;
    if (shipType) {
        const config = getShipTypeByType(shipType);
        if (config) {
            document.getElementById('maxWeightInput').value = config.weight;
            document.getElementById('maxVolumeInput').value = config.volume;
            mtcUpdateConstraintDisplay();
        }
    }
}

/**
 * MTC 更新限制条件显示
 */
export function mtcUpdateConstraintDisplay() {
    const shipType = document.getElementById('shipType').value;
    const weightInput = document.getElementById('maxWeightInput');
    const volumeInput = document.getElementById('maxVolumeInput');
    let weight = parseFloat(weightInput.value) || 500;
    let volume = parseFloat(volumeInput.value) || 500;
    
    // 如果选择了船舱类型，验证并限制容量不超过最大值
    if (shipType) {
        const shipInfo = getShipTypeByType(shipType);
        if (shipInfo) {
            const maxWeight = shipInfo.weight;
            const maxVolume = shipInfo.volume;
            
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
    }
    
    // 确保值为正数
    if (weight <= 0) {
        if (shipType) {
            const shipInfo = getShipTypeByType(shipType);
            if (shipInfo) {
                weight = shipInfo.weight;
                weightInput.value = weight;
            }
        } else {
            weight = 500;
            weightInput.value = weight;
        }
    }
    if (volume <= 0) {
        if (shipType) {
            const shipInfo = getShipTypeByType(shipType);
            if (shipInfo) {
                volume = shipInfo.volume;
                volumeInput.value = volume;
            }
        } else {
            volume = 500;
            volumeInput.value = volume;
        }
    }
    
    document.getElementById('maxWeight').textContent = weight;
    document.getElementById('maxVolume').textContent = volume;
}

/**
 * MTC 添加物品输入行
 */
export function mtcAddItem() {
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
export function mtcRemoveItem(itemId) {
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
export function mtcUpdateItemCount() {
    const count = document.querySelectorAll('.item-input-row').length;
    document.getElementById('itemCount').textContent = `${count} 种物品`;
}

/**
 * MTC 加载示例数据
 */
export function mtcLoadExample() {
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
        if (code) {
            const data = getMaterialByCode(code);
            if (data) {
                infoValue = `${data.weight}t / ${data.volume}m³`;
            }
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
            
            if (code) {
                const data = getMaterialByCode(code);
                if (data) {
                    infoInput.value = `${data.weight}t / ${data.volume}m³`;
                    codeInput.style.borderColor = 'var(--primary-color)';
                } else {
                    infoInput.value = '';
                    codeInput.style.borderColor = '';
                }
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
export function mtcAddItemWithData(code, qty) {
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
export function mtcResetAll() {
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
export function mtcShowError(message) {
    showNotification(message, 'error');
}

/**
 * MTC 隐藏错误信息（兼容性函数）
 */
export function mtcHideError() {
    // 使用通知系统，无需手动隐藏
}

/**
 * MTC 收集物品数据
 */
export function mtcCollectItems() {
    const rows = document.querySelectorAll('.item-input-row');
    const items = [];
    
    rows.forEach(row => {
        const codeInput = row.querySelector('[data-field="code"]');
        const qtyInput = row.querySelector('[data-field="qty"]');
        
        if (codeInput && qtyInput) {
            const code = codeInput.value;
            const qty = parseInt(qtyInput.value);
            
            if (code && !isNaN(qty) && qty > 0) {
                const material = getMaterialByCode(code);
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
export function mtcValidateInput() {
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
export function mtcCalculateMinTrips() {
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
            const result = MTCOptimizer.optimizeTrips(items, maxWeight, maxVolume);
            mtcDisplayResult(result);
        } catch (error) {
            mtcShowError('计算过程中发生错误: ' + error.message);
        } finally {
            document.getElementById('calculating').classList.remove('show');
        }
    }, 100);
}

/**
 * MTC 显示计算结果
 */
export function mtcDisplayResult(result) {
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
export function mtcShowResult() {
    document.getElementById('resultCard').classList.add('show');
}

/**
 * MTC 隐藏结果区域
 */
export function mtcHideResult() {
    document.getElementById('resultCard').classList.remove('show');
}

/**
 * MTC 初始化
 */
export function mtcInit() {
    initTheme();
    mtcAddItem();
    mtcAddItem();
    mtcUpdateItemCount();
}

// 导出公共方法
export {
    mtcItems,
    mtcItemIdCounter
};