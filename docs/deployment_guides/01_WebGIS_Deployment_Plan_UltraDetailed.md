# WebGIS 生产环境容器化部署规划蓝图 (超详细版)

> **文档说明**：本文档是针对本项目（含 Vue3 客户端、Node.js 接口及 70GB+ 级 GeoServer 栅格影像后端）的宏观全局迁移规划。本文档从硬件准备、策略制定到底层逻辑，为您提供详尽的理论支撑。具体的操作命令和脚本请参阅《实施实施标准作业程序 (SOP)》。

## 第一章：我们的“家底”盘点与部署挑战

在进行任何服务器操作前，我们必须清晰地认知当前系统的数据量级。经过系统扫描，您的 WebGIS 项目资产分为以下四大核心模块：

### 1.1 资产清单
1. **前端与 Node.js 源码层**：位于 `C:\projects\webgis\my_webgis_project`。体积小（不计 node_modules 约数十 MB），包含 Vue3 界面、Cesium 三维地球引擎请求逻辑以及大模型 AI 接口等。
2. **关系型/空间数据库层**：PostgreSQL 数据库 `yunnan_CLCD`。包含县级及格网级土地流转矢量数据。当前在 Windows 系统中占用空间约 **3.2 GB**。
3. **GeoServer 核心配置层**：位于 `E:\GeoServer\GerServer_Data`。包含数百个发布好的图层定义、WMS/WFS 工作区配置、SLD 渲染样式等。总体积计 **723.79 MB**。
4. **巨型遥感影像存储层（外部挂载）**：位于 `E:\yunnan_CLCD_data`。包含了 1985 年至今的按年分类的 CLCD 高分辨率 TIF 格式栅格地图。总体积计 **70.62 GB**。

### 1.2 部署的最大痛点（为什么必须用本方案）
* **痛点一：网络传输的巨大时间成本**。如果 3.2 GB 的数据库导成普通 SQL 文本，体积会膨胀数倍。
* **痛点二：GeoServer 令人窒息的“绝对路径依赖”错误**。这是 GIS 部署的千古难题！在您的 Windows 环境下，GeoServer 内部的 `coveragestore.xml` 配置文件死死地写明了影像地址在 `file://E:/yunnan_CLCD_data/...`。如果直接原样搬到没有 E 盘的 Linux 云服务器上，无论您怎么改代码，所有图层都将变红报错，WebGIS 画布将彻底空白。修改几百个 xml 文件又极尽繁琐且极易出错。
* **痛点三：WebGIS 跨域与切片渲染崩溃 (OOM)**。GeoServer 解析 70GB 的栅格数据，在默认内存配置下，只要前端并发请求流转分析矩阵切片，服务器 Java 必然崩溃报警 (`OutOfMemoryError`)。

---

## 第二章：破局之道 —— Docker 容器化与“路径欺骗”战略

为了完美解决以上三个痛点，我们制定了标准的**Docker 容器化云端架构策略**。

### 2.1 什么是 Docker？为什么要用它？
Docker 相当于标准化的物流集装箱。我们不再手把手教新的 Linux 服务器如何安装配置复杂的 Java 和 PostgreSQL 环境，而是直接把装满环境底座的“集装箱”整体搬运上去，从而做到**“一键点火，零偏差启动”**。

您的系统架构将由三个集装箱 (Container) 组成：
1. **Nginx 反向代理集装箱**：负责接管静态网页，并将跨域请求伪装成同源请求，发送给后端的 GeoServer 和 Node API。
2. **GeoServer 空间引擎集装箱**：我们将在此集装箱中注入 4GB 以上的独立运算内存。
3. **PostGIS 空间数据库集装箱**：存放您的 `yunnan_CLCD` 数据。

### 2.2 核心黑科技：如何通过“路径欺骗”解决 E 盘数据问题？
我们将使用 Docker 的**数据卷映射（Volume Mount）**技术。
云盘（通常挂载为 Linux 的 `/mnt/disks/data`）存放了您的 70GB 影像文件。当配置 GeoServer 集装箱时，我们写下一行神奇的命令：告诉集装箱的系统，把外部的 `/mnt/disks/data/yunnan_CLCD_data` 映射为集装箱内部的 `E:/yunnan_CLCD_data` 路径。

此时，GeoServer 解析配置时，会去寻找 `E:/yunnan` 路径下的图片，它**完全不知道自己其实是被欺骗了**，并成功读取到了 Linux 硬盘上的文件。通过这个魔术，我们在**一行代码都不改、配置文件一个字都不动**的情况下，完成了系统的跨平台（Win -> Linux）无缝平移。

---

## 第三章：上云执行四步走战略

这是整个项目的执行主线轴：

### 阶段 1：购买及整备云环境（Cloud Infrastructure Provisioning）
* 您需要采购一台 Linux 操作系统的云服务器（强烈推荐 Ubuntu 22.04 LTS）。
* **硬件规格底线设定**：
  * **计算组**：由于有大量的空间要素分析，建议最低选用 **4核 CPU，8GB 运行内存**（4C8G）。
  * **系统盘**：50GB 到 80GB 高速固态。
  * **数据盘（至关重要）**：必须额外附加购买一块至少 **100GB 或以上的数据盘**。专门用于承载那 70GB+ 的巨型 TIF 遥感图集！

### 阶段 2：本地资产打包与提纯（Local Data Export & Compression）
* 将 3.2 GB 的数据库通过最高效的 `pg_dump Custom Format` 压缩导出，瘦身至数百兆。
* 将 723 MB 的 GeoServer 文件夹 (`GerServer_Data`) 原样打包为标准 ZIP 包。
* 准备好您的 WinSCP 或者 FileZilla 等传输软件。

### 阶段 3：大动脉输血与系统编排（Data Transfer & Orchestration）
* 将系统盘挂载好，并把所有的备份包以及 70.6GB 原生 TIF 文件传输到服务器指定目录下。
* 通过本规划一并附送的完整 `docker-compose.yml` 脚本，几行命令在云端拉起整个数据库和应用服务阵列。

### 阶段 4：前端重新接轨与封测（Frontend API Rewrite & Dry-Run）
* 将 `Workbench.vue` 和 `vite.config.js` 等涉及到写死 `localhost:3000` 或 `localhost:8080/geoserver` 的硬编码前缀剥除掉。改为统一的 `/api/...` 和 `/geoserver/...` 相对路径。
* 使用 Nginx 分发流量。最后执行一键发布与联调。

> **请移步查阅同目录下的《WebGIS_Deployment_SOP_UltraDetailed.md》，该文档包含详尽到每一行字母级的复制-粘贴执行命令行。**
