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
        this.maxCacheSize = 50; // 增加缓存大小
        this.cacheAccessOrder = []; // 用于 LRU 缓存
        this.#loadCache = new Map(); // 装载计算缓存
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
     * 清空缓存
     */
    clearCache() {
        this.cache.clear();
        this.#loadCache.clear();
        this.cacheAccessOrder = [];
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
        // 生成更精确的缓存键
        const itemsKey = validItems
            .sort((a, b) => a.code.localeCompare(b.code))
            .map(i => `${i.id}:${i.inventory}:${i.dailyConsume}:${i.unitWeight}:${i.unitVolume}`)
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
        
        // 限制缓存大小
        if (this.#loadCache.size >= 200) {
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
        const cachedResult = this.getCache(cacheKey);
        if (cachedResult) {
            return cachedResult;
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
     * 生成更紧凑的缓存键
     * @param {number} capacityWeight - 重量容量
     * @param {number} capacityVolume - 体积容量
     * @returns {string} 缓存键
     */
    generateCacheKey(capacityWeight, capacityVolume) {
        // 使用更紧凑的格式，只包含关键信息
        const itemsKey = this.items
            .sort((a, b) => a.code.localeCompare(b.code)) // 排序确保顺序一致
            .map(i => `${i.code}:${i.inventory}:${i.dailyConsume}:${i.unitWeight}:${i.unitVolume}`)
            .join('|');
        
        // 使用哈希函数生成更短的键
        const hash = this.simpleHash(itemsKey);
        return `${capacityWeight}:${capacityVolume}:${hash}`;
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
     * 获取缓存（更新访问顺序）
     * @param {string} key - 缓存键
     * @returns {OptimizeResult|null} 缓存值
     */
    getCache(key) {
        if (this.cache.has(key)) {
            // 更新访问顺序
            const index = this.cacheAccessOrder.indexOf(key);
            if (index > -1) {
                this.cacheAccessOrder.splice(index, 1);
                this.cacheAccessOrder.push(key);
            }
            return this.cache.get(key);
        }
        return null;
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

// Web Worker 实例
let optimizerWorker = null;
let workerTaskId = 0;
const workerTasks = new Map();
const MAX_WORKER_TASKS = 100; // 最大任务数限制

// 初始化 Worker
function initWorker() {
    if (optimizerWorker) return;
    
    try {
        optimizerWorker = new Worker('optimizer.worker.js');
        
        optimizerWorker.addEventListener('message', (event) => {
            const { id, success, result, error } = event.data;
            const task = workerTasks.get(id);
            
            if (task) {
                const { resolve, reject } = task;
                workerTasks.delete(id);
                
                if (success) {
                    resolve(result);
                } else {
                    reject(new Error(error));
                }
            }
        });
        
        optimizerWorker.addEventListener('error', (error) => {
            console.error('Worker error:', error);
            // 清理所有任务
            workerTasks.forEach(({ reject }) => {
                reject(new Error('Worker error'));
            });
            workerTasks.clear();
            // 尝试重新初始化 Worker
            setTimeout(() => {
                optimizerWorker = null;
                initWorker();
            }, 1000);
        });
    } catch (error) {
        console.error('Failed to create worker:', error);
        // 降级到同步计算
        optimizerWorker = null;
    }
}

// 向 Worker 发送任务
function sendWorkerTask(action, params) {
    return new Promise((resolve, reject) => {
        if (!optimizerWorker) {
            // 降级到同步计算
            try {
                const result = optimizer.optimize(params.capacityWeight, params.capacityVolume);
                resolve(result);
            } catch (error) {
                reject(error);
            }
            return;
        }
        
        // 限制任务数量，防止任务堆积
        if (workerTasks.size >= MAX_WORKER_TASKS) {
            reject(new Error('Too many worker tasks'));
            return;
        }
        
        const id = ++workerTaskId;
        workerTasks.set(id, { resolve, reject });
        
        try {
            optimizerWorker.postMessage({ id, action, params });
        } catch (error) {
            console.error('Failed to send task to worker:', error);
            workerTasks.delete(id);
            // 降级到同步计算
            try {
                const result = optimizer.optimize(params.capacityWeight, params.capacityVolume);
                resolve(result);
            } catch (err) {
                reject(err);
            }
        }
    });
}

// 清理 Worker
function cleanupWorker() {
    if (optimizerWorker) {
        optimizerWorker.terminate();
        optimizerWorker = null;
    }
    workerTasks.clear();
}

const optimizer = new CargoOptimizer();

// 使用 Utils 模块（如果可用）
const round = typeof Utils !== 'undefined' ? Utils.round : (n, d) => Number(n.toFixed(d || 2));
const escapeHtml = typeof Utils !== 'undefined' ? Utils.escapeHtml : (t) => t;
const debounce = typeof Utils !== 'undefined' ? Utils.debounce : (f, w) => f;

// 页面加载时初始化 Worker
window.addEventListener('load', initWorker);

// 页面卸载时清理 Worker
window.addEventListener('unload', cleanupWorker);

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
 * 统一的自动匹配函数（防抖200ms）
 * 强制大写 + 视觉反馈
 */
const autoMatchMaterial = debounce(function(id, code) {
    const item = optimizer.items.find(i => i.id === id);
    if (!item) return;

    // 强制转换为大写
    const upperCode = code.toUpperCase();
    const dbItem = materialDB[upperCode];
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
            const weightInput = row.querySelector('[data-field="unitWeight"]');
            const volumeInput = row.querySelector('[data-field="unitVolume"]');

            if (weightInput) weightInput.value = dbItem.weight;
            if (volumeInput) volumeInput.value = dbItem.volume;
        }

        // 视觉反馈 - 边框变绿
        if (codeInput) {
            codeInput.style.borderColor = 'var(--primary-color)';
        }

        // 提示文字
        if (hint) {
            hint.textContent = '✓ 已自动匹配';
            setTimeout(() => { hint.textContent = ''; }, 2000);
        }
    } else {
        // 清除视觉反馈
        if (codeInput) {
            codeInput.style.borderColor = '';
        }

        if (hint) {
            hint.textContent = '⚠ 未找到材料';
            setTimeout(() => { hint.textContent = ''; }, 2000);
        }
    }
}, 200);

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
    div.className = 'item-input-row';
    div.setAttribute('data-id', item.id);
    div.style.animation = 'fadeIn 0.3s ease'; // 添加淡入动画
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
            <button class="btn-remove-item" data-action="delete" data-id="${item.id}" title="删除此物品">🗑️</button>
        </div>
    `;
    container.appendChild(div);
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
async function optimize() {
    const btn = document.querySelector('.btn-primary');
    try {
        btn.classList.add('loading');
        
        const capacityWeight = parseFloat(document.getElementById('capacityWeight').value) || 2000;
        const capacityVolume = parseFloat(document.getElementById('capacityVolume').value) || 2000;

        if (optimizer.items.length === 0) {
            showNotification('请添加物品！', 'warning');
            return;
        }

        // 确保 Worker 已初始化
        initWorker();

        const result = await sendWorkerTask('optimize', {
            capacityWeight,
            capacityVolume,
            items: optimizer.items
        });

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

/**
 * 最少次数运输计算器 - MTC模块
 * @author CMDRKilmer
 * @version 1.0
 */

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
 * MTC 删除物品行
 */
function mtcRemoveItem(itemId) {
    showConfirm('确定要删除这个物品吗？', () => {
        const row = document.querySelector(`[data-item-id="${itemId}"]`);
        if (row) {
            row.remove();
            mtcUpdateItemCount();
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

// MTC 页面加载完成后初始化
if (window.location.pathname.includes('MTC.html')) {
    window.onload = function() {
        mtcInit();
    };
}
