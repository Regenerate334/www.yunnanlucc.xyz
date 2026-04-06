import os
import rasterio
from rasterio.enums import Resampling
import numpy as np
from multiprocessing import Pool, cpu_count
from osgeo import gdal

# 强制修正投影数据库指向
os.environ['PROJ_LIB'] = r'C:\ProgramData\anaconda3\envs\soilmetal\Library\share\proj'
os.environ['GDAL_DATA'] = r'C:\ProgramData\anaconda3\envs\soilmetal\Library\share\gdal'

ROOT_DIR = r"D:\yunnan_CLCD_Data\clipped_regions"

CLCD_COLORMAP = {
    0: (0, 0, 0, 0),
    1: (250, 227, 156, 255),
    2: (68, 111, 51, 255),
    3: (51, 160, 44, 255),
    4: (171, 211, 123, 255),
    5: (30, 105, 180, 255),
    6: (166, 206, 227, 255),
    7: (207, 189, 163, 255),
    8: (226, 66, 144, 255),
    9: (40, 155, 232, 255)
}

def calibrate_and_fix_tif(file_path):
    tmp_path = file_path + ".tmp.tif"
    try:
        with rasterio.open(file_path) as src:
            # 检查是否已经校准 (容差 1e-10)
            if abs(src.transform.a - 30.0) < 1e-10 and abs(src.transform.e - (-30.0)) < 1e-10:
                # 检查金字塔是否存在 (简单判断波段有无 overview)
                if src.overviews(1):
                    return "SKIPPED"
            
            # 使用 EXACT 30.0 Transform
            new_transform = rasterio.Affine(30.0, 0.0, src.bounds.left, 0.0, -30.0, src.bounds.top)
            new_width = int(np.ceil((src.bounds.right - src.bounds.left) / 30.0))
            new_height = int(np.ceil((src.bounds.top - src.bounds.bottom) / 30.0))
            
            meta = src.meta.copy()
            meta.update({
                'width': new_width, 'height': new_height,
                'transform': new_transform,
                'compress': 'lzw', 'nodata': 0, 'dtype': 'uint8'
            })
            
            with rasterio.open(tmp_path, 'w', **meta) as dst:
                data = src.read(1, out_shape=(new_height, new_width), resampling=Resampling.nearest)
                dst.write(data, 1)
                dst.write_colormap(1, CLCD_COLORMAP)
                dst.build_overviews([2, 4, 8, 16, 32], Resampling.nearest)

        # 复制色彩表到金字塔概览层
        ds = gdal.Open(tmp_path, gdal.GA_Update)
        band = ds.GetRasterBand(1)
        ct = band.GetColorTable()
        if ct is not None:
            for i in range(band.GetOverviewCount()):
                band.GetOverview(i).SetColorTable(ct)
        ds = None
        
        if os.path.exists(file_path): os.remove(file_path)
        os.rename(tmp_path, file_path)
        return "SUCCESS"
    except Exception as e:
        if os.path.exists(tmp_path): os.remove(tmp_path)
        return f"ERROR: {e}"

def run():
    tif_files = []
    for root, dirs, files in os.walk(ROOT_DIR):
        for f in files:
            if f.lower().endswith(".tif"):
                tif_files.append(os.path.join(root, f))
    
    print(f"正在全量并行并行校准 {len(tif_files)} 个数据文件...")
    
    # 核心数减1以防卡死
    cores = max(1, cpu_count() - 1)
    with Pool(cores) as p:
        results = p.map(calibrate_and_fix_tif, tif_files)
    
    success = results.count("SUCCESS")
    skipped = results.count("SKIPPED")
    errors = len(results) - success - skipped
    
    print(f"\n校准任务完成！")
    print(f"  > 成功重新校准: {success}")
    print(f"  > 跳过 (已校准): {skipped}")
    print(f"  > 失败: {errors}")

if __name__ == "__main__":
    run()
