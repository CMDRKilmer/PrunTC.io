/**
 * 补给运输计算器 - 核心优化模块
 * @author CMDRKilmer
 * @version 2.1
 */

/**
 * @typedef {Object} Item
 * @property {number} id - 物品唯一标识
 * @property {string} code - 物品代码
 * @property {number} inventory - 现有库存
 * @property {number} dailyConsume - 每日消耗量
 * @property {number} unitWeight - 单位重量
 * @property {number} unitVolume - 单位体积
 */

/**
 * @typedef {Object} LoadResult
 * @property {number} totalWeight - 总重量
 * @property {number} totalVolume - 总体积
 * @property {Array} load - 装载详情
 */

/**
 * @typedef {Object} OptimizeResult
 * @property {number} optimalDays - 最优平衡天数
 * @property {number} fillRate - 填充率
 * @property {number} totalWeight - 总重量
 * @property {number} totalVolume - 总体积
 * @property {Array} load - 装载方案
 */

/**
 * 货舱优化器类
 * 负责管理物品、计算最优装载方案
 */
class CargoOptimizer {
    constructor() {
        /** @type {Item[]} */
        this.items = [];
        this.nextId = 1;
        /** @type {Map<string, OptimizeResult>} */
        this.cache = new Map();
        this.maxCacheSize = 10;
    }

    /**
     * 添加物品
     * @param {string} code - 物品代码
     * @param {number} inventory - 现有库存
     * @param {number} dailyConsume - 每日消耗量
     * @param {number} unitWeight - 单位重量
     * @param {number} unitVolume - 单位体积
     * @returns {number} 物品ID
     */
    addItem(code = '', inventory = 0, dailyConsume = 0, unitWeight = 0, unitVolume = 0) {
        this.validateItemInput({ code, inventory, dailyConsume, unitWeight, unitVolume });
        
        const id = this.nextId++;
        this.items.push({
            id,
            code: code.toUpperCase(),
            inventory: round(Math.max(0, inventory)),
            dailyConsume: round(Math.max(0, dailyConsume), 3),
            unitWeight: round(Math.max(0, unitWeight), 4),
            unitVolume: round(Math.max(0, unitVolume), 4)
        });
        
        this.clearCache();
        return id;
    }

    /**
     * 验证物品输入
     * @param {Object} item - 物品数据
     * @throws {Error} 验证失败时抛出错误
     */
    validateItemInput(item) {
        if (item.code && typeof item.code !== 'string') {
            throw new Error('物品代码必须是字符串');
        }
        if (!isFinite(item.inventory) || item.inventory < 0) {
            throw new Error('库存必须是有效的非负数');
        }
        if (!isFinite(item.dailyConsume) || item.dailyConsume < 0) {
            throw new Error('每日消耗量必须是有效的非负数');
        }
        if (!isFinite(item.unitWeight) || item.unitWeight < 0) {
            throw new Error('单位重量必须是有效的非负数');
        }
        if (!isFinite(item.unitVolume) || item.unitVolume < 0) {
            throw new Error('单位体积必须是有效的非负数');
        }
    }

    /**
     * 更新物品信息
     * @param {number} id - 物品ID
     * @param {string} field - 字段名
     * @param {*} value - 新值
     */
    updateItem(id, field, value) {
        const item = this.items.find(i => i.id === id);
        if (item) {
            if (field === 'code') {
                item[field] = value.toUpperCase();
            } else {
                const numValue = parseFloat(value);
                if (isFinite(numValue)) {
                    item[field] = round(Math.max(0, numValue), field === 'dailyConsume' ? 3 : 2);
                }
            }
            this.clearCache();
        }
    }

    /**
     * 删除物品
     * @param {number} id - 物品ID
     */
    removeItem(id) {
        this.items = this.items.filter(i => i.id !== id);
        this.clearCache();
    }

    /**
     * 清空所有物品
     */
    clearAllItems() {
        this.items = [];
        this.clearCache();
    }

    /**
     * 清空缓存
     */
    clearCache() {
        this.cache.clear();
        this.#loadCache.clear();
    }

    // 缓存 calculateLoadForDays 结果
    #loadCache = new Map();

    /**
     * 计算指定天数下的装载方案
     * @param {Item[]} validItems - 有效物品列表
     * @param {number} days - 目标天数
     * @returns {LoadResult} 装载方案
     */
    calculateLoadForDays(validItems, days) {
        const cacheKey = `load_${days.toFixed(6)}`;
        if (this.#loadCache.has(cacheKey)) {
            return this.#loadCache.get(cacheKey);
        }

        let totalWeight = 0;
        let totalVolume = 0;
        const load = [];

        // 预计算常量值
        const daysFixed = round(days, 3);

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
                weight: round(weight, 4),
                volume: round(volume, 4),
                targetInventory: round(item.inventory + loadAmount),
                days: daysFixed
            });
        }

        const result = {
            totalWeight: round(totalWeight, 4),
            totalVolume: round(totalVolume, 4),
            load
        };
        this.#loadCache.set(cacheKey, result);
        return result;
    }

    /**
     * 使用二分查找优化算法寻找最优装载方案
     * @param {number} capacityWeight - 重量容量
     * @param {number} capacityVolume - 体积容量
     * @returns {OptimizeResult|null} 优化结果
     */
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
            const mid = round((left + right) / 2, 6);
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
            optimalDays: round(bestDays, 3),
            fillRate: round(bestFillRate, 6),
            totalWeight: round(finalResult.totalWeight, 2),
            totalVolume: round(finalResult.totalVolume, 2),
            load: finalResult.load
        };

        // 缓存结果
        this.cache.set(cacheKey, result);
        return result;
    }

    /**
     * 生成缓存键
     * @param {number} capacityWeight - 重量容量
     * @param {number} capacityVolume - 体积容量
     * @returns {string} 缓存键
     */
    generateCacheKey(capacityWeight, capacityVolume) {
        const itemsKey = this.items.map(i => `${i.code}:${i.inventory}:${i.dailyConsume}`).join('|');
        return `${capacityWeight}-${capacityVolume}-${itemsKey}`;
    }

    /**
     * 设置缓存
     * @param {string} key - 缓存键
     * @param {OptimizeResult} value - 缓存值
     */
    setCache(key, value) {
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
    }
}

const optimizer = new CargoOptimizer();

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
 * 更新船舱容量
 */
function updateShipCapacity() {
    const shipType = document.getElementById('shipType').value;
    if (shipType && shipTypes[shipType]) {
        document.getElementById('capacityWeight').value = shipTypes[shipType].weight;
        document.getElementById('capacityVolume').value = shipTypes[shipType].volume;
    }
}

/**
 * 验证容量输入
 * @param {string} type - 类型（'weight' 或 'volume'）
 */
function validateCapacityInput(type) {
    const shipType = document.getElementById('shipType').value;
    if (shipType && shipTypes[shipType]) {
        const input = document.getElementById(type === 'weight' ? 'capacityWeight' : 'capacityVolume');
        const value = parseFloat(input.value);
        const maxValue = type === 'weight' ? shipTypes[shipType].weight : shipTypes[shipType].volume;
        
        if (!isFinite(value) || value <= 0) {
            input.value = maxValue;
        } else if (value > maxValue) {
            input.value = maxValue;
        }
    }
}

/**
 * 自动匹配材料（防抖处理）
 */
const autoMatchMaterial = debounce(function(id, code) {
    const item = optimizer.items.find(i => i.id === id);
    if (!item) return;

    const dbItem = materialDB[code];
    const hint = document.getElementById('matchHint');

    if (dbItem) {
        item.unitWeight = dbItem.weight;
        item.unitVolume = dbItem.volume;

        const row = document.querySelector(`[data-id="${id}"]`);
        if (row) {
            const weightInput = row.querySelector('[data-field="unitWeight"]');
            const volumeInput = row.querySelector('[data-field="unitVolume"]');

            if (weightInput) weightInput.value = dbItem.weight;
            if (volumeInput) volumeInput.value = dbItem.volume;
        }

        if (hint) {
            hint.textContent = '✓ 已自动匹配';
            setTimeout(() => { hint.textContent = ''; }, 2000);
        }
    } else {
        if (hint) {
            hint.textContent = '⚠ 未找到材料';
            setTimeout(() => { hint.textContent = ''; }, 2000);
        }
    }
}, 300);

/**
 * 添加物品
 */
function addItem() {
    optimizer.addItem();
    renderItems();
}

/**
 * 渲染物品列表（使用事件委托）
 */
function renderItems() {
    const container = document.getElementById('itemContainer');
    container.innerHTML = '';
    document.getElementById('itemCount').textContent = optimizer.items.length + ' 种物品';

    optimizer.items.forEach((item) => {
        const div = document.createElement('div');
        div.className = 'item-input-row';
        div.setAttribute('data-id', item.id);
        div.innerHTML = `
            <div class="form-group">
                <input type="text" placeholder="如: GRN" value="${escapeHtml(item.code)}" 
                    data-field="code"
                    data-id="${item.id}"
                    class="code-input">
            </div>
            <div class="form-group">
                <input type="number" placeholder="库存" value="${item.inventory}" 
                    data-field="inventory"
                    data-id="${item.id}"
                    min="0">
            </div>
            <div class="form-group">
                <input type="number" placeholder="每日消耗" value="${item.dailyConsume}" 
                    data-field="dailyConsume"
                    data-id="${item.id}"
                    min="0" step="0.01">
            </div>
            <div class="form-group">
                <input type="number" placeholder="单位重量" value="${item.unitWeight}" 
                    data-field="unitWeight"
                    data-id="${item.id}"
                    step="0.001" min="0" readonly>
            </div>
            <div class="form-group">
                <input type="number" placeholder="单位体积" value="${item.unitVolume}" 
                    data-field="unitVolume"
                    data-id="${item.id}"
                    step="0.001" min="0" readonly>
            </div>
            <div class="form-group">
                <button class="btn btn-danger" data-action="delete" data-id="${item.id}">删除</button>
            </div>
        `;
        container.appendChild(div);
    });
}

/**
 * 初始化事件委托
 */
function initEventDelegation() {
    const container = document.getElementById('itemContainer');
    
    container.addEventListener('change', function(e) {
        const input = e.target;
        if (input.tagName !== 'INPUT') return;
        
        const id = parseInt(input.dataset.id);
        const field = input.dataset.field;
        const value = input.value;
        
        if (!id || !field) return;
        
        optimizer.updateItem(id, field, value);
        
        if (field === 'code') {
            autoMatchMaterial(id, value.toUpperCase());
        }
    });

    container.addEventListener('blur', function(e) {
        const input = e.target;
        if (input.dataset.field === 'code') {
            const id = parseInt(input.dataset.id);
            autoMatchMaterial(id, input.value.toUpperCase());
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
function updateItem(id, field, value) {
    optimizer.updateItem(id, field, value);
}

/**
 * 删除物品
 */
function removeItem(id) {
    showConfirm('确定要删除这个物品吗？', () => {
        optimizer.removeItem(id);
        renderItems();
        showNotification('物品已删除', 'success');
    });
}

/**
 * 清空所有物品
 */
function clearAllItems() {
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
function loadExampleData() {
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
function optimize() {
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
        btn.classList.remove('loading');
    }
}

/**
 * 显示优化结果
 * @param {OptimizeResult} result - 优化结果
 * @param {number} capacityWeight - 重量容量
 * @param {number} capacityVolume - 体积容量
 */
function displayResults(result, capacityWeight, capacityVolume) {
    const weightRate = result.totalWeight / capacityWeight;
    const volumeRate = result.totalVolume / capacityVolume;
    const bottleneck = weightRate > volumeRate ? '重量' : '体积';

    document.getElementById('optimalDays').textContent = result.optimalDays.toFixed(2);
    document.getElementById('fillRate').textContent = (result.fillRate * 100).toFixed(2) + '%';
    document.getElementById('totalWeight').textContent = result.totalWeight.toFixed(2);
    document.getElementById('totalVolume').textContent = result.totalVolume.toFixed(2);

    document.getElementById('weightText').textContent = result.totalWeight.toFixed(2) + ' / ' + capacityWeight + ' t';
    document.getElementById('volumeText').textContent = result.totalVolume.toFixed(2) + ' / ' + capacityVolume + ' m³';
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
            <td>${r.weight.toFixed(2)}</td>
            <td>${r.volume.toFixed(2)}</td>
            <td>${r.targetInventory.toLocaleString()}</td>
            <td>${r.days.toFixed(2)} 天</td>
        `;
        resultList.appendChild(tr);
    });

    document.getElementById('resultCard').classList.add('show');
    document.getElementById('resultCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * 切换主题
 */
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

/**
 * 初始化主题
 */
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

/**
 * 显示通知提示（替代 alert）
 * @param {string} message - 提示信息
 * @param {string} type - 提示类型: 'error' | 'warning' | 'success' | 'info'
 */
function showNotification(message, type = 'error') {
    // 移除已有的提示
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;

    // 图标映射
    const icons = {
        error: '❌',
        warning: '⚠️',
        success: '✅',
        info: 'ℹ️'
    };

    notification.innerHTML = `
        <span class="notification-icon">${icons[type] || 'ℹ️'}</span>
        <span class="notification-message">${escapeHtml(message)}</span>
        <button class="notification-close" onclick="this.parentElement.remove()">✕</button>
    `;

    document.body.appendChild(notification);

    // 自动移除
    setTimeout(() => {
        if (notification.parentElement) {
            notification.classList.add('notification-hiding');
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

/**
 * 显示确认对话框（替代 confirm）
 * @param {string} message - 确认消息
 * @param {Function} onConfirm - 确认回调
 * @param {Function} onCancel - 取消回调（可选）
 */
function showConfirm(message, onConfirm, onCancel) {
    // 移除已有的对话框
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

    // 绑定事件
    dialog.querySelector('.confirm-ok').addEventListener('click', () => {
        dialog.remove();
        if (onConfirm) onConfirm();
    });

    dialog.querySelector('.confirm-cancel').addEventListener('click', () => {
        dialog.remove();
        if (onCancel) onCancel();
    });

    dialog.querySelector('.confirm-overlay').addEventListener('click', () => {
        dialog.remove();
        if (onCancel) onCancel();
    });
}

/**
 * 全局错误处理
 */
window.addEventListener('error', function(e) {
    console.error('全局错误:', e.error);
    showNotification('发生错误: ' + e.error?.message, 'error');
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('未处理的Promise拒绝:', e.reason);
    showNotification('异步操作失败: ' + e.reason?.message, 'error');
});

window.onload = function() {
    initTheme();
    document.getElementById('shipType').value = 'SCB';
    updateShipCapacity();
    initEventDelegation();
};
