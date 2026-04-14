/**
 * PrunTC 配置常量
 * 集中管理所有配置项，便于维护和修改
 */

const CONFIG = Object.freeze({
    CACHE: {
        LOAD_CACHE_MAX_SIZE: 200,
        PRECISION: 0.001,
        EARLY_TERMINATION_THRESHOLD: 0.999
    },
    OPTIMIZE: {
        MAX_ITERATIONS: 500,
        MIN_DAYS_OFFSET: 10,
        SEARCH_BOOST: 50,
        FALLBACK_DAYS_INCREMENT: 1,
        MIN_SEARCH_DAYS: 0.001
    },
    UI: {
        DEBOUNCE_DELAY: 200,
        ANIMATION_DURATION: 300,
        NOTIFICATION_DURATION: 5000,
        SUCCESS_COLOR: 'var(--primary-color)',
        ERROR_COLOR: '#ff4757',
        HINT_SUCCESS: '✓ 已自动匹配',
        HINT_WARNING: '⚠ 未找到材料',
        HINT_TIMEOUT: 2000
    }
});

/**
 * @typedef {Object} CacheConfig
 * @property {number} LOAD_CACHE_MAX_SIZE - 装载缓存最大条目数
 * @property {number} PRECISION - 计算精度
 * @property {number} EARLY_TERMINATION_THRESHOLD - 提前终止阈值
 */

/**
 * @typedef {Object} OptimizeConfig
 * @property {number} MAX_ITERATIONS - 最大迭代次数
 * @property {number} MIN_DAYS_OFFSET - 最小天数偏移
 * @property {number} SEARCH_BOOST - 搜索增强值
 * @property {number} FALLBACK_DAYS_INCREMENT - 回退天数增量
 * @property {number} MIN_SEARCH_DAYS - 最小搜索天数
 */

/**
 * @typedef {Object} UIConfig
 * @property {number} DEBOUNCE_DELAY - 防抖延迟(ms)
 * @property {number} ANIMATION_DURATION - 动画时长(ms)
 * @property {number} NOTIFICATION_DURATION - 通知显示时长(ms)
 * @property {string} SUCCESS_COLOR - 成功状态颜色
 * @property {string} ERROR_COLOR - 错误状态颜色
 * @property {string} HINT_SUCCESS - 成功提示文字
 * @property {string} HINT_WARNING - 警告提示文字
 * @property {number} HINT_TIMEOUT - 提示消失时间(ms)
 */

/**
 * @typedef {Object} Config
 * @property {CacheConfig} CACHE - 缓存配置
 * @property {OptimizeConfig} OPTIMIZE - 优化算法配置
 * @property {UIConfig} UI - 界面配置
 */

/**
 * @type {Config}
 */
// ES6 模块导出
export { CONFIG };
