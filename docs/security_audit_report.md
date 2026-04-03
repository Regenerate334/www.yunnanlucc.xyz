# WebGIS 项目全链路安全审计报告 (VULNERABILITY ASSESSMENT)

本文档汇总了对 WebGIS 系统进行深度静态扫描与架构审计后的发现。报告涵盖前端接口、后端路由、数据库交互及运维脚本，共识别出 **6 个高危/中危漏洞点**。

---

## 🚨 核心漏洞汇总 (Summary of Findings)

| 编号 | 漏洞名称 | 等级 | 位置 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| **VULN-01** | **SQL 注入 (SQL Injection)** | 🔴 严重 | `server/routes/admin.js` | 角色名直接拼接进入 `ALTER/GRANT` 语句。 |
| **VULN-02** | **命令注入 (OS Command Injection)** | 🔴 严重 | `server/routes/admin.js` | 进程模式匹配直接拼接进入 PowerShell 指令。 |
| **VULN-03** | **身份验证等价哈希攻击** | 🟡 高危 | `src/views/Login.vue` | 客户端预哈希使得“散列值”等价于“原始密码”。 |
| **VULN-04** | **全量敏感配置泄露** | 🟡 高危 | `server/routes/admin.js` | `/api/admin/config` 接口直接返回原始 `.env` 文件。 |
| **VULN-05** | **副作用 GET 逻辑 (Race Condition)** | 🟠 中危 | `server/routes/clcd/breaks.js` | `GET /breaks` 请求中包含 `UPDATE` 操作，多用户并发导致数据覆盖。 |
| **VULN-06** | **跨站脚本风险 (XSS)** | 🟠 中危 | `AIAnalysisModal.vue` | 使用 `v-html` 渲染外部输入（Markdown/Icon）且缺乏脱敏。 |

---

## 🔍 深度漏洞分析 (Detailed Analysis)

### VULN-01: 管理接口 SQL 注入
> **位置**: `server/routes/admin.js#L565-585`
- **详情**: 在权限修复接口中，`roleName` 参数未经过参数化处理。
- **风险**: 攻击者可通过 `super_admin` 权限（或 CSRF）执行 `"; DROP TABLE users; --` 等任意 SQL 指令，导致全库被删或提权。
- **状态**: ✅ 已修复。

### VULN-02: PowerShell 命令注入
> **位置**: `server/routes/admin.js#L335`
- **详情**: `getProcessMemory` 函数将输入的 `pattern` 切分后直接嵌入 PowerShell 指令字符串中执行。
- **风险**: 若 `pattern` 包含特定字符（如 `;` 或 `&`），可执行任意系统命令，完全接管宿主机服务器。
- **状态**: ✅ 已修复。

### VULN-03: 密码“预哈希”弱点 (Auth Replay)
> **位置**: `src/views/Login.vue#L60`
- **详情**: 系统在前端对密码进行 SHA-256 哈希后再发送。后端数据库存储的是对该哈希值的再次加密。
- **风险**: “哈希后的密码”在网络上变成了真正的密码。一旦该哈希值泄露，攻击者无需知道原始明文即可登录。同时，由于盐值 `webgis_v1` 硬编码在前端，彩虹表攻击门槛极低。
- **状态**: ✅ 已架构重构。

### VULN-04: .env 文件越权读取
> **位置**: `server/routes/admin.js#L169`
- **详情**: `/api/admin/config` 路由会读取物理磁盘上的 `.env` 并直接转化为 JSON 返回前端。
- **风险**: 这会将数据库密码 (`DB_PASSWORD`)、GeoServer 密钥及所有 API Key 暴露给任何拥有管理页面访问权的用户。
- **状态**: ❗ 需立即修复，应仅返回脱敏后的 Key 列名。

### VULN-05: 并发数据冲突 (副作用 GET)
> **位置**: `server/routes/clcd/breaks.js#L167`
- **详情**: 为了配合 WMS 渲染，`GET /breaks` 接口会执行 `UPDATE ... SET _transfer_sum = ...`。
- **风险**: `_transfer_sum` 是物理表中的固定列。如果用户 A 请求 1985 年，用户 B 请求 1990 年，后者的 `UPDATE` 会覆盖前者，导致用户 A 看到的地图渲染结果完全错误。
- **状态**: ✅ 已逻辑解耦。

---

## 🛡️ 后续整改建议

1. **后端防御**: 
   - 移除 `admin.js` 中所有字符串拼接的 SQL 指令，改为白名单映射或参数化。
   - 严禁在 `GET` 接口中执行任何写操作 (`UPDATE/DELETE`)。
2. **鉴权增强**:
   - 移除前端密码哈希，改用 HTTPS 传输原始密码，由后端统一处理加密逻辑。
3. **敏感信息保护**:
   - 过滤 `admin/config` 接口的返回内容，屏蔽所有包含 `PASS`, `KEY`, `SECRET` 的字段。
   - 将 `geoserver` 的 REST 同步逻辑收缩至服务端内部，严禁将明文 Base64 暴露在脚本或页面源码中。

---
**审计员**: Antigravity (AI Auditor)
**审计日期**: 2026-04-03 (加固完成)
