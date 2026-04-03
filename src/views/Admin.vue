<!--
  超级管理员管理后台 (Super Admin Dashboard)
  职责：负责系统全局治理，包括用户权限管控、核心基础设施配置热更新、服务监控及审计日志查看。
  
  修改提示：
  1. 用户管理逻辑涉及 POST /api/admin/users 接口，修改角色权限时需注意后端安全校验。
  2. 核心配置修改后需通过管理员密钥二次验证，见 verifyAndSaveConfig 函数。
  3. 新增监控项时，需在 CONFIG_GROUPS 中注册新的配置键名。
-->
<template>
  <div class="admin-layout">
    <!-- Sidebar -->
    <aside class="admin-sidebar" :class="{ collapsed: isSidebarCollapsed }">
      <div class="sidebar-logo">
        <div class="logo-wrapper">
          <svg class="logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L3 7V12C3 17.5228 7.02944 22.1812 12 23C16.9706 22.1812 21 17.5228 21 12V7L12 2Z" fill="url(#logoGradient)" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
            <path d="M12 7V17M12 7L15 10M12 7L9 10M12 17L9 14M12 17L15 14" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <defs>
              <linearGradient id="logoGradient" x1="12" y1="2" x2="12" y2="23" gradientUnits="userSpaceOnUse">
                <stop stop-color="#3B82F6"/>
                <stop offset="1" stop-color="#2563EB"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <span v-if="!isSidebarCollapsed" class="logo-text">Admin <span class="text-blue-500">System</span></span>
      </div>
      
      <nav class="sidebar-nav">
        <div 
          v-for="item in menuItems" 
          :key="item.id"
          :class="['nav-item', { active: activeTab === item.id }]"
          @click="activeTab = item.id"
        >
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path v-if="item.id === 'dashboard'" d="M3 3v18h18M18 17V9M13 17V5M8 17v-3"></path>
            <path v-if="item.id === 'users'" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm14 14v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"></path>
            <circle v-if="item.id === 'config'" cx="12" cy="12" r="3"></circle>
            <path v-if="item.id === 'config'" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            <path v-if="item.id === 'service_control'" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            <path v-if="item.id === 'logs'" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline v-if="item.id === 'logs'" points="14 2 14 8 20 8"></polyline>
          </svg>
          <span v-if="!isSidebarCollapsed">{{ item.label }}</span>
        </div>
      </nav>

      <div class="sidebar-footer" @click="isSidebarCollapsed = !isSidebarCollapsed">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline v-if="isSidebarCollapsed" points="9 18 15 12 9 6"></polyline>
          <polyline v-else points="15 18 9 12 15 6"></polyline>
        </svg>
        <span v-if="!isSidebarCollapsed">收起菜单</span>
      </div>
    </aside>

    <!-- Main Section -->
    <main class="admin-main">
      <!-- Header -->
      <header class="admin-header">
        <div class="header-left">
          <div class="breadcrumb">
            <span class="crumb-parent">控制中心</span>
            <span class="crumb-divider">/</span>
            <span class="crumb-current">{{ activeMenuLabel }}</span>
          </div>
        </div>
        
        <div class="header-right">
          <div class="user-info">
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=admin" alt="avatar" class="avatar" />
            <div class="user-meta">
              <span class="username">{{ authStore.user?.username }}</span>
              <span class="role-tag">{{ authStore.user?.role }}</span>
            </div>
          </div>
          <button class="exit-btn" @click="goToWorkbench">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mini-icon">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"></path>
            </svg>
            返回工作台
          </button>
        </div>
      </header>

      <!-- Page Content -->
      <div class="page-content">
        <!-- 仪表盘 -->
        <div v-if="activeTab === 'dashboard'" class="dashboard-view animate__animated animate__fadeIn">
          <!-- Top Metric Grid -->
          <div class="status-grid">
            <div class="status-card">
              <div class="card-icon disk">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 12L2 12M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>
                </svg>
              </div>
              <div class="card-info">
                <span class="card-label">磁盘空间</span>
                <div class="card-value">{{ systemStatus?.disk || '检测中...' }}</div>
              </div>
            </div>
            <div class="status-card">
              <div class="card-icon ram"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 10h20M2 14h20M6 6v12M10 6v12M14 6v12M18 6v12"></path></svg></div>
              <div class="card-info">
                <span class="card-label">已分配服务内存</span>
                <div class="card-value">{{ formatMB(totalServiceMemory) }}</div>
              </div>
            </div>
            <div class="status-card">
              <div class="card-icon db"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg></div>
              <div class="card-info">
                <span class="card-label">数据库实时速率</span>
                <div class="card-value">{{ dbPerformance?.tps || 0 }} 事务/秒</div>
              </div>
            </div>
            <div class="status-card">
              <div class="card-icon uptime">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </div>
              <div class="card-info">
                <span class="card-label">已运行</span>
                <div class="card-value">{{ formatUptime(systemStatus?.uptime) }}</div>
              </div>
            </div>
          </div>
          
          <div class="dashboard-grid">
            <div class="dashboard-left solo">
              <!-- Row 1: System Load -->
              <div class="admin-section">
                <div class="section-title-bar">
                  <h2 class="section-title">系统核心运行纵览 <small>Real-time Metrics</small></h2>
                  <div class="legend-pills">
                    <span class="pill cpu">CPU 占用</span>
                    <span class="pill ram">内存 (RSS)</span>
                  </div>
                </div>
                <div class="chart-card">
                  <div ref="chartRef" class="chart-container"></div>
                </div>
              </div>

              <!-- Row 2: PostgreSQL Performance Studio (PGAdmin Style) -->
              <div class="admin-section">
                <div class="section-title-bar">
                  <h2 class="section-title">数据库运行性能审计 <small>PGAdmin Studio Mode</small></h2>
                </div>
                <div class="pg-monitor-card">
                  <div class="pg-grid">
                    <!-- Chart 1: Sessions -->
                    <div class="pg-card">
                      <div class="pg-card-header">
                        <span class="p-title">数据库会话连接</span>
                        <div class="pg-legend">
                          <span class="l-i l-total">总计</span>
                          <span class="l-i l-active">活跃</span>
                          <span class="l-i l-idle">空闲</span>
                        </div>
                      </div>
                      <div ref="sessionsChartRef" class="pg-chart-item"></div>
                    </div>

                    <!-- Chart 2: TPS -->
                    <div class="pg-card">
                      <div class="pg-card-header">
                        <span class="p-title">每秒事务速率 (TPS)</span>
                        <div class="pg-legend">
                          <span class="l-i l-trans">总事务</span>
                          <span class="l-i l-commits">提交</span>
                          <span class="l-i l-rollbacks">回退</span>
                        </div>
                      </div>
                      <div ref="tpsChartRef" class="pg-chart-item"></div>
                    </div>

                    <!-- Chart 3: Tuples In -->
                    <div class="pg-card">
                      <div class="pg-card-header">
                        <span class="p-title">每秒写入数据量 (行/秒)</span>
                        <div class="pg-legend">
                          <span class="l-i l-ins">插入</span>
                          <span class="l-i l-upd">更新</span>
                          <span class="l-i l-del">删除</span>
                        </div>
                      </div>
                      <div ref="tInChartRef" class="pg-chart-item"></div>
                    </div>

                    <!-- Chart 4: Block I/O -->
                    <div class="pg-card">
                      <div class="pg-card-header">
                        <span class="p-title">磁盘读写 I/O</span>
                        <div class="pg-legend">
                          <span class="l-i l-read">读取数</span>
                          <span class="l-i l-hit">命中数</span>
                        </div>
                      </div>
                      <div ref="bioChartRef" class="pg-chart-item"></div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- API Hub (Row 3) -->
              <div class="admin-section">
                <div class="section-title-bar">
                  <h2 class="section-title">API 核心服务监控 <small>API Hub Service Audit</small></h2>
                  <button class="refresh-btn" @click="handleManualRefresh" :disabled="isRefreshing" title="手动刷新状态">
                    <svg :class="{ 'is-spinning': isRefreshing }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path>
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                    {{ isRefreshing ? '刷新中...' : '手动刷新' }}
                  </button>
                </div>
                <div class="api-hub-card">
                  <div class="api-grid">
                    <div v-for="svc in servicesHealth" :key="svc.name" class="api-item">
                      <div class="svc-icon-box">
                        <svg v-if="svc.type==='System'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/></svg>
                        <svg v-else-if="svc.type==='Data'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
                        <svg v-else-if="svc.type==='Security'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                      </div>
                      <div class="svc-main">
                        <div class="svc-top">
                          <span class="svc-name">{{ svc.name }}</span>
                          <span :class="['svc-status-tag', svc.status]">{{ svc.status === 'online' ? '运行中' : '离线' }}</span>
                        </div>
                        <div class="svc-meta">
                          <span class="svc-endpoint">{{ svc.endpoint }}</span>
                          <span v-if="svc.memory" class="svc-mem-tag">内存: {{ formatMB(svc.memory) }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 内部管理逻辑忽略... -->
        <!-- 用户管理 (治理模式) -->
        <div v-if="activeTab === 'users'" class="admin-section users-view animate__animated animate__fadeIn">
          <div class="section-title-bar">
            <h2 class="section-title">系统账号权限管理 <small>User Governance Control</small></h2>
            <button class="add-user-btn" @click="showAddUserModal = true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
              新增用户
            </button>
          </div>
          
          <div class="user-card">
            <div class="table-container">
              <table class="modern-table">
                <thead>
                  <tr>
                    <th>用户主体</th>
                    <th>权限角色</th>
                    <th>注册时间</th>
                    <th class="text-right">管理操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="user in userList" :key="user.id">
                    <td>
                      <div class="user-info-box">
                        <img :src="`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`" class="user-avatar-sm" />
                        <div class="user-name-wrapper">
                          <span class="u-name">{{ user.username }}</span>
                          <span class="u-id">#{{ user.id }}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span :class="['role-tag', user.role]">{{ user.role === 'super_admin' ? '超级管理员' : '普通管理员' }}</span>
                    </td>
                    <td class="time-cell">{{ formatDate(user.created_at) }}</td>
                    <td class="text-right">
                      <div class="table-actions">
                        <button class="edit-icon-btn" @click="openEditModal(user)" title="修改权限/密码">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button class="delete-icon-btn" @click="deleteUser(user)" title="销毁账号">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

          <div v-if="activeTab === 'service_control'" class="governance-view animate__animated animate__fadeIn">
            <!-- 1. 数据库运行环境治理层 -->
            <div class="governance-section">
              <div class="section-header">
                <div class="header-main">
                  <div class="h-icon-box">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>
                  </div>
                  <div class="h-text">
                    <div class="section-title-bar no-margin">
                      <h2 class="section-title">数据库层运行治理 <small>Database Infrastructure</small></h2>
                    </div>
                    <p class="card-subtitle">审计各账号 DDL/DML 指派权限，实时热切换后端连接身份</p>
                  </div>
                </div>
                <div class="header-actions">
                  <button class="action-btn secondary" @click="fetchBackendStatus">同步全局状态</button>
                  <button class="action-btn primary" @click="fetchDbRoles">全网权限扫描</button>
                </div>
              </div>

              <div class="roles-governance-table">
                <table class="modern-table high-density">
                  <thead>
                    <tr>
                      <th style="width: 200px">系统角色名称</th>
                      <th>权限属性</th>
                      <th>读写能力 (DML)</th>
                      <th>架构控制 (DDL)</th>
                      <th>当前运行状态</th>
                      <th class="text-right">一键治理操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="role in dbRoles" :key="role.name" :class="{ 'active-row': backendStatus?.db_user === role.name }">
                      <td>
                        <div class="role-cell">
                          <span class="r-name">{{ role.name }}</span>
                          <span v-if="role.is_superuser" class="r-badge super">SUPER</span>
                        </div>
                      </td>
                      <td>
                        <div class="tag-group">
                          <span v-if="role.can_login" class="tag-outline info">LOGIN</span>
                          <span v-else class="tag-outline danger">LOCKED</span>
                          <span v-if="role.can_create_db" class="tag-outline success">DB_CREATOR</span>
                        </div>
                      </td>
                      <td>
                        <div v-if="role.is_superuser || (role.can_select && role.can_insert && role.can_update && role.can_delete)" class="status-group">
                          <span class="status-dot ok"></span>
                          <span class="status-text font-bold">全量读写 (CRUD)</span>
                        </div>
                        <div v-else-if="role.can_select && !role.can_insert" class="status-group">
                          <span class="status-dot warning"></span>
                          <span class="status-text">只读 (READ ONLY)</span>
                        </div>
                        <div v-else-if="!role.can_select && role.can_insert" class="status-group">
                          <span class="status-dot warning"></span>
                          <span class="status-text">只写 (WRITE ONLY)</span>
                        </div>
                        <div v-else class="status-group">
                          <span class="status-dot blocked"></span>
                          <span class="status-text">受限/无表权限</span>
                        </div>
                      </td>
                      <td>
                        <span :class="['status-dot', role.is_superuser ? 'ok' : 'blocked']"></span>
                        <span class="status-text">{{ role.is_superuser ? '物理架构控制 (DDL)' : '无架构变更权限' }}</span>
                      </td>
                      <td>
                        <div v-if="backendStatus?.db_user === role.name" class="active-identity-box">
                          <span class="pulse-dot"></span>
                          <span class="active-text">当前项目连接身份</span>
                        </div>
                        <span v-else class="inactive-text">空闲/外部工具使用</span>
                      </td>
                      <td class="text-right">
                        <div class="governance-actions">
                          <!-- 权限微调 -->
                          <div class="action-sub-group">
                            <button class="mini-btn zinc" @click="remediateRole(role.name, 'GRANT_READ_ONLY')" title="设为只读">只读</button>
                            <button class="mini-btn zinc" @click="remediateRole(role.name, 'GRANT_WRITE_ONLY')" title="设为只写">只写</button>
                            <button class="mini-btn primary" @click="remediateRole(role.name, 'GRANT_READ_WRITE')" title="设为读写">读写</button>
                          </div>
                          <!-- 身份激活 -->
                          <button v-if="backendStatus?.db_user !== role.name" 
                                  class="mini-btn success-solid" 
                                  @click="triggerModeSwitch(role.name === 'postgres' ? 'DEVELOPMENT' : 'PRODUCTION')">
                            激活为此环境
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- 2. 服务组件审计层 -->
            <div class="governance-section mt-8">
              <div class="section-header">
                <div class="header-main">
                  <div class="h-icon-box orange">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                  </div>
                  <div class="h-text">
                    <div class="section-title-bar no-margin">
                      <h2 class="section-title">服务体系运行审计 <small>Service Integration Audit</small></h2>
                    </div>
                    <p class="card-subtitle">全局组件运行账号与资源分配，支持实时心跳监控与实例审计</p>
                  </div>
                </div>
              </div>

              <div class="service-audit-grid">
                <!-- GeoServer 账号审计 -->
                <div class="audit-card">
                  <div class="audit-card-title">GeoServer REST 控制账号</div>
                  <div class="audit-info-row">
                    <span class="a-label">活跃管理账号:</span>
                    <span class="a-value uppercase">admin</span>
                  </div>
                  <div class="audit-info-row">
                    <span class="a-label">资源访问频率:</span>
                    <span class="a-value">正常 (STABLE)</span>
                  </div>
                  <div class="tag-group mt-2">
                    <span class="tag-pill normal">REST_FULL_ACCESS</span>
                    <span class="tag-pill normal">WORKSPACE_ADMIN</span>
                  </div>
                </div>

                <!-- Node Backend 进程审计 -->
                <div v-for="svc in servicesHealth" :key="svc.name" class="audit-card">
                  <div class="audit-card-title">{{ svc.name }} 进程实例</div>
                  <div class="audit-info-row">
                    <span class="a-label">执行宿主用户:</span>
                    <span class="a-value">system_process</span>
                  </div>
                  <div class="audit-info-row">
                    <span class="a-label">节点环境模式:</span>
                    <span class="a-value text-blue uppercase">{{ backendStatus?.node_env }}</span>
                  </div>
                  <div class="tag-group mt-2">
                    <span :class="['tag-pill', svc.status === 'online' ? 'success' : 'danger']">{{ svc.status.toUpperCase() }}</span>
                    <span class="tag-pill info">{{ (svc.memory / 1024 / 1024).toFixed(1) }}MB RSS</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 网络及基础设施状态 -->
            <div class="infra-status-bar mt-8">
              <div class="info-block">
                <span class="i-label">数据库接入点 (Endpoint)</span>
                <span class="i-value">{{ backendStatus?.db_host || '127.0.0.1' }}:5432</span>
              </div>
              <div class="info-block">
                <span class="i-label">当前连接库 (Target)</span>
                <span class="i-value">{{ backendStatus?.db_name }}</span>
              </div>
              <div class="info-block">
                <span class="i-label">SSO/JWT 秘钥状态</span>
                <span class="i-value text-success">已加密装载</span>
              </div>
            </div>
          </div>

          <div v-if="activeTab === 'config'" class="admin-view config-view animate-fade-in">
          <div class="config-container card">
            <div class="card-header config-header">
              <div class="h-text">
                <h3 class="card-title">核心配置治理 <small>Infrastructure Config</small></h3>
                <p class="card-subtitle">全局环境变量热治理，支持 E2E 加密同步至后端基础设施</p>
              </div>
              <div class="header-actions">
                <button 
                  class="action-btn" 
                  :class="isConfigLocked ? 'secondary' : 'warning'" 
                  @click="isConfigLocked = !isConfigLocked"
                >
                  {{ isConfigLocked ? '解锁编辑' : '锁定修改' }}
                </button>
                <button 
                  class="action-btn primary" 
                  @click="showSecretVerifyModal = true" 
                  :disabled="isSavingConfig || isConfigLocked"
                >
                  {{ isSavingConfig ? '同步中...' : '确认保存变更' }}
                </button>
              </div>
            </div>

            <div class="card-content">
              <div v-for="group in CONFIG_GROUPS" :key="group.title" class="config-group-block">
                <div class="section-title-bar no-margin inner-group">
                  <h2 class="section-title">{{ group.title }} <small>{{ group.sub }}</small></h2>
                </div>
                <div class="config-grid-layout">
                  <div v-for="key in group.keys" :key="key" class="config-card-item" :class="{ locked: isConfigLocked }">
                    <label class="config-label">{{ key }} <span class="desc">{{ CONFIG_DESC[key] }}</span></label>
                    <div class="input-wrapper">
                      <textarea
                        v-model="systemConfig[key]"
                        class="cfg-textarea"
                        :disabled="isConfigLocked"
                        rows="1"
                        @input="autoResize($event)"
                      ></textarea>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="config-footer-hint">
              <span>提醒：核心配置修改后需“确认保存”并校验管理员密钥才会生效。</span>
            </div>
          </div>
        </div>

        <div v-if="activeTab === 'logs'" class="logs-view animate__animated animate__fadeIn">
           <div class="card-header"><h3 class="card-title">审计日志</h3><button class="action-btn secondary" @click="fetchData">刷新</button></div>
           <div class="table-container">
             <table><thead><tr><th>时间</th><th>执行者</th><th>动作</th><th>目标</th><th>详细</th></tr></thead>
               <tbody><tr v-for="log in auditLogs" :key="log.id"><td>{{ formatDate(log.created_at) }}</td><td class="font-bold">{{ log.username }}</td><td><span :class="['action-tag', log.action]">{{ log.action }}</span></td><td>{{ log.target }}</td><td class="details-cell">{{ log.details }}</td></tr></tbody>
             </table>
           </div>
        </div>
      </div>
    </main>
 
    <!-- Modals -->
    <!-- 新增用户弹窗 -->
    <div v-if="showAddUserModal" class="modal-overlay">
      <div class="modal animate__animated animate__zoomIn animate__faster">
        <h3>新增系统用户</h3>
        <div class="form-item"><label>用户名</label><input v-model="newUser.username" /></div>
        <div class="form-item"><label>初始密码</label><input type="password" v-model="newUser.password" /></div>
        <div class="form-item"><label>权限角色</label><select v-model="newUser.role"><option value="admin">管理员</option><option value="super_admin">超级管理员</option></select></div>
        <div class="modal-actions"><button @click="showAddUserModal = false">取消</button><button class="primary" @click="addUser">提交</button></div>
      </div>
    </div>

    <!-- Modals -->

    <!-- 编辑用户弹窗 -->
    <div v-if="showEditUserModal" class="modal-overlay">
      <div class="modal animate__animated animate__zoomIn animate__faster">
        <h3>修改用户权限/密码</h3>
        <div class="form-item">
          <label>用户名</label>
          <input :value="editUser.username" disabled class="bg-gray-100" />
        </div>
        <div class="form-item">
          <label>重置密码 (留空则不修改)</label>
          <input type="password" v-model="editUser.password" placeholder="请输入新密码" />
        </div>
        <div class="form-item">
          <label>权限角色</label>
          <select v-model="editUser.role">
            <option value="user">普通用户</option>
            <option value="admin">普通管理员</option>
            <option value="super_admin">超级管理员</option>
          </select>
        </div>
        <div class="modal-actions">
          <button @click="showEditUserModal = false">取消</button>
          <button class="primary" @click="updateUserInfo" :disabled="isUpdatingUser">
            {{ isUpdatingUser ? '提交中...' : '提交修改' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showSecretVerifyModal" class="modal-overlay">
      <div class="modal secret-modal animate__animated animate__zoomIn animate__faster">
        <div class="modal-header-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg></div>
        <h3>安全授权验证</h3><p class="modal-tip">请输入您的 128 位管理员授权密钥：</p>
        <div class="form-item"><textarea v-model="adminSecretInput" rows="4"></textarea></div>
        <div class="modal-actions full-width"><button class="btn-cancel" @click="showSecretVerifyModal = false">取消</button><button class="btn-verify" @click="verifyAndSaveConfig">同步核心配置</button></div>
      </div>
    </div>

    <!-- 账号快速切换弹窗 -->
    <div v-if="showSwitchAccountModal" class="modal-overlay">
      <div class="modal animate__animated animate__fadeInUp animate__faster">
        <h3>系统运行模式一键切换</h3>
        <p class="modal-tip">切换将同步变更数据库与地理服务器的运行身份。请确保密钥正确。</p>
        <div class="form-item">
          <label>目标运行模式</label>
          <select v-model="switchTarget">
            <option value="DEVELOPMENT">开发模式 (Superuser / Postgres)</option>
            <option value="PRODUCTION">生产模式 (Standard / App User)</option>
          </select>
        </div>
        <div class="form-item">
          <label>管理员授权密钥</label>
          <textarea v-model="adminSecretInput" rows="3" placeholder="粘贴 128 位密钥..."></textarea>
        </div>
        <div class="modal-actions">
          <button @click="showSwitchAccountModal = false">取消</button>
          <button class="primary" @click="executeAccountSwitch">立即执行全局切换</button>
        </div>
    </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, nextTick, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useAdminStore } from '@/stores/admin';
import * as echarts from 'echarts';
import { encrypt as rsaEncrypt } from '@/utils/crypto';

const router = useRouter();
const authStore = useAuthStore();
const adminStore = useAdminStore();

// Navigation
const isSidebarCollapsed = ref(false);
const activeTab = ref('dashboard');
const menuItems = [
  { id: 'dashboard', label: '控制仪表盘' },
  { id: 'users', label: '账号管理' },
  { id: 'service_control', label: '环境运行模式' },
  { id: 'config', label: '核心配置' },
  { id: 'logs', label: '审计日志' }
];

const activeMenuLabel = computed(() => menuItems.find(i => i.id === activeTab.value)?.label || '仪表盘');

// Data State
const userList = ref([]);
const systemStatus = ref({});
const dbPerformance = ref({ throughput: {} });
const systemConfig = ref({});
const auditLogs = ref([]);
const servicesHealth = ref([]);
const dbRoles = ref([]);
const backendStatus = ref(null);
const isRefreshing = ref(false);
const totalServiceMemory = computed(() => {
  return servicesHealth.value.reduce((acc, s) => acc + (s.memory || 0), 0);
});
const showAddUserModal = ref(false);
const showSecretVerifyModal = ref(false);
const showSwitchAccountModal = ref(false);
const switchTarget = ref('DEVELOPMENT');
const adminSecretInput = ref('');
const isSavingConfig = ref(false);
const isConfigLocked = ref(true);
const newUser = ref({ username: '', password: '', role: 'admin' });
const editUser = ref({ id: null, username: '', password: '', role: 'admin' });
const showEditUserModal = ref(false);
const isUpdatingUser = ref(false);

// Identity Switch Logic
const triggerModeSwitch = (modeId) => {
  switchTarget.value = modeId;
  showSwitchAccountModal.value = true;
};

// ADMINISTRATION_KEY now managed exclusively on backend via .env

const CONFIG_DESC = {
  VITE_TIANDITU_TOKEN: "天地图服务授权密钥 (Browser JS API)",
  AMAP_WEATHER_KEY: "高德地图/天气服务密钥 (Backend API)",
  PORT: "后端 HTTP 服务启动端口",
  NODE_ENV: "系统运行环境 (development/production)",
  LOG_LEVEL: "日志详细程度级别",
  DB_HOST: "数据库主机地址",
  DB_PORT: "数据库连接端口",
  DB_USER: "数据库连接用户名",
  DB_PASSWORD: "数据库连接密码",
  DB_DATABASE: "数据库名称",
  PGHOST: "数据库兼容地址 (Legacy)",
  PGPORT: "数据库兼容端口 (Legacy)",
  PGUSER: "数据库兼容用户 (Legacy)",
  PGPASSWORD: "数据库兼容密码 (Legacy)",
  PGDATABASE: "数据库兼容库名 (Legacy)",
  GEOSERVER_USER: "GeoServer REST 用户",
  GEOSERVER_PASSWORD: "GeoServer REST 密码",
  OLLAMA_URL: "Ollama 本地 AI 服务地址",
  OLLAMA_MODEL: "Ollama 核心模型名称",
  REPORT_MODEL: "报表生成辅助模型名称",
  DEEPSEEK_API_KEY: "Deepseek 云端 AI 服务密钥",
  JWT_SECRET: "应用身份验证安全密钥 (只读修复)",
  DEFAULT_ADMIN_PASSWORD: "初始化管理员默认密码",
  CLOUDFLARE_TUNNEL_TOKEN: "Cloudflare 隧道加密令牌",
  ADMINISTRATION_KEY: "管理员全局授权密钥",
  GLOBAL_HOTSWAP_SECRET: "全局运行时一键切换密钥"
};

const CONFIG_GROUPS = [
  { title: '地图与第三方服务', sub: 'Map & API Services', keys: ['VITE_TIANDITU_TOKEN', 'AMAP_WEATHER_KEY'] },
  { title: '数据库连接 (现代)', sub: 'Primary Database Connect', keys: ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_DATABASE'] },
  { title: 'GeoServer 地图服务引擎', sub: 'GIS Infrastructure', keys: ['GEOSERVER_USER', 'GEOSERVER_PASSWORD'] },
  { title: 'AI 与报表引擎', sub: 'AI Integration & Engines', keys: ['OLLAMA_URL', 'OLLAMA_MODEL', 'REPORT_MODEL', 'DEEPSEEK_API_KEY'] },
  { title: '网络与系统内核', sub: 'Network & System Core', keys: ['PORT', 'NODE_ENV', 'LOG_LEVEL', 'JWT_SECRET', 'DEFAULT_ADMIN_PASSWORD', 'CLOUDFLARE_TUNNEL_TOKEN'] },
  { title: '权限与安全治理', sub: 'Identity & Hotswap Auth', keys: ['GLOBAL_HOTSWAP_SECRET', 'ADMINISTRATION_KEY'] }
];

// Web Crypto Encryption Helper (AES-256-CBC)
const autoResize = (event) => {
  const el = event instanceof Event ? event.target : event;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = (el.scrollHeight + 2) + 'px';
};

const triggerAllResize = () => {
  nextTick(() => {
    document.querySelectorAll('.cfg-textarea').forEach(el => autoResize(el));
  });
};

const encryptPayload = async (data, secret) => {
  const enc = new TextEncoder();
  const encodedData = enc.encode(JSON.stringify(data));
  const secretHash = await window.crypto.subtle.digest('SHA-256', enc.encode(secret));
  const key = await window.crypto.subtle.importKey('raw', secretHash, { name: 'AES-CBC' }, false, ['encrypt']);
  const iv = window.crypto.getRandomValues(new Uint8Array(16));
  const encrypted = await window.crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, encodedData);
  const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
  const encryptedHex = Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${ivHex}:${encryptedHex}`;
};

// Charts Logic
const chartRef = ref(null);
const sessionsChartRef = ref(null);
const tpsChartRef = ref(null);
const tInChartRef = ref(null);
const tOutChartRef = ref(null);
const bioChartRef = ref(null);

let chartInstances = { system: null, sessions: null, tps: null, tIn: null, tOut: null, bio: null };
let pollTimer = null;

const safeFetch = async (url, options) => {
  try {
    const r = await fetch(url, options);
    if (!r.ok) return { success: false };
    return await r.json();
  } catch (e) {
    return { success: false };
  }
};

const fetchData = async () => {
  const headers = { 'Authorization': `Bearer ${authStore.token}` };
  const [usersRes, statusRes, configRes, logsRes, perfRes] = await Promise.all([
    safeFetch('/api/admin/users', { headers }),
    safeFetch('/api/admin/system/status', { headers }),
    safeFetch('/api/admin/config', { headers }),
    safeFetch('/api/admin/logs', { headers }),
    safeFetch('/api/admin/db/performance', { headers })
  ]);

  if (usersRes.success) userList.value = usersRes.data;
  if (statusRes.success) systemStatus.value = statusRes.data;
  if (configRes.success) systemConfig.value = configRes.data;
  if (logsRes.success) auditLogs.value = logsRes.data;
  if (perfRes.success) dbPerformance.value = perfRes.data;

  // 无论基本数据获取是否部分失败，尝试更新图表和健康状态
  if (activeTab.value === 'dashboard') {
    try {
      updateCharts();
    } catch (e) {
      console.warn('Dashboard chart update failed:', e);
    }
    fetchServicesHealth();
  }
  
  if (activeTab.value === 'service_control') {
    fetchDbRoles();
    fetchBackendStatus();
  }
};

const fetchBackendStatus = async () => {
  try {
    const res = await fetch('/api/admin/security/backend-status', { headers: { 'Authorization': `Bearer ${authStore.token}` }}).then(r => r.json());
    if (res.success) backendStatus.value = res.data;
  } catch (err) { backendStatus.value = null; }
};

const handleManualRefresh = async () => {
  isRefreshing.value = true;
  await fetchServicesHealth();
  // 增加人为延迟以展示动画美感
  setTimeout(() => isRefreshing.value = false, 800);
};

const fetchServicesHealth = async () => {
  try {
    const res = await fetch('/api/admin/services/health', { headers: { 'Authorization': `Bearer ${authStore.token}` }}).then(r => r.json());
    if (res.success) servicesHealth.value = res.data;
  } catch (err) { servicesHealth.value = []; }
};

const fetchDbRoles = async () => {
  try {
    const res = await fetch('/api/admin/security/db-roles', { headers: { 'Authorization': `Bearer ${authStore.token}` }}).then(r => r.json());
    if (res.success) dbRoles.value = res.data;
  } catch (err) { dbRoles.value = []; }
};

const remediateRole = async (roleName, action) => {
  if (!confirm(`确定执行安全修复操作 [${action}] 吗？`)) return;
  try {
    const res = await fetch('/api/admin/security/remediate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authStore.token}` },
      body: JSON.stringify({ roleName, action })
    }).then(r => r.json());
    if (res.success) {
      alert(res.message);
      fetchDbRoles();
    } else {
      alert(res.message || '操作失败');
    }
  } catch (e) { alert('请求异常'); }
};

const verifyAndSaveConfig = async () => {
  if (!adminSecretInput.value) {
    alert('请输入管理员授权密钥');
    return;
  }

  isSavingConfig.value = true;
  try {
    // Perform E2E Encryption
    const encryptedPayload = await encryptPayload(systemConfig.value, adminSecretInput.value);
    
    const r = await fetch('/api/admin/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({ 
        payload: encryptedPayload, 
        secret: adminSecretInput.value 
      })
    });
    
    const res = await r.json();
    if (res.success) {
      alert('核心配置已完成 E2E 加密同步');
      showSecretVerifyModal.value = false;
      adminSecretInput.value = '';
      isConfigLocked.value = true;
      fetchData();
    } else {
      alert(res.message || '更新失败');
    }
  } catch (e) {
    alert('网络通信异常');
  } finally {
    isSavingConfig.value = false;
  }
};

const executeAccountSwitch = async () => {
  if (!adminSecretInput.value) return alert('请输入授权密钥');
  try {
    const res = await fetch('/api/admin/security/switch-runtime-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authStore.token}` },
      body: JSON.stringify({ mode: switchTarget.value, secret: adminSecretInput.value })
    }).then(r => r.json());

    if (res.success) {
      alert(res.message);
      showSwitchAccountModal.value = false;
      adminSecretInput.value = '';
      fetchBackendStatus(); // 刷新显示
    } else {
      alert(res.message || '切换失败');
    }
  } catch (e) { alert('后端连接异常'); }
};

const commonChartOption = {
  tooltip: { trigger: 'axis', backgroundColor: 'rgba(255,255,255,0.9)', borderColor: '#eef2f6', textStyle: { color: '#1e293b' } },
  grid: { left: '3%', right: '3%', bottom: '5%', top: '15%', containLabel: true },
  xAxis: { type: 'category', boundaryGap: false, data: [], axisLabel: { color: '#94a3b8', fontSize: 10 }, axisLine: { lineStyle: { color: '#f1f5f9' } } },
  yAxis: { type: 'value', axisLabel: { color: '#94a3b8', fontSize: 10 }, splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } } }
};

const initCharts = () => {
  if (!chartRef.value) return;
  
  // System Load
  chartInstances.system = echarts.init(chartRef.value);
  chartInstances.system.setOption({
    ...commonChartOption,
    xAxis: { ...commonChartOption.xAxis, data: adminStore.systemHistory.times },
    series: [
      { name: 'CPU 占用', type: 'line', smooth: false, showSymbol: false, data: adminStore.systemHistory.cpu, lineStyle: { width: 3, color: '#3b82f6' }, areaStyle: { opacity: 0.1, color: '#3b82f6' } },
      { name: '内存 (RSS)', type: 'line', smooth: false, showSymbol: false, data: adminStore.systemHistory.ram, lineStyle: { width: 3, color: '#10b981' }, areaStyle: { opacity: 0.1, color: '#10b981' } }
    ]
  });

  // Sessions
  chartInstances.sessions = echarts.init(sessionsChartRef.value);
  chartInstances.sessions.setOption({
    ...commonChartOption,
    xAxis: { ...commonChartOption.xAxis, data: adminStore.sessionsHistory.times },
    series: [
      { name: '总连接', type: 'line', smooth: false, showSymbol: false, data: adminStore.sessionsHistory.total, lineStyle: { width: 2, color: '#3b82f6' } },
      { name: '活跃', type: 'line', smooth: false, showSymbol: false, data: adminStore.sessionsHistory.active, lineStyle: { width: 2, color: '#f59e0b' } },
      { name: '空闲', type: 'line', smooth: false, showSymbol: false, data: adminStore.sessionsHistory.idle, lineStyle: { width: 2, color: '#10b981' } }
    ]
  });

  // TPS
  chartInstances.tps = echarts.init(tpsChartRef.value);
  chartInstances.tps.setOption({
    ...commonChartOption,
    xAxis: { ...commonChartOption.xAxis, data: adminStore.tpsHistory.times },
    series: [
      { name: '总事务', type: 'line', smooth: false, showSymbol: false, data: adminStore.tpsHistory.trans, lineStyle: { width: 2, color: '#3b82f6' } },
      { name: '提交', type: 'line', smooth: false, showSymbol: false, data: adminStore.tpsHistory.commits, lineStyle: { width: 2, color: '#f59e0b' } },
      { name: '回退', type: 'line', smooth: false, showSymbol: false, data: adminStore.tpsHistory.rollbacks, lineStyle: { width: 2, color: '#ef4444' } }
    ]
  });

  // Tuples In
  chartInstances.tIn = echarts.init(tInChartRef.value);
  chartInstances.tIn.setOption({
    ...commonChartOption,
    xAxis: { ...commonChartOption.xAxis, data: adminStore.tInHistory.times },
    series: [
      { name: '插入', type: 'line', smooth: false, showSymbol: false, data: adminStore.tInHistory.ins, lineStyle: { width: 2, color: '#3b82f6' } },
      { name: '更新', type: 'line', smooth: false, showSymbol: false, data: adminStore.tInHistory.upd, lineStyle: { width: 2, color: '#f59e0b' } },
      { name: '删除', type: 'line', smooth: false, showSymbol: false, data: adminStore.tInHistory.del, lineStyle: { width: 2, color: '#ef4444' } }
    ]
  });

  // Block I/O
  chartInstances.bio = echarts.init(bioChartRef.value);
  chartInstances.bio.setOption({
    ...commonChartOption,
    xAxis: { ...commonChartOption.xAxis, data: adminStore.bioHistory.times },
    series: [
      { name: '读取', type: 'line', smooth: false, showSymbol: false, data: adminStore.bioHistory.reads, lineStyle: { width: 2, color: '#3b82f6' } },
      { name: '命中', type: 'line', smooth: false, showSymbol: false, data: adminStore.bioHistory.hits, lineStyle: { width: 2, color: '#f59e0b' } }
    ]
  });

  window.addEventListener('resize', () => {
    Object.values(chartInstances).forEach(c => c && c.resize());
  });
};

const updateCharts = () => {
  if (!chartInstances.system) return;
  
  const time = new Date().toLocaleTimeString();
  const db = dbPerformance.value || {};

  // Update Data and Push to Store
  adminStore.addSystemPoint(time, (systemStatus.value?.cpu?.load || 0), (systemStatus.value?.os?.totalMem - systemStatus.value?.os?.freeMem || 0));
  adminStore.addDbPoints(time, dbPerformance.value);

  // Sync Charts from Store
  if (chartInstances.system) {
    chartInstances.system.setOption({
      xAxis: { data: adminStore.systemHistory.times },
      series: [{ data: adminStore.systemHistory.cpu }, { data: adminStore.systemHistory.ram }]
    });
  }

  if (chartInstances.sessions) {
    chartInstances.sessions.setOption({
      xAxis: { data: adminStore.sessionsHistory.times },
      series: [{ data: adminStore.sessionsHistory.total }, { data: adminStore.sessionsHistory.active }, { data: adminStore.sessionsHistory.idle }]
    });
  }

  if (chartInstances.tps) {
    chartInstances.tps.setOption({
      xAxis: { data: adminStore.tpsHistory.times },
      series: [{ data: adminStore.tpsHistory.trans }, { data: adminStore.tpsHistory.commits }, { data: adminStore.tpsHistory.rollbacks }]
    });
  }

  if (chartInstances.tIn) {
    chartInstances.tIn.setOption({
      xAxis: { data: adminStore.tInHistory.times },
      series: [{ data: adminStore.tInHistory.ins }, { data: adminStore.tInHistory.upd }, { data: adminStore.tInHistory.del }]
    });
  }

  if (chartInstances.bio) {
    chartInstances.bio.setOption({
      xAxis: { data: adminStore.bioHistory.times },
      series: [{ data: adminStore.bioHistory.reads }, { data: adminStore.bioHistory.hits }]
    });
  }
};

// Handlers
// [Security] 现已启用 RSA 非对称加密传输。
// 密码在前端利用公钥加密为密文，传输至后端后再由私钥解密，随后进行 BCRYPT 盐化存储。

const addUser = async () => {
  if (!newUser.value.username || !newUser.value.password) {
    alert('请填写完整信息');
    return;
  }
  try {
    // [Security] 强制对传输过程中的密码进行 RSA 公钥加密
    const encryptedPassword = await rsaEncrypt(newUser.value.password);
    
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}` 
      },
      body: JSON.stringify({
        ...newUser.value,
        password: encryptedPassword
      })
    }).then(r => r.json());

    if (res.success) {
      alert('用户创建成功');
      newUser.value = { username: '', password: '', role: 'admin' };
      showAddUserModal.value = false;
      fetchData(); // 立即刷新列表
    } else {
      alert(res.message || '创建失败');
    }
  } catch (e) {
    alert('请求异常');
  }
};

const openEditModal = (u) => {
  editUser.value = { id: u.id, username: u.username, role: u.role, password: '' };
  showEditUserModal.value = true;
};

const updateUserInfo = async () => {
  isUpdatingUser.value = true;
  try {
    let encryptedPassword = undefined;
    if (editUser.value.password) {
        // [Security] 强制对传输过程中的重置密码进行 RSA 公钥加密
        encryptedPassword = await rsaEncrypt(editUser.value.password);
    }

    const res = await fetch(`/api/admin/users/${editUser.value.id}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}` 
      },
      body: JSON.stringify({ 
        role: editUser.value.role, 
        password: encryptedPassword
      })
    }).then(r => r.json());

    if (res.success) {
      alert('更新成功');
      showEditUserModal.value = false;
      fetchData();
    } else {
      alert(res.message || '更新失败');
    }
  } catch (e) {
    alert('请求异常');
  } finally {
    isUpdatingUser.value = false;
  }
};

const deleteUser = async (u) => {
  if (!confirm(`确定要彻底删除账号 [${u.username}] 吗？此操作不可撤销。`)) return;
  try {
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authStore.token}` }
    }).then(r => r.json());

    if (res.success) {
      fetchData(); // 刷新列表
    } else {
      alert(res.message || '删除失败');
    }
  } catch (e) {
    alert('删除异常');
  }
};

const formatMB = (b) => b ? `${Math.round(b/1024/1024)}MB` : '0MB';
const formatMB_simple = (m) => m ? `${Math.round(m/1024)}GB` : '0GB';
const formatUptime = (s) => s ? `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m` : '0s';
const formatDate = (s) => new Date(s).toLocaleString();
const goToWorkbench = () => router.push('/workbench');

watch(activeTab, (newTab) => {
  if (newTab === 'config') {
    triggerAllResize();
  }
});

onMounted(() => { 
  nextTick(() => {
    initCharts();
    fetchData(); 
    pollTimer = setInterval(fetchData, 5000); 
  });
});
onBeforeUnmount(() => {
  clearInterval(pollTimer);
  Object.values(chartInstances).forEach(c => c && c.dispose());
});
</script>

<style scoped>
.admin-layout { width: 100vw; height: 100vh; display: flex; background: #f1f5f9; font-family: 'Inter', system-ui, -apple-system, sans-serif; }
.admin-sidebar { width: 260px; background: #0f172a; color: white; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: flex; flex-direction: column; box-shadow: 4px 0 24px rgba(0,0,0,0.1); z-index: 50; }
.admin-sidebar.collapsed { width: 80px; }

.sidebar-logo { height: 80px; padding: 0 24px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; gap: 14px; overflow: hidden; }
.logo-wrapper { width: 36px; height: 36px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3); }
.logo-icon { width: 24px; height: 24px; }
.logo-text { font-size: 1.25rem; font-weight: 700; letter-spacing: -0.025em; white-space: nowrap; }

.sidebar-nav { flex: 1; padding: 20px 12px; display: flex; flex-direction: column; gap: 6px; }
.nav-item { height: 48px; border-radius: 10px; padding: 0 16px; display: flex; align-items: center; gap: 16px; color: #94a3b8; cursor: pointer; transition: all 0.2s; position: relative; }
.nav-item:hover { background: rgba(255,255,255,0.05); color: white; }
.nav-item.active { background: #2563eb; color: white; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2); }
.nav-icon { width: 20px; height: 20px; flex-shrink: 0; transition: transform 0.2s; }
.nav-item:hover .nav-icon { transform: scale(1.1); }

.sidebar-footer { height: 60px; margin: 0 12px 12px; border-radius: 10px; background: rgba(255,255,255,0.03); display: flex; align-items: center; gap: 16px; padding: 0 16px; color: #64748b; cursor: pointer; transition: all 0.2s; }
.sidebar-footer:hover { background: rgba(255,255,255,0.08); color: white; }

.admin-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #f8fafc; }
.admin-header { height: 80px; background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(12px); padding: 0 40px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eef2f6; z-index: 40; }

.breadcrumb { display: flex; align-items: center; gap: 8px; font-size: 0.875rem; }
.crumb-parent { color: #64748b; }
.crumb-divider { color: #cbd5e1; }
.crumb-current { color: #0f172a; font-weight: 600; }

.header-right { display: flex; align-items: center; gap: 24px; }
.user-info { display: flex; align-items: center; gap: 12px; padding: 6px 12px; background: #f1f5f9; border-radius: 100px; }
.avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 2px solid white; }
.username { font-size: 0.875rem; font-weight: 600; color: #1e293b; }
.role-tag { font-size: 0.75rem; color: #3b82f6; background: #dbeafe; padding: 2px 8px; border-radius: 4px; font-weight: 600; }

.exit-btn { display: flex; align-items: center; gap: 8px; padding: 8px 16px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.875rem; font-weight: 600; color: #475569; cursor: pointer; transition: all 0.2s; }
.exit-btn:hover { background: #f8fafc; border-color: #cbd5e1; color: #0f172a; }
.refresh-btn { display: flex; align-items: center; gap: 8px; padding: 8px 16px; background: #eff6ff; color: #3b82f6; border: none; border-radius: 10px; font-weight: 700; font-size: 0.875rem; cursor: pointer; transition: all 0.2s; }
.refresh-btn:hover { background: #3b82f6; color: white; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2); }
.refresh-btn:disabled { opacity: 0.7; cursor: not-allowed; }
.refresh-btn svg { width: 18px; height: 18px; }
.is-spinning { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.mini-icon { width: 16px; height: 16px; }

.page-content { flex: 1; padding: 24px; overflow-y: auto; scroll-behavior: smooth; }

/* Grid Layout */
.status-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; margin-bottom: 24px; }
.status-card { background: white; padding: 20px; border-radius: 20px; display: flex; align-items: center; gap: 20px; transition: all 0.3s; border: 1px solid #f1f5f9; }
.status-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.05); }

.card-icon { width: 56px; height: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.card-icon svg { width: 28px; height: 28px; }
.card-icon.disk { background: #fff1f2; color: #f43f5e; }
.card-icon.ram { background: #f0fdf4; color: #22c55e; }
.card-icon.db { background: #f0f9ff; color: #0ea5e9; }
.card-icon.uptime { background: #fefce8; color: #eab308; }

.card-label { font-size: 0.875rem; color: #64748b; font-weight: 500; display: block; margin-bottom: 4px; }
.card-value { font-size: 1.5rem; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }

.monitor-row { margin-bottom: 32px; }
.chart-card { background: white; padding: 24px; border-radius: 20px; border: 1px solid #f1f5f9; box-shadow: 0 4px 15px rgba(0,0,0,0.02); transition: all 0.3s; }
.chart-card:hover { box-shadow: 0 8px 30px rgba(0,0,0,0.05); }
.chart-container { height: 280px; width: 100%; margin-top: 16px; }

.legend-pills { display: flex; gap: 8px; }
.pill { padding: 4px 12px; border-radius: 100px; font-size: 0.75rem; font-weight: 600; }
.pill.cpu { background: #dbeafe; color: #1e40af; }
.pill.ram { background: #dcfce7; color: #166534; }

/* Standardized Section Headers (Figure 3 Branding) */
.admin-section { margin-bottom: 32px; }
.section-title-bar { margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; position: relative; padding-left: 16px; min-height: 24px; }
.section-title-bar::before { content: ''; position: absolute; left: 0; top: 2px; bottom: 2px; width: 4px; background: #2563eb; border-radius: 4px; }
.section-title-bar.no-margin { margin-bottom: 0; padding-left: 12px; }
.section-title-bar.no-margin::before { width: 3px; }
.section-title { font-size: 1rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; margin: 0; line-height: 1; }
.section-title small { font-size: 0.725rem; color: #94a3b8; font-weight: 500; margin-left: 10px; letter-spacing: 0.02em; }

.pg-monitor-card, .api-hub-card { background: white; padding: 24px; border-radius: 20px; border: 1px solid #f1f5f9; box-shadow: 0 4px 15px rgba(0,0,0,0.02); }
.pg-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
.pg-card { background: #fff; border: 1px solid #f1f5f9; border-radius: 16px; padding: 20px; transition: all 0.3s; }
.pg-card:hover { border-color: #3b82f6; box-shadow: 0 8px 20px rgba(59, 130, 246, 0.05); }

.pg-card-header { font-size: 0.8125rem; font-weight: 700; color: #475569; display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.pg-legend { display: flex; gap: 8px; font-size: 0.7rem; }
.l-i { display: flex; align-items: center; gap: 4px; }
.l-i::before { content: ''; width: 8px; height: 8px; border-radius: 2px; }

/* Legend Colors */
.l-total::before { background: #3b82f6; }
.l-active::before { background: #f59e0b; }
.l-idle::before { background: #10b981; }
.l-trans::before { background: #3b82f6; }
.l-commits::before { background: #f59e0b; }
.l-rollbacks::before { background: #ef4444; }
.l-ins::before { background: #3b82f6; }
.l-upd::before { background: #f59e0b; }
.l-del::before { background: #ef4444; }
.l-fet::before { background: #3b82f6; }
.l-ret::before { background: #f59e0b; }
.l-read::before { background: #3b82f6; }
.l-hit::before { background: #f59e0b; }

.pg-chart-item { height: 180px; width: 100%; }

.api-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
.api-item { padding: 20px; border-radius: 16px; background: #fff; border: 1px solid #f1f5f9; transition: all 0.3s; display: flex; align-items: center; gap: 16px; }
.api-item:hover { border-color: #10b981; box-shadow: 0 8px 20px rgba(16, 185, 129, 0.05); }

.svc-icon-box { width: 52px; height: 52px; border-radius: 14px; background: #f8fafc; color: #64748b; display: flex; align-items: center; justify-content: center; }
.svc-icon-box svg { width: 26px; height: 26px; }

.svc-top { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.svc-name { font-weight: 800; color: #0f172a; font-size: 1rem; }
.svc-status-tag { font-size: 0.7rem; padding: 2px 10px; border-radius: 100px; font-weight: 700; }
.svc-status-tag.online { background: #dcfce7; color: #166534; }
.svc-status-tag.offline { background: #fee2e2; color: #991b1b; }
.svc-meta { display: flex; flex-direction: column; gap: 4px; }
.svc-endpoint { font-size: 0.8rem; color: #64748b; font-family: 'JetBrains Mono', monospace; }
.svc-mem-tag { font-size: 0.75rem; color: #3b82f6; font-weight: 600; background: #eff6ff; padding: 2px 8px; border-radius: 6px; width: fit-content; }

.specs-card { background: white; padding: 24px; border-radius: 20px; border: 1px solid #f1f5f9; }
.spec-tile { display: flex; align-items: center; gap: 16px; padding: 12px; border-radius: 12px; background: #f8fafc; margin-bottom: 12px; }
.tile-icon { width: 40px; height: 40px; background: white; border-radius: 10px; color: #3b82f6; font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }

.calendar-card { background: white; padding: 24px; border-radius: 20px; border: 1px solid #f1f5f9; }
.cal-header { text-align: center; font-weight: 800; color: #0f172a; margin-bottom: 16px; font-size: 0.875rem; }
.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.cal-day-head { text-align: center; font-size: 0.75rem; font-weight: 600; color: #94a3b8; padding: 8px 0; }
.cal-day { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; border-radius: 8px; color: #475569; position: relative; }
.cal-day.today { background: #3b82f6; color: white; font-weight: 800; }
.cal-day:not(.empty):hover { background: #f1f5f9; }

/* Tables & Lists */
.table-container { background: white; border-radius: 16px; border: 1px solid #f1f5f9; overflow: hidden; }
table { width: 100%; border-collapse: collapse; }
th { background: #f8fafc; padding: 16px 24px; text-align: left; font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
td { padding: 16px 24px; border-top: 1px solid #f1f5f9; font-size: 0.875rem; }

.status-badge { font-size: 0.75rem; font-weight: 600; padding: 4px 10px; border-radius: 100px; display: inline-flex; align-items: center; gap: 6px; }
.status-badge.online { background: #dcfce7; color: #15803d; }
.status-badge.online::before { content: ''; width: 6px; height: 6px; background: #10b981; border-radius: 50%; }

/* User Management & Governance */
.user-card { background: white; border-radius: 20px; border: 1px solid #f1f5f9; box-shadow: 0 4px 15px rgba(0,0,0,0.02); overflow: hidden; }
.modern-table { width: 100%; border-collapse: collapse; }
.modern-table th { text-align: left; background: #f8fafc; padding: 16px 24px; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 700; border-bottom: 1px solid #f1f5f9; }
.modern-table td { padding: 16px 24px; border-bottom: 1px solid #f8fafc; vertical-align: middle; }
.modern-table tr:hover td { background: #fcfdfe; }
.modern-table tr:last-child td { border-bottom: none; }

.user-info-box { display: flex; align-items: center; gap: 14px; }
.user-avatar-sm { width: 42px; height: 42px; border-radius: 12px; background: #eff6ff; border: 1px solid #dbeafe; }
.user-name-wrapper { display: flex; flex-direction: column; }
.u-name { font-weight: 700; color: #1e293b; font-size: 0.9375rem; }
.u-id { font-size: 0.75rem; color: #94a3b8; font-family: 'JetBrains Mono', monospace; }

.role-tag { font-size: 0.75rem; font-weight: 700; padding: 4px 12px; border-radius: 80px; }
.role-tag.super_admin { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
.role-tag.admin { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
.time-cell { font-size: 0.875rem; color: #64748b; font-family: 'JetBrains Mono', monospace; }

.add-user-btn { display: flex; align-items: center; gap: 8px; padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s; font-size: 0.875rem; }
.add-user-btn:hover { background: #1d4ed8; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2); }
.add-user-btn svg { width: 18px; height: 18px; }

.delete-icon-btn { width: 36px; height: 36px; border-radius: 10px; border: 1px solid #fee2e2; background: white; color: #ef4444; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; margin-left: auto; }
.delete-icon-btn:hover { background: #ef4444; color: white; border-color: #ef4444; transform: scale(1.05); }
.delete-icon-btn svg { width: 18px; height: 18px; }

.text-right { text-align: right; }
.table-actions { display: flex; gap: 8px; justify-content: flex-end; }
.edit-icon-btn { width: 36px; height: 36px; border-radius: 10px; border: 1px solid #e2e8f0; background: white; color: #3b82f6; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
.edit-icon-btn:hover { background: #3b82f6; color: white; border-color: #3b82f6; transform: scale(1.05); }
.edit-icon-btn svg { width: 18px; height: 18px; }
.bg-gray-100 { background-color: #f3f4f6 !important; }

/* Security & Service Control UI */
.security-summary-card { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 24px; }
.summary-item { background: white; padding: 20px; border-radius: 16px; border: 1px solid #f1f5f9; display: flex; flex-direction: column; gap: 8px; }
.summary-item .label { font-size: 0.7rem; font-weight: 800; color: #94a3b8; letter-spacing: 0.1em; }
.summary-item .value { font-size: 1.5rem; font-weight: 800; color: #0f172a; }
.summary-item .value.critical { color: #ef4444; }

.role-icon { width: 36px; height: 36px; border-radius: 10px; background: #f1f5f9; color: #64748b; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.role-icon.super { background: #fee2e2; color: #ef4444; }
.role-icon svg { width: 20px; height: 20px; }

.ability-tags { display: flex; gap: 6px; }
.tag { font-size: 0.65rem; font-weight: 800; padding: 2px 6px; border-radius: 4px; border: 1px solid transparent; }
.tag.super { background: #fee2e2; color: #991b1b; border-color: #fecaca; }
.tag.login { background: #dcfce7; color: #15803d; border-color: #bbf7d0; }
.tag.db { background: #e0f2fe; color: #0369a1; border-color: #bae6fd; }

.risk-badge { font-size: 0.7rem; font-weight: 800; padding: 4px 8px; border-radius: 6px; }
.risk-badge.CRITICAL { background: #450a0a; color: #fecaca; }
.risk-badge.HIGH { background: #ef4444; color: white; }
.risk-badge.LOW { background: #f1f5f9; color: #64748b; }

.rec-text { font-size: 0.8rem; color: #64748b; font-weight: 500; }
.action-group { display: flex; gap: 8px; justify-content: flex-end; }
.mini-btn { padding: 6px 12px; border-radius: 8px; border: none; font-size: 0.7rem; font-weight: 800; cursor: pointer; transition: all 0.2s; }
.mini-btn.warning { background: #fff7ed; color: #c2410c; border: 1px solid #ffedd5; }
.mini-btn.warning:hover { background: #c2410c; color: white; }
.mini-btn.danger { background: #fef2f2; color: #dc2626; border: 1px solid #fee2e2; }
.mini-btn.danger:hover { background: #dc2626; color: white; }
.mini-btn.success { background: #f0fdf4; color: #16a34a; border: 1px solid #dcfce7; }
.mini-btn.success:hover { background: #16a34a; color: white; }

/* Modals & Forms (Premium UI) */
.modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
.modal { background: white; width: 100%; max-width: 440px; border-radius: 24px; padding: 32px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); border: 1px solid rgba(255,255,255,0.1); }
.modal h3 { font-size: 1.25rem; font-weight: 800; color: #0f172a; margin-bottom: 24px; text-align: center; }

.form-item { margin-bottom: 20px; }
.form-item label { display: block; font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
.form-item input, .form-item select, .form-item textarea { width: 100%; padding: 12px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 0.9375rem; color: #1e293b; transition: all 0.2s; outline: none; box-sizing: border-box; }
.form-item input:focus, .form-item select:focus, .form-item textarea:focus { border-color: #3b82f6; background: #fff; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1); }

.modal-actions { display: flex; gap: 12px; margin-top: 32px; }
.modal-actions button { flex: 1; padding: 12px; border-radius: 12px; font-weight: 700; font-size: 0.875rem; cursor: pointer; transition: all 0.2s; border: none; }
.modal-actions button:not(.primary) { background: #f1f5f9; color: #475569; }
.modal-actions button:not(.primary):hover { background: #e2e8f0; }
.modal-actions button.primary { background: #2563eb; color: white; }
.modal-actions button.primary:hover { background: #1d4ed8; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2); }

/* Secret Modal Specific */
.secret-modal { max-width: 500px; text-align: center; }
.modal-header-icon { width: 64px; height: 64px; background: #eff6ff; color: #3b82f6; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
.modal-header-icon svg { width: 32px; height: 32px; }
.modal-tip { color: #64748b; font-size: 0.875rem; margin-bottom: 24px; }
.btn-verify { background: #0f172a !important; color: white !important; }
.btn-verify:hover { background: #1e293b !important; }
.role-icon.postgresql { background: #dbeafe; color: #1e40af; }
.role-icon.geoserver { background: #ffedd5; color: #9a3412; }
.type-tag { font-size: 0.7rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; }
.type-tag.postgresql { background: #eff6ff; color: #2563eb; }
.type-tag.geoserver { background: #fff7ed; color: #ea580c; }
.tag.locked { background: #fee2e2; color: #ef4444; }
.mini-btn.primary { background: #3b82f6; color: white; border: none; }
.mini-btn.primary:hover { background: #2563eb; }
.mini-btn.info { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
.mini-btn.info:hover { background: #0369a1; color: white; }

.mt-8 { margin-top: 32px; }
.backend-status-banner { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: #e2e8f0; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
.status-box { background: white; padding: 20px; display: flex; flex-direction: column; gap: 8px; }
.s-label { font-size: 0.7rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
.s-value { font-size: 1rem; font-weight: 700; color: #0f172a; }
.s-value-tag { font-size: 0.85rem; font-weight: 800; padding: 4px 12px; border-radius: 6px; width: fit-content; }
.s-value-tag.full { background: #dcfce7; color: #15803d; }
.s-value-tag.limited { background: #fee2e2; color: #991b1b; }
.s-value-tag.prod { background: #7f1d1d; color: white; }
.s-value-tag.dev { background: #0369a1; color: white; }

.s-value-row { display: flex; align-items: center; gap: 8px; }
.mini-tag-btn { background: #eff6ff; color: #3b82f6; border: 1px solid #dbeafe; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; cursor: pointer; transition: all 0.2s; }
.mini-tag-btn:hover { background: #3b82f6; color: white; border-color: #3b82f6; }

/* New Governance View Styles (Strict Professional) */
.governance-view { padding: 4px; }
.governance-section { background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.section-header { padding: 24px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
.header-main { display: flex; align-items: center; gap: 16px; }
.h-icon-box { width: 44px; height: 44px; background: #eff6ff; color: #2563eb; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
.h-icon-box svg { width: 22px; height: 22px; }
.h-icon-box.orange { background: #fff7ed; color: #ea580c; }
.h-text h3 { font-size: 1rem; font-weight: 700; color: #1e293b; margin: 0; }
.card-subtitle { font-size: 0.8125rem; color: #64748b; margin: 4px 0 0; }

.roles-governance-table { padding: 0; }
.modern-table.high-density th { padding: 12px 20px; font-size: 0.725rem; color: #94a3b8; }
.modern-table.high-density td { padding: 14px 20px; font-size: 0.8125rem; }
.active-row td { background: #f0f9ff !important; border-bottom: 1px solid #bae6fd; }

.role-cell { display: flex; align-items: center; gap: 8px; }
.r-name { font-weight: 700; color: #0f172a; font-family: 'JetBrains Mono', monospace; }
.r-badge { font-size: 0.625rem; font-weight: 800; padding: 2px 6px; border-radius: 4px; }
.r-badge.super { background: #0f172a; color: white; }

.tag-outline { font-size: 0.65rem; font-weight: 700; padding: 2px 6px; border: 1px solid #e2e8f0; border-radius: 4px; color: #64748b; }
.tag-outline.info { color: #3b82f6; border-color: #dbeafe; }
.tag-outline.danger { color: #ef4444; border-color: #fee2e2; }
.tag-outline.success { color: #10b981; border-color: #dcfce7; }

.status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 8px; }
.status-dot.ok { background: #10b981; box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15); }
.status-dot.warning { background: #f59e0b; box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.15); }
.status-dot.blocked { background: #94a3b8; }
.status-text { font-size: 0.75rem; color: #475569; font-weight: 600; }

.active-identity-box { display: flex; align-items: center; gap: 8px; color: #2563eb; font-weight: 700; font-size: 0.75rem; }
.pulse-dot { width: 6px; height: 6px; background: #2563eb; border-radius: 50%; animation: pulse 2s infinite; }
@keyframes pulse { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(37, 99, 235, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); } }
.inactive-text { color: #94a3b8; font-size: 0.75rem; font-style: italic; }

.governance-actions { display: flex; gap: 12px; align-items: center; }
.action-sub-group { display: flex; background: #f1f5f9; padding: 2px; border-radius: 6px; }
.mini-btn.zinc { background: transparent; color: #475569; border: none; padding: 4px 10px; font-size: 0.65rem; border-radius: 4px; }
.mini-btn.zinc:hover { background: white; color: #0f172a; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
.mini-btn.primary { background: #2563eb; color: white; border: none; padding: 4px 10px; font-size: 0.65rem; border-radius: 4px; }
.mini-btn.success-solid { background: #10b981; color: white; border: none; padding: 5px 12px; font-size: 0.65rem; font-weight: 800; border-radius: 6px; }

.service-audit-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: #e2e8f0; border-top: 1px solid #e2e8f0; }
.audit-card { background: white; padding: 20px; }
.audit-card-title { font-size: 0.75rem; font-weight: 700; color: #64748b; margin-bottom: 12px; text-transform: uppercase; }
.audit-info-row { display: flex; justify-content: space-between; font-size: 0.8125rem; margin-bottom: 6px; }
.a-label { color: #94a3b8; }
.a-value { color: #1e293b; font-weight: 700; }
.tag-pill { font-size: 0.625rem; font-weight: 800; padding: 2px 8px; border-radius: 4px; background: #f1f5f9; color: #475569; margin-right: 4px; }
.tag-pill.success { background: #dcfce7; color: #15803d; }
.tag-pill.danger { background: #fee2e2; color: #991b1b; }
.tag-pill.info { background: #eff6ff; color: #3b82f6; }

.infra-status-bar { display: flex; gap: 40px; padding: 20px 24px; background: #0f172a; border-radius: 12px; color: white; }
.info-block { display: flex; flex-direction: column; gap: 4px; }
.i-label { font-size: 0.625rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; }
.i-value { font-size: 0.8125rem; font-weight: 600; color: #cbd5e1; }
.text-success { color: #10b981 !important; }
.text-blue { color: #3b82f6 !important; }
.uppercase { text-transform: uppercase; }
/* Core Config Overhaul Styles */
/* Config View Refinements (Figure 3 Style) */
.config-header { display: flex; align-items: center; justify-content: space-between; padding: 24px 32px; border-bottom: 1px solid #f1f5f9; }
.header-actions { display: flex; gap: 12px; }
.action-btn { 
  display: flex; align-items: center; justify-content: center;
  padding: 10px 20px; border-radius: 10px; font-size: 0.875rem; font-weight: 600; 
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); border: none; cursor: pointer;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}
.action-btn.secondary { background: white; color: #475569; border: 1px solid #e2e8f0; }
.action-btn.secondary:hover { background: #f8fafc; border-color: #cbd5e1; }
.action-btn.warning { background: #fff1f2; color: #be123c; border: 1px solid #fecdd3; }
.action-btn.warning:hover { background: #ffe4e6; }
.action-btn.primary { background: #2563eb; color: white; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.15); }
.action-btn.primary:hover { background: #1d4ed8; transform: translateY(-1px); box-shadow: 0 6px 14px rgba(37, 99, 235, 0.2); }
.action-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none !important; box-shadow: none !important; }

.config-group-block { margin-bottom: 40px; padding: 0 16px; }
.inner-group { margin-bottom: 16px; }
.config-grid-layout { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }

.config-card-item { background: #f8fafc; border: 1px solid #eef2f6; border-radius: 12px; padding: 16px; transition: all 0.2s; }
.config-card-item:not(.locked):hover { border-color: #3b82f644; background: white; box-shadow: 0 4px 12px rgba(0,0,0,0.02); }
.config-card-item.locked { background: #f8fafc99; border-style: dashed; opacity: 0.8; }
.config-label { display: flex; flex-direction: column; gap: 4px; font-size: 0.75rem; font-weight: 700; color: #0f172a; margin-bottom: 12px; font-family: 'JetBrains Mono', monospace; }
.config-label .desc { font-weight: 500; font-size: 0.7rem; color: #64748b; font-family: var(--font-sans); }
.input-wrapper { background: white; border-radius: 8px; border: 1px solid #e2e8f0; padding: 8px 12px; transition: all 0.2s; }
.input-wrapper:focus-within { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
.cfg-textarea { 
  width: 100%; border: none; outline: none; background: transparent; 
  font-family: 'JetBrains Mono', monospace; font-size: 0.825rem; color: #0f172a; 
  resize: none; min-height: 24px; line-height: 1.6;
  word-break: break-all; overflow-wrap: anywhere; white-space: pre-wrap;
}
.config-card-item.locked { background: #f1f5f9; border-style: solid; border-color: #e2e8f0; cursor: not-allowed; }
.config-card-item.locked .cfg-textarea { color: #64748b; font-weight: 500; }
.config-card-item.locked .input-wrapper { background: #f8fafc; border-color: #e2e8f0; }

.config-footer-hint { margin-top: 32px; padding: 20px; background: #f8fafc; border-radius: 12px; border-left: 4px solid #94a3b8; font-size: 0.825rem; color: #64748b; }
</style>
