"""
================================================================================
@File    :   gs_prep_standard_mosaic.py
@Desc    :   为 GeoServer ImageMosaic 准备标准化栅格数据的工具。包含：
             1. 文件夹名中文化转拼音（county_xxx 规范）；
             2. 投影重投影 (EPSG:4522)；
             3. 强制注入 CLCD 标准色彩表及构建内部金字塔。
@Usage   :   python ops/gs_prep_standard_mosaic.py
@Deps    :   rasterio, gdal, pypinyin, concurrent.futures
================================================================================
"""
import os
import shutil
from pypinyin import pinyin, Style

# 强制修正投影数据库指向 (解决 ArcGIS/PostGIS 环境变量干扰问题)
os.environ['PROJ_LIB'] = r'C:\ProgramData\anaconda3\envs\soilmetal\Library\share\proj'
os.environ['GDAL_DATA'] = r'C:\ProgramData\anaconda3\envs\soilmetal\Library\share\gdal'

import rasterio
from rasterio.warp import calculate_default_transform, reproject, Resampling
from concurrent.futures import ProcessPoolExecutor
from functools import partial

def get_pinyin(text):
    """将中文转换为拼音，去除空格"""
    py_list = pinyin(text, style=Style.NORMAL)
    return "".join([item[0] for item in py_list]).replace(" ", "")

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

def reproject_tif(file_path, target_crs="EPSG:4522"):
    """
    标准化单个 TIF 文件：修复色彩、数据类型，并根据需要重投影。
    """
    temp_file = file_path + ".final.tif"
    try:
        with rasterio.open(file_path) as src:
            # 检查是否需要执行重投影
            src_crs_str = src.crs.to_string() if src.crs else ""
            needs_reproject = (src_crs_str.upper() != target_crs.upper())

            if not needs_reproject:
                transform, width, height = src.transform, src.width, src.height
            else:
                transform, width, height = calculate_default_transform(
                    src.crs, target_crs, src.width, src.height, *src.bounds)
            
            # 准备输出参数，统一使用 uint8/lzw/nodata:0
            kwargs = src.meta.copy()
            kwargs.update({
                'driver': 'GTiff',
                'crs': target_crs,
                'transform': transform,
                'width': width,
                'height': height,
                'dtype': 'uint8',
                'nodata': 0,
                'compress': 'lzw',
                'tiled': True
            })

            # 执行写入
            with rasterio.open(temp_file, 'w', **kwargs) as dst:
                if needs_reproject:
                    for i in range(1, src.count + 1):
                        reproject(
                            source=rasterio.band(src, i),
                            destination=rasterio.band(dst, i),
                            src_transform=src.transform,
                            src_crs=src.crs,
                            dst_transform=transform,
                            dst_crs=target_crs,
                            resampling=Resampling.nearest)
                else:
                    # 仅复制数据并确保类型正确（针对色彩修复）
                    for i in range(1, src.count + 1):
                        data = src.read(i).astype('uint8')
                        dst.write(data, i)
                
                # 注入 CLCD 标准色彩映射表（解决“全黑”问题的核心）
                dst.write_colormap(1, CLCD_COLORMAP)

                # 生成内部金字塔 (Overviews)，解决大缩放级别下显示全黑的问题
                factors = [2, 4, 8, 16, 32]
                dst.build_overviews(factors, Resampling.mode)

        # GDAL Bug Fix: 强制把主波段的色彩表复制给所有金字塔概览级
        from osgeo import gdal
        ds = gdal.Open(temp_file, gdal.GA_Update)
        band = ds.GetRasterBand(1)
        ct = band.GetColorTable()
        if ct is not None:
            for i in range(band.GetOverviewCount()):
                band.GetOverview(i).SetColorTable(ct)
        ds = None # 保存并释放
        
        # 成功后物理替换
        if os.path.exists(file_path):
            os.remove(file_path)
        os.rename(temp_file, file_path)

        # 清理旧的关联辅助文件（如 .ovr, .aux.xml），防止 GeoServer 读取过时索引
        for ext in ['.ovr', '.aux.xml', '.tif.ovr']:
            sidecar = file_path + ext if not file_path.endswith(ext) else file_path
            # 处理可能的重复后缀情况
            potential_sidecars = [file_path + ext, file_path.rsplit('.', 1)[0] + ext]
            for ps in set(potential_sidecars):
                if os.path.exists(ps) and ps != file_path:
                    os.remove(ps)

        return True, f"OK: {os.path.basename(file_path)}"
    except Exception as e:
        if os.path.exists(temp_file):
            os.remove(temp_file)
        return False, f"ERR: {os.path.basename(file_path)}: {str(e)}"

def standardize_dataset(root_dir):
    print(f"正在扫描数据根目录: {root_dir}")
    
    # 步骤 1: 检查并修复文件夹拼音命名
    folders = [f for f in os.listdir(root_dir) if os.path.isdir(os.path.join(root_dir, f))]
    for folder in folders:
        # 如果包含中文，执行转换
        if any('\u4e00' <= char <= '\u9fff' for char in folder):
            new_name = get_pinyin(folder)
            old_path = os.path.join(root_dir, folder)
            new_path = os.path.join(root_dir, new_name)
            
            if old_path != new_path:
                if os.path.exists(new_path):
                    print(f"  正在合并目录: {folder} -> {new_name}")
                    for item in os.listdir(old_path):
                        shutil.move(os.path.join(old_path, item), os.path.join(new_path, item))
                    os.rmdir(old_path)
                else:
                    os.rename(old_path, new_path)
                    print(f"  重命名目录: {folder} -> {new_name}")

    # 步骤 2: 搜集所有 TIF 文件（在已拼音化的目录中）
    tif_files = []
    pinyin_folders = [f for f in os.listdir(root_dir) if os.path.isdir(os.path.join(root_dir, f)) and f.startswith("county_")]
    for folder in pinyin_folders:
        folder_path = os.path.join(root_dir, folder)
        for f in os.listdir(folder_path):
            if f.lower().endswith(".tif"):
                tif_files.append(os.path.join(folder_path, f))

    if not tif_files:
        print("未找到需要处理的 TIF 文件。")
        return

    print(f"--- 正在批量修复 {len(tif_files)} 个文件的色彩表与投影 ---")
    print("注意：正在使用多进程加速，请勿中断...")

    # 使用进程池执行
    import multiprocessing
    num_workers = min(os.cpu_count(), 8) # 限制 worker 数量防止磁盘 I/O 瓶颈
    
    with ProcessPoolExecutor(max_workers=num_workers) as executor:
        worker_func = partial(reproject_tif, target_crs="EPSG:4522")
        results = list(executor.map(worker_func, tif_files))

    # 汇总
    success = sum(1 for s, m in results if s)
    print("-" * 50)
    print(f"修复处理完成！")
    print(f"总计: {len(tif_files)}, 成功: {success}, 失败: {len(tif_files) - success}")
    
    if success < len(tif_files):
        print("失败列表摘要:")
        for s, m in results[:10]: # 仅显示前10个失败
            if not s: print(f"  {m}")

if __name__ == "__main__":
    DATA_PATH = r"D:\yunnan_CLCD_Data\clipped_regions"
    standardize_dataset(DATA_PATH)
