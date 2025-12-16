-- ===========================================
-- 空间索引优化脚本
-- ===========================================
-- 用于优化 yunnan_clcd_merged_table 表的空间索引性能

-- 1. 检查现有空间索引
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_indexes
WHERE tablename = 'yunnan_clcd_merged_table' 
    AND schemaname = 'public'
    AND indexdef LIKE '%gist%';

-- 2. 检查几何数据质量
SELECT 
    'Total Geometries' as metric,
    COUNT(*) as count
FROM public.yunnan_clcd_merged_table
UNION ALL
SELECT 
    'NULL Geometries' as metric,
    COUNT(*) as count
FROM public.yunnan_clcd_merged_table
WHERE geom IS NULL
UNION ALL
SELECT 
    'Invalid Geometries' as metric,
    COUNT(*) as count
FROM public.yunnan_clcd_merged_table
WHERE ST_IsValid(geom) = false
UNION ALL
SELECT 
    'Empty Geometries' as metric,
    COUNT(*) as count
FROM public.yunnan_clcd_merged_table
WHERE ST_IsEmpty(geom) = true;

-- 3. 检查几何数据的空间范围
SELECT 
    ST_AsText(ST_Envelope(ST_Collect(geom))) as bounding_box,
    ST_Area(ST_Envelope(ST_Collect(geom))) as bounding_box_area
FROM public.yunnan_clcd_merged_table
WHERE geom IS NOT NULL
LIMIT 1;

-- 4. 删除现有空间索引（如果需要重建）
-- DROP INDEX CONCURRENTLY IF EXISTS idx_merged_geom;

-- 5. 创建优化的空间索引
-- 使用更高的填充因子和更合适的参数
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_merged_geom_optimized 
ON public.yunnan_clcd_merged_table 
USING GIST (geom)
WITH (fillfactor = 90, buffering = 'on');

-- 6. 创建空间+属性复合索引（用于空间查询+属性过滤）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_merged_geom_year 
ON public.yunnan_clcd_merged_table 
USING GIST (geom, year);

-- 7. 创建空间+地类复合索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_merged_geom_landuse 
ON public.yunnan_clcd_merged_table 
USING GIST (geom, landuse_type);

-- 8. 创建空间+年份+地类复合索引（最全面的索引）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_merged_geom_year_landuse 
ON public.yunnan_clcd_merged_table 
USING GIST (geom, year, landuse_type);

-- 9. 更新表统计信息
ANALYZE public.yunnan_clcd_merged_table;

-- 10. 检查索引使用情况
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_stat_user_indexes 
WHERE tablename = 'yunnan_clcd_merged_table'
    AND indexname LIKE '%geom%'
ORDER BY idx_scan DESC;

-- 11. 测试空间查询性能
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT 
    landuse_type,
    COUNT(*) as count,
    SUM(ST_Area(geom)) as total_area
FROM public.yunnan_clcd_merged_table
WHERE year = 1985
    AND ST_Intersects(geom, ST_MakeEnvelope(100, 20, 110, 30, 4326))
GROUP BY landuse_type;

-- 12. 检查PostGIS版本和配置
SELECT 
    PostGIS_Version() as postgis_version,
    ST_Transform(ST_SetSRID(ST_Point(0,0), 4326), 3857) as test_transform;

-- 13. 优化PostgreSQL配置（需要重启数据库）
-- 这些设置可以在postgresql.conf中调整
SHOW shared_preload_libraries;
SHOW max_parallel_workers_per_gather;
SHOW work_mem;
SHOW maintenance_work_mem;

