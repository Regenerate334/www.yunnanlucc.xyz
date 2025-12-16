-- ===========================================
-- 数据库性能优化脚本
-- ===========================================
-- 用于优化 yunnan_clcd_merged_table 表的查询性能

-- 1. 检查表统计信息
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats 
WHERE tablename = 'yunnan_clcd_merged_table' 
    AND schemaname = 'public'
ORDER BY attname;

-- 2. 更新表统计信息（提高查询计划器的准确性）
ANALYZE public.yunnan_clcd_merged_table;

-- 3. 检查现有索引
SELECT
    tablename,
    indexname,
    indexdef,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_indexes
WHERE tablename = 'yunnan_clcd_merged_table' 
    AND schemaname = 'public'
ORDER BY indexname;

-- 4. 创建关键索引（如果不存在）
-- 注意：这些索引创建可能需要较长时间，建议在维护窗口期间执行

-- 为 year 列创建索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_yunnan_clcd_year 
ON public.yunnan_clcd_merged_table (year);

-- 为 landuse_type 列创建索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_yunnan_clcd_landuse_type 
ON public.yunnan_clcd_merged_table (landuse_type);

-- 创建复合索引（最重要）- 对按年份和地类查询最有效
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_yunnan_clcd_year_landuse 
ON public.yunnan_clcd_merged_table (year, landuse_type);

-- 为面积列创建索引（用于过滤无效数据）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_yunnan_clcd_area_positive 
ON public.yunnan_clcd_merged_table (area_sqm) 
WHERE area_sqm > 0;

-- 5. 检查索引使用情况
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE tablename = 'yunnan_clcd_merged_table'
ORDER BY idx_tup_read DESC;

-- 6. 检查表大小
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size
FROM pg_tables 
WHERE tablename = 'yunnan_clcd_merged_table' 
    AND schemaname = 'public';

-- 7. 测试查询性能
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT 
  landuse_type, 
  SUM(area_sqm) / 1e6 AS area_km2,
  COUNT(*) as polygon_count
FROM public.yunnan_clcd_merged_table
WHERE year = 1985
  AND area_sqm > 0
GROUP BY landuse_type
ORDER BY landuse_type;

