# LUCC 预警指标体系（核验与可追溯重构版，2026-04-22）

- 适用模块：右侧面板 `DashboardRightPanel.vue`
- 后端实现：`server/services/landUseService.js`
- 接口：`GET /api/clcd/monitoring/:level/:name/:year?policy=...`
- 编码：UTF-8

---

## 0. 结论（先给结论）

1. 你提出的核心问题成立：耕地、城镇建设、生态三者存在强耦合，单一综合分易出现“风险抵消”。  
2. 当前系统已升级为“熵权核心分 + 政策耦合项”的分层结构，避免耕地骤降被生态项掩盖。  
3. 文档口径统一为“可追溯声明”：  
   - 有明确文献/标准支持的部分，标注来源；  
   - 属于工程代理构造的部分，明确写为“代理指标”；  
   - 属于政策情景参数的部分，明确写为“政策参数”，不伪称通用定律。  
4. 若论文审稿更强调“只依赖 LUCC 统计数据的硬证据监测”，建议优先采用 **2.4 节的动态度 + 转移矩阵**（不依赖能源账单与 InVEST 真值输出）。  

---

## 1. 文献一致性核验（修正后的边界）

### 1.1 HQ 与 InVEST 的关系

- 可证据事实：InVEST Habitat Quality 是基于威胁源、敏感性、衰减与可达性的空间模型，不是简单面积加权。  
- 本系统做法：使用面积加权得到“生境支持代理指标（HQ proxy）”。  
- 规范写法：不得宣称“严格等同 InVEST-HQ”，只能写“受其生态质量思想启发的代理指标”。

### 1.2 熵权法

- 可证据事实：熵权法的标准推导（$p_{ij}, e_j, d_j, w_j$）有稳定方法学来源。  
- 本系统做法：用于四个核心指标（HQ/CMP/ERes/PLEC）的客观赋权。

### 1.3 耦合协调度（CCD）

- 可证据事实：$D=\sqrt{C\cdot T}$ 形式在区域发展、生态-经济协调研究中广泛使用。  
- 本系统做法：将其用于生产-生活-生态（PLE）子系统耦合风险代理。
                     
### 1.4 需要明确“工程代理”的部分

以下内容在系统中是“可解释代理”而非统一国家标准参数：

1. CMP 的具体地类碳系数组合（用于在缺少能源账单时近似表达碳压）。  
2. ERes 的地类韧性系数表（0.9/0.8/0.7/0.2...）。  
3. PLE 压力比 `(2*life + prod)/eco`。  
4. 政策情景权重、阈值与敏感度（如 `cropland_decline_sensitivity`）。  

这些都可用于论文，但必须标注“区域化参数设定/工程代理构造”，并给出校准流程。

---

## 2. 当前可复现算法结构（与代码一致）

### 2.1 核心指标层（熵权核心分）

1. 生境支持代理（HQ proxy）

$$
HQ_t=\frac{\sum_i A_{i,t}w_i}{\sum_i A_{i,t}}\times 100
$$

2. 土地利用碳压代理（CMP proxy）

$$
CMP_t=\frac{C^{source}_t}{C^{sink}_t+\epsilon}\left(1+\frac{A_{imp,t}}{A_{tot,t}}\right)
$$

3. 生态韧性代理（ERes proxy）

$$
ERes_t=\frac{\sum_i A_{i,t}r_i}{\sum_i A_{i,t}}\times 100
$$

4. 三生空间压力代理（PLEC proxy）

$$
PLEC_t=\frac{2A_{life,t}+A_{prod,t}}{A_{eco,t}+\epsilon}
$$

### 2.2 核心分风险化与熵权

1. 逐指标 Min-Max 风险映射（HQ/ERes 反向）。  
2. 熵值与权重：

$$
p_{ij}=\frac{x_{ij}}{\sum_i x_{ij}},\quad
e_j=-k\sum_i p_{ij}\ln p_{ij},\quad
w_j=\frac{1-e_j}{\sum_j(1-e_j)}
$$

3. 核心综合分：

$$
Core=\sum_j w_j S_j
$$

### 2.3 政策耦合层

1. 耕地红线风险（库存 + 流量）  

库存项：

$$
R_{stock}=f\left(\max\left(0,\frac{A_{crop,target}-A_{crop,t}}{A_{crop,target}}\right)\right)
$$

流量项（同比下降）：

$$
R_{flow}=f\left(\max\left(0,-\frac{A_{crop,t}-A_{crop,t-1}}{A_{crop,t-1}}\right)\right)
$$

合成：

$$
R_{redline}=\omega_sR_{stock}+\omega_fR_{flow}
$$

2. 城镇扩张强度风险（UEI 代理）

$$
UEI_t=\frac{A_{imp,t}-A_{imp,t-1}}{A_{tot,t}\Delta t}\times 100\%
$$

再根据政策策略（`control/balanced/encourage`）映射风险分。

3. PLE 耦合协调风险（CCD 代理）

$$
C=\left(\frac{PLE}{\left(\frac{P+L+E}{3}\right)^3}\right)^{1/3},\quad
T=\alpha P+\beta L+\gamma E,\quad
D=\sqrt{CT},\quad
R_{coupling}=(1-D)\times100
$$

4. 最终综合分：

$$
Score=w_cCore+w_rR_{redline}+w_uR_{urban}+w_kR_{coupling}
$$

### 2.4 LUCC 变化监测指标（仅使用 LUCC 统计数据）

你提出的担忧是关键点：很多生态/碳/生境指标的“权威口径”往往需要能源清单、驱动因子或 InVEST 等过程模型。  
**但如果你的可用数据只有 LUCC 面积统计与转移矩阵**，仍然可以用文献里更常见、可复现的方式完成 LUCC 变化监测（并且审稿人更容易接受）。

#### 2.4.1 面积与结构（最基础但最稳）

对每一类地类 $i$：

- 面积：$A_{i,t}$  
- 占比：$p_{i,t}=A_{i,t}/A_{tot,t}$  
- 变化量：$\Delta A_i=A_{i,t_2}-A_{i,t_1}$

工程实现（本项目）：

- `clcd_analysis` 支持结构/趋势输出（`query_type=structure|trend`）。

#### 2.4.2 土地利用动态度（Dynamic Degree）

动态度是 LUCC 研究中常用的“变化速度”指标，**只需要两期地类面积**。常见定义包括：

1. 单一地类动态度（单类变化速率，常见定义可追溯至王秀兰 & 包玉海(1999)，并在 LUCC 变化监测中被广泛采用，如 Huang et al.(2018)）

$$
K_i=\frac{A_{i,t_2}-A_{i,t_1}}{A_{i,t_1}}\cdot\frac{1}{T}\cdot100\%
$$

2. 综合动态度（区域总体变化剧烈程度，常见定义可追溯至王秀兰 & 包玉海(1999)，并在 LUCC 变化监测中被广泛采用，如 Huang et al.(2018)）

$$
LC=\frac{\sum_i\left|A_{i,t_2}-A_{i,t_1}\right|}{2\sum_i A_{i,t_1}}\cdot\frac{1}{T}\cdot100\%
$$

工程实现（本项目）：

- 后端：`server/utils/indices/dynamicDegree.js`
  - `calculateSingleDynamicDegree(startArea, endArea, yearDiff)`
  - `calculateDynamicDegree(startData, endData, yearDiff)`
- 工具：`dashboard_analysis` 已输出综合动态度与关键子项动态度。

#### 2.4.3 转移矩阵与变化分解（Transfer Matrix）

如果有两期 LUCC 的叠置结果（转移矩阵 $M_{ij}$：$i\to j$），则可以把变化从“方向”层面讲清楚：谁转成了谁。  
在此基础上，文献里常用的分解口径包括“保持/转入/转出/净变化/交换变化（swap）”等概念（Pontius et al., 2004）：

- 保持（不变）：$P_i=M_{ii}$  
- 转出（loss）：$L_i=\sum_{j\ne i}M_{ij}$  
- 转入（gain）：$G_i=\sum_{j\ne i}M_{ji}$  
- 总变化（gross change）：$C_i=G_i+L_i$  
- 净变化（net change）：$N_i=G_i-L_i$  
- 交换变化（swap）：$S_i=C_i-|N_i|=2\min(G_i,L_i)$
- 提示：该分解口径与 `land_transfer_analysis` 工具输出的“转入/转出/净变化/交换变化/保持”表一致，便于论文与系统结果一一对应。

工程实现（本项目）：

- 工具：`land_transfer_analysis` 可直接查询区域的转移矩阵（并能按 `province/prefecture/county` 过滤）。
- API（矩阵形式）：`GET /api/analysis/transfer-matrix/:period`（返回绝对矩阵与百分比矩阵）。

#### 2.4.4 可选：Intensity Analysis（更学术的“强度监测框架”）

若你希望把“变化强度”做成论文主线，Intensity Analysis 是一个更系统的框架：以区间、类别、转移三个层级统一度量变化强度与稳定性（Aldwaik & Pontius, 2012），应用实例可参考 Huang et al.(2018)。  
该方法同样只依赖转移矩阵与时间跨度，不需要能源/人口等外部驱动数据。

---

## 3. 场景化必要性（与你的政策背景问题对应）

同一套固定权重不能跨政策周期直接比较：

1. 耕地保护主导期：耕地下降的惩罚应显著提高。  
2. 退耕还林主导期：生态恢复应提高权重，耕地底线策略相应调整。  
3. 城镇发展主导期：应对扩张不足和过快扩张分别建模。

因此本系统采用 `policy` 参数驱动：

- `farmland_protection`
- `balanced`
- `ecological_protection`
- `urban_development`
- `reforestation`

---

## 4. 后端与前端一致性核查

### 4.1 后端关键函数

- `_calcMonitoringRaw(data)`：四指标代理值  
- `_calcRiskScoresBySeries(rawSeries,currentRaw)`：风险标准化  
- `_calcEntropyWeights(scoreSeries)`：熵权  
- `_calcPolicyRisk(...)`：红线/扩张/耦合  
- `_calculateMonitoringIndices(...)`：核心与耦合融合  
- `getRegionMonitoring(..., options)`：API 主入口

### 4.2 API 输出字段

- `metrics.hq|cmp|eres|plec.{value,base,score}`
- `weights`
- `weighting`
- `policy`
- `policyMetrics`
- `compositeBreakdown`
- `legacyCompositeScore`
- `compositeScore`

### 4.3 前端消费

前端直接使用后端返回值，不做二次重算，保证“公式口径 = 展示口径”。

---

## 5. 可追溯参考文献（论文可直接引用）

以下文献已按“标准/官方文档/同行评议论文”分层整理，可直接作为论文参考文献候选：

1. 生态环境部. 生态环境状况评价技术规范: HJ 192-2015.  
   官方页面: https://www.mee.gov.cn/ywgz/fgbz/bz/bzwb/stzl/201503/t20150324_298011.shtml  
   PDF: https://www.mee.gov.cn/ywgz/fgbz/bz/bzwb/stzl/201503/W020150326489785523925.pdf

2. Natural Capital Project. InVEST Habitat Quality User Guide (v3.16.1).  
   https://storage.googleapis.com/releases.naturalcapitalproject.org/invest/3.16.1/userguide/en/habitat_quality.html

3. Hu, J., Song, M., & Zhang, L. (2025). Spatial and temporal evolution of land use carbon emission and carbon balance zoning: evidence from Xinjiang China. *Scientific Reports*, 15(1):35705.  
   DOI: https://doi.org/10.1038/s41598-025-19475-9  
   说明: 文中采用“地类碳排放/碳吸收系数法”对耕地/林地/草地/水域/裸地等进行核算（系数符号约定为：碳汇为负）。本系统在 `CMP proxy` 中使用其系数的“碳汇绝对量”作为近似表达（并将灌木/湿地合并到相邻地类），用于区域相对对比监测，而非精确碳清单。

4. Zhang, Q., Ge, J., Liang, Y., Zhang, M., Dong, L., & Zhang, J. (2022). Does intensive land use decoupled from carbon emissions? an empirical study from the three grand economic zones of China. *Frontiers in Environmental Science*, 10:941177.  
   DOI: https://doi.org/10.3389/fenvs.2022.941177  
   说明: 提供土地利用碳排放系数表（耕地/园地/林地/草地/水域等）与建设用地能耗碳排放的衔接思路。本文系统不依赖能源账单，仅保留“地类系数核算”的 LUCC 统计代理部分。

5. Xie, X., Fang, B., & He, S. (2022). Is China’s Urbanization Quality and Ecosystem Health Developing Harmoniously? An Empirical Analysis from Jiangsu, China. *Land*, 11(4):530.  
   DOI: https://doi.org/10.3390/land11040530  
   说明: 给出生态系统健康/韧性相关指标的“地类赋值”与综合建模示例，可作为 `ERes proxy` 属于“系数法代理”而非国家统一真值的写作依据。

6. Lin, G., Jiang, D., Fu, J., Cao, C., & Zhang, D. (2020). Spatial Conflict of Production–Living–Ecological Space and Sustainable-Development Scenario Simulation in Yangtze River Delta Agglomerations. *Sustainability*, 12(6):2175.  
   DOI: https://doi.org/10.3390/su12062175  
   说明: 提供 PLES（生产-生活-生态空间）冲突识别与治理情景分析的主流研究路径。本系统 `PLEC proxy` 为基于面积统计的“压力比”简化表达，不宣称等同其空间冲突指数（SCI）的景观格局原式。

7. Shannon, C. E. (1948). A Mathematical Theory of Communication. *Bell System Technical Journal*, 27(3):379-423.  
   DOI: https://doi.org/10.1002/j.1538-7305.1948.tb01338.x

8. Chen, P. (2021). Effects of the entropy weight on TOPSIS. *Expert Systems with Applications*, 168:114186.  
   DOI: https://doi.org/10.1016/j.eswa.2020.114186  
   说明: 作为熵权法工程应用参考文献（与本文熵权部分更直接相关）。

9. Zavadskas, E. K., Mardani, A., Turskis, Z., Jusoh, A., & Nor, K. M. (2016). Development of TOPSIS method to solve complicated decision-making problems: An overview on developments from 2000 to 2015. *International Journal of Information Technology & Decision Making*, 15(3):645-682.  
   DOI: https://doi.org/10.1142/S0219622016300019  
   说明: 综述多指标评价中客观赋权与排序的工程实现路径。

10. 中共中央、国务院. 关于建立国土空间规划体系并监督实施的若干意见（2019-05-23）.  
    中国政府网: https://www.gov.cn/xinwen/2019-05/23/content_5394187.htm  
    说明: 政策情景项（耕地保护、城镇发展、生态保护）的制度背景依据。

11. 王秀兰, 包玉海. 土地利用动态变化研究方法探讨[J]. 地理科学进展, 1999, 18(1): 81-87.  
    DOI: https://doi.org/10.11820/dlkxjz.1999.01.012  
    说明: 常被用于“单一/综合土地利用动态度”等 LUCC 变化强度监测口径的理论来源。

12. Pontius, R. G., Shusas, E., & McEachern, M. (2004). Detecting important categorical land changes while accounting for persistence. *Agriculture, Ecosystems & Environment*, 101(2-3): 251-268.  
    DOI: https://doi.org/10.1016/j.agee.2003.09.008  
    说明: 系统化分解转移矩阵的“净变化/交换变化（swap）/总增减（gross gains/losses）”等概念，用于解释 LUCC 转移过程。

13. Aldwaik, S. Z., & Pontius, R. G. (2012). Intensity analysis to unify measurements of size and stationarity of land changes by interval, category, and transition. *Landscape and Urban Planning*, 106(1): 103-114.  
    DOI: https://doi.org/10.1016/j.landurbplan.2012.02.010  
    说明: Intensity Analysis 框架，可在只依赖转移矩阵的条件下完成区间/类别/转移三层级的强度监测。

14. Huang, F., Huang, B., Huang, J., & Li, S. (2018). Measuring Land Change in Coastal Zone around a Rapidly Urbanized Bay in China: Distinguishing between Land Use and Land Cover and Applying Intensity Analysis. *International Journal of Environmental Research and Public Health*, 15(6):1059.  
    DOI: https://doi.org/10.3390/ijerph15061059  
    说明: 提供“动态度 + 强度分析”的组合示例，适用于仅基于 LUCC 统计数据开展变化监测的论文写作。

---

## 6. 论文写作时的“避免硬伤”提示

1. 把 HQ/CMP/ERes/PLEC 明确称为 `proxy`（代理指标）。  
2. 把情景参数称为“政策约束参数/区域校准参数”，不要写成“普适真值”。  
3. 把“规范标准”与“工程设定”分表列出。  
4. 在附录给出参数敏感性分析（如耕地下降敏感度从 0.01 到 0.03 的结果对比）。

---

## 7. 版本记录

- 2026-04-22：本版重写为“可追溯引用版”，修正了“代理指标被误写为通用标准”的风险表述。  
- 2026-04-23：补充“仅使用 LUCC 统计数据的变化监测指标”（动态度/转移矩阵/Intensity Analysis），并补齐对应可追溯参考文献。  
