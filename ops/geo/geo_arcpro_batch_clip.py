"""
================================================================================
@File    :   geo_arcpro_batch_clip.py
@Desc    :   基于 ArcGIS Pro (arcpy) 的栅格批量裁剪工具。使用县级矢量边界对全省 
             CLCD 栅格数据进行精确裁剪。目前硬编码为处理福贡县。
@Usage   :   在 ArcGIS Pro 的 Python 环境下运行：python ops/geo/geo_arcpro_batch_clip.py
@Deps    :   arcpy, os
================================================================================
"""
import arcpy
import os

# --- 1. 路径与字段配置 ---
SOURCE_TIFF_DIR = r"D:\yunnan_CLCD_Data\CLCD_Province\yunnan"
SHP_COUNTIES = r"D:\【MapData】GIS数据集\2022年地市边界\2022县矢量.shp"
OUTPUT_BASE_DIR = r"D:\yunnan_CLCD_Data\clipped_regions"

# 福贡县：中文名 -> 拼音
TARGET_COUNTY = "福贡县"
TARGET_PINYIN = "fugongxian"

# --- 2. 核心裁切逻辑 ---
def clip_fugong():
    """
    仅裁切福贡县的 CLCD 栅格数据
    """
    print(f"\n>>> 开始裁切福贡县 CLCD 数据...")

    if not os.path.exists(OUTPUT_BASE_DIR):
        os.makedirs(OUTPUT_BASE_DIR)

    arcpy.env.overwriteOutput = True

    # 获取待处理的 TIFF 列表
    tiff_files = [f for f in os.listdir(SOURCE_TIFF_DIR) if f.endswith(".tif")]
    if not tiff_files:
        print(f"  [错误] 在 {SOURCE_TIFF_DIR} 未找到 TIFF 文件。")
        return

    print(f"  共找到 {len(tiff_files)} 个源 TIFF 文件")

    # 输出目录：拼音命名
    folder_name = f"county_{TARGET_PINYIN}"
    region_dir = os.path.join(OUTPUT_BASE_DIR, folder_name)

    if not os.path.exists(region_dir):
        os.makedirs(region_dir)

    # 查找福贡县的矢量边界
    where_clause = f"\"县级\" = '{TARGET_COUNTY}'"
    found = False

    with arcpy.da.SearchCursor(SHP_COUNTIES, ["SHAPE@", "县级"], where_clause) as cursor:
        for row in cursor:
            found = True
            geom = row[0]
            region_name = str(row[1])
            print(f"  已定位福贡县矢量边界: {region_name}")

            for i, tiff_name in enumerate(tiff_files):
                in_raster = os.path.join(SOURCE_TIFF_DIR, tiff_name)
                out_raster = os.path.join(region_dir, tiff_name)

                if os.path.exists(out_raster):
                    print(f"    [{i+1}/{len(tiff_files)}] {tiff_name}: 已存在，跳过")
                    continue

                try:
                    arcpy.management.Clip(
                        in_raster=in_raster,
                        rectangle="#",
                        out_raster=out_raster,
                        in_template_dataset=geom,
                        nodata_value="0",
                        clipping_geometry="ClippingGeometry",
                        maintain_clipping_extent="NO_MAINTAIN_EXTENT"
                    )
                    print(f"    [{i+1}/{len(tiff_files)}] {tiff_name}: OK")
                except Exception as e:
                    print(f"    [{i+1}/{len(tiff_files)}] {tiff_name}: [失败] {e}")

    if not found:
        print(f"  [错误] 未在矢量文件中找到 '{TARGET_COUNTY}'，请检查字段名和属性值。")
    else:
        result_count = len([f for f in os.listdir(region_dir) if f.endswith(".tif")])
        print(f"\n[完成] 福贡县裁切结束，共生成 {result_count} 个 TIF 文件")
        print(f"  输出目录: {region_dir}")

# --- 3. 运行主程序 ---
if __name__ == "__main__":
    clip_fugong()
