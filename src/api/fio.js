/**
 * FIO API 模块
 * 负责处理与 FIO API 的交互
 */

// FIO API 全局状态
let fioAuthToken = null;
let fioUsername = null;
let fioAuthType = 'password';

/**
 * FIO API 登录
 * @param {string} authType - 认证类型 ('password' 或 'apikey')
 * @param {string} username - 用户名
 * @param {string} password - 密码
 * @param {string} apiKey - API 密钥
 * @param {Function} onSuccess - 成功回调
 * @param {Function} onError - 错误回调
 */
export async function fioLogin(authType, username, password, apiKey, onSuccess, onError) {
    try {
        if (authType === 'password') {
            if (!username || !password) {
                throw new Error('请输入用户名和密码');
            }
        } else {
            if (!username || !apiKey) {
                throw new Error('请输入用户名和 API 密钥');
            }
        }

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
        } else {
            // 使用 API 密钥登录（直接设置为认证令牌）
            fioAuthToken = apiKey;
            fioUsername = username;
            fioAuthType = authType;
        }
        
        // 保存认证信息到 localStorage
        localStorage.setItem('fioAuthToken', fioAuthToken);
        localStorage.setItem('fioUsername', fioUsername);
        localStorage.setItem('fioAuthType', fioAuthType);
        
        // 测试认证是否成功
        const testResponse = await fetch(`https://rest.fnar.net/sites/planets/${fioUsername}`, {
            headers: {
                'Authorization': fioAuthToken
            }
        });
        
        if (!testResponse.ok) {
            throw new Error(`认证失败: ${testResponse.status} ${testResponse.statusText}`);
        }
        
        if (onSuccess) onSuccess();
        
        // 获取基地列表
        return await fioGetBases();
    } catch (error) {
        if (onError) onError(error.message);
        clearAuthStorage();
        throw error;
    }
}

/**
 * 获取用户基地列表
 * @returns {Array} 基地列表
 */
export async function fioGetBases() {
    if (!fioAuthToken || !fioUsername) {
        throw new Error('请先登录');
    }
    
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
            return [];
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
                } else {
                    // 如果获取失败，使用 ID 作为名称
                    baseInfoList.push({ planetId, planetName: planetId });
                }
            } catch (error) {
                // 如果出错，使用 ID 作为名称
                baseInfoList.push({ planetId, planetName: planetId });
            }
        }
        
        return baseInfoList;
    } catch (error) {
        throw new Error(`获取基地列表失败: ${error.message}`);
    }
}

/**
 * 加载选中基地的消耗品数据
 * @param {Array} selectedBases - 选中的基地列表
 * @returns {Object} 消耗品和存储数据
 */
export async function fioLoadBaseData(selectedBases) {
    if (!fioAuthToken || !fioUsername) {
        throw new Error('请先登录');
    }
    
    if (selectedBases.length === 0) {
        throw new Error('请选择至少一个基地');
    }
    
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
        
        return {
            consumables: allConsumables,
            storage: allStorage
        };
    } catch (error) {
        throw new Error(`加载基地数据失败: ${error.message}`);
    }
}

/**
 * 清除认证存储
 */
export function clearAuthStorage() {
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
export function fioLogout() {
    clearAuthStorage();
    const usernameInput = document.getElementById('fioUsername');
    const passwordInput = document.getElementById('fioPassword');
    const apiKeyInput = document.getElementById('fioApiKey');
    const authTypeSelect = document.getElementById('fioAuthType');
    const statusDiv = document.getElementById('apiStatus');
    const baseSelectionSection = document.getElementById('baseSelectionSection');
    const baseList = document.getElementById('baseList');

    if (usernameInput) usernameInput.value = '';
    if (passwordInput) passwordInput.value = '';
    if (apiKeyInput) apiKeyInput.value = '';
    if (authTypeSelect) authTypeSelect.value = 'password';
    if (statusDiv) statusDiv.innerHTML = '<span style="color: orange;">已登出</span>';
    if (baseSelectionSection) baseSelectionSection.style.display = 'none';
    if (baseList) baseList.innerHTML = '';
}

/**
 * 检查是否已登录
 * @returns {boolean} 是否已登录
 */
export function isFioLoggedIn() {
    return !!fioAuthToken && !!fioUsername;
}

/**
 * 从本地存储恢复认证信息
 */
export function restoreFioAuth() {
    fioAuthToken = localStorage.getItem('fioAuthToken');
    fioUsername = localStorage.getItem('fioUsername');
    fioAuthType = localStorage.getItem('fioAuthType') || 'password';
}

/**
 * 切换认证表单显示
 */
export function toggleAuthForm() {
    const authType = document.getElementById('fioAuthType').value;
    const usernameField = document.getElementById('usernameField');
    const passwordField = document.getElementById('passwordField');
    const apiKeyField = document.getElementById('apiKeyField');

    if (authType === 'password') {
        if (usernameField) usernameField.style.display = 'flex';
        if (passwordField) passwordField.style.display = 'flex';
        if (apiKeyField) apiKeyField.style.display = 'none';
    } else {
        if (usernameField) usernameField.style.display = 'flex';
        if (passwordField) passwordField.style.display = 'none';
        if (apiKeyField) apiKeyField.style.display = 'flex';
    }
}

/**
 * 加载选中基地的消耗品数据（从 DOM 读取选中状态）
 */
export async function loadSelectedBases() {
    if (!fioAuthToken || !fioUsername) {
        const statusDiv = document.getElementById('apiStatus');
        if (statusDiv) statusDiv.innerHTML = '<span style="color: red;">请先登录</span>';
        return;
    }

    const checkboxes = document.querySelectorAll('#baseList input[type="checkbox"]:checked');
    const selectedBases = Array.from(checkboxes).map(cb => {
        const planetId = cb.value;
        const planetName = cb.getAttribute('data-name') || planetId;
        return { planetId, planetName };
    });

    if (selectedBases.length === 0) {
        const statusDiv = document.getElementById('apiStatus');
        if (statusDiv) statusDiv.innerHTML = '<span style="color: red;">请选择至少一个基地</span>';
        return;
    }

    const statusDiv = document.getElementById('apiStatus');
    if (statusDiv) statusDiv.innerHTML = '<span style="color: blue;">正在加载基地数据...</span>';

    try {
        const { consumables, storage } = await fioLoadBaseData(selectedBases);
        if (statusDiv) statusDiv.innerHTML = `<span style="color: green;">成功加载 ${consumables.size} 种消耗品</span>`;
    } catch (error) {
        if (statusDiv) statusDiv.innerHTML = `<span style="color: red;">加载基地数据失败: ${error.message}</span>`;
    }
}

// 导出公共方法
export {
    fioAuthToken,
    fioUsername,
    fioAuthType
};