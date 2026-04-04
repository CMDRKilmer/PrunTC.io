// FIO API 测试脚本
// 用户名: KAMISAMA223
// API 密钥: f6bdf958-23e4-4f0e-b3c2-1ad379672c0e

const username = 'KAMISAMA223';
const apiKey = 'f6bdf958-23e4-4f0e-b3c2-1ad379672c0e';
const baseUrl = 'https://rest.fnar.net';

// 测试函数
async function testFioApi() {
    console.log('开始测试 FIO API...');
    console.log(`用户名: ${username}`);
    console.log(`API 密钥: ${apiKey}`);
    console.log('====================================');
    
    try {
        // 1. 测试认证（使用 API 密钥）
        console.log('1. 测试认证...');
        const testResponse = await fetch(`${baseUrl}/sites/planets/${username}`, {
            headers: {
                'Authorization': apiKey
            }
        });
        
        if (!testResponse.ok) {
            throw new Error(`认证失败: ${testResponse.status} ${testResponse.statusText}`);
        }
        
        console.log('✅ 认证成功！');
        
        // 2. 获取基地列表
        console.log('\n2. 获取基地列表...');
        const planetsResponse = await fetch(`${baseUrl}/sites/planets/${username}`, {
            headers: {
                'Authorization': apiKey
            }
        });
        
        if (!planetsResponse.ok) {
            throw new Error(`获取基地列表失败: ${planetsResponse.status} ${planetsResponse.statusText}`);
        }
        
        const planets = await planetsResponse.json();
        console.log(`✅ 找到 ${planets.length} 个基地:`);
        planets.forEach((planetId, index) => {
            console.log(`${index + 1}. ${planetId}`);
        });
        
        if (planets.length > 0) {
            // 3. 获取第一个基地的详细信息
            const firstPlanetId = planets[0];
            console.log(`\n3. 获取基地 ${firstPlanetId} 的详细信息...`);
            
            const siteResponse = await fetch(`${baseUrl}/sites/${username}/${firstPlanetId}`, {
                headers: {
                    'Authorization': apiKey
                }
            });
            
            if (siteResponse.ok) {
                const siteData = await siteResponse.json();
                console.log(`✅ 基地信息:`);
                console.log(`   星球 ID: ${siteData.PlanetId}`);
                console.log(`   星球名称: ${siteData.PlanetName}`);
                console.log(`   星球标识符: ${siteData.PlanetIdentifier}`);
                console.log(`   站点 ID: ${siteData.SiteId}`);
                console.log(`   建筑数量: ${siteData.Buildings ? siteData.Buildings.length : 0}`);
            } else {
                console.log(`❌ 获取基地详细信息失败: ${siteResponse.status} ${siteResponse.statusText}`);
            }
            
            // 4. 获取生产数据
            console.log(`\n4. 获取基地 ${firstPlanetId} 的生产数据...`);
            
            const productionResponse = await fetch(`${baseUrl}/production/${username}/${firstPlanetId}`, {
                headers: {
                    'Authorization': apiKey
                }
            });
            
            if (productionResponse.ok) {
                const productionData = await productionResponse.json();
                console.log(`✅ 生产数据:`);
                console.log(`   生产线数量: ${Array.isArray(productionData) ? productionData.length : 0}`);
                
                if (Array.isArray(productionData) && productionData.length > 0) {
                    const firstLine = productionData[0];
                    console.log(`   第一个生产线类型: ${firstLine.Type}`);
                    console.log(`   订单数量: ${firstLine.Orders ? firstLine.Orders.length : 0}`);
                    
                    if (firstLine.Orders && firstLine.Orders.length > 0) {
                        const firstOrder = firstLine.Orders[0];
                        console.log(`   第一个订单:`);
                        console.log(`      输入数量: ${firstOrder.Inputs ? firstOrder.Inputs.length : 0}`);
                        console.log(`      输出数量: ${firstOrder.Outputs ? firstOrder.Outputs.length : 0}`);
                        
                        if (firstOrder.Inputs && firstOrder.Inputs.length > 0) {
                            console.log(`      输入详情:`);
                            firstOrder.Inputs.forEach((input, idx) => {
                                console.log(`         ${idx + 1}. 完整输入项:`, input);
                            });
                        }
                    }
                }
            } else {
                console.log(`❌ 获取生产数据失败: ${productionResponse.status} ${productionResponse.statusText}`);
            }
            
            // 5. 获取存储数据
            console.log(`\n5. 获取基地 ${firstPlanetId} 的存储数据...`);
            
            const storageResponse = await fetch(`${baseUrl}/storage/${username}/${firstPlanetId}`, {
                headers: {
                    'Authorization': apiKey
                }
            });
            
            if (storageResponse.ok) {
                const storageData = await storageResponse.json();
                console.log(`✅ 存储数据:`);
                console.log(`   存储 ID: ${storageData.StorageId}`);
                console.log(`   重量负载: ${storageData.WeightLoad}`);
                console.log(`   体积负载: ${storageData.VolumeLoad}`);
                console.log(`   物品数量: ${storageData.StorageItems ? storageData.StorageItems.length : 0}`);
                
                if (storageData.StorageItems && storageData.StorageItems.length > 0) {
                    console.log(`   存储物品:`);
                    storageData.StorageItems.slice(0, 2).forEach((item, idx) => {
                        console.log(`      ${idx + 1}. 完整物品:`, item);
                    });
                    if (storageData.StorageItems.length > 2) {
                        console.log(`      ... 还有 ${storageData.StorageItems.length - 2} 个物品`);
                    }
                }
            } else {
                console.log(`❌ 获取存储数据失败: ${storageResponse.status} ${storageResponse.statusText}`);
            }
        }
        
        // 6. 获取 burnrate 数据
        console.log(`\n6. 获取用户的 burnrate 数据...`);
        
        const burnrateResponse = await fetch(`${baseUrl}/usersettings/burnrate/${username}`, {
            headers: {
                'Authorization': apiKey
            }
        });
        
        if (burnrateResponse.ok) {
            const burnrateData = await burnrateResponse.json();
            console.log(`✅ Burnrate 数据:`);
            console.log(`   燃烧率记录数量: ${Array.isArray(burnrateData) ? burnrateData.length : 0}`);
            
            if (Array.isArray(burnrateData) && burnrateData.length > 0) {
                console.log(`   燃烧率详情:`);
                burnrateData.forEach((item, idx) => {
                    console.log(`      ${idx + 1}. 完整燃烧率项:`, item);
                });
            }
        } else {
            console.log(`❌ 获取 burnrate 数据失败: ${burnrateResponse.status} ${burnrateResponse.statusText}`);
        }
        
        console.log('\n====================================');
        console.log('测试完成！');
        
    } catch (error) {
        console.error('测试过程中出现错误:', error);
    }
}

// 运行测试
testFioApi();
