/**
 * PrunTC UI 控制模块
 * 负责处理补给运输计算器的界面交互
 */

import CargoOptimizer from '../core/optimizers/CargoOptimizer.js';
import { round, debounce, escapeHtml, showNotification, showConfirm, initTheme } from '../utils/index.js';
import { getMaterialByCode, getShipTypeByType } from '../data/index.js';
import { fioLogin, fioGetBases, fioLoadBaseData, restoreFioAuth } from '../api/fio.js';

// 全局优化器实例
const optimizer = new CargoOptimizer();

/**
 * 更新船舱容量
 */
export function updateShipCapacity() {
    const shipType = document.getElementById('shipType').value;
    if (shipType) {
        const shipInfo = getShipTypeByType(shipType);
        if (shipInfo) {
            document.getElementById('capacityWeight').value = shipInfo.weight;
            document.getElementById('capacityVolume').value = shipInfo.volume;
        }
    }
    // 同步更新显示值
    updateCapacityDisplay();
}

/**
 * 更新容量显示值
 */
export function updateCapacityDisplay() {
    // 容量显示已移至输入框，此函数保留用于兼容性
    // 实际值直接显示在输入框中
}

/**
 * 验证容量输入
 * @param {string} type - 类型（'weight' 或 'volume'）
 */
export function validateCapacityInput(type) {
    const shipType = document.getElementById('shipType').value;
    const input = document.getElementById(type === 'weight' ? 'capacityWeight' : 'capacityVolume');
    const value = parseFloat(input.value);
    
    // 基本验证：确保值是有效的正数
    if (!isFinite(value) || value <= 0) {
        // 如果有选择船舱类型，恢复为船舱默认值；否则设为0
        if (shipType) {
            const shipInfo = getShipTypeByType(shipType);
            if (shipInfo) {
                input.value = type === 'weight' ? shipInfo.weight : shipInfo.volume;
            }
        } else {
            input.value = 0;
        }
        return;
    }
    
    // 如果选择了船舱类型，限制不能超过船舱最大容量
    if (shipType) {
        const shipInfo = getShipTypeByType(shipType);
        if (shipInfo) {
            const maxValue = type === 'weight' ? shipInfo.weight : shipInfo.volume;
            if (value > maxValue) {
                input.value = maxValue;
                showNotification(`容量不能超过船舱最大限制：${maxValue}${type === 'weight' ? '吨' : 'm³'}`, 'warning');
            }
        }
    }
}

/**
 * 统一的自动匹配函数（防抖200ms）
 * 强制大写 + 视觉反馈
 */
const autoMatchMaterial = debounce(function(id, code) {
    const item = optimizer.items.find(i => i.id === id);
    if (!item) return;

    // 强制转换为大写
    const upperCode = code.toUpperCase();
    const dbItem = getMaterialByCode(upperCode);
    // 检查matchHint元素是否存在
    const hint = document.getElementById('matchHint');
    const row = document.querySelector(`[data-id="${id}"]`);
    const codeInput = row ? row.querySelector('[data-field="code"]') : null;

    if (dbItem) {
        // 更新数据模型
        item.unitWeight = dbItem.weight;
        item.unitVolume = dbItem.volume;
        item.code = upperCode; // 更新为大写

        // 更新UI
        if (row) {
            const infoInput = row.querySelector('[data-field="info"]');
            if (infoInput) {
                infoInput.value = `${dbItem.weight}t / ${dbItem.volume}m³`;
            }
        }

        // 视觉反馈 - 边框变绿
        if (codeInput) {
            codeInput.style.borderColor = 'var(--primary-color)';
        }

        // 提示文字（仅当hint元素存在时）
        if (hint) {
            hint.textContent = '✓ 已自动匹配';
            setTimeout(() => { hint.textContent = ''; }, 2000);
        }
    } else {
        // 清除匹配
        if (row) {
            const infoInput = row.querySelector('[data-field="info"]');
            if (infoInput) {
                infoInput.value = '';
            }
        }

        if (codeInput) {
            codeInput.style.borderColor = '';
        }

        // 提示文字（仅当hint元素存在且code不为空时）
        if (hint && upperCode) {
            hint.textContent = '⚠️ 未找到匹配物品';
            setTimeout(() => { hint.textContent = ''; }, 2000);
        }
    }
}, 200);

/**
 * 物品代码输入时自动匹配（使用防抖）
 */
export function onItemCodeInput(id) {
    const row = document.querySelector(`[data-id="${id}"]`);
    if (row) {
        const codeInput = row.querySelector('[data-field="code"]');
        if (codeInput) {
            autoMatchMaterial(id, codeInput.value);
        }
    }
}

/**
 * 物品代码改变时自动填充信息（立即执行）
 */
export function onItemCodeChange(id) {
    const row = document.querySelector(`[data-id="${id}"]`);
    if (row) {
        const codeInput = row.querySelector('[data-field="code"]');
        if (codeInput) {
            // 强制转换为大写
            codeInput.value = codeInput.value.toUpperCase();
            const code = codeInput.value;
            
            const item = optimizer.items.find(i => i.id === id);
            if (item && code) {
                const data = getMaterialByCode(code);
                if (data) {
                    item.unitWeight = data.weight;
                    item.unitVolume = data.volume;
                    item.code = code;
                    
                    const infoInput = row.querySelector('[data-field="info"]');
                    if (infoInput) {
                        infoInput.value = `${data.weight}t / ${data.volume}m³`;
                    }
                    codeInput.style.borderColor = 'var(--primary-color)';
                } else {
                    const infoInput = row.querySelector('[data-field="info"]');
                    if (infoInput) {
                        infoInput.value = '';
                    }
                    codeInput.style.borderColor = '';
                }
            } else {
                const infoInput = row.querySelector('[data-field="info"]');
                if (infoInput) {
                    infoInput.value = '';
                }
                codeInput.style.borderColor = '';
            }
        }
    }
}

/**
 * 添加物品（增量更新，避免闪烁）
 */
export function addItem() {
    const newItem = optimizer.addItem();
    addItemToDOM(newItem);
    updateItemCount();
}

/**
 * 添加单个物品到DOM（增量更新）
 */
export function addItemToDOM(item) {
    const container = document.getElementById('itemContainer');
    
    const div = document.createElement('div');
    div.className = 'item-input-row item-row-pruntc';
    div.setAttribute('data-id', item.id);
    div.style.animation = 'itemSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    div.innerHTML = `
        <div class="form-group">
            <label>物品代码</label>
            <input type="text" placeholder="如: GRN" value="${escapeHtml(item.code)}" 
                data-field="code"
                data-id="${item.id}"
                class="code-input"
                oninput="onItemCodeInput(${item.id})"
                onchange="onItemCodeChange(${item.id})">
        </div>
        <div class="form-group">
            <label>现有库存</label>
            <input type="number" placeholder="库存" value="${item.inventory}" 
                data-field="inventory"
                data-id="${item.id}"
                min="0">
        </div>
        <div class="form-group">
            <label>每日消耗</label>
            <input type="number" placeholder="每日消耗" value="${item.dailyConsume}" 
                data-field="dailyConsume"
                data-id="${item.id}"
                min="0" step="0.01">
        </div>
        <div class="form-group">
            <label>单位重量/体积</label>
            <input type="text" placeholder="自动填充" value="${item.unitWeight}t / ${item.unitVolume}m³" 
                data-field="info"
                data-id="${item.id}"
                readonly
                style="background: var(--bg-input-readonly); cursor: not-allowed;">
        </div>
        <button class="btn-remove-item" onclick="removeItem(${item.id})" title="删除此物品">🗑️</button>
    `;
    
    container.appendChild(div);
    updateItemCount();
}

/**
 * 更新物品计数
 */
export function updateItemCount() {
    document.getElementById('itemCount').textContent = optimizer.items.length + ' 种物品';
}

/**
 * 渲染物品列表（首次加载时使用）
 */
export function renderItems() {
    const container = document.getElementById('itemContainer');
    container.innerHTML = '';
    updateItemCount();

    // 使用 DocumentFragment 批量处理，减少 DOM 重排
    const fragment = document.createDocumentFragment();
    optimizer.items.forEach((item) => {
        const itemElement = createItemElement(item);
        if (itemElement) {
            fragment.appendChild(itemElement);
        }
    });
    container.appendChild(fragment);
}

/**
 * 创建物品元素（用于批量处理）
 * @param {Object} item - 物品对象
 * @returns {HTMLElement} 物品元素
 */
function createItemElement(item) {
    const div = document.createElement('div');
    div.className = 'item-input-row item-row-pruntc';
    div.setAttribute('data-id', item.id);
    div.style.animation = 'itemSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    div.innerHTML = `
        <div class="form-group">
            <label>物品代码</label>
            <input type="text" placeholder="如: GRN" value="${escapeHtml(item.code)}" 
                data-field="code"
                data-id="${item.id}"
                class="code-input"
                oninput="onItemCodeInput(${item.id})"
                onchange="onItemCodeChange(${item.id})"></div>
        <div class="form-group">
            <label>现有库存</label>
            <input type="number" placeholder="库存" value="${item.inventory}" 
                data-field="inventory"
                data-id="${item.id}"
                min="0"></div>
        <div class="form-group">
            <label>每日消耗</label>
            <input type="number" placeholder="每日消耗" value="${item.dailyConsume}" 
                data-field="dailyConsume"
                data-id="${item.id}"
                min="0" step="0.01"></div>
        <div class="form-group">
            <label>单位重量/体积</label>
            <input type="text" placeholder="自动填充" value="${item.unitWeight}t / ${item.unitVolume}m³" 
                data-field="info"
                data-id="${item.id}"
                readonly
                style="background: var(--bg-input-readonly); cursor: not-allowed;"></div>
        <button class="btn-remove-item" onclick="removeItem(${item.id})" title="删除此物品">🗑️</button>
    `;
    return div;
}

/**
 * 添加单个物品到DOM（增量更新）
 */
export function addItemToDOM(item) {
    const container = document.getElementById('itemContainer');
    const itemElement = createItemElement(item);
    if (itemElement) {
        container.appendChild(itemElement);
        updateItemCount();
    }
}

/**
 * 初始化事件委托
 */
export function initEventDelegation() {
    const container = document.getElementById('itemContainer');
    
    container.addEventListener('input', function(e) {
        const input = e.target;
        if (input.tagName !== 'INPUT') return;
        
        const id = parseInt(input.dataset.id);
        const field = input.dataset.field;
        
        if (!id || !field) return;
        
        // 代码字段实时转换为大写并触发匹配
        if (field === 'code') {
            input.value = input.value.toUpperCase();
            autoMatchMaterial(id, input.value);
        }
    });
    
    container.addEventListener('change', function(e) {
        const input = e.target;
        if (input.tagName !== 'INPUT') return;
        
        const id = parseInt(input.dataset.id);
        const field = input.dataset.field;
        const value = input.value;
        
        if (!id || !field) return;
        
        optimizer.updateItem(id, field, value);
        
        // 代码字段在change时立即执行匹配
        if (field === 'code') {
            input.value = input.value.toUpperCase();
            autoMatchMaterial(id, input.value);
        }
    });

    container.addEventListener('blur', function(e) {
        const input = e.target;
        if (input.dataset.field === 'code') {
            const id = parseInt(input.dataset.id);
            input.value = input.value.toUpperCase();
            autoMatchMaterial(id, input.value);
        }
    }, true);

    container.addEventListener('click', function(e) {
        const btn = e.target.closest('[data-action="delete"]');
        if (!btn) return;
        
        const id = parseInt(btn.dataset.id);
        showConfirm('确定要删除这个物品吗？', () => {
            optimizer.removeItem(id);
            renderItems();
            showNotification('物品已删除', 'success');
        });
    });
}

/**
 * 更新物品信息
 */
export function updateItem(id, field, value) {
    optimizer.updateItem(id, field, value);
}

/**
 * 删除物品（增量更新，避免闪烁）
 */
export function removeItem(id) {
    showConfirm('确定要删除这个物品吗？', () => {
        const row = document.querySelector(`[data-id="${id}"]`);
        if (row) {
            // 添加淡出动画
            row.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => {
                optimizer.removeItem(id);
                row.remove();
                updateItemCount();
                showNotification('物品已删除', 'success');
            }, 300);
        } else {
            optimizer.removeItem(id);
            updateItemCount();
            showNotification('物品已删除', 'success');
        }
    });
}

/**
 * 清空所有物品
 */
export function clearAllItems() {
    if (optimizer.items.length === 0) {
        showNotification('没有物品可清空', 'info');
        return;
    }
    showConfirm(`确定要清空所有 ${optimizer.items.length} 个物品吗？`, () => {
        optimizer.clearAllItems();
        renderItems();
        showNotification('所有物品已清空', 'success');
    });
}

/**
 * 加载示例数据
 */
export function loadExampleData() {
    const loadData = () => {
        optimizer.clearAllItems();
        // 来自需求规范的示例数据
        optimizer.addItem('GRN', 875, 187.5, 0.9, 1.0);
        optimizer.addItem('NUT', 965, 187.5, 0.9, 1.0);
        optimizer.addItem('MUS', 853, 187.5, 0.8, 1.0);
        optimizer.addItem('DW', 224, 44.8, 0.1, 0.1);
        optimizer.addItem('OVE', 28, 5.6, 0.02, 0.025);
        optimizer.addItem('COF', 28, 5.6, 0.1, 0.1);
        optimizer.addItem('PWO', 11, 2.24, 0.05, 0.05);
        renderItems();
        showNotification('示例数据已加载', 'success');
    };

    if (optimizer.items.length > 0) {
        showConfirm('当前已有物品，是否覆盖加载示例数据？', loadData);
    } else {
        loadData();
    }
}

/**
 * 执行优化计算
 */
export function optimize() {
    const btn = document.querySelector('.btn-primary');
    try {
        btn.classList.add('loading');
        
        const capacityWeight = parseFloat(document.getElementById('capacityWeight').value) || 2000;
        const capacityVolume = parseFloat(document.getElementById('capacityVolume').value) || 2000;

        if (optimizer.items.length === 0) {
            showNotification('请添加物品！', 'warning');
            return;
        }

        const result = optimizer.optimize(capacityWeight, capacityVolume);

        if (!result) {
            showNotification('无法找到满足约束的装载方案！请检查输入数据或增加船舱容量。', 'warning');
            return;
        }

        displayResults(result, capacityWeight, capacityVolume);
        showNotification('计算完成！', 'success');
    } catch (error) {
        console.error('优化计算错误:', error);
        showNotification('计算过程中发生错误: ' + error.message, 'error');
    } finally {
        if (btn) {
            btn.classList.remove('loading');
        }
    }
}

/**
 * 显示优化结果
 * @param {Object} result - 优化结果
 * @param {number} capacityWeight - 重量容量
 * @param {number} capacityVolume - 体积容量
 */
export function displayResults(result, capacityWeight, capacityVolume) {
    const weightRate = result.totalWeight / capacityWeight;
    const volumeRate = result.totalVolume / capacityVolume;
    const bottleneck = weightRate > volumeRate ? '重量' : '体积';

    document.getElementById('optimalDays').textContent = round(result.optimalDays, 2);
    document.getElementById('fillRate').textContent = (result.fillRate * 100).toFixed(2) + '%';
    document.getElementById('totalWeight').textContent = round(result.totalWeight, 2);
    document.getElementById('totalVolume').textContent = round(result.totalVolume, 2);

    document.getElementById('weightText').textContent = round(result.totalWeight, 2) + ' / ' + capacityWeight + ' t';
    document.getElementById('volumeText').textContent = round(result.totalVolume, 2) + ' / ' + capacityVolume + ' m³';
    document.getElementById('bottleneckText').textContent = bottleneck + ' (' + (Math.max(weightRate, volumeRate) * 100).toFixed(2) + '%)';

    // 使用 transform 设置进度条，性能更好
    document.getElementById('weightProgress').style.transform = `scaleX(${Math.min(weightRate, 1)})`;
    document.getElementById('volumeProgress').style.transform = `scaleX(${Math.min(volumeRate, 1)})`;
    document.getElementById('bottleneckProgress').style.transform = `scaleX(${Math.min(Math.max(weightRate, volumeRate), 1)})`;

    const resultList = document.getElementById('resultList');
    resultList.innerHTML = '';

    result.load.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="highlight">${escapeHtml(r.code)}</span></td>
            <td>${r.loadAmount.toLocaleString()}</td>
            <td>${round(r.weight, 2)}</td>
            <td>${round(r.volume, 2)}</td>
            <td>${r.targetInventory.toLocaleString()}</td>
            <td>${round(r.days, 2)} 天</td>
        `;
        resultList.appendChild(tr);
    });

    document.getElementById('resultCard').classList.add('show');
    document.getElementById('resultCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * 初始化FIO API事件
 */
export function initFioApiEvents() {
    // 从本地存储恢复认证信息
    restoreFioAuth();
}

/**
 * 页面初始化
 */
export function init() {
    initTheme();
    document.getElementById('shipType').value = 'SCB';
    updateShipCapacity();
    initEventDelegation();
    initFioApiEvents();
    // 添加两个默认物品行
    addItem();
    addItem();
}

// 导出公共方法
export {
    optimizer
};