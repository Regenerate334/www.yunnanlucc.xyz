
#================================================================================
#@File    :   geo_fix_yiliang_conflict.py
#@Desc    :   宜良县/彝良县拼音重名冲突的全自动修复脚本。包含四步：
#             1. 重命名彝良县图层为 _zt 后缀；2. 更新拼音映射；
#             3. 从源 TIF 重新裁剪宜良县；4. 发布新图层。
#@Usage   :   python ops/geo/geo_fix_yiliang_conflict.py
#@Deps    :   gdal, ogr, requests, json, os
#================================================================================

import os
import shutil
import json
os.environ["PROJ_DATA"] = r"C:\ProgramData\anaconda3\envs\soilmetal\Library\share\proj"
os.environ["PROJ_LIB"]  = r"C:\ProgramData\anaconda3\envs\soilmetal\Library\share\proj"
from osgeo import gdal, osr, ogr
import requests, time
gdal.UseExceptions()

ROOT    = r"D:\yunnan_CLCD_Data\clipped_regions"
SRC_DIR = r"D:\yunnan_CLCD_Data\CLCD_Province\yunnan"
SHP     = r"D:\【MapData】GIS数据集\2022年地市边界\2022县矢量.shp"
BASE    = "http://localhost:8080/geoserver/rest"
AUTH    = ("admin", "sMqq2TPR7kY75FN")
WS      = "WebGIS"
PINYIN_MAP_PATH = r"c:\projects\webgis\my_webgis_project\public\data\region_pinyin_map.json"

# ================================================================
# Step 1: 重命名彝良县(昭通) GeoServer 图层
# ================================================================
print("=" * 60)
print("STEP 1: 重命名彝良县 GeoServer 图层")
print("=" * 60)

old_store = "CLCD_TimeSeries_yiliangxian"
new_store = "CLCD_TimeSeries_yiliangxian_zt"
old_layer = "county_yiliangxian"
new_layer = "county_yiliangxian_zt"
old_dir = os.path.join(ROOT, "county_yiliangxian")
new_dir = os.path.join(ROOT, "county_yiliangxian_zt")

# 删除旧Store(purge=none)
r = requests.delete(f"{BASE}/workspaces/{WS}/coveragestores/{old_store}?recurse=true&purge=none", auth=AUTH)
print(f"  删除旧Store '{old_store}': HTTP {r.status_code}")
time.sleep(1)

# 也删除可能存在的新名Store
requests.delete(f"{BASE}/workspaces/{WS}/coveragestores/{new_store}?recurse=true&purge=none", auth=AUTH)
time.sleep(1)

# 重命名磁盘目录
if os.path.exists(new_dir):
    shutil.rmtree(new_dir)
os.rename(old_dir, new_dir)
print(f"  磁盘: {old_dir} -> {new_dir}")

# 清理旧索引文件
for f in os.listdir(new_dir):
    if not f.endswith(".tif") and f not in ["indexer.properties", "timeregex.properties"]:
        os.remove(os.path.join(new_dir, f))

# 写入mosaic配置
with open(os.path.join(new_dir, "indexer.properties"), "w") as f:
    f.write("TimeAttribute=time\nSchema=*the_geom:Polygon,location:String,time:java.util.Date\nPropertyCollectors=TimestampFileNameExtractorSPI[timeregex](time)\nNoData=0\n")
with open(os.path.join(new_dir, "timeregex.properties"), "w") as f:
    f.write("regex=[0-9]{8}\n")

# 创建新Store+Coverage
r_s = requests.post(f"{BASE}/workspaces/{WS}/coveragestores", auth=AUTH, json={
    "coverageStore": {"name": new_store, "type": "ImageMosaic", "workspace": WS,
                      "enabled": True, "url": f"file://{new_dir}"}
})
print(f"  创建Store '{new_store}': HTTP {r_s.status_code}")
time.sleep(4)

cv_url = f"{BASE}/workspaces/{WS}/coveragestores/{new_store}/coverages"
r_c = requests.post(cv_url, auth=AUTH, json={
    "coverage": {
        "name": new_layer, "title": "CLCD TimeSeries - yiliangxian_zt",
        "srs": "EPSG:4522", "projectionPolicy": "FORCE_DECLARED",
        "interpolationMethods": {"string": ["nearest neighbor", "bilinear", "bicubic"]},
        "defaultInterpolationMethod": "nearest neighbor",
        "parameters": {"entry": [
            {"string": "BackgroundValues", "null": ""},
            {"string": ["MergeBehavior", "FLAT"]},
            {"string": "AllowMultithreading", "boolean": False},
            {"string": "MaxAllowedTiles", "int": -1},
            {"string": ["OutputTransparentColor", "#000000"]},
            {"string": "RescalePixels", "boolean": False},
            {"string": ["FootprintBehavior", "None"]}
        ]},
        "dimensions": {"coverageDimension": {
            "name": "PALETTE_INDEX", "description": "GridSampleDimension[-Infinity,Infinity]",
            "range": {"min": "-inf", "max": "inf"}, "nullValues": {"double": 0},
            "dimensionType": {"name": "UNSIGNED_8BITS"}
        }},
        "metadata": {"entry": [
            {"@key": "elevation", "dimensionInfo": {"enabled": False}},
            {"@key": "time", "dimensionInfo": {
                "enabled": True, "presentation": "LIST", "units": "ISO8601",
                "defaultValue": {"strategy": "MAXIMUM"},
                "nearestMatchEnabled": False, "rawNearestMatchEnabled": False
            }},
            {"@key": "cachingEnabled", "$": "false"}
        ]}
    }
})
print(f"  创建Coverage '{new_layer}': HTTP {r_c.status_code}")
if r_c.status_code in [200, 201]:
    requests.put(f"{BASE}/layers/{WS}:{new_layer}", auth=AUTH,
                 json={"layer": {"defaultStyle": {"name": "raster"}}})
    print(f"  [OK] 彝良县图层已重命名为 {new_layer}")
else:
    print(f"  ERROR: {r_c.text[:300]}")

# ================================================================
# Step 2: 更新 region_pinyin_map.json
# ================================================================
print(f"\n{'=' * 60}")
print("STEP 2: 更新拼音映射")
print("=" * 60)

with open(PINYIN_MAP_PATH, "r", encoding="utf-8") as f:
    pm = json.load(f)

pm["彝良县"] = "yiliangxian_zt"
# 宜良县保持 yiliangxian 不变

with open(PINYIN_MAP_PATH, "w", encoding="utf-8") as f:
    json.dump(pm, f, ensure_ascii=False, indent=2)
print(f"  彝良县: yiliangxian -> yiliangxian_zt")
print(f"  宜良县: yiliangxian (保持不变)")

# ================================================================
# Step 3: 从源TIF裁剪宜良县
# ================================================================
print(f"\n{'=' * 60}")
print("STEP 3: 从源TIF裁剪宜良县并重投影到EPSG:4522")
print("=" * 60)

yiliang_dir = os.path.join(ROOT, "county_yiliangxian")
if os.path.exists(yiliang_dir):
    shutil.rmtree(yiliang_dir)
os.makedirs(yiliang_dir)

# 获取源TIF WKT
src_ds = gdal.Open(os.path.join(SRC_DIR, "CLCD_19850101.tif"))
src_wkt = src_ds.GetProjection()
src_ds = None

# 获取目标CRS WKT (从泸水市)
lu_ds = gdal.Open(os.path.join(ROOT, "county_lushuishi", "CLCD_19850101.tif"))
dst_wkt = lu_ds.GetProjection()
lu_ds = None

# 获取宜良县的经纬度范围
ds_shp = ogr.Open(SHP)
layer = ds_shp.GetLayer()
yi_env = None
for feat in layer:
    if feat.GetField("县级") == "宜良县":
        geom = feat.GetGeometryRef()
        yi_env = geom.GetEnvelope()
        print(f"  宜良县边界: lon={yi_env[0]:.4f}~{yi_env[1]:.4f}, lat={yi_env[2]:.4f}~{yi_env[3]:.4f}")
        break
ds_shp = None

if yi_env is None:
    print("  [ERROR] 未找到宜良县！尝试使用预设范围...")
    yi_env = (102.8, 103.3, 24.3, 25.0)

# 用矩形裁剪+重投影（比cutline快很多）
src_tifs = sorted([f for f in os.listdir(SRC_DIR) if f.endswith(".tif")])
print(f"  开始裁剪 {len(src_tifs)} 个源TIF...")
for i, tif_name in enumerate(src_tifs):
    src_path = os.path.join(SRC_DIR, tif_name)
    dst_path = os.path.join(yiliang_dir, tif_name)
    warp_opts = gdal.WarpOptions(
        srcSRS=src_wkt,
        dstSRS=dst_wkt,
        outputBounds=[yi_env[0] - 0.05, yi_env[2] - 0.05, yi_env[1] + 0.05, yi_env[3] + 0.05],
        outputBoundsSRS="EPSG:4326",
        resampleAlg="near",
        format="GTiff",
        creationOptions=["COMPRESS=LZW", "TILED=YES"],
    )
    gdal.Warp(dst_path, src_path, options=warp_opts)
    if (i + 1) % 10 == 0 or i == 0:
        print(f"  [{i+1}/{len(src_tifs)}]")

# 验证
result_tifs = sorted([f for f in os.listdir(yiliang_dir) if f.endswith(".tif")])
ds = gdal.Open(os.path.join(yiliang_dir, result_tifs[0]))
gt = ds.GetGeoTransform()
srs = osr.SpatialReference()
srs.ImportFromWkt(ds.GetProjection())
w, h = ds.RasterXSize, ds.RasterYSize
ds = None
print(f"  裁剪完成: {len(result_tifs)} TIF, EPSG={srs.GetAuthorityCode(None)}")

# 写入mosaic配置
with open(os.path.join(yiliang_dir, "indexer.properties"), "w") as f:
    f.write("TimeAttribute=time\nSchema=*the_geom:Polygon,location:String,time:java.util.Date\nPropertyCollectors=TimestampFileNameExtractorSPI[timeregex](time)\nNoData=0\n")
with open(os.path.join(yiliang_dir, "timeregex.properties"), "w") as f:
    f.write("regex=[0-9]{8}\n")

# ================================================================
# Step 4: 为宜良县创建GeoServer图层
# ================================================================
print(f"\n{'=' * 60}")
print("STEP 4: 为宜良县创建GeoServer图层")
print("=" * 60)

yl_store = "CLCD_TimeSeries_yiliangxian"
yl_layer = "county_yiliangxian"

requests.delete(f"{BASE}/workspaces/{WS}/coveragestores/{yl_store}?recurse=true&purge=none", auth=AUTH)
time.sleep(1)

r_s2 = requests.post(f"{BASE}/workspaces/{WS}/coveragestores", auth=AUTH, json={
    "coverageStore": {"name": yl_store, "type": "ImageMosaic", "workspace": WS,
                      "enabled": True, "url": f"file://{yiliang_dir}"}
})
print(f"  创建Store: HTTP {r_s2.status_code}")
time.sleep(4)

cv_url2 = f"{BASE}/workspaces/{WS}/coveragestores/{yl_store}/coverages"
r_c2 = requests.post(cv_url2, auth=AUTH, json={
    "coverage": {
        "name": yl_layer, "title": "CLCD TimeSeries - yiliangxian (Kunming)",
        "srs": "EPSG:4522", "projectionPolicy": "FORCE_DECLARED",
        "interpolationMethods": {"string": ["nearest neighbor", "bilinear", "bicubic"]},
        "defaultInterpolationMethod": "nearest neighbor",
        "parameters": {"entry": [
            {"string": "BackgroundValues", "null": ""},
            {"string": ["MergeBehavior", "FLAT"]},
            {"string": "AllowMultithreading", "boolean": False},
            {"string": "MaxAllowedTiles", "int": -1},
            {"string": ["OutputTransparentColor", "#000000"]},
            {"string": "RescalePixels", "boolean": False},
            {"string": ["FootprintBehavior", "None"]}
        ]},
        "dimensions": {"coverageDimension": {
            "name": "PALETTE_INDEX", "description": "GridSampleDimension[-Infinity,Infinity]",
            "range": {"min": "-inf", "max": "inf"}, "nullValues": {"double": 0},
            "dimensionType": {"name": "UNSIGNED_8BITS"}
        }},
        "metadata": {"entry": [
            {"@key": "elevation", "dimensionInfo": {"enabled": False}},
            {"@key": "time", "dimensionInfo": {
                "enabled": True, "presentation": "LIST", "units": "ISO8601",
                "defaultValue": {"strategy": "MAXIMUM"},
                "nearestMatchEnabled": False, "rawNearestMatchEnabled": False
            }},
            {"@key": "cachingEnabled", "$": "false"}
        ]}
    }
})
print(f"  创建Coverage: HTTP {r_c2.status_code}")
if r_c2.status_code in [200, 201]:
    requests.put(f"{BASE}/layers/{WS}:{yl_layer}", auth=AUTH,
                 json={"layer": {"defaultStyle": {"name": "raster"}}})
    time.sleep(2)
    rc = requests.get(f"{cv_url2}/{yl_layer}.json", auth=AUTH)
    if rc.status_code == 200:
        lb = rc.json()["coverage"].get("latLonBoundingBox", {})
        print(f"\n[OK] 宜良县图层发布成功！")
        print(f"  latLon: {lb.get('minx'):.4f}~{lb.get('maxx'):.4f}, {lb.get('miny'):.4f}~{lb.get('maxy'):.4f}")
        print(f"  (应约 lon 102.8~103.3, lat 24.3~25.0)")
else:
    print(f"  ERROR: {r_c2.text[:400]}")

print(f"\n{'=' * 60}")
print("完成！请刷新前端验证昆明市。")
