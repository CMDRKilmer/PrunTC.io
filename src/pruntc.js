/**
 * 补给运输计算器入口文件
 */

import { init, addItem, removeItem, clearAllItems, loadExampleData, optimize, updateShipCapacity, validateCapacityInput, onItemCodeInput, onItemCodeChange } from './ui/pruntc.js';
import { toggleTheme } from './utils/index.js';

// 暴露全局函数
globalThis.addItem = addItem;
globalThis.removeItem = removeItem;
globalThis.clearAllItems = clearAllItems;
globalThis.loadExampleData = loadExampleData;
globalThis.optimize = optimize;
globalThis.updateShipCapacity = updateShipCapacity;
globalThis.validateCapacityInput = validateCapacityInput;
globalThis.onItemCodeInput = onItemCodeInput;
globalThis.onItemCodeChange = onItemCodeChange;
globalThis.toggleTheme = toggleTheme;

// 页面加载完成后初始化
window.onload = init;