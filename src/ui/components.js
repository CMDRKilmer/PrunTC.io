/**
 * PrunTC 通用 UI 组件模块
 * 提供通知系统、主题切换和通用对话框功能
 */

const NOTIFICATION_DURATION = 5000;
const ANIMATION_DURATION = 300;

let notificationContainer = null;

function getNotificationContainer() {
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        notificationContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
        `;
        document.body.appendChild(notificationContainer);
    }
    return notificationContainer;
}

export function showNotification(message, type = 'info', duration = NOTIFICATION_DURATION) {
    const container = getNotificationContainer();
    const notification = document.createElement('div');
    
    const colors = {
        success: 'var(--primary-color, #4CAF50)',
        error: '#ff4757',
        warning: '#ffa502',
        info: 'var(--primary-color, #2196F3)'
    };
    
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };

    notification.style.cssText = `
        background: ${colors[type] || colors.info};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        font-family: 'Segoe UI', system-ui, sans-serif;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 10px;
        transform: translateX(120%);
        transition: transform ${ANIMATION_DURATION}ms ease-out;
        pointer-events: auto;
        max-width: 350px;
    `;
    
    notification.innerHTML = `
        <span style="font-size: 18px;">${icons[type] || icons.info}</span>
        <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(notification);

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            notification.style.transform = 'translateX(0)';
        });
    });

    if (duration > 0) {
        setTimeout(() => {
            notification.style.transform = 'translateX(120%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, ANIMATION_DURATION);
        }, duration);
    }

    return notification;
}

export function showConfirm(message, onConfirm, onCancel) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
        opacity: 0;
        transition: opacity ${ANIMATION_DURATION}ms ease-out;
    `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
        background: var(--bg-color, white);
        padding: 24px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        max-width: 400px;
        width: 90%;
        transform: scale(0.9);
        transition: transform ${ANIMATION_DURATION}ms ease-out;
        font-family: 'Segoe UI', system-ui, sans-serif;
    `;

    dialog.innerHTML = `
        <p style="
            margin: 0 0 20px 0;
            font-size: 16px;
            color: var(--text-color, #333);
            line-height: 1.5;
        ">${escapeHtml(message)}</p>
        <div style="
            display: flex;
            gap: 12px;
            justify-content: flex-end;
        ">
            <button id="confirm-cancel-btn" style="
                padding: 8px 16px;
                border: 1px solid var(--border-color, #ddd);
                background: var(--bg-color, white);
                color: var(--text-color, #333);
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                transition: background ${ANIMATION_DURATION}ms;
            ">取消</button>
            <button id="confirm-ok-btn" style="
                padding: 8px 16px;
                border: none;
                background: var(--primary-color, #2196F3);
                color: white;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                transition: background ${ANIMATION_DURATION}ms;
            ">确定</button>
        </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        dialog.style.transform = 'scale(1)';
    });

    const closeDialog = (result) => {
        overlay.style.opacity = '0';
        dialog.style.transform = 'scale(0.9)';
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }, ANIMATION_DURATION);
        
        if (result && onConfirm) {
            onConfirm();
        } else if (!result && onCancel) {
            onCancel();
        }
    };

    dialog.querySelector('#confirm-ok-btn').addEventListener('click', () => closeDialog(true));
    dialog.querySelector('#confirm-cancel-btn').addEventListener('click', () => closeDialog(false));
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeDialog(false);
        }
    });
}

export function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    return newTheme;
}

export function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');
    
    document.documentElement.setAttribute('data-theme', theme);
    
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        }
    });
    
    return theme;
}

function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
