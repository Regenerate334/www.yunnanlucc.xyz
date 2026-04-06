import requests
import os
import time

# --- 配置区 ---
GEOSERVER_URL = "http://localhost:8080/geoserver/rest"
USER = "admin"
PASS = "sMqq2TPR7kY75FN"
WORKSPACE = "WebGIS"
ROOT_DIR = "D:/yunnan_CLCD_Data/clipped_regions"

SLD_FILE = r"C:\projects\webgis\my_webgis_project\geoserver_styles\clcd_standard.sld"
STYLE_NAME = "clcd_standard"

def upload_sld():
    print(f"\\n正在上传样式 {STYLE_NAME} ...")
    with open(SLD_FILE, 'r', encoding='utf-8') as f:
        sld_content = f.read()
    
    # 1. 创建样式元数据 (如果不存在)
    headers_xml = {'Content-Type': 'application/xml'}
    style_xml = f"<style><name>{STYLE_NAME}</name><filename>{STYLE_NAME}.sld</filename></style>"
    requests.post(f"{GEOSERVER_URL}/workspaces/{WORKSPACE}/styles", auth=(USER, PASS), headers=headers_xml, data=style_xml)
    
    # 2. 上传 SLD 内容
    headers_sld = {'Content-Type': 'application/vnd.ogc.sld+xml'}
    res = requests.put(f"{GEOSERVER_URL}/workspaces/{WORKSPACE}/styles/{STYLE_NAME}", auth=(USER, PASS), headers=headers_sld, data=sld_content.encode('utf-8'))
    if res.status_code in [200, 201]:
        print("  [Success] 样式上传成功。")
    else:
        print(f"  [Warning] 样式上传可能已存在或失败: {res.status_code}")

def get_all_counties():
    return [f for f in os.listdir(ROOT_DIR) if os.path.isdir(os.path.join(ROOT_DIR, f)) and f.startswith("county_")]

def publish_county_mosaic(county_folder):
    pinyin = county_folder.replace("county_", "")
    store_name = f"CLCD_TimeSeries_{pinyin}"
    layer_name = county_folder
    data_path = f"file://{ROOT_DIR}/{county_folder}"

    # 1. 确保工作空间
    requests.post(f"{GEOSERVER_URL}/workspaces", auth=(USER, PASS), json={"workspace": {"name": WORKSPACE}})

    # 2. Store
    cs_url = f"{GEOSERVER_URL}/workspaces/{WORKSPACE}/coveragestores"
    cs_payload = {"coverageStore": {"name": store_name, "type": "ImageMosaic", "workspace": WORKSPACE, "enabled": True, "url": data_path}}
    requests.post(cs_url, auth=(USER, PASS), json=cs_payload)
    
    # 3. Coverage (Layer Resource)
    cv_url = f"{GEOSERVER_URL}/workspaces/{WORKSPACE}/coveragestores/{store_name}/coverages"
    cv_payload = {
        "coverage": {
            "name": layer_name,
            "title": f"CLCD TimeSeries - {pinyin}",
            "srs": "EPSG:4522",
            "projectionPolicy": "FORCE_DECLARED",
            "interpolationMethods": {"string": ["nearest neighbor", "bilinear", "bicubic"]},
            "defaultInterpolationMethod": "nearest neighbor",
            "parameters": {"entry": [
                {"string": "BackgroundValues", "null": ""},
                {"string": ["OVERVIEW_POLICY", "QUALITY"]},
                {"string": ["MergeBehavior", "FLAT"]},
                # 布尔值/整型值必须使用正确的JSON类型，而非字符串，否则GeoServer会忽略
                {"string": "AllowMultithreading", "boolean": False},
                {"string": "MaxAllowedTiles", "int": -1},
                {"string": ["ExcessGranuleRemoval", "NONE"]},
                # 透明颜色值必须包含 # 前缀，否则GeoServer无法识别
                {"string": ["OutputTransparentColor", "#000000"]},
                # 正确的键名是 USE_IMAGEN_IMAGEREAD，不是 USE_JAI_IMAGEREAD
                {"string": "USE_IMAGEN_IMAGEREAD", "boolean": True},
                {"string": "Bands", "null": ""},
                # CLCD 是固定分类值(0-9)的调色板索引栅格，禁止动态拉伸
                # RescalePixels=True 会导致 SLD type="values" 找不到精确匹配 → 全白
                {"string": "RescalePixels", "boolean": False},
                {"string": "Filter", "null": ""},
                # 手动发布版本中额外有 SkipDuplicates 参数
                {"string": "SkipDuplicates", "boolean": False},
                {"string": ["InputTransparentColor", "#000000"]},
                {"string": ["SUGGESTED_TILE_SIZE", "512,512"]},
                {"string": "Accurate resolution computation", "boolean": False},
                # 手动发布版本中额外有 SORTING 参数
                {"string": "SORTING", "null": ""},
                {"string": ["FootprintBehavior", "None"]}
            ]},
            "dimensions": {
                "coverageDimension": {
                    "name": "PALETTE_INDEX",
                    "description": "GridSampleDimension[-Infinity,Infinity]",
                    # 补充 range 字段，与手动发布一致
                    "range": {"min": "-inf", "max": "inf"},
                    "nullValues": {"double": 0},
                    "dimensionType": {"name": "UNSIGNED_8BITS"}
                }
            },
            # metadata.entry 必须是数组，且包含 elevation 禁用维度条目
            "metadata": {"entry": [
                {"@key": "elevation", "dimensionInfo": {"enabled": False}},
                {"@key": "time", "dimensionInfo": {
                    "enabled": True,
                    "presentation": "LIST",
                    "units": "ISO8601",
                    "defaultValue": {"strategy": "MAXIMUM"},
                    "nearestMatchEnabled": False,
                    "rawNearestMatchEnabled": False,
                    "startValue": "",
                    "endValue": ""
                }},
                {"@key": "cachingEnabled", "$": "false"}
            ]}
        }
    }
    requests.post(cv_url, auth=(USER, PASS), json=cv_payload)
    requests.put(f"{cv_url}/{layer_name}", auth=(USER, PASS), json=cv_payload)
    
    # 4. 设置默认样式
    # CLCD TIF 文件内嵌调色板，GeoServer 的默认 'raster' 样式能直接正确渲染颜色
    # 自定义 SLD 的 type="values" 与调色板数据冲突，会导致全图透明（白屏）
    layer_url = f"{GEOSERVER_URL}/layers/{WORKSPACE}:{layer_name}"
    layer_payload = {
        "layer": {
            "defaultStyle": {"name": "raster"}  # 与手动发布 AAA 一致，直接使用皮肤自带调色板
        }
    }
    requests.put(layer_url, auth=(USER, PASS), json=layer_payload)
    
    # 5. 强制重计范围
    requests.put(f"{cv_url}/{layer_name}?recalculate=nativebbox,latlonbbox", auth=(USER, PASS), json={})
    
    return True

if __name__ == "__main__":
    upload_sld()
    counties = sorted(get_all_counties())
    print(f"\\n开始全量同步 128 个县域图层 (配置 + 样式)...")
    success_count = 0
    for i, county in enumerate(counties):
        print(f"[{i+1}/{len(counties)}] 正在校准: {county}", end="\\r")
        if publish_county_mosaic(county):
            success_count += 1
    print(f"\\n完成！已应用样式并重新校准 {success_count} 个县域。")
