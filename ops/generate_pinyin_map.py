import json
import os
from pypinyin import pinyin, Style

def get_pinyin(text):
    """将中文转换为拼音，去除空格"""
    # 按照 ops/standardize_data_for_geoserver.py 的逻辑，保留后缀以匹配已发布的图层名
    py_list = pinyin(text, style=Style.NORMAL)
    return "".join([item[0] for item in py_list]).replace(" ", "")

def generate_map():
    counties_path = r'c:\projects\webgis\my_webgis_project\public\data\yunnan_all_counties.geojson'
    cities_path = r'c:\projects\webgis\my_webgis_project\public\data\yunnan_cities_boundary.geo.json'
    output_path = r'c:\projects\webgis\my_webgis_project\public\data\region_pinyin_map.json'

    mapping = {}

    # 处理地级市
    if os.path.exists(cities_path):
        with open(cities_path, 'r', encoding='utf-8') as f:
            cities_data = json.load(f)
            for feature in cities_data['features']:
                name = feature['properties'].get('name', '')
                fullname = feature['properties'].get('fullname', '')
                # 这里优先使用 properties 自带的 pinyin (如果有)
                py = feature['properties'].get('pinyin', get_pinyin(name))
                if name: mapping[name] = py
                if fullname: mapping[fullname] = py

    # 处理县级
    if os.path.exists(counties_path):
        with open(counties_path, 'r', encoding='utf-8') as f:
            counties_data = json.load(f)
            for feature in counties_data['features']:
                p = feature['properties']
                # 兼容不同的属性名
                name = p.get('name') or p.get('NAME') or p.get('COUNTY') or ''
                fullname = p.get('fullname') or ''
                if name:
                    py = get_pinyin(name)
                    mapping[name] = py
                if fullname:
                    py = get_pinyin(fullname)
                    mapping[fullname] = py

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(mapping, f, ensure_ascii=False, indent=2)
    
    print(f"成功生成拼音映射表: {output_path}")

if __name__ == "__main__":
    generate_map()
