/**
 * 最少次数运输计算器入口文件
 */

import { mtcInit, mtcAddItem, mtcRemoveItem, mtcResetAll, mtcLoadExample, mtcCalculateMinTrips, mtcUpdateShipCapacity, mtcUpdateConstraintDisplay } from './ui/mtc.js';
import { toggleTheme } from './utils/index.js';

// 暴露全局函数
globalThis.mtcAddItem = mtcAddItem;
globalThis.mtcRemoveItem = mtcRemoveItem;
globalThis.mtcResetAll = mtcResetAll;
globalThis.mtcLoadExample = mtcLoadExample;
globalThis.mtcCalculateMinTrips = mtcCalculateMinTrips;
globalThis.mtcUpdateShipCapacity = mtcUpdateShipCapacity;
globalThis.mtcUpdateConstraintDisplay = mtcUpdateConstraintDisplay;
globalThis.toggleTheme = toggleTheme;

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mtcInit);
} else {
    mtcInit();
}