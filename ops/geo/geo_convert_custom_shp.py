"""
================================================================================
@File    :   geo_convert_custom_shp.py
@Desc    :   将 2022 年县级矢量（SHP）转换为前端 GeoJSON 边界。支持：
             1. 生成所有县级边界 FeatureCollection；
             2. 基于行政区划字段 Dissolve 融合生成地级和省级边界。
@Usage   :   python ops/geo_convert_custom_shp.py
@Deps    :   pyshp (shapefile), shapely, json
================================================================================
"""
import shapefile
import json
import os
from shapely.geometry import shape, mapping
from shapely.ops import unary_union

# Paths (Using absolute paths for Windows stability)
SHP_PATH = r'c:\projects\webgis\my_webgis_project\public\data\yunan_boundary_SHP\2022县矢量.shp'
OUTPUT_DIR = r'c:\projects\webgis\my_webgis_project\public\data'

# Output Files (Overwrite existing project boundaries)
COUNTY_FILE = os.path.join(OUTPUT_DIR, 'yunnan_all_counties.geojson')
CITY_FILE = os.path.join(OUTPUT_DIR, 'yunnan_cities_boundary.geo.json')
PROVINCE_FILE = os.path.join(OUTPUT_DIR, 'yunnan_boundary.geo.json')

def convert():
    if not os.path.exists(SHP_PATH):
        print(f"Error: SHP file not found at {SHP_PATH}")
        return

    print(f"Reading SHP: {SHP_PATH}")
    # Attempt to read SHP. pyshp usually auto-detects, but on Win it's often GBK
    try:
        sf = shapefile.Reader(SHP_PATH, encoding='gbk')
        fields = [f[0] for f in sf.fields[1:]]
        # Test a record
        _ = sf.record(0)
    except:
        sf = shapefile.Reader(SHP_PATH, encoding='utf-8')
        fields = [f[0] for f in sf.fields[1:]]

    print(f"Fields found: {fields}")
    
    all_yunnan_features = []
    cities_geoms = {} # city_name -> list of shapely geoms
    city_codes = {}   # city_name -> adcode
    
    possible_province_names = ['云南省', '云南']
    
    count = 0
    # Search for Yunnan features
    for sr in sf.shapeRecords():
        record = sr.record
        row_dict = dict(zip(fields, record))
        
        province_name = str(row_dict.get('省级', ''))
        
        if province_name in possible_province_names:
            # Convert pyshp shape to shapely geometry
            geom = shape(sr.shape.__geo_interface__)
            
            county_name = str(row_dict.get('县级', ''))
            county_code = row_dict.get('县级码', 0)
            city_name = str(row_dict.get('地级', ''))
            city_code = row_dict.get('地级码', 0)
            
            # 1. County GeoJSON Feature
            feature = {
                "type": "Feature",
                "properties": {
                    "name": county_name,
                    "adcode": county_code,
                    "parent": {
                        "name": city_name,
                        "adcode": city_code
                    }
                },
                "geometry": mapping(geom)
            }
            all_yunnan_features.append(feature)
            
            # 2. Aggregate for City Dissolve
            if city_name not in cities_geoms:
                cities_geoms[city_name] = []
                city_codes[city_name] = city_code
            cities_geoms[city_name].append(geom)
            
            count += 1
            if count % 20 == 0:
                print(f"  Processed {count} counties...")

    print(f"Total Yunnan features found: {count}")
    if count == 0:
        print("Warning: No Yunnan features found. Check '省级' field values.")
        return

    # A. Write yunnan_all_counties.geojson
    with open(COUNTY_FILE, 'w', encoding='utf-8') as f:
        json.dump({"type": "FeatureCollection", "features": all_yunnan_features}, f, ensure_ascii=False)
    print(f"Successfully created: {COUNTY_FILE}")
    
    # B. Dissolve to Cities
    city_features = []
    province_geoms = []
    print("Dissolving city boundaries...")
    for city_name, geoms in cities_geoms.items():
        unified = unary_union(geoms)
        city_features.append({
            "type": "Feature",
            "properties": { 
                "name": city_name,
                "adcode": city_codes[city_name]
            },
            "geometry": mapping(unified)
        })
        province_geoms.append(unified)
        
    with open(CITY_FILE, 'w', encoding='utf-8') as f:
        json.dump({"type": "FeatureCollection", "features": city_features}, f, ensure_ascii=False)
    print(f"Successfully created: {CITY_FILE}")
    
    # C. Dissolve to Province
    print("Dissolving provincial boundary...")
    province_unified = unary_union(province_geoms)
    with open(PROVINCE_FILE, 'w', encoding='utf-8') as f:
        json.dump({
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "properties": { "name": "云南省", "adcode": 530000 },
                "geometry": mapping(province_unified)
            }]
        }, f, ensure_ascii=False)
    print(f"Successfully created: {PROVINCE_FILE}")

if __name__ == "__main__":
    convert()
