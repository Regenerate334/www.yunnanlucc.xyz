import arcpy
import os

# =================================================================
# ArcGIS Pro 套件原生切割脚本 (直接在 Python 窗口粘贴运行)
# 修复说明：修正了 Clip 工具的 maintain_clipping_extent 参数名
# =================================================================

# --- 1. 路径与字段配置 ---
SOURCE_TIFF_DIR = r"D:\yunnan_CLCD_Data\CLCD_Province\yunnan"
SHP_COUNTIES = r"D:\【MapData】GIS数据集\2022年地市边界\2022县矢量.shp"
OUTPUT_BASE_DIR = r"D:\yunnan_CLCD_Data\clipped_regions"

# --- 2. 核心裁切逻辑 ---
def process_clipping(shp_path, name_field, province_field, province_val):
    """
    执行批量裁切 (仅限县级)
    """
    print(f"\n>>> 开始处理县级行政区划 (云南省)...")
    
    if not os.path.exists(OUTPUT_BASE_DIR):
        os.makedirs(OUTPUT_BASE_DIR)
        
    arcpy.env.overwriteOutput = True
    
    # 获取待处理的 TIFF 列表
    tiff_files = [f for f in os.listdir(SOURCE_TIFF_DIR) if f.endswith(".tif")]
    if not tiff_files:
        print(f"  [错误] 在 {SOURCE_TIFF_DIR} 未找到 TIFF 文件。")
        return

    # 只选云南省
    where_clause = f"\"{province_field}\" LIKE '%{province_val}%'"
    
    with arcpy.da.SearchCursor(shp_path, ["SHAPE@", name_field], where_clause) as cursor:
        for row in cursor:
            geom = row[0]
            region_name = str(row[1]) if row[1] else "Unknown"
            
            folder_name = f"county_{region_name}"
            region_dir = os.path.join(OUTPUT_BASE_DIR, folder_name)
            
            if not os.path.exists(region_dir):
                os.makedirs(region_dir)
            
            print(f"  正在切割区域: {region_name}")
            
            for tiff_name in tiff_files:
                in_raster = os.path.join(SOURCE_TIFF_DIR, tiff_name)
                out_raster = os.path.join(region_dir, tiff_name)
                
                if os.path.exists(out_raster):
                    continue
                
                try:
                    # 修正参数名：maintain_clipping_extent
                    arcpy.management.Clip(
                        in_raster=in_raster,
                        rectangle="#",
                        out_raster=out_raster,
                        in_template_dataset=geom,
                        nodata_value="0",
                        clipping_geometry="ClippingGeometry",
                        maintain_clipping_extent="NO_MAINTAIN_EXTENT"
                    )
                except Exception as e:
                    print(f"    - [跳过] {tiff_name}: {e}")

# --- 3. 运行主程序 ---
if __name__ == "__main__":
    process_clipping(SHP_COUNTIES, "县级", "省级", "云南")
    print("\n[完成] 县级行政区划切割结束。请检查结果目录：", OUTPUT_BASE_DIR)
