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
    // 缓存 calculateLoadForDays 结果
    #loadCache = new Map();
    // 最大load缓存大小
    #maxLoadCacheSize = 200;
    
    constructor() {
        /** @type {Item[]} */
        this.items = [];
        this.nextId = 1;
        /** @type {Map<string, OptimizeResult>} */
        this.cache = new Map();
        this.maxCacheSize = 50; // 增加缓存大小
        this.cacheAccessOrder = []; // 用于 LRU 缓存
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
        const newItem = {
            id,
            code: code.toUpperCase(),
            inventory: round(Math.max(0, inventory)),
            dailyConsume: round(Math.max(0, dailyConsume), 3),
            unitWeight: round(Math.max(0, unitWeight), 4),
            unitVolume: round(Math.max(0, unitVolume), 4)
        };
        this.items.push(newItem);
        
        this.clearCache();
        return newItem;
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
     * 简单哈希函数
     * @param {string} str - 输入字符串
     * @returns {number} 哈希值
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return Math.abs(hash);
    }

    /**
     * 清空缓存
     */
    clearCache() {
        this.cache.clear();
        this.cacheAccessOrder = [];
        this.#loadCache.clear();
    }

    /**
     * 计算指定天数下的装载方案
     * @param {Item[]} validItems - 有效物品列表
     * @param {number} days - 目标天数
     * @returns {LoadResult} 装载方案
     */
    calculateLoadForDays(validItems, days) {
        // 生成更精确的缓存键，包含物品信息
        const itemsKey = validItems
            .sort((a, b) => a.code.localeCompare(b.code))
            .map(i => `${i.code}:${i.inventory}:${i.dailyConsume}:${i.unitWeight}:${i.unitVolume}`)
            .join('|');
        const cacheKey = `load_${days.toFixed(6)}_${this.simpleHash(itemsKey)}`;
        
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
        
        // 限制load缓存大小
        if (this.#loadCache.size >= this.#maxLoadCacheSize) {
            const firstKey = this.#loadCache.keys().next().value;
            this.#loadCache.delete(firstKey);
        }
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
        const earlyTerminationThreshold = 0.999;

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
        if (!bestLoad || bestFillRate > 1) {
            let fallbackDays = 0.001;
            let fallbackResult = null;
            const searchLimit = Math.min(maxSearchDays, 1000);
            for (let testDays = 0.001; testDays <= searchLimit; testDays += 0.5) {
                const result = this.calculateLoadForDays(validItems, testDays);
                if (result.totalWeight <= capacityWeight && result.totalVolume <= capacityVolume) {
                    fallbackDays = testDays;
                    fallbackResult = result;
                    break;
                }
            }
            if (!fallbackResult) {
                fallbackDays = 0.001;
                fallbackResult = this.calculateLoadForDays(validItems, fallbackDays);
            }
            bestLoad = fallbackResult.load;
            bestDays = fallbackDays;
            bestFillRate = Math.max(fallbackResult.totalWeight / capacityWeight, fallbackResult.totalVolume / capacityVolume);
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
     * 设置缓存（LRU 策略）
     * @param {string} key - 缓存键
     * @param {OptimizeResult} value - 缓存值
     */
    setCache(key, value) {
        // 移除已存在的键（如果有）
        if (this.cache.has(key)) {
            const index = this.cacheAccessOrder.indexOf(key);
            if (index > -1) {
                this.cacheAccessOrder.splice(index, 1);
            }
        } else if (this.cache.size >= this.maxCacheSize) {
            // 删除最久未使用的项
            const lruKey = this.cacheAccessOrder.shift();
            if (lruKey) {
                this.cache.delete(lruKey);
            }
        }
        
        // 添加到缓存和访问顺序
        this.cache.set(key, value);
        this.cacheAccessOrder.push(key);
    }
}

const optimizer = new CargoOptimizer();

// 使用 Utils 模块（如果可用）
const round = typeof Utils !== 'undefined' ? Utils.round : (n, d) => Number(n.toFixed(d || 2));
const escapeHtml = typeof Utils !== 'undefined' ? Utils.escapeHtml : (t) => t;
const debounce = typeof Utils !== 'undefined' ? Utils.debounce : (f, w) => f;

/**
 * 更新船舱容量
 */
function updateShipCapacity() {
    const shipType = document.getElementById('shipType').value;
    if (shipType && shipTypes[shipType]) {
        document.getElementById('capacityWeight').value = shipTypes[shipType].weight;
        document.getElementById('capacityVolume').value = shipTypes[shipType].volume;
    }
    // 同步更新显示值
    updateCapacityDisplay();
}

/**
 * 更新容量显示值
 */
function updateCapacityDisplay() {
    // 容量显示已移至输入框，此函数保留用于兼容性
    // 实际值直接显示在输入框中
}

/**
 * 验证容量输入
 * @param {string} type - 类型（'weight' 或 'volume'）
 */
function validateCapacityInput(type) {
    const shipType = document.getElementById('shipType').value;
    const input = document.getElementById(type === 'weight' ? 'capacityWeight' : 'capacityVolume');
    const value = parseFloat(input.value);
    
    // 基本验证：确保值是有效的正数
    if (!isFinite(value) || value <= 0) {
        // 如果有选择船舱类型，恢复为船舱默认值；否则设为0
        if (shipType && shipTypes[shipType]) {
            input.value = type === 'weight' ? shipTypes[shipType].weight : shipTypes[shipType].volume;
        } else {
            input.value = 0;
        }
        return;
    }
    
    // 如果选择了船舱类型，限制不能超过船舱最大容量
    if (shipType && shipTypes[shipType]) {
        const maxValue = type === 'weight' ? shipTypes[shipType].weight : shipTypes[shipType].volume;
        if (value > maxValue) {
            input.value = maxValue;
            showNotification(`容量不能超过船舱最大限制：${maxValue}${type === 'weight' ? '吨' : 'm³'}`, 'warning');
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
    const dbItem = materialDB[upperCode];
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
function onItemCodeInput(id) {
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
function onItemCodeChange(id) {
    const row = document.querySelector(`[data-id="${id}"]`);
    if (row) {
        const codeInput = row.querySelector('[data-field="code"]');
        if (codeInput) {
            // 强制转换为大写
            codeInput.value = codeInput.value.toUpperCase();
            const code = codeInput.value;
            
            const item = optimizer.items.find(i => i.id === id);
            if (item && code && typeof materialDB !== 'undefined' && materialDB[code]) {
                const data = materialDB[code];
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
        }
    }
}

/**
 * 添加物品（增量更新，避免闪烁）
 */
function addItem() {
    const newItem = optimizer.addItem();
    addItemToDOM(newItem);
    updateItemCount();
}

/**
 * 添加单个物品到DOM（增量更新）
 */
function addItemToDOM(item) {
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
function updateItemCount() {
    document.getElementById('itemCount').textContent = optimizer.items.length + ' 种物品';
}

/**
 * 渲染物品列表（首次加载时使用）
 */
function renderItems() {
    const container = document.getElementById('itemContainer');
    container.innerHTML = '';
    updateItemCount();

    optimizer.items.forEach((item) => {
        addItemToDOM(item);
    });
}

/**
 * 初始化事件委托
 */
function initEventDelegation() {
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
function updateItem(id, field, value) {
    optimizer.updateItem(id, field, value);
}

/**
 * 删除物品（增量更新，避免闪烁）
 */
function removeItem(id) {
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
        if (btn) {
            btn.classList.remove('loading');
        }
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
    initFioApiEvents();
    // 添加两个默认物品行
    addItem();
    addItem();
};

// FIO API 相关函数
let fioAuthToken = null;
let fioUsername = null;
let fioAuthType = 'password';

/**
 * FIO API 登录
 */
async function fioLogin() {
    const authType = document.getElementById('fioAuthType').value;
    const username = document.getElementById('fioUsername').value;
    const password = document.getElementById('fioPassword').value;
    const apiKey = document.getElementById('fioApiKey').value;
    const statusDiv = document.getElementById('apiStatus');
    
    if (authType === 'password') {
        if (!username || !password) {
            statusDiv.innerHTML = '<span style="color: red;">请输入用户名和密码</span>';
            return;
        }
    } else {
        if (!username || !apiKey) {
            statusDiv.innerHTML = '<span style="color: red;">请输入用户名和 API 密钥</span>';
            return;
        }
    }
    
    statusDiv.innerHTML = '<span style="color: blue;">正在登录...</span>';
    
    try {
        if (authType === 'password') {
            // 使用用户名密码登录
            const response = await fetch('https://rest.fnar.net/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    UserName: username,
                    Password: password
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`登录失败: ${response.status} ${response.statusText} ${errorData.message || ''}`);
            }
            
            const data = await response.json();
            fioAuthToken = data.AuthToken;
            fioUsername = username;
            fioAuthType = authType;
            
            // 保存认证信息到 localStorage
            localStorage.setItem('fioAuthToken', fioAuthToken);
            localStorage.setItem('fioUsername', fioUsername);
            localStorage.setItem('fioAuthType', fioAuthType);
        } else {
            // 使用 API 密钥登录（直接设置为认证令牌）
            fioAuthToken = apiKey;
            fioUsername = username;
            fioAuthType = authType;
            
            // 保存认证信息到 localStorage
            localStorage.setItem('fioAuthToken', fioAuthToken);
            localStorage.setItem('fioUsername', fioUsername);
            localStorage.setItem('fioAuthType', fioAuthType);
        }
        
        statusDiv.innerHTML = '<span style="color: green;">登录成功！</span>';
        
        // 测试认证是否成功
        const testResponse = await fetch(`https://rest.fnar.net/sites/planets/${fioUsername}`, {
            headers: {
                'Authorization': fioAuthToken
            }
        });
        
        if (!testResponse.ok) {
            throw new Error(`认证失败: ${testResponse.status} ${testResponse.statusText}`);
        }
        
        // 获取基地列表
        await fioGetBases();
    } catch (error) {
        statusDiv.innerHTML = `<span style="color: red;">登录失败: ${error.message}</span>`;
        clearAuthStorage();
    }
}

/**
 * 获取用户基地列表
 */
async function fioGetBases() {
    if (!fioAuthToken || !fioUsername) {
        return;
    }
    
    const statusDiv = document.getElementById('apiStatus');
    statusDiv.innerHTML = '<span style="color: blue;">正在获取基地列表...</span>';
    
    try {
        // 获取用户有站点的星球
        const response = await fetch(`https://rest.fnar.net/sites/planets/${fioUsername}`, {
            headers: {
                'Authorization': fioAuthToken
            }
        });
        
        if (!response.ok) {
            throw new Error('获取基地列表失败');
        }
        
        const planets = await response.json();
        
        if (planets.length === 0) {
            statusDiv.innerHTML = '<span style="color: orange;">未找到基地</span>';
            return;
        }
        
        // 获取每个基地的详细信息，提取星球名称
        const baseInfoList = [];
        for (const planetId of planets) {
            try {
                const siteResponse = await fetch(`https://rest.fnar.net/sites/${fioUsername}/${planetId}`, {
                    headers: {
                        'Authorization': fioAuthToken
                    }
                });
                
                if (siteResponse.ok) {
                    const siteData = await siteResponse.json();
                    const planetName = siteData.PlanetName || siteData.planetName || planetId;
                    baseInfoList.push({ planetId, planetName });
                    console.log(`基地 ${planetId} 的名称: ${planetName}`);
                } else {
                    // 如果获取失败，使用 ID 作为名称
                    baseInfoList.push({ planetId, planetName: planetId });
                }
            } catch (error) {
                // 如果出错，使用 ID 作为名称
                baseInfoList.push({ planetId, planetName: planetId });
            }
        }
        
        // 显示基地选择界面
        const baseSelectionSection = document.getElementById('baseSelectionSection');
        const baseList = document.getElementById('baseList');
        
        baseSelectionSection.style.display = 'block';
        baseList.innerHTML = '';
        
        // 为每个星球创建复选框
        baseInfoList.forEach(base => {
            const baseItem = document.createElement('div');
            baseItem.className = 'base-item';
            baseItem.innerHTML = `
                <input type="checkbox" id="base-${base.planetId}" value="${base.planetId}" data-name="${base.planetName}">
                <label for="base-${base.planetId}">${base.planetName}</label>
            `;
            baseList.appendChild(baseItem);
        });
        
        statusDiv.innerHTML = `<span style="color: green;">找到 ${baseInfoList.length} 个基地</span>`;
    } catch (error) {
        statusDiv.innerHTML = `<span style="color: red;">获取基地列表失败: ${error.message}</span>`;
    }
}

/**
 * 加载选中基地的消耗品数据
 */
async function loadSelectedBases() {
    if (!fioAuthToken || !fioUsername) {
        document.getElementById('apiStatus').innerHTML = '<span style="color: red;">请先登录</span>';
        return;
    }
    
    // 获取选中的基地
    const checkboxes = document.querySelectorAll('#baseList input[type="checkbox"]:checked');
    const selectedBases = Array.from(checkboxes).map(cb => {
        const planetId = cb.value;
        const planetName = cb.getAttribute('data-name') || planetId;
        return { planetId, planetName };
    });
    
    if (selectedBases.length === 0) {
        document.getElementById('apiStatus').innerHTML = '<span style="color: red;">请选择至少一个基地</span>';
        return;
    }
    
    document.getElementById('apiStatus').innerHTML = '<span style="color: blue;">正在加载基地数据...</span>';
    
    try {
        const allConsumables = new Map();
        const allStorage = new Map();
        
        // 遍历选中的基地
        for (const base of selectedBases) {
            // 获取基地的生产数据（消耗品）
            const productionResponse = await fetch(`https://rest.fnar.net/production/${fioUsername}/${base.planetId}`, {
                headers: {
                    'Authorization': fioAuthToken
                }
            });
            
            if (productionResponse.ok) {
                const productionData = await productionResponse.json();
                
                // 处理生产数据，提取消耗品和生产原料
                if (productionData) {
                    // 显示生产线输入品消耗量汇总
                    let productionConsumeTotal = {};
                    
                    // 检查数据结构
                    if (Array.isArray(productionData)) {
                        productionData.forEach(line => {
                            // 参考 BURN 模块的计算逻辑
                            const capacity = line.Capacity || line.capacity || 1;
                            const efficiency = line.Efficiency || line.efficiency || 1;
                            
                            // 处理 Orders 数组（循环订单）
                            if (line.Orders && Array.isArray(line.Orders)) {
                                const burnOrders = line.Orders;
                                
                                // 计算生产线的基础消耗率
                                let productionConsumeRate = {};
                                let totalDurationMs = 0;
                                let activeOrderCount = 0;
                                
                                // 遍历所有订单，统计每种材料的总输入量和总生产时间
                                burnOrders.forEach(order => {
                                    // 跳过 StartedEpochMs 为 null 的等待订单
                                    if (order.StartedEpochMs === null || order.StartedEpochMs === undefined) {
                                        return;
                                    }
                                    
                                    activeOrderCount++;
                                    
                                    // 获取生产周期时间（毫秒）
                                    const durationMs = order.DurationMs || 0;
                                    totalDurationMs += durationMs;
                                    
                                    // 只处理订单输入（生产原料），不处理输出
                                    if (order.Inputs && Array.isArray(order.Inputs)) {
                                        order.Inputs.forEach(input => {
                                            if (input.MaterialTicker && input.MaterialAmount) {
                                                productionConsumeRate[input.MaterialTicker] = (productionConsumeRate[input.MaterialTicker] || 0) + input.MaterialAmount;
                                            } else if (input.Ticker && input.Amount) {
                                                productionConsumeRate[input.Ticker] = (productionConsumeRate[input.Ticker] || 0) + input.Amount;
                                            }
                                        });
                                    } else if (order.inputs && Array.isArray(order.inputs)) {
                                        order.inputs.forEach(input => {
                                            if (input.materialTicker && input.materialAmount) {
                                                productionConsumeRate[input.materialTicker] = (productionConsumeRate[input.materialTicker] || 0) + input.materialAmount;
                                            } else if (input.ticker && input.amount) {
                                                productionConsumeRate[input.ticker] = (productionConsumeRate[input.ticker] || 0) + input.amount;
                                            }
                                        });
                                    }
                                });
                                
                                // 计算每日循环次数：86400000ms / 总DurationMs
                                const avgDurationMs = activeOrderCount > 0 ? totalDurationMs / activeOrderCount : 86400000;
                                const cyclesPerDay = avgDurationMs > 0 ? 86400000 / avgDurationMs : 1;
                                
                                // 计算每种材料的日消耗率 = 总输入量 × 每日循环次数
                                for (const [ticker, totalInput] of Object.entries(productionConsumeRate)) {
                                    const rate = totalInput * cyclesPerDay;
                                    allConsumables.set(ticker, (allConsumables.get(ticker) || 0) + rate);
                                    productionConsumeTotal[ticker] = (productionConsumeTotal[ticker] || 0) + rate;
                                }
                            }
                        });
                    }
                }
            } else {
                console.log(`获取生产数据失败 (${base.planetName}):`, productionResponse.status, productionResponse.statusText);
            }
            
            // 获取劳动力数据（消耗品）
            try {
                const workforceResponse = await fetch(`https://rest.fnar.net/workforce/${fioUsername}/${base.planetId}`, {
                    headers: {
                        'Authorization': fioAuthToken
                    }
                });
                    
                if (workforceResponse.ok) {
                    const workforceData = await workforceResponse.json();
                        
                    // 显示工人日常消耗汇总
                    let workforceConsumeTotal = {};
                        
                    // 处理劳动力需求（消耗品）
                    if (workforceData) {
                        // 检查数据结构
                        if (workforceData.Workforces && Array.isArray(workforceData.Workforces)) {
                            // 处理 Workforces 数组
                            workforceData.Workforces.forEach(tier => {
                                if (tier.Population > 1 && tier.Capacity > 0) {
                                    // WorkforceNeeds 是劳动力的日常消耗品（如 RAT、DW、OVE）
                                    if (tier.WorkforceNeeds && Array.isArray(tier.WorkforceNeeds)) {
                                        tier.WorkforceNeeds.forEach(need => {
                                            if (need.MaterialTicker && need.UnitsPerInterval) {
                                                const currentRate = allConsumables.get(need.MaterialTicker) || 0;
                                                allConsumables.set(need.MaterialTicker, currentRate + need.UnitsPerInterval);
                                                workforceConsumeTotal[need.MaterialTicker] = (workforceConsumeTotal[need.MaterialTicker] || 0) + need.UnitsPerInterval;
                                            } else if (need.materialTicker && need.unitsPerInterval) {
                                                const currentRate = allConsumables.get(need.materialTicker) || 0;
                                                allConsumables.set(need.materialTicker, currentRate + need.unitsPerInterval);
                                                workforceConsumeTotal[need.materialTicker] = (workforceConsumeTotal[need.materialTicker] || 0) + need.unitsPerInterval;
                                            } else if (need.Ticker && need.Rate) {
                                                const currentRate = allConsumables.get(need.Ticker) || 0;
                                                allConsumables.set(need.Ticker, currentRate + need.Rate);
                                                workforceConsumeTotal[need.Ticker] = (workforceConsumeTotal[need.Ticker] || 0) + need.Rate;
                                            } else if (need.ticker && need.rate) {
                                                const currentRate = allConsumables.get(need.ticker) || 0;
                                                allConsumables.set(need.ticker, currentRate + need.rate);
                                                workforceConsumeTotal[need.ticker] = (workforceConsumeTotal[need.ticker] || 0) + need.rate;
                                            }
                                        });
                                    }
                                }
                            });
                        } else if (Array.isArray(workforceData)) {
                            // 处理数组结构
                            workforceData.forEach(tier => {
                                if (tier.Population > 1 && tier.Capacity > 0) {
                                    // WorkforceNeeds 是劳动力的日常消耗品（如 RAT、DW、OVE）
                                    if (tier.WorkforceNeeds && Array.isArray(tier.WorkforceNeeds)) {
                                        tier.WorkforceNeeds.forEach(need => {
                                            if (need.MaterialTicker && need.UnitsPerInterval) {
                                                const currentRate = allConsumables.get(need.MaterialTicker) || 0;
                                                allConsumables.set(need.MaterialTicker, currentRate + need.UnitsPerInterval);
                                                workforceConsumeTotal[need.MaterialTicker] = (workforceConsumeTotal[need.MaterialTicker] || 0) + need.UnitsPerInterval;
                                            } else if (need.materialTicker && need.unitsPerInterval) {
                                                const currentRate = allConsumables.get(need.materialTicker) || 0;
                                                allConsumables.set(need.materialTicker, currentRate + need.unitsPerInterval);
                                                workforceConsumeTotal[need.materialTicker] = (workforceConsumeTotal[need.materialTicker] || 0) + need.unitsPerInterval;
                                            }
                                        });
                                    }
                                }
                            });
                        }
                            
                        // 显示工人日常消耗汇总
                        console.log(`===== 工人日常消耗汇总 (${base.planetName}) =====`);
                        for (const [ticker, rate] of Object.entries(workforceConsumeTotal)) {
                            console.log(`  ${ticker}: ${rate}/天`);
                        }
                        console.log(`==========================================`);
                    }
                }
            } catch (error) {
                console.log(`获取劳动力数据出错:`, error);
            }
            
            // 获取基地的存储数据（当前库存）
            try {
                const storageResponse = await fetch(`https://rest.fnar.net/storage/${fioUsername}/${base.planetId}`, {
                    headers: {
                        'Authorization': fioAuthToken
                    }
                });
            
                if (storageResponse.ok) {
                    const storageData = await storageResponse.json();
                    
                    // 处理存储数据，获取当前库存
                    if (storageData) {
                        if (Array.isArray(storageData)) {
                            storageData.forEach(item => {
                                if (item.Ticker && item.Amount) {
                                    allStorage.set(item.Ticker, item.Amount);
                                }
                            });
                        } else if (storageData.StorageItems && Array.isArray(storageData.StorageItems)) {
                            // 处理 StorageItems 数组
                            storageData.StorageItems.forEach(item => {
                                if (item.MaterialTicker && item.MaterialAmount) {
                                    allStorage.set(item.MaterialTicker, item.MaterialAmount);
                                } else if (item.Ticker && item.Amount) {
                                    allStorage.set(item.Ticker, item.Amount);
                                }
                            });
                        }
                    }
                }
            } catch (error) {
                console.log(`获取存储数据出错:`, error);
            }
        }
        
        console.log(`所有消耗品:`, Object.fromEntries(allConsumables));
        console.log(`所有存储:`, Object.fromEntries(allStorage));
        
        // 只添加有消耗的物品到表单（根据用户要求：没有消耗的物品不要输入表单）
        const materialsWithConsume = new Set(allConsumables.keys());
        
        // 直接清空现有物品（不显示确认对话框）
        optimizer.clearAllItems();
        document.getElementById('itemContainer').innerHTML = '';
        updateItemCount();
        
        // 添加有消耗的物品到表单
        materialsWithConsume.forEach(materialCode => {
            const consumeRate = allConsumables.get(materialCode) || 0;
            const inventory = allStorage.get(materialCode) || 0;
            
            // 从 materialDB 获取单位重量和体积
            let unitWeight = 0;
            let unitVolume = 0;
            if (typeof materialDB !== 'undefined' && materialDB[materialCode]) {
                unitWeight = materialDB[materialCode].weight || 0;
                unitVolume = materialDB[materialCode].volume || 0;
            }
            
            // 直接使用 optimizer.addItem 添加完整数据
            const newItem = optimizer.addItem(materialCode, inventory, consumeRate, unitWeight, unitVolume);
            
            // 同时添加到 DOM
            addItemToDOM(newItem);
        });
        
        // 如果没有消耗品，尝试获取 burnrate 数据
        if (allConsumables.size === 0) {
            // 获取用户的 burnrate 数据
            const burnrateResponse = await fetch(`https://rest.fnar.net/usersettings/burnrate/${fioUsername}`, {
                headers: {
                    'Authorization': fioAuthToken
                }
            });
            
            if (burnrateResponse.ok) {
                const burnrateData = await burnrateResponse.json();
                console.log(`Burnrate 数据:`, burnrateData);
                
                // 处理 burnrate 数据
                if (burnrateData && Array.isArray(burnrateData)) {
                    burnrateData.forEach(item => {
                        if (item.MaterialTicker && item.BurnRate) {
                            allConsumables.set(item.MaterialTicker, item.BurnRate);
                            console.log(`添加燃烧率: ${item.MaterialTicker}, 速率: ${item.BurnRate}`);
                        }
                    });
                }
            } else {
                console.log(`获取 burnrate 数据失败:`, burnrateResponse.status, burnrateResponse.statusText);
                
                // 如果 burnrate 失败，尝试获取站点数据
                console.log('尝试获取站点数据...');
                for (const base of selectedBases) {
                    const sitesResponse = await fetch(`https://rest.fnar.net/sites/${fioUsername}/${base.planetId}`, {
                        headers: {
                            'Authorization': fioAuthToken
                        }
                    });
                    
                    if (sitesResponse.ok) {
                        const sitesData = await sitesResponse.json();
                        console.log(`基地 ${base.planetName} (${base.planetId}) 的站点数据:`, sitesData);
                    }
                }
            }
        }
        
        document.getElementById('apiStatus').innerHTML = `<span style="color: green;">成功加载 ${allConsumables.size} 种消耗品</span>`;
    } catch (error) {
        console.error('加载基地数据错误:', error);
        document.getElementById('apiStatus').innerHTML = `<span style="color: red;">加载基地数据失败: ${error.message}</span>`;
    }
}

/**
 * 切换认证表单显示
 */
function toggleAuthForm() {
    const authType = document.getElementById('fioAuthType').value;
    const usernameField = document.getElementById('usernameField');
    const passwordField = document.getElementById('passwordField');
    const apiKeyField = document.getElementById('apiKeyField');
    
    if (authType === 'password') {
        usernameField.style.display = 'flex';
        passwordField.style.display = 'flex';
        apiKeyField.style.display = 'none';
    } else {
        usernameField.style.display = 'flex';
        passwordField.style.display = 'none';
        apiKeyField.style.display = 'flex';
    }
}

/**
 * 初始化 FIO API 相关事件
 */
function initFioApiEvents() {
    // 从 localStorage 加载认证信息
    loadAuthFromStorage();
    
    // 这里可以添加 FIO API 相关的事件监听
}

/**
 * 从 localStorage 加载认证信息
 */
function loadAuthFromStorage() {
    const savedToken = localStorage.getItem('fioAuthToken');
    const savedUsername = localStorage.getItem('fioUsername');
    const savedAuthType = localStorage.getItem('fioAuthType');
    
    if (savedToken && savedUsername) {
        fioAuthToken = savedToken;
        fioUsername = savedUsername;
        fioAuthType = savedAuthType || 'password';
        
        // 恢复认证表单状态
        document.getElementById('fioAuthType').value = fioAuthType;
        document.getElementById('fioUsername').value = fioUsername;
        toggleAuthForm();
        
        // 自动测试认证是否有效
        testAuth();
    }
}

/**
 * 测试认证是否有效
 */
async function testAuth() {
    if (!fioAuthToken || !fioUsername) {
        return;
    }
    
    try {
        const response = await fetch(`https://rest.fnar.net/sites/planets/${fioUsername}`, {
            headers: {
                'Authorization': fioAuthToken
            }
        });
        
        if (response.ok) {
            document.getElementById('apiStatus').innerHTML = '<span style="color: green;">已自动登录</span>';
            await fioGetBases();
        }
    } catch (error) {
        // 认证失败，清除存储
        clearAuthStorage();
    }
}

/**
 * 清除认证存储
 */
function clearAuthStorage() {
    localStorage.removeItem('fioAuthToken');
    localStorage.removeItem('fioUsername');
    localStorage.removeItem('fioAuthType');
    fioAuthToken = null;
    fioUsername = null;
    fioAuthType = 'password';
}

/**
 * FIO API 登出
 */
function fioLogout() {
    clearAuthStorage();
    document.getElementById('fioUsername').value = '';
    document.getElementById('fioPassword').value = '';
    document.getElementById('fioApiKey').value = '';
    document.getElementById('fioAuthType').value = 'password';
    toggleAuthForm();
    document.getElementById('apiStatus').innerHTML = '<span style="color: orange;">已登出</span>';
    document.getElementById('baseSelectionSection').style.display = 'none';
    document.getElementById('baseList').innerHTML = '';
}