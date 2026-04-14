/**
 * PrunTC 工具函数
 * 提供共享的通用函数
 */

/**
 * 四舍五入到指定小数位
 * @param {number} num - 要四舍五入的数字
 * @param {number} [decimals=2] - 小数位数
 * @returns {number} 四舍五入后的数字
 */
function round(num, decimals = 2) {
    return Number(num.toFixed(decimals));
}

/**
 * 简单哈希函数
 * @param {string} str - 输入字符串
 * @returns {number} 哈希值
 */
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

/**
 * HTML 特殊字符转义
 * @param {string} text - 要转义的文本
 * @returns {string} 转义后的文本
 */
function escapeHtml(text) {
    if (typeof text !== 'string') return text;
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
 * 验证是否为有效数字
 * @param {number} value - 要验证的值
 * @param {boolean} [positive=false] - 是否要求为正数
 * @returns {boolean} 是否有效
 */
function isValidNumber(value, positive = false) {
    if (!isFinite(value)) return false;
    if (positive && value <= 0) return false;
    return true;
}

/**
 * 生成缓存键
 * @param {Array} items - 物品数组
 * @param {number} days - 天数
 * @returns {string} 缓存键
 */
function generateLoadCacheKey(items, days) {
    const itemsKey = items
        .sort((a, b) => a.code.localeCompare(b.code))
        .map(i => `${i.code}:${i.inventory}:${i.dailyConsume}:${i.unitWeight}:${i.unitVolume}`)
        .join('|');
    const hash = simpleHash(itemsKey);
    return `load_${days.toFixed(6)}_${hash}`;
}

/**
 * 验证物品数据
 * @param {Object} item - 物品数据
 * @throws {Error} 验证失败时抛出错误
 */
function validateItem(item) {
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
 * 验证容量参数
 * @param {number} capacityWeight - 重量容量
 * @param {number} capacityVolume - 体积容量
 * @throws {Error} 验证失败时抛出错误
 */
function validateCapacity(capacityWeight, capacityVolume) {
    if (!isFinite(capacityWeight) || capacityWeight <= 0) {
        throw new Error('重量容量必须是有效的正数');
    }
    if (!isFinite(capacityVolume) || capacityVolume <= 0) {
        throw new Error('体积容量必须是有效的正数');
    }
}

// ES6 模块导出
export {
    round,
    simpleHash,
    escapeHtml,
    debounce,
    isValidNumber,
    generateLoadCacheKey,
    validateItem,
    validateCapacity
};
