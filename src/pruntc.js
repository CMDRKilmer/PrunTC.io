/**
 * PrunTC 模块
 * 补给运输计算器功能模块
 */

import { CargoOptimizerCore } from './core/optimizer.js';
import { round, debounce, escapeHtml, showNotification, showConfirm, initTheme } from './utils/index.js';
import { getMaterialByCode, getShipTypeByType } from './data/index.js';
import { fioLogin, fioLoginFromForm, fioLogout, loadSelectedBases, toggleAuthForm, restoreFioAuth, fioGetBases } from './api/fio.js';
import { CONFIG } from './core/config.js';

let optimizer = null;

function createOptimizer() {
    if (!optimizer) {
        optimizer = new CargoOptimizerCore({
            round: round,
            simpleHash: null,
            generateLoadCacheKey: null,
            config: CONFIG
        });
    }
    return optimizer;
}

let autoMatchMaterial = null;

function initAutoMatch() {
    if (autoMatchMaterial) return;
    
    autoMatchMaterial = debounce(function(id, code) {
        const opt = createOptimizer();
        const item = opt.items.find(i => i.id === id);
        if (!item) return;

        const upperCode = code.toUpperCase();
        const dbItem = getMaterialByCode(upperCode);
        const hint = document.getElementById('matchHint');
        const row = document.querySelector(`[data-id="${id}"]`);
        const codeInput = row ? row.querySelector('[data-field="code"]') : null;

        if (dbItem) {
            item.unitWeight = dbItem.weight;
            item.unitVolume = dbItem.volume;
            item.code = upperCode;

            if (row) {
                const infoInput = row.querySelector('[data-field="info"]');
                if (infoInput) {
                    infoInput.value = `${dbItem.weight}t / ${dbItem.volume}m³`;
                }
            }

            if (codeInput) {
                codeInput.style.borderColor = 'var(--primary-color)';
            }

            if (hint) {
                hint.textContent = '✓ 已自动匹配';
                setTimeout(() => { hint.textContent = ''; }, 2000);
            }
        } else {
            if (row) {
                const infoInput = row.querySelector('[data-field="info"]');
                if (infoInput) {
                    infoInput.value = '';
                }
            }

            if (codeInput) {
                codeInput.style.borderColor = '';
            }

            if (hint && upperCode) {
                hint.textContent = '⚠️ 未找到匹配物品';
                setTimeout(() => { hint.textContent = ''; }, 2000);
            }
        }
    }, 200);
}

function updateShipCapacity() {
    const shipType = document.getElementById('shipType').value;
    if (shipType) {
        const shipInfo = getShipTypeByType(shipType);
        if (shipInfo) {
            document.getElementById('capacityWeight').value = shipInfo.weight;
            document.getElementById('capacityVolume').value = shipInfo.volume;
        }
    }
    updateCapacityDisplay();
}

function updateCapacityDisplay() {}

function validateCapacityInput(type) {
    const shipType = document.getElementById('shipType').value;
    const input = document.getElementById(type === 'weight' ? 'capacityWeight' : 'capacityVolume');
    const value = parseFloat(input.value);
    
    if (!isFinite(value) || value <= 0) {
        if (shipType) {
            const shipInfo = getShipTypeByType(shipType);
            if (shipInfo) {
                input.value = type === 'weight' ? shipInfo.weight : shipInfo.volume;
            }
        } else {
            input.value = 0;
        }
        return;
    }
    
    if (shipType) {
        const shipInfo = getShipTypeByType(shipType);
        if (shipInfo) {
            const maxValue = type === 'weight' ? shipInfo.weight : shipInfo.volume;
            if (value > maxValue) {
                input.value = maxValue;
                showNotification(`容量不能超过船舱最大限制：${maxValue}${type === 'weight' ? '吨' : 'm³'}`, 'warning');
            }
        }
    }
}

function onItemCodeInput(id) {
    initAutoMatch();
    const row = document.querySelector(`[data-id="${id}"]`);
    if (row) {
        const codeInput = row.querySelector('[data-field="code"]');
        if (codeInput) {
            autoMatchMaterial(id, codeInput.value);
        }
    }
}

function onItemCodeChange(id) {
    initAutoMatch();
    const row = document.querySelector(`[data-id="${id}"]`);
    if (row) {
        const codeInput = row.querySelector('[data-field="code"]');
        if (codeInput) {
            codeInput.value = codeInput.value.toUpperCase();
            const code = codeInput.value;
            
            const opt = createOptimizer();
            const item = opt.items.find(i => i.id === id);
            if (item && code) {
                const data = getMaterialByCode(code);
                if (data) {
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

function addItem() {
    const opt = createOptimizer();
    const newItem = opt.addItem();
    addItemToDOM(newItem);
    updateItemCount();
}

function updateItemCount() {
    const opt = createOptimizer();
    const countEl = document.getElementById('itemCount');
    if (countEl) {
        countEl.textContent = opt.items.length + ' 种物品';
    }
}

function createItemElement(item) {
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
                onchange="onItemCodeChange(${item.id})"></div>
        <div class="form-group">
            <label>现有库存</label>
            <input type="number" placeholder="库存" value="${item.inventory}" 
                data-field="inventory"
                data-id="${item.id}"
                min="0"></div>
        <div class="form-group">
            <label>每日消耗</label>
            <input type="number" placeholder="每日消耗" value="${item.dailyConsume}" 
                data-field="dailyConsume"
                data-id="${item.id}"
                min="0" step="0.01"></div>
        <div class="form-group">
            <label>单位重量/体积</label>
            <input type="text" placeholder="自动填充" value="${item.unitWeight}t / ${item.unitVolume}m³" 
                data-field="info"
                data-id="${item.id}"
                readonly
                style="background: var(--bg-input-readonly); cursor: not-allowed;"></div>
        <button class="btn-remove-item" onclick="removeItem(${item.id})" title="删除此物品">🗑️</button>
    `;
    return div;
}

function addItemToDOM(item) {
    const container = document.getElementById('itemContainer');
    if (!container) return;
    const itemElement = createItemElement(item);
    if (itemElement) {
        container.appendChild(itemElement);
        updateItemCount();
    }
}

function renderItems() {
    const container = document.getElementById('itemContainer');
    if (!container) return;
    container.innerHTML = '';
    updateItemCount();

    const opt = createOptimizer();
    const fragment = document.createDocumentFragment();
    opt.items.forEach((item) => {
        const itemElement = createItemElement(item);
        if (itemElement) {
            fragment.appendChild(itemElement);
        }
    });
    container.appendChild(fragment);
}

function initEventDelegation() {
    const container = document.getElementById('itemContainer');
    if (!container) return;
    
    container.addEventListener('input', function(e) {
        const input = e.target;
        if (input.tagName !== 'INPUT') return;
        
        const id = parseInt(input.dataset.id);
        const field = input.dataset.field;
        
        if (!id || !field) return;
        
        const opt = createOptimizer();
        
        if (field === 'code') {
            input.value = input.value.toUpperCase();
            initAutoMatch();
            autoMatchMaterial(id, input.value);
        } else {
            opt.updateItem(id, field, input.value);
        }
    });
    
    container.addEventListener('change', function(e) {
        const input = e.target;
        if (input.tagName !== 'INPUT') return;
        
        const id = parseInt(input.dataset.id);
        const field = input.dataset.field;
        const value = input.value;
        
        if (!id || !field) return;
        
        const opt = createOptimizer();
        opt.updateItem(id, field, value);
        
        if (field === 'code') {
            input.value = input.value.toUpperCase();
            initAutoMatch();
            autoMatchMaterial(id, input.value);
        }
    });

    container.addEventListener('blur', function(e) {
        const input = e.target;
        if (input.dataset.field === 'code') {
            const id = parseInt(input.dataset.id);
            input.value = input.value.toUpperCase();
            initAutoMatch();
            autoMatchMaterial(id, input.value);
        }
    }, true);

    container.addEventListener('click', function(e) {
        const btn = e.target.closest('[data-action="delete"]');
        if (!btn) return;
        
        const id = parseInt(btn.dataset.id);
        showConfirm('确定要删除这个物品吗？', () => {
            const opt = createOptimizer();
            opt.removeItem(id);
            renderItems();
            showNotification('物品已删除', 'success');
        });
    });
}

function removeItem(id) {
    showConfirm('确定要删除这个物品吗？', () => {
        const row = document.querySelector(`[data-id="${id}"]`);
        if (row) {
            row.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => {
                const opt = createOptimizer();
                opt.removeItem(id);
                row.remove();
                updateItemCount();
                showNotification('物品已删除', 'success');
            }, 300);
        } else {
            const opt = createOptimizer();
            opt.removeItem(id);
            updateItemCount();
            showNotification('物品已删除', 'success');
        }
    });
}

function clearAllItems() {
    const opt = createOptimizer();
    if (opt.items.length === 0) {
        showNotification('没有物品可清空', 'info');
        return;
    }
    showConfirm(`确定要清空所有 ${opt.items.length} 个物品吗？`, () => {
        opt.clearAllItems();
        renderItems();
        showNotification('所有物品已清空', 'success');
    });
}

function loadExampleData() {
    const loadData = () => {
        const opt = createOptimizer();
        opt.clearAllItems();
        opt.addItem('GRN', 875, 187.5, 0.9, 1.0);
        opt.addItem('NUT', 965, 187.5, 0.9, 1.0);
        opt.addItem('MUS', 853, 187.5, 0.8, 1.0);
        opt.addItem('DW', 224, 44.8, 0.1, 0.1);
        opt.addItem('OVE', 28, 5.6, 0.02, 0.025);
        opt.addItem('COF', 28, 5.6, 0.1, 0.1);
        opt.addItem('PWO', 11, 2.24, 0.05, 0.05);
        renderItems();
        showNotification('示例数据已加载', 'success');
    };

    const opt = createOptimizer();
    if (opt.items.length > 0) {
        showConfirm('当前已有物品，是否覆盖加载示例数据？', loadData);
    } else {
        loadData();
    }
}

function loadFioDataToTable(consumables, storage) {
    const opt = createOptimizer();
    opt.clearAllItems();

    consumables.forEach((dailyConsume, ticker) => {
        const inventory = storage.get(ticker) || 0;
        const dbItem = getMaterialByCode(ticker);

        if (dbItem) {
            opt.addItem(ticker, inventory, dailyConsume, dbItem.weight, dbItem.volume);
        } else {
            opt.addItem(ticker, inventory, dailyConsume, 0, 0);
        }
    });

    renderItems();
    updateItemCount();

    const count = consumables.size;
    showNotification(`已加载 ${count} 种物品数据`, 'success');
}

function displayResults(result, capacityWeight, capacityVolume) {
    const weightRate = result.totalWeight / capacityWeight;
    const volumeRate = result.totalVolume / capacityVolume;
    const bottleneck = weightRate > volumeRate ? '重量' : '体积';

    document.getElementById('optimalDays').textContent = round(result.optimalDays, 2);
    document.getElementById('fillRate').textContent = (result.fillRate * 100).toFixed(2) + '%';
    document.getElementById('totalWeight').textContent = round(result.totalWeight, 2);
    document.getElementById('totalVolume').textContent = round(result.totalVolume, 2);

    document.getElementById('weightText').textContent = round(result.totalWeight, 2) + ' / ' + capacityWeight + ' t';
    document.getElementById('volumeText').textContent = round(result.totalVolume, 2) + ' / ' + capacityVolume + ' m³';
    document.getElementById('bottleneckText').textContent = bottleneck + ' (' + (Math.max(weightRate, volumeRate) * 100).toFixed(2) + '%)';

    document.getElementById('weightProgress').style.transform = `scaleX(${Math.min(weightRate, 1)})`;
    document.getElementById('volumeProgress').style.transform = `scaleX(${Math.min(volumeRate, 1)})`;
    document.getElementById('bottleneckProgress').style.transform = `scaleX(${Math.min(Math.max(weightRate, volumeRate), 1)})`;

    const resultList = document.getElementById('resultList');
    if (!resultList) return;
    resultList.innerHTML = '';

    result.load.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="highlight">${escapeHtml(r.code)}</span></td>
            <td>${r.loadAmount.toLocaleString()}</td>
            <td>${round(r.weight, 2)}</td>
            <td>${round(r.volume, 2)}</td>
            <td>${r.targetInventory.toLocaleString()}</td>
            <td>${round(r.days, 2)} 天</td>
        `;
        resultList.appendChild(tr);
    });

    const resultCard = document.getElementById('resultCard');
    if (resultCard) {
        resultCard.classList.add('show');
        resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function optimize() {
    const btn = document.querySelector('.btn-primary');
    if (btn) btn.classList.add('loading');
    
    try {
        const capacityWeight = parseFloat(document.getElementById('capacityWeight').value) || 2000;
        const capacityVolume = parseFloat(document.getElementById('capacityVolume').value) || 2000;

        const opt = createOptimizer();
        if (opt.items.length === 0) {
            showNotification('请添加物品！', 'warning');
            return;
        }

        const result = opt.optimize(capacityWeight, capacityVolume);

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

function initFioApiEvents() {
    restoreFioAuth();
}

function getPrunTCTemplate() {
    return `
        <section class="card" aria-labelledby="info-heading">
            <h2 id="info-heading">📋 项目说明</h2>
            <div class="info-box" role="region" aria-label="使用说明">
                <p>本工具用于优化船舱装载方案，在保证各物品库存消耗平衡的前提下，将船舱装载至最大容量。</p>
                <p><strong>核心规则：</strong>补充后各物品的库存天数必须相同，按重量和体积中占用比例较高的计算填充率。</p>
            </div>
        </section>
        
        <section class="card" aria-labelledby="fio-api-heading">
            <h2 id="fio-api-heading">🚀 FIO API 集成</h2>
            <div class="api-auth-section">
                <h3>🔐 API 认证</h3>
                <div class="api-auth-form">
                    <div class="form-item">
                        <label for="fioAuthType">认证方式：</label>
                        <select id="fioAuthType" onchange="toggleAuthForm()">
                            <option value="password">用户名密码</option>
                            <option value="apikey">API 密钥</option>
                        </select>
                    </div>
                    <div class="form-item" id="usernameField">
                        <label for="fioUsername">FIO 用户名：</label>
                        <input type="text" id="fioUsername" placeholder="输入 FIO 用户名">
                    </div>
                    <div class="form-item" id="passwordField">
                        <label for="fioPassword">FIO 密码：</label>
                        <input type="password" id="fioPassword" placeholder="输入 FIO 密码">
                    </div>
                    <div class="form-item" id="apiKeyField" style="display: none;">
                        <label for="fioApiKey">API 密钥：</label>
                        <input type="text" id="fioApiKey" placeholder="输入 FIO API 密钥">
                    </div>
                    <button class="btn btn-primary" onclick="fioLogin()" aria-label="登录 FIO API">🔑 登录</button>
                    <button class="btn btn-secondary" onclick="fioLogout()" aria-label="登出 FIO API">🚪 登出</button>
                    <div id="apiStatus" class="api-status" aria-live="polite"></div>
                </div>
            </div>
            
            <div class="base-selection-section" style="margin-top: 20px; display: none;" id="baseSelectionSection">
                <h3>🏙️ 基地选择</h3>
                <div id="baseList" class="base-list" role="list" aria-label="基地列表"></div>
                <button class="btn btn-primary" onclick="loadSelectedBases()" aria-label="加载选中基地数据" style="margin-top: 10px;">📥 加载选中基地数据</button>
            </div>
        </section>
        
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
                        <span>优化目标：在保证各物品库存消耗平衡的前提下，最大化船舱利用率</span>
                    </div>
                </div>
                <div class="ship-info-box">
                    <h3>🚀 飞船信息</h3>
                    <div class="ship-info-item">
                        <span class="ship-info-label">船舱类型：</span>
                        <select id="shipType" onchange="updateShipCapacity()">
                            <option value="">-- 选择船舱 --</option>
                            <option value="TCB">TCB 微型货舱</option>
                            <option value="VSC">VSC 超小型货舱</option>
                            <option value="SCB">SCB 小型货舱</option>
                            <option value="MCB">MCB 中型货舱</option>
                            <option value="LCB">LCB 大型货舱</option>
                            <option value="HCB">HCB 巨型货舱</option>
                            <option value="VCB">VCB 高容积货舱</option>
                            <option value="WCB">WCB 高负荷货舱</option>
                        </select>
                    </div>
                    <div class="ship-info-item">
                        <span class="ship-info-label">重量容量（吨）：</span>
                        <input type="number" id="capacityWeight" value="2000" min="1" step="100" 
                            onchange="validateCapacityInput('weight')">
                    </div>
                    <div class="ship-info-item">
                        <span class="ship-info-label">体积容量（m³）：</span>
                        <input type="number" id="capacityVolume" value="2000" min="1" step="100" 
                            onchange="validateCapacityInput('volume')">
                    </div>
                </div>
            </div>
        </section>
        
        <section class="card" aria-labelledby="items-heading">
            <h2 id="items-heading">📦 物品信息 <span id="itemCount" class="highlight" aria-live="polite">0 种物品</span></h2>
            
            <div id="errorMessage" class="error-message" role="alert"></div>
            
            <div id="itemContainer" class="items-input-section" role="list" aria-label="物品列表"></div>
            
            <div class="action-buttons">
                <button class="btn btn-add" onclick="addItem()" aria-label="添加新物品">➕ 添加物品</button>
                <button class="btn btn-secondary" onclick="loadExampleData()" aria-label="加载示例数据">📋 示例数据</button>
                <button class="btn btn-danger" onclick="clearAllItems()" aria-label="重置所有物品">🔄 重置</button>
            </div>
        </section>
        
        <button class="btn btn-primary" onclick="optimize()" aria-label="开始计算最优装载方案">🧮 计算最优装载方案</button>
        
        <section class="card result-card" id="resultCard" aria-labelledby="result-heading">
            <h2 id="result-heading">📊 优化结果</h2>
            
            <div class="stat-grid" role="group" aria-label="优化统计数据">
                <div class="stat-box">
                    <div class="value" id="optimalDays" aria-label="最优平衡天数">0</div>
                    <div class="label">最优平衡天数</div>
                </div>
                <div class="stat-box">
                    <div class="value" id="fillRate" aria-label="填充率">0%</div>
                    <div class="label">填充率</div>
                </div>
                <div class="stat-box">
                    <div class="value" id="totalWeight" aria-label="总重量">0</div>
                    <div class="label">总重量 (t)</div>
                </div>
                <div class="stat-box">
                    <div class="value" id="totalVolume" aria-label="总体积">0</div>
                    <div class="label">总体积 (m³)</div>
                </div>
            </div>
            
            <div class="progress-section" role="group" aria-label="装载进度">
                <div class="progress-item">
                    <div class="progress-header">
                        <span>⚖️ 重量填充</span>
                        <span id="weightText" aria-label="重量填充详情">0 / 0 t</span>
                    </div>
                    <div class="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
                        <div class="progress-fill weight" id="weightProgress"></div>
                    </div>
                </div>
                <div class="progress-item">
                    <div class="progress-header">
                        <span>📦 体积填充</span>
                        <span id="volumeText" aria-label="体积填充详情">0 / 0 m³</span>
                    </div>
                    <div class="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
                        <div class="progress-fill volume" id="volumeProgress"></div>
                    </div>
                </div>
                <div class="progress-item">
                    <div class="progress-header">
                        <span>🔴 瓶颈资源</span>
                        <span id="bottleneckText" aria-label="瓶颈资源">-</span>
                    </div>
                    <div class="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
                        <div class="progress-fill bottleneck" id="bottleneckProgress"></div>
                    </div>
                </div>
            </div>
            
            <table class="result-table" aria-label="装载方案详情">
                <thead>
                    <tr>
                        <th scope="col">物品代码</th>
                        <th scope="col">装载数量</th>
                        <th scope="col">装载重量(t)</th>
                        <th scope="col">装载体积(m³)</th>
                        <th scope="col">目标库存</th>
                        <th scope="col">库存天数</th>
                    </tr>
                </thead>
                <tbody id="resultList"></tbody>
            </table>
        </section>
    `;
}

function mount() {
    const main = document.getElementById('app-main');
    if (!main) return;
    
    main.innerHTML = getPrunTCTemplate();
    
    initTheme();
    document.getElementById('shipType').value = 'SCB';
    updateShipCapacity();
    initEventDelegation();
    initFioApiEvents();
    addItem();
    addItem();
    
    window.onItemCodeInput = onItemCodeInput;
    window.onItemCodeChange = onItemCodeChange;
    window.addItem = addItem;
    window.removeItem = removeItem;
    window.clearAllItems = clearAllItems;
    window.loadExampleData = loadExampleData;
    window.optimize = optimize;
    window.updateShipCapacity = updateShipCapacity;
    window.validateCapacityInput = validateCapacityInput;
    window.toggleAuthForm = toggleAuthForm;
    window.fioLogin = fioLoginFromForm;
    window.fioLogout = fioLogout;
    window.loadSelectedBases = loadSelectedBases;
    window.loadFioDataToTable = loadFioDataToTable;
}

function unmount() {
    const resultCard = document.getElementById('resultCard');
    if (resultCard) {
        resultCard.classList.remove('show');
    }
    
    delete window.onItemCodeInput;
    delete window.onItemCodeChange;
    delete window.addItem;
    delete window.removeItem;
    delete window.clearAllItems;
    delete window.loadExampleData;
    delete window.optimize;
    delete window.updateShipCapacity;
    delete window.validateCapacityInput;
    delete window.toggleAuthForm;
    delete window.fioLogin;
    delete window.fioLogout;
    delete window.loadSelectedBases;
    delete window.loadFioDataToTable;
}

function createPrunTCModule() {
    return {
        mount,
        unmount,
        name: 'pruntc'
    };
}

export { createPrunTCModule };
