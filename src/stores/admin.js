/**
 * @module stores/admin
 * @description Pinia 状态管理：后台管理模块，维护系统日志、用户及系统配置状态。
 * @author System
 * @dependencies pinia
 */

import { defineStore } from 'pinia';

export const useAdminStore = defineStore('admin', {
    state: () => ({
        // 限制每个数组长度为 30
        systemHistory: {
            times: [],
            cpu: [],
            ram: []
        },
        sessionsHistory: {
            times: [],
            total: [],
            active: [],
            idle: []
        },
        tpsHistory: {
            times: [],
            trans: [],
            commits: [],
            rollbacks: []
        },
        tInHistory: {
            times: [],
            ins: [],
            upd: [],
            del: []
        },
        bioHistory: {
            times: [],
            reads: [],
            hits: []
        }
    }),
    actions: {
        addSystemPoint(time, cpu, ram) {
            if (this.systemHistory.times.length >= 30) {
                this.systemHistory.times.shift();
                this.systemHistory.cpu.shift();
                this.systemHistory.ram.shift();
            }
            this.systemHistory.times.push(time);
            this.systemHistory.cpu.push(cpu);
            this.systemHistory.ram.push(ram);
        },
        addDbPoints(time, dbStatus) {
            // Sessions
            if (this.sessionsHistory.times.length >= 30) {
                this.sessionsHistory.times.shift();
                this.sessionsHistory.total.shift();
                this.sessionsHistory.active.shift();
                this.sessionsHistory.idle.shift();
            }
            this.sessionsHistory.times.push(time);
            this.sessionsHistory.total.push(dbStatus.sessions?.total || 0);
            this.sessionsHistory.active.push(dbStatus.sessions?.active || 0);
            this.sessionsHistory.idle.push(dbStatus.sessions?.idle || 0);

            // TPS
            if (this.tpsHistory.times.length >= 30) {
                this.tpsHistory.times.shift();
                this.tpsHistory.trans.shift();
                this.tpsHistory.commits.shift();
                this.tpsHistory.rollbacks.shift();
            }
            this.tpsHistory.times.push(time);
            this.tpsHistory.trans.push(dbStatus.tps || 0);
            this.tpsHistory.commits.push(dbStatus.commits || 0);
            this.tpsHistory.rollbacks.push(dbStatus.rollbacks || 0);

            // Tuples In
            if (this.tInHistory.times.length >= 30) {
                this.tInHistory.times.shift();
                this.tInHistory.ins.shift();
                this.tInHistory.upd.shift();
                this.tInHistory.del.shift();
            }
            this.tInHistory.times.push(time);
            this.tInHistory.ins.push(dbStatus.throughput?.ins || 0);
            this.tInHistory.upd.push(dbStatus.throughput?.upd || 0);
            this.tInHistory.del.push(dbStatus.throughput?.del || 0);

            // Bio
            if (this.bioHistory.times.length >= 30) {
                this.bioHistory.times.shift();
                this.bioHistory.reads.shift();
                this.bioHistory.hits.shift();
            }
            this.bioHistory.times.push(time);
            this.bioHistory.reads.push(dbStatus.reads || 0);
            this.bioHistory.hits.push(dbStatus.hits || 0);
        }
    }
});
