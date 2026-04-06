import os
import rasterio
from rasterio.warp import Resampling
from concurrent.futures import ProcessPoolExecutor
from functools import partial

# 强制修正投影数据库指向
os.environ['PROJ_LIB'] = r'C:\ProgramData\anaconda3\envs\soilmetal\Library\share\proj'
os.environ['GDAL_DATA'] = r'C:\ProgramData\anaconda3\envs\soilmetal\Library\share\gdal'

# CLCD 标准色彩映射表 (RGBA格式)
CLCD_COLORMAP = {
    0: (0, 0, 0, 0),          # NoData (透明)
    1: (250, 227, 156, 255),   # Cropland
    2: (68, 111, 51, 255),     # Forest
    3: (51, 160, 44, 255),     # Shrub
    4: (171, 211, 123, 255),   # Grassland
    5: (30, 105, 180, 255),    # Water
    6: (166, 206, 227, 255),   # Snow/Ice
    7: (207, 189, 163, 255),   # Barren
    8: (226, 66, 144, 255),    # Impervious
    9: (40, 155, 232, 255)     # Wetland
}

def fix_single_tif(file_path):
    """
    原地修复单个 TIF：注入色彩表、生成金字塔、清理副文件
    """
    try:
        # 使用 r+ 模式进行原地修改，不产生临时文件，速度极快
        with rasterio.open(file_path, 'r+') as dst:
            # 1. 强制注入色彩表
            dst.write_colormap(1, CLCD_COLORMAP)
            
            # 2. 建立内部金字塔 (Overviews)
            factors = [2, 4, 8, 16, 32]
            dst.build_overviews(factors, Resampling.mode)
        
        # 3. GDAL Bug Fix: 强制把主波段的色彩表复制给所有金字塔概览级，否则缩小时变黑
        from osgeo import gdal
        ds = gdal.Open(file_path, gdal.GA_Update)
        band = ds.GetRasterBand(1)
        ct = band.GetColorTable()
        if ct is not None:
            for i in range(band.GetOverviewCount()):
                band.GetOverview(i).SetColorTable(ct)
        ds = None # 保存并自动清理
        
        # 4. 清理外部过时的辅助文件
        for ext in ['.ovr', '.aux.xml', '.tif.ovr']:
            sidecar = file_path + ext
            # 处理路径重复后缀
            potential_sidecars = [file_path + ext, file_path.rsplit('.', 1)[0] + ext]
            for ps in set(potential_sidecars):
                if os.path.exists(ps) and ps != file_path:
                    os.remove(ps)
                    
        return True, f"Fixed: {os.path.basename(file_path)}"
    except Exception as e:
        return False, f"Error: {os.path.basename(file_path)}: {str(e)}"

def run_fix(root_dir):
    print(f"正在扫描并原地修复目录: {root_dir}")
    tif_files = []
    for root, dirs, files in os.walk(root_dir):
        for f in files:
            if f.lower().endswith(".tif"):
                tif_files.append(os.path.join(root, f))
    
    if not tif_files:
        print("未找到 TIF 文件。")
        return

    print(f"开始原地修复 {len(tif_files)} 个文件...")
    
    num_workers = min(os.cpu_count(), 8)
    with ProcessPoolExecutor(max_workers=num_workers) as executor:
        results = list(executor.map(fix_single_tif, tif_files))
    
    success = sum(1 for s, m in results if s)
    print(f"完成！成功: {success}, 失败: {len(tif_files) - success}")

if __name__ == "__main__":
    DATA_PATH = r"D:\yunnan_CLCD_Data\clipped_regions"
    run_fix(DATA_PATH)
