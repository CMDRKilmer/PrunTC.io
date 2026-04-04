# FIO REST API 端点文档

基础URL: `https://rest.fnar.net`

认证方式: 在请求头中添加 `Authorization: <AUTH_TOKEN_HASH>`

***

## 端点分类索引

| 分类                                     | 公共端点 | 认证端点 | 说明                |
| -------------------------------------- | ---- | ---- | ----------------- |
| [Auth](#auth-认证)                       | 0    | 16   | 认证与权限管理           |
| [Admin](#admin-管理员)                    | 0    | 13   | 管理员功能             |
| [Building](#building-建筑物)              | 2    | 1    | 建筑物信息             |
| [Chat](#chat-聊天)                       | 3    | 4    | 聊天功能              |
| [CSV](#csv-电子表格格式)                     | 27   | 0    | 适合电子表格使用的数据格式     |
| [Exchange](#exchange-交易所)              | 7    | 1    | 商品交易所信息           |
| [Global](#global-全局数据)                 | 4    | 3    | 全局游戏数据            |
| [Infrastructure](#infrastructure-基础设施) | 1    | 2    | 基础设施信息            |
| [LocalMarket](#localmarket-本地市场)       | 6    | 2    | 本地市场信息            |
| [Material](#material-材料)               | 2    | 2    | 材料信息              |
| [Planet](#planet-星球)                   | 4    | 6    | 星球信息              |
| [Production](#production-生产)           | 0    | 4    | 生产线信息             |
| [Rain](#rain-雨数据)                      | 8    | 14   | Google Sheet 数据格式 |
| [Recipes](#recipes-配方)                 | 1    | 1    | 配方信息              |
| [Ship](#ship-飞船)                       | 0    | 4    | 飞船信息              |
| [Sites](#sites-站点)                     | 0    | 7    | 站点信息              |
| [Storage](#storage-存储)                 | 0    | 4    | 存储信息              |
| [SystemStars](#systemstars-系统恒星)       | 5    | 3    | 系统和恒星信息           |
| [User](#user-用户)                       | 0    | 4    | 用户信息              |
| [UserSettings](#usersettings-用户设置)     | 0    | 9    | 用户设置              |
| [Version](#version-版本)                 | 5    | 0    | 版本信息              |
| [Workforce](#workforce-劳动力)            | 0    | 4    | 劳动力信息             |

**总计**: 75 个公共端点 + 65 个认证端点

***

## Auth (认证)

### 登录

**POST** `/auth/login`

登录到 FIO 并获取认证令牌。

**请求体**:

```json
{
  "UserName": "Saganaki",
  "Password": "Hunter2"
}
```

**响应示例**:

```json
{
  "AuthToken": "f6639c30d1a647b8937da9874bf1ec10",
  "Expiry": "2021-01-19T17:10:57.8648344Z",
  "IsAdministrator": false
}
```

### 检查认证状态

**GET** `/auth`

检查当前用户是否已认证。

**响应**: 200 已认证, 401 未认证

### 获取权限列表

**GET** `/auth/permissions`

获取所有权限允许。

**响应示例**:

```json
[
  {
    "UserName": "Saganaki",
    "FlightData": false,
    "BuildingData": true,
    "StorageData": true,
    "ProductionData": false,
    "WorkforceData": true,
    "ExpertsData": true,
    "ContractData": false,
    "ShipmentTracking": false
  }
]
```

### 刷新认证令牌

**POST** `/auth/refreshauthtoken`

刷新认证令牌，有效期延长至当前时间起24小时。

### 修改密码

**POST** `/auth/changepassword`

**请求体**:

```json
{
  "OldPassword": "OldPassword",
  "NewPassword": "Hunter2"
}
```

### 添加权限

**POST** `/auth/addpermission`

**请求体**:

```json
{
  "UserName": "Saganaki",
  "FlightData": true,
  "BuildingData": true,
  "StorageData": true,
  "ProductionData": false,
  "WorkforceData": true,
  "ExpertsData": true,
  "ContractData": false,
  "ShipmentTracking": false
}
```

### 删除权限

**POST** `/auth/deletepermission/{UserName}`

删除指定用户的权限允许。

### 创建 API 密钥

**POST** `/auth/createapikey`

**请求体**:

```json
{
  "UserName": "Saganaki",
  "Password": "Hunter2",
  "AllowWrites": false,
  "Application": "FIOWeb-Chrome"
}
```

**响应**: 返回创建的 API 密钥（纯文本）。

### 撤销 API 密钥

**POST** `/auth/revokeapikey`

**请求体**:

```json
{
  "UserName": "Saganaki",
  "Password": "Hunter2",
  "ApiKeyToRevoke": "e04e2e9f-e970-4253-8349-45c33a54d42e"
}
```

### 列出 API 密钥

**POST** `/auth/listapikeys`

### 创建群组

**POST** `/auth/creategroup`

**请求体**:

```json
{
  "GroupId": "12345678",
  "GroupName": "My_Group1",
  "GroupUsers": ["Saganaki", "Kovus"]
}
```

### 删除群组

**POST** `/auth/deletegroup/{GroupId}`

### 获取拥有的群组

**GET** `/auth/groups`

### 获取群组详情

**GET** `/auth/group/{GroupId}`

***

## Admin (管理员)

### 检查管理员身份

**GET** `/admin`

检查当前用户是否为管理员。

**响应**: 200 是管理员, 401 不是管理员

### 检查用户名

**GET** `/admin/{UserName}`

检查指定用户名是否存在。

**响应**: 200 存在, 204 不存在

### 获取所有用户

**GET** `/admin/allusers`

获取所有用户名列表。

**响应示例**:

```json
["Saganaki", "Kovus", "EatTacos88"]
```

### 获取用户数量

**GET** `/admin/usercount`

### 创建账户

**POST** `/admin/create`

**请求体**:

```json
{
  "UserName": "Saganaki",
  "Password": "Hunter2",
  "IsAdmin": false
}
```

### 禁用账户

**POST** `/admin/disable`

**请求体**:

```json
{
  "UserName": "Saganaki",
  "Reason": "This user was disabled because they abused the API"
}
```

### 清除 CX 数据

**POST** `/admin/clearcxdata`

### 清除 MAT 数据

**POST** `/admin/clearmatdata`

### 清除跳跃缓存

**POST** `/admin/clearjumpcache`

### 重置用户数据

**POST** `/admin/resetuserdata/{UserName}`

***

## Building (建筑物)

### 获取所有建筑物

**GET** `/building/allbuildings`

获取所有建筑物列表 (WorldReactorData)。

**响应示例**:

```json
[
  {
    "Ticker": "FP",
    "Name": "foodProcessor",
    "Area": 42,
    "Expertise": "FOOD_INDUSTRIES"
  }
]
```

### 获取指定建筑物

**GET** `/building/{BuildingTicker}`

**参数**: `BuildingTicker` - 建筑物代码

**响应示例**:

```json
{
  "Ticker": "FP",
  "Name": "foodProcessor",
  "Area": 42,
  "Expertise": "FOOD_INDUSTRIES"
}
```

### 上传建筑物数据

**POST** `/building` *(需认证)*

***

## Chat (聊天)

### 获取频道列表

**GET** `/chat/list`

获取可搜索的频道名称和对应的 ChannelId。

**响应示例**:

```json
[
  {
    "DisplayName": "CR-701a Global Site Owners",
    "ChannelId": "7a581ed1c9d891f1e372a280b5d77b5c"
  }
]
```

### 获取频道消息

**GET** `/chat/display/{ChannelDescription}`

获取频道最近300条消息。

**参数**: `ChannelDescription` 可以是 ChannelId、ChannelDisplayName、PlanetName 或 PlanetNaturalId

### 获取频道消息 (纯文本)

**GET** `/chat/display/pretty/{ChannelDescription}`

***

## CSV (电子表格格式)

在 Google Sheets 中使用: `=IMPORTDATA("https://rest.fnar.net/csv/ENDPOINT")`

### 基础数据

| 端点                        | 描述     | 示例                 |
| ------------------------- | ------ | ------------------ |
| `/csv/buildings`          | 建筑物信息  | buildings          |
| `/csv/buildingcosts`      | 建筑物成本  | buildingcosts      |
| `/csv/buildingworkforces` | 建筑物劳动力 | buildingworkforces |
| `/csv/buildingrecipes`    | 建筑物配方  | buildingrecipes    |
| `/csv/materials`          | 材料信息   | materials          |

### 价格数据

| 端点                      | 描述        |
| ----------------------- | --------- |
| `/csv/prices`           | 完整价格信息    |
| `/csv/prices/condensed` | 价格信息(精简版) |
| `/csv/orders`           | 价格订单      |
| `/csv/bids`             | 价格竞价      |

### 配方数据

| 端点                   | 描述   |
| -------------------- | ---- |
| `/csv/recipeinputs`  | 配方输入 |
| `/csv/recipeoutputs` | 配方输出 |

### 星球数据

| 端点                          | 描述     |
| --------------------------- | ------ |
| `/csv/planets`              | 星球信息   |
| `/csv/planetresources`      | 星球资源   |
| `/csv/planetproductionfees` | 星球生产费用 |
| `/csv/planetdetail`         | 详细星球信息 |

### 系统数据

| 端点                   | 描述   |
| -------------------- | ---- |
| `/csv/systems`       | 系统信息 |
| `/csv/systemlinks`   | 系统链接 |
| `/csv/systemplanets` | 系统星球 |

### 基础设施数据

| 端点                                    | 描述         |
| ------------------------------------- | ---------- |
| `/csv/infrastructure/report/{Planet}` | 特定星球基础设施报告 |
| `/csv/infrastructure/allreports`      | 所有基础设施报告   |
| `/csv/infrastructure/infos/{Planet}`  | 特定星球基础设施信息 |
| `/csv/infrastructure/allinfos`        | 所有基础设施信息   |

### 本地市场数据

| 端点                               | 描述   |
| -------------------------------- | ---- |
| `/csv/localmarket/buy/{Planet}`  | 买入广告 |
| `/csv/localmarket/sell/{Planet}` | 卖出广告 |
| `/csv/localmarket/ship/{Planet}` | 运输广告 |

### 其他数据

| 端点                   | 描述                            |
| -------------------- | ----------------------------- |
| `/csv/cxpc/{Ticker}` | CXPC 数据                       |
| `/csv/inventory`     | 用户库存 *(需apikey和username参数)*   |
| `/csv/burnrate`      | 燃烧率 *(需apikey和username参数)*    |
| `/csv/sites`         | 用户站点 *(需apikey和username参数)*   |
| `/csv/workforce`     | 劳动力 *(需apikey和username参数)*    |
| `/csv/cxos`          | CXOS交易 *(需apikey和username参数)* |

***

## Exchange (交易所)

### 获取所有交易所汇总

**GET** `/exchange/all`

**响应示例**:

```json
[
  {
    "ExchangeTicker": "RAT.ABC",
    "Average": 681.05,
    "LastPrice": 650.00
  }
]
```

### 获取所有交易所完整数据

**GET** `/exchange/full`

获取所有交易所完整数据，包括订单信息。

### 获取交易所站点

**GET** `/exchange/station`

获取所有交易所站点数据。

### 获取指定交易所

**GET** `/exchange/{ExchangeTicker}`

**参数**: `ExchangeTicker` - 格式: `Material.ExchangeCode` 例如: `RAT.ABC`

### 获取价格图表

**GET** `/exchange/cxpc/{ExchangeTicker}`

**GET** `/exchange/cxpc/{ExchangeTicker}/{TimeStamp}`

**参数**: `TimeStamp` - 毫秒时间戳 (UTC)

### 获取公司订单

**GET** `/exchange/orders/{CompanyCode}`

**GET** `/exchange/orders/{CompanyCode}/{ExchangeCode}`

***

## Global (全局数据)

### 获取 COMEX 交易所列表

**GET** `/global/comexexchanges`

### 获取国家数据

**GET** `/global/countries`

### 获取模拟数据

**GET** `/global/simulationdata`

### 获取劳动力需求

**GET** `/global/workforceneeds`

***

## Infrastructure (基础设施)

### 获取基础设施数据

**GET** `/infrastructure/{PlanetOrInfrastructureId}`

**参数**: `PlanetOrInfrastructureId` 可以是 PopulationId、InfrastructureId、PlanetId、PlanetNaturalId 或 PlanetName

***

## LocalMarket (本地市场)

### 获取本地市场数据

**GET** `/localmarket/{LocalMarketId}`

### 按星球获取

**GET** `/localmarket/planet/{Planet}`

**GET** `/localmarket/planet/{Planet}/{Type}`

**参数**: `Type` 可以是 BUY/BUYS/BUYING, SELL/SELLS/SELLING, SHIP/SHIPPING

### 运输相关

**GET** `/localmarket/shipping/source/{SourcePlanet}`

**GET** `/localmarket/shipping/destination/{DestinationPlanet}`

### 按公司获取

**GET** `/localmarket/company/{Company}`

### 搜索

**POST** `/localmarket/search`

**请求体**:

```json
{
  "SearchBuys": true,
  "SearchSells": true,
  "Ticker": "RAT",
  "CostThreshold": 1.5,
  "SourceLocation": "Katoa"
}
```

***

## Material (材料)

### 获取所有材料

**GET** `/material/allmaterials` *(需认证)*

### 获取指定材料

**GET** `/material/{MaterialTicker}`

### 按分类获取

**GET** `/material/category/{CategoryName}`

***

## Planet (星球)

### 获取所有星球

**GET** `/planet/allplanets`

**响应示例**:

```json
[
  {
    "PlanetNaturalId": "XK-745b",
    "PlanetName": "Katoa"
  }
]
```

### 获取所有星球完整数据

**GET** `/planet/allplanets/full`

### 获取指定星球

**GET** `/planet/{Planet}`

**参数**: `Planet` 可以是 PlanetId、PlanetNaturalId 或 PlanetName

### 搜索星球

**POST** `/planet/search`

**请求体**:

```json
{
  "Materials": ["FEO", "LST"],
  "IncludeRocky": true,
  "IncludeGaseous": true,
  "IncludeLowGravity": true,
  "IncludeHighGravity": false,
  "IncludeLowPressure": true,
  "IncludeHighPressure": false,
  "IncludeLowTemperature": true,
  "IncludeHighTemperature": false,
  "MustBeFertile": true,
  "MustHaveLocalMarket": true,
  "MustHaveChamberOfCommerce": false,
  "MustHaveWarehouse": true,
  "MustHaveAdministrationCenter": true,
  "MustHaveShipyard": false,
  "DistanceChecks": ["Katoa", "Promitor", "Montem"]
}
```

***

## Production (生产)

### 获取用户生产线

**GET** `/production/{UserName}` *(需 production 权限)*

### 获取用户有生产线的星球

**GET** `/production/planets/{UserName}` *(需 production 权限)*

### 获取指定星球生产线

**GET** `/production/{UserName}/{Planet}` *(需 production 权限)*

***

## Rain (雨数据)

Google Sheet 友好的规范化数据格式。

### 基础数据

| 端点                         | 描述             |
| -------------------------- | -------------- |
| `/rain/buildings`          | 所有建筑物数据        |
| `/rain/buildingcosts`      | 建筑物成本数据 (规范化)  |
| `/rain/buildingworkforces` | 建筑物劳动力数据 (规范化) |
| `/rain/buildingrecipes`    | 建筑物配方数据 (规范化)  |
| `/rain/materials`          | 材料数据           |
| `/rain/prices`             | CX 价格数据        |
| `/rain/recipeinputs`       | 配方输入数据 (规范化)   |
| `/rain/recipeoutputs`      | 配方输出数据 (规范化)   |
| `/rain/planetresources`    | 星球资源数据 (规范化)   |

### 用户数据

| 端点                                                | 描述    | 权限         |
| ------------------------------------------------- | ----- | ---------- |
| `/rain/userliquid/{UserName}`                     | 流动资产  | storage    |
| `/rain/userplanets/{UserName}`                    | 用户星球  | storage    |
| `/rain/userplanetbuildings/{UserName}`            | 星球建筑  | building   |
| `/rain/userplanetbuildingreclaimables/{UserName}` | 可回收建筑 | building   |
| `/rain/userplanetproduction/{UserName}`           | 星球生产  | production |
| `/rain/userplanetproductioninput/{UserName}`      | 生产投入  | production |
| `/rain/userplanetproductionoutput/{UserName}`     | 生产产出  | production |
| `/rain/userplanetworkforce/{UserName}`            | 劳动力   | workforce  |
| `/rain/userstorage/{UserName}`                    | 存储    | storage    |

***

## Recipes (配方)

### 获取所有配方

**GET** `/recipes/allrecipes` *(需认证)*

**响应示例**:

```json
[
  {
    "BuildingTicker": "FP",
    "RecipeName": "1xGRN 1xBEA 1xNUT = 10xRAT",
    "Inputs": [
      { "Ticker": "GRN", "Amount": 1 },
      { "Ticker": "BEA", "Amount": 1 },
      { "Ticker": "NUT", "Amount": 1 }
    ],
    "Outputs": [
      { "Ticker": "RAT", "Amount": 10 }
    ],
    "TimeMs": 21600000
  }
]
```

### 获取指定配方

**GET** `/recipes/{Ticker}`

***

## Ship (飞船)

### 获取用户船只

**GET** `/ship/ships/{UserName}` *(需 flight 权限)*

### 获取船只燃料

**GET** `/ship/ships/fuel/{UserName}` *(需 flight 权限)*

### 获取用户航班

**GET** `/ship/flights/{UserName}` *(需 flight 权限)*

***

## Sites (站点)

### 获取用户站点

**GET** `/sites/{UserName}` *(需 building 权限)*

### 获取用户有站点的星球

**GET** `/sites/planets/{UserName}` *(需 building 权限)*

### 获取用户在星球的站点

**GET** `/sites/{UserName}/{Planet}` *(需 building 权限)*

### 获取用户仓库

**GET** `/sites/warehouses/{UserName}` *(需 building 权限)*

***

## Storage (存储)

### 获取用户存储

**GET** `/storage/{UserName}` *(需 storage 权限)*

### 获取用户有存储的星球

**GET** `/storage/planets/{UserName}` *(需 storage 权限)*

### 获取用户指定存储

**GET** `/storage/{UserName}/{StorageDescription}` *(需 storage 权限)*

***

## SystemStars (系统恒星)

### 获取所有恒星

**GET** `/systemstars`

### 获取世界区域

**GET** `/systemstars/worldsectors`

### 获取跳跃次数

**GET** `/systemstars/jumpcount/{Source}/{Destination}`

**响应**: 整数 (跳跃次数)

### 获取跳跃路线

**GET** `/systemstars/jumproute/{Source}/{Destination}`

**响应示例**:

```json
[
  {
    "SourceSystemId": "cf135f115b2b0f268b19ce3626637248",
    "SourceSystemName": "Daikoku",
    "SourceSystemNaturalId": "WN-506",
    "DestinationSystemId": "bb0450c417f7623f5bac4bd779b9a8b9",
    "DestinationSystemName": "WN-428",
    "DestinationSystemNaturalId": "WN-428",
    "Distance": 50.95398174301303
  }
]
```

### 获取指定恒星

**GET** `/systemstars/star/{Star}`

**参数**: `Star` 可以是 SystemId、SystemName 或 SystemNaturalId

***

## User (用户)

### 获取所有用户

**GET** `/user/allusers`

**响应示例**:

```json
["Saganaki", "Kovus", "EatTacos88"]
```

### 获取指定用户数据

**GET** `/user/{UserName}`

### 重置当前用户数据

**POST** `/user/resetalldata`

删除以下数据:

- Company data
- ProductionLine data
- Ship data
- Site data
- Workforce data
- User data
- Warehouse data
- Contract data

***

## UserSettings (用户设置)

### 燃烧率设置

**POST** `/usersettings/burnrate/addexclusion`

**请求体**:

```json
{
  "PlanetNaturalId": "XK-745b",
  "MaterialTicker": "COF"
}
```

**POST** `/usersettings/burnrate/deleteexclusion`

**GET** `/usersettings/burnrate/{UserName}`

**GET** `/usersettings/burnrate/{UserName}/{PlanetNaturalId}`

***

## Version (版本)

### 获取最新版本号

**GET** `/version/latest`

**响应**: 版本字符串

### 获取发布说明

**GET** `/version/releasenotes`

返回 rtf 格式文件。

### 获取安装程序

**GET** `/version/download`

### 获取 Chrome 扩展

**GET** `/version/extension/download`

重定向到 Chrome 扩展页面。

### 获取上传脚本

**GET** `/version/extension/script`

***

## Workforce (劳动力)

### 获取用户劳动力

**GET** `/workforce/{UserName}` *(需 workforce 权限)*

### 获取用户有劳动力的星球

**GET** `/workforce/planets/{UserName}` *(需 workforce 权限)*

### 获取指定星球劳动力

**GET** `/workforce/{UserName}/{Planet}` *(需 workforce 权限)*

***

## 权限类型说明

| 权限名                | 描述     |
| ------------------ | ------ |
| `flight`           | 航班权限   |
| `building`         | 建筑物权限  |
| `storage`          | 存储权限   |
| `production`       | 生产权限   |
| `workforce`        | 劳动力权限  |
| `experts`          | 专家权限   |
| `contracts`        | 合同权限   |
| `shipmenttracking` | 货运追踪权限 |
| `admin`            | 管理员权限  |

***

## 认证说明

1. 使用 `/auth/login` 获取 AuthToken
2. 在后续请求头中添加 `Authorization: <AUTH_TOKEN>`
3. API 密钥可在 `/auth/createapikey` 创建
4. 部分端点需要额外的特定权限才能访问

***

*文档基于 FIO REST API yaml 规范生成*
