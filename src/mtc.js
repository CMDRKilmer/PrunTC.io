/**
 * MTC 模块
 * 最少次数运输计算器功能模块
 */

import MTCOptimizer from './core/optimizers/MTCOptimizer.js';
import { round, debounce, escapeHtml, showNotification, showConfirm, initTheme } from './utils/index.js';
import { getMaterialByCode, getShipTypeByType } from './data/index.js';

let mtcItems = [];
let mtcItemIdCounter = 0;

let mtcAutoMatchCode = null;

function initMtcAutoMatch() {
    if (mtcAutoMatchCode) return;
    
    mtcAutoMatchCode = debounce(function(input, infoInput) {
        input.value = input.value.toUpperCase();
        const code = input.value;
        
        if (code) {
            const data = getMaterialByCode(code);
            if (data) {
                infoInput.value = `${data.weight}t / ${data.volume}m³`;
                input.style.borderColor = 'var(--primary-color)';
            } else {
                infoInput.value = '';
                input.style.borderColor = '';
            }
        } else {
            infoInput.value = '';
            input.style.borderColor = '';
        }
    }, 200);
}

function mtcUpdateShipCapacity() {
    const shipType = document.getElementById('shipType').value;
    if (shipType) {
        const config = getShipTypeByType(shipType);
        if (config) {
            document.getElementById('maxWeightInput').value = config.weight;
            document.getElementById('maxVolumeInput').value = config.volume;
            mtcUpdateConstraintDisplay();
        }
    }
}

function mtcUpdateConstraintDisplay() {
    const shipType = document.getElementById('shipType').value;
    const weightInput = document.getElementById('maxWeightInput');
    const volumeInput = document.getElementById('maxVolumeInput');
    let weight = parseFloat(weightInput.value) || 500;
    let volume = parseFloat(volumeInput.value) || 500;
    
    if (shipType) {
        const shipInfo = getShipTypeByType(shipType);
        if (shipInfo) {
            const maxWeight = shipInfo.weight;
            const maxVolume = shipInfo.volume;
            
            if (weight > maxWeight) {
                weight = maxWeight;
                weightInput.value = maxWeight;
                showNotification(`重量容量不能超过船舱最大限制：${maxWeight}吨`, 'warning');
            }
            if (volume > maxVolume) {
                volume = maxVolume;
                volumeInput.value = maxVolume;
                showNotification(`体积容量不能超过船舱最大限制：${maxVolume}m³`, 'warning');
            }
        }
    }
    
    if (weight <= 0) {
        if (shipType) {
            const shipInfo = getShipTypeByType(shipType);
            if (shipInfo) {
                weight = shipInfo.weight;
                weightInput.value = weight;
            }
        } else {
            weight = 500;
            weightInput.value = weight;
        }
    }
    if (volume <= 0) {
        if (shipType) {
            const shipInfo = getShipTypeByType(shipType);
            if (shipInfo) {
                volume = shipInfo.volume;
                volumeInput.value = volume;
            }
        } else {
            volume = 500;
            volumeInput.value = volume;
        }
    }
    
    const maxWeightEl = document.getElementById('maxWeight');
    const maxVolumeEl = document.getElementById('maxVolume');
    if (maxWeightEl) maxWeightEl.textContent = weight;
    if (maxVolumeEl) maxVolumeEl.textContent = volume;
}

function createItemRow(code = '', qty = 1, itemId) {
    try {
        const row = document.createElement('div');
        row.className = 'item-input-row';
        row.dataset.itemId = itemId;
        row.style.animation = 'itemSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
        row.style.display = 'grid';
        row.style.gridTemplateColumns = '100px 120px 200px 50px';
        row.style.gap = '12px';
        row.style.alignItems = 'end';
        row.style.padding = '15px';
        row.style.background = 'var(--bg-card-light)';
        row.style.borderRadius = '10px';
        row.style.marginBottom = '10px';
        row.style.border = '1px solid var(--border-color-lighter)';
        
        let infoValue = '';
        if (code) {
            const data = getMaterialByCode(code);
            if (data) {
                infoValue = `${data.weight}t / ${data.volume}m³`;
            }
        }
        
        row.innerHTML = `
            <div class="form-group">
                <label>物品代码</label>
                <input type="text" data-field="code" value="${code}" ${!code ? 'placeholder="如: MCG"' : ''}>
            </div>
            <div class="form-group">
                <label>数量</label>
                <input type="number" data-field="qty" min="1" step="1" value="${qty}" ${!qty ? 'placeholder="输入数量"' : ''}>
            </div>
            <div class="form-group">
                <label>单位重量/体积</label>
                <input type="text" data-field="info" readonly value="${infoValue}" ${!infoValue ? 'placeholder="自动填充"' : ''}>
            </div>
            <button class="btn-remove-item" title="删除此物品">🗑️</button>
        `;
        
        const codeInput = row.querySelector('[data-field="code"]');
        const qtyInput = row.querySelector('[data-field="qty"]');
        const infoInput = row.querySelector('[data-field="info"]');
        const removeBtn = row.querySelector('.btn-remove-item');
        
        initMtcAutoMatch();
        
        codeInput.addEventListener('input', () => {
            mtcAutoMatchCode(codeInput, infoInput);
        });
        
        codeInput.addEventListener('change', () => {
            codeInput.value = codeInput.value.toUpperCase();
            const code = codeInput.value;
            
            if (code) {
                const data = getMaterialByCode(code);
                if (data) {
                    infoInput.value = `${data.weight}t / ${data.volume}m³`;
                    codeInput.style.borderColor = 'var(--primary-color)';
                } else {
                    infoInput.value = '';
                    codeInput.style.borderColor = '';
                }
            } else {
                infoInput.value = '';
                codeInput.style.borderColor = '';
            }
        });
        
        qtyInput.addEventListener('input', () => {
            const value = parseInt(qtyInput.value);
            if (isNaN(value) || value < 1) {
                qtyInput.style.borderColor = '#ff4757';
            } else {
                qtyInput.style.borderColor = '';
            }
        });
        
        qtyInput.addEventListener('change', () => {
            const value = parseInt(qtyInput.value);
            if (isNaN(value) || value < 1) {
                qtyInput.style.borderColor = '#ff4757';
            } else {
                qtyInput.style.borderColor = '';
            }
        });
        
        removeBtn.addEventListener('click', () => {
            mtcRemoveItem(itemId);
        });
        
        if (code) {
            codeInput.dispatchEvent(new Event('change'));
        }
        
        return row;
    } catch (error) {
        console.error('Error creating item row:', error);
        return null;
    }
}

function mtcAddItem() {
    const container = document.getElementById('itemsContainer');
    if (!container) {
        console.error('Items container not found');
        return;
    }
    const itemId = mtcItemIdCounter++;
    
    const row = createItemRow('', 1, itemId);
    if (row) {
        container.appendChild(row);
        mtcUpdateItemCount();
    }
}

function mtcRemoveItem(itemId) {
    showConfirm('确定要删除这个物品吗？', () => {
        const row = document.querySelector(`[data-item-id="${itemId}"]`);
        if (row) {
            row.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => {
                row.remove();
                mtcUpdateItemCount();
            }, 300);
        }
    });
}

function mtcUpdateItemCount() {
    const count = document.querySelectorAll('#itemsContainer .item-input-row').length;
    const countEl = document.getElementById('itemCount');
    if (countEl) {
        countEl.textContent = `${count} 种物品`;
    }
}

function mtcLoadExample() {
    const container = document.getElementById('itemsContainer');
    if (!container) return;
    container.innerHTML = '';
    mtcItemIdCounter = 0;
    
    const examples = [
        ['BBH', 10],
        ['BDE', 10],
        ['BSE', 6],
        ['BTA', 4],
        ['INS', 4940],
        ['LBH', 56],
        ['LDE', 80],
        ['LSE', 100],
        ['LTA', 42],
        ['MCG', 1976],
        ['RSE', 2],
        ['RTA', 4],
        ['TRU', 80]
    ];
    
    const fragment = document.createDocumentFragment();
    
    examples.forEach(([code, qty]) => {
        const row = createItemRow(code, qty, mtcItemIdCounter++);
        if (row) {
            fragment.appendChild(row);
        }
    });
    
    container.appendChild(fragment);
    mtcUpdateItemCount();
}

function mtcResetAll() {
    showConfirm('确定要清空所有物品吗？', () => {
        const container = document.getElementById('itemsContainer');
        if (container) container.innerHTML = '';
        mtcItemIdCounter = 0;
        mtcAddItem();
        mtcAddItem();
        mtcUpdateItemCount();
        mtcHideResult();
    });
}

function mtcShowError(message) {
    showNotification(message, 'error');
}

function mtcHideError() {}

function mtcCollectItems() {
    const rows = document.querySelectorAll('#itemsContainer .item-input-row');
    const items = [];
    
    rows.forEach(row => {
        const codeInput = row.querySelector('[data-field="code"]');
        const qtyInput = row.querySelector('[data-field="qty"]');
        
        if (codeInput && qtyInput) {
            const code = codeInput.value;
            const qty = parseInt(qtyInput.value);
            
            if (code && !isNaN(qty) && qty > 0) {
                const material = getMaterialByCode(code);
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
        }
    });
    
    return items;
}

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
    
    for (const item of items) {
        if (item.unitWeight > maxWeight || item.unitVolume > maxVolume) {
            mtcShowError(`物品 ${item.code} 的单位重量或体积超过单次运输容量，无法运输`);
            return null;
        }
    }
    
    return { items, maxWeight, maxVolume };
}

function mtcDisplayResult(result) {
    const maxWeight = parseFloat(document.getElementById('maxWeightInput').value);
    const maxVolume = parseFloat(document.getElementById('maxVolumeInput').value);
    
    let totalWeight = 0;
    let totalVolume = 0;
    result.trips.forEach(trip => {
        totalWeight += trip.totalWeight;
        totalVolume += trip.totalVolume;
    });
    
    const weightRate = totalWeight / (maxWeight * result.totalTrips);
    const volumeRate = totalVolume / (maxVolume * result.totalTrips);
    const fillRate = Math.max(weightRate, volumeRate);
    const bottleneck = weightRate > volumeRate ? '重量' : '体积';
    
    document.getElementById('totalTrips').textContent = result.totalTrips;
    document.getElementById('fillRate').textContent = (fillRate * 100).toFixed(2) + '%';
    document.getElementById('totalWeight').textContent = totalWeight.toFixed(2);
    document.getElementById('totalVolume').textContent = totalVolume.toFixed(2);
    
    document.getElementById('weightText').textContent = totalWeight.toFixed(2) + ' / ' + (maxWeight * result.totalTrips) + ' t';
    document.getElementById('volumeText').textContent = totalVolume.toFixed(2) + ' / ' + (maxVolume * result.totalTrips) + ' m³';
    document.getElementById('bottleneckText').textContent = bottleneck + ' (' + (fillRate * 100).toFixed(2) + '%)';
    
    document.getElementById('weightProgress').style.transform = `scaleX(${Math.min(weightRate, 1)})`;
    document.getElementById('volumeProgress').style.transform = `scaleX(${Math.min(volumeRate, 1)})`;
    document.getElementById('bottleneckProgress').style.transform = `scaleX(${Math.min(fillRate, 1)})`;
    
    const container = document.getElementById('tripPlans');
    if (!container) return;
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
    
    mtcShowResult();
}

function mtcShowResult() {
    const resultCard = document.getElementById('resultCard');
    if (resultCard) resultCard.classList.add('show');
}

function mtcHideResult() {
    const resultCard = document.getElementById('resultCard');
    if (resultCard) resultCard.classList.remove('show');
}

function mtcCalculateMinTrips() {
    mtcHideError();
    
    const input = mtcValidateInput();
    if (!input) return;
    
    const { items, maxWeight, maxVolume } = input;
    
    const calculating = document.getElementById('calculating');
    if (calculating) calculating.classList.add('show');
    mtcHideResult();
    
    setTimeout(() => {
        try {
            const result = MTCOptimizer.optimizeTrips(items, maxWeight, maxVolume);
            mtcDisplayResult(result);
        } catch (error) {
            mtcShowError('计算过程中发生错误: ' + error.message);
        } finally {
            if (calculating) calculating.classList.remove('show');
        }
    }, 100);
}

function getMTCTemplate() {
    return `
        <section class="card" aria-labelledby="constraints-heading">
            <h2 id="constraints-heading">📋 运输限制条件</h2>
            <div class="constraints-wrapper">
                <div class="constraints-box">
                    <h3>⚙️ 当前运输配置</h3>
                    <div class="constraint-item">
                        <span class="constraint-icon">🔄</span>
                        <span>物品组合规则：每次运输可同时装载多种物品，但总重量和总体积不能超过上限</span>
                    </div>
                    <div class="constraint-item">
                        <span class="constraint-icon">🎯</span>
                        <span>优化目标：在满足约束条件下，最小化总运输次数</span>
                    </div>
                </div>
                <div class="ship-info-box">
                    <h3>🚀 飞船信息</h3>
                    <div class="ship-info-item">
                        <span class="ship-info-label">船舱类型：</span>
                        <select id="shipType" onchange="mtcUpdateShipCapacity()">
                            <option value="">-- 选择船舱 --</option>
                            <option value="TCB">TCB 微型货舱</option>
                            <option value="VSC">VSC 超小型货舱</option>
                            <option value="SCB" selected>SCB 小型货舱</option>
                            <option value="MCB">MCB 中型货舱</option>
                            <option value="LCB">LCB 大型货舱</option>
                            <option value="HCB">HCB 巨型货舱</option>
                            <option value="VCB">VCB 高容积货舱</option>
                            <option value="WCB">WCB 高负荷货舱</option>
                        </select>
                    </div>
                    <div class="ship-info-item">
                        <span class="ship-info-label">重量容量（吨）：</span>
                        <input type="number" id="maxWeightInput" value="500" min="1" step="100" 
                            onchange="mtcUpdateConstraintDisplay()">
                    </div>
                    <div class="ship-info-item">
                        <span class="ship-info-label">体积容量（m³）：</span>
                        <input type="number" id="maxVolumeInput" value="500" min="1" step="100" 
                            onchange="mtcUpdateConstraintDisplay()">
                    </div>
                </div>
            </div>
        </section>
        
        <section class="card" aria-labelledby="items-heading">
            <h2 id="items-heading">📦 物品信息 <span id="itemCount" class="highlight">0 种物品</span></h2>
            
            <div id="errorMessage" class="error-message" role="alert"></div>
            
            <div id="itemsContainer" class="items-input-section">
            </div>
            
            <div class="action-buttons">
                <button class="btn btn-add" onclick="mtcAddItem()">➕ 添加物品</button>
                <button class="btn btn-secondary" onclick="mtcLoadExample()">📋 示例数据</button>
                <button class="btn btn-danger" onclick="mtcResetAll()">🗑️ 清空</button>
            </div>
        </section>
        
        <button class="btn btn-primary" onclick="mtcCalculateMinTrips()">🧮 计算最少运输次数</button>
        
        <div id="calculating" class="calculating">
            <div class="spinner"></div>
            <p>正在计算最优运输方案...</p>
        </div>
        
        <section class="card result-card" id="resultCard">
            <h2>📊 计算结果</h2>
            
            <div class="summary-stats">
                <div class="summary-stat">
                    <div class="summary-stat-value" id="totalTrips">0</div>
                    <div class="summary-stat-label">最少运输次数</div>
                </div>
                <div class="summary-stat">
                    <div class="summary-stat-value" id="fillRate">0%</div>
                    <div class="summary-stat-label">填充率</div>
                </div>
                <div class="summary-stat">
                    <div class="summary-stat-value" id="totalWeight">0</div>
                    <div class="summary-stat-label">总重量 (t)</div>
                </div>
                <div class="summary-stat">
                    <div class="summary-stat-value" id="totalVolume">0</div>
                    <div class="summary-stat-label">总体积 (m³)</div>
                </div>
            </div>
            
            <div class="progress-section" role="group" aria-label="装载进度" style="margin-top: 25px;">
                <div class="progress-item">
                    <div class="progress-header">
                        <span>⚖️ 重量填充</span>
                        <span id="weightText">0 / 0 t</span>
                    </div>
                    <div class="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
                        <div class="progress-fill weight" id="weightProgress"></div>
                    </div>
                </div>
                <div class="progress-item">
                    <div class="progress-header">
                        <span>📦 体积填充</span>
                        <span id="volumeText">0 / 0 m³</span>
                    </div>
                    <div class="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
                        <div class="progress-fill volume" id="volumeProgress"></div>
                    </div>
                </div>
                <div class="progress-item">
                    <div class="progress-header">
                        <span>🔴 瓶颈资源</span>
                        <span id="bottleneckText">-</span>
                    </div>
                    <div class="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
                        <div class="progress-fill bottleneck" id="bottleneckProgress"></div>
                    </div>
                </div>
            </div>
            
            <div id="tripPlans" style="margin-top: 25px;">
            </div>
        </section>
    `;
}

function mount() {
    const main = document.getElementById('app-main');
    if (!main) return;
    
    main.innerHTML = getMTCTemplate();
    
    initTheme();
    mtcUpdateShipCapacity();
    mtcAddItem();
    mtcAddItem();
    mtcUpdateItemCount();
    
    window.mtcUpdateShipCapacity = mtcUpdateShipCapacity;
    window.mtcUpdateConstraintDisplay = mtcUpdateConstraintDisplay;
    window.mtcAddItem = mtcAddItem;
    window.mtcRemoveItem = mtcRemoveItem;
    window.mtcResetAll = mtcResetAll;
    window.mtcLoadExample = mtcLoadExample;
    window.mtcCalculateMinTrips = mtcCalculateMinTrips;
}

function unmount() {
    mtcHideResult();
    
    delete window.mtcUpdateShipCapacity;
    delete window.mtcUpdateConstraintDisplay;
    delete window.mtcAddItem;
    delete window.mtcRemoveItem;
    delete window.mtcResetAll;
    delete window.mtcLoadExample;
    delete window.mtcCalculateMinTrips;
}

function createMTCModule() {
    return {
        mount,
        unmount,
        name: 'mtc'
    };
}

export { createMTCModule };
