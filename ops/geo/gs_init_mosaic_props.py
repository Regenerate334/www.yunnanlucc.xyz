"""
================================================================================
@File    :   gs_init_mosaic_props.py
@Desc    :   初始化 GeoServer 影像金字塔（ImageMosaic）配置文件。生成基础的 
             indexer.xml 和 timeregex.properties，并执行初步索引清理。
@Usage   :   python ops/gs_init_mosaic_props.py
@Deps    :   os
================================================================================
"""
import os

INDEXER_XML_CONTENT = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Indexer>
  <domains>
    <domain name="time">
      <attributes>
        <attribute>time</attribute>
      </attributes>
    </domain>
  </domains>
  <parameters>
    <parameter name="AbsolutePath" value="true" />
    <parameter name="Recursive" value="false" />
  </parameters>
</Indexer>
"""

TIMEREGEX_PROPERTIES_CONTENT = """regex=[0-9]{8}
"""

def setup_mosaic_configs(root_dir):
    """
    遍历县域文件夹，生成 indexer.xml 和 timeregex.properties。
    同时清理旧的 GeoServer 索引文件。
    """
    print(f"正在配置目录: {root_dir}")
    
    county_folders = [f for f in os.listdir(root_dir) if os.path.isdir(os.path.join(root_dir, f))]
    
    for folder in county_folders:
        folder_path = os.path.join(root_dir, folder)
        print(f"正在配置: {folder}")
        
        # 1. 写入 indexer.xml
        with open(os.path.join(folder_path, "indexer.xml"), "w", encoding="utf-8") as f:
            f.write(INDEXER_XML_CONTENT)
            
        # 2. 写入 timeregex.properties
        with open(os.path.join(folder_path, "timeregex.properties"), "w", encoding="utf-8") as f:
            f.write(TIMEREGEX_PROPERTIES_CONTENT)
            
        # 3. 清理已有的 GeoServer 错误索引文件 (以文件夹名为名的 shp/dbf/shx/prj)
        # GeoServer 通常会以文件夹名作为索引文件名
        base_name = folder
        for ext in [".shp", ".dbf", ".shx", ".prj", ".properties"]:
            index_file = os.path.join(folder_path, f"{base_name}{ext}")
            if os.path.exists(index_file):
                try:
                    os.remove(index_file)
                    print(f"  已清理旧索引: {index_file}")
                except Exception as e:
                    print(f"  无法删除 {index_file}: {e}")

if __name__ == "__main__":
    TARGET_PATH = r"D:\yunnan_CLCD_Data\clipped_regions"
    setup_mosaic_configs(TARGET_PATH)
