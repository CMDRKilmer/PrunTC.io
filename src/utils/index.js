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
 * 防抖函数 - 优化高频触发事件
 * @param {Function} func - 要执行的函数
 * @param {number} wait - 等待时间（毫秒）
 * @param {boolean} immediate - 是否立即执行
 * @returns {Function} 防抖处理后的函数
 */
function debounce(func, wait = 300, immediate = false) {
    let timeout;
    let result;
    
    const debounced = function(...args) {
        const context = this;
        
        const later = () => {
            timeout = null;
            if (!immediate) {
                result = func.apply(context, args);
            }
        };
        
        const callNow = immediate && !timeout;
        
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        
        if (callNow) {
            result = func.apply(context, args);
        }
        
        return result;
    };
    
    // 添加取消方法
    debounced.cancel = function() {
        clearTimeout(timeout);
        timeout = null;
    };
    
    return debounced;
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
 * 显示通知提示
 * @param {string} message - 提示消息
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
 * 显示确认对话框
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
            <div class="confirm-message">${escapeHtml(message)}</div>
            <div class="confirm-buttons">
                <button class="btn btn-secondary" data-action="cancel">取消</button>
                <button class="btn btn-primary" data-action="confirm">确定</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    // 绑定按钮事件
    dialog.querySelector('[data-action="confirm"]').addEventListener('click', () => {
        dialog.remove();
        if (onConfirm) onConfirm();
    });

    dialog.querySelector('[data-action="cancel"]').addEventListener('click', () => {
        dialog.remove();
        if (onCancel) onCancel();
    });

    // 点击遮罩关闭
    dialog.querySelector('.confirm-overlay').addEventListener('click', () => {
        dialog.remove();
        if (onCancel) onCancel();
    });
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

// 导出公共方法
export {
    round,
    debounce,
    escapeHtml,
    showNotification,
    showConfirm,
    toggleTheme,
    initTheme
};