import os
import shutil
import sys

# 目标数据根目录
ROOT_DIR = r"D:\yunnan_CLCD_Data\clipped_regions"

# 配置模板：同步 NoData=0
INDEXER_PROPERTIES_CONTENT = """TimeAttribute=time
Schema=*the_geom:Polygon,location:String,time:java.util.Date
PropertyCollectors=TimestampFileNameExtractorSPI[timeregex](time)
NoData=0
"""

TIMEREGEX_CONTENT = "regex=[0-9]{8}"

def fix_folder_config(folder_path):
    folder_name = os.path.basename(folder_path)
    
    # 1. 处理 sample_image.dat
    target_sample_name = "sample_image.dat"
    for f in os.listdir(folder_path):
        if "sample_image.dat" in f and f != target_sample_name:
            try:
                os.remove(os.path.join(folder_path, target_sample_name))
            except: pass
            os.rename(os.path.join(folder_path, f), os.path.join(folder_path, target_sample_name))

    # 2. 移除旧的 indexer.xml
    old_xml = os.path.join(folder_path, "indexer.xml")
    if os.path.exists(old_xml): os.remove(old_xml)

    # 3. 写入新的 indexer.properties (含 NoData=0)
    with open(os.path.join(folder_path, "indexer.properties"), "w", encoding="utf-8") as f:
        f.write(INDEXER_PROPERTIES_CONTENT)
    
    # 4. 写入 timeregex.properties
    with open(os.path.join(folder_path, "timeregex.properties"), "w", encoding="utf-8") as f:
        f.write(TIMEREGEX_CONTENT)
    
    # 5. [CRITICAL] 彻底清理旧的索引文件，强制 GeoServer 重新由于 30.0m TIF 生成索引
    # 删除所有 .shp, .dbf, .shx, .prj, .properties (除了 indexer/timeregex), .fix, .qix, .xml (除了 indexer/timeregex)
    for f in os.listdir(folder_path):
        f_lower = f.lower()
        if f_lower.endswith((".tif", ".dat")):
            continue
        if f in ["indexer.properties", "timeregex.properties"]:
            continue
        
        # 删除所有 shapefile/h2 相关索引
        if f_lower.endswith((".shp", ".dbf", ".shx", ".prj", ".fix", ".qix", ".db", ".xml", ".properties")):
            try:
                os.remove(os.path.join(folder_path, f))
            except:
                pass

def run():
    print(f"\n正在启动核心配置修复 + 全局索引清空...")
    folders = [f for f in os.listdir(ROOT_DIR) if os.path.isdir(os.path.join(ROOT_DIR, f)) and f.startswith("county_")]
    
    for i, folder in enumerate(folders):
        print(f"[{i+1}/{len(folders)}] 正在清空索引并对齐配置: {folder}", end="\r")
        folder_path = os.path.join(ROOT_DIR, folder)
        try:
            fix_folder_config(folder_path)
        except Exception as e:
            print(f"\n[ERROR] {folder}: {e}")
    
    print("\n完成！已清理旧索引并注入 NoData=0。")

if __name__ == "__main__":
    run()
