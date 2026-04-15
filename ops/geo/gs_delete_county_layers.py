"""
================================================================================
@File    :   gs_delete_county_layers.py
@Desc    :   全量删除 GeoServer 中所有县域图层及数据源的批量维护工具。主要用于 
             重构发布逻辑后的环境清理。
@Usage   :   python ops/geo/gs_delete_county_layers.py
@Deps    :   requests
================================================================================
"""
import requests
import sys

GEOSERVER_URL = "http://localhost:8080/geoserver/rest"
USER = "admin"
PASS = "sMqq2TPR7kY75FN"
WORKSPACE = "WebGIS"

def get_all_stores():
    url = f"{GEOSERVER_URL}/workspaces/{WORKSPACE}/coveragestores.json"
    res = requests.get(url, auth=(USER, PASS))
    if res.status_code == 200:
        data = res.json()
        if "coverageStores" in data and "coverageStore" in data["coverageStores"]:
            return [store["name"] for store in data["coverageStores"]["coverageStore"]]
    return []

def delete_store(store_name):
    # recurse=true deletes the layers attached to the store
    url = f"{GEOSERVER_URL}/workspaces/{WORKSPACE}/coveragestores/{store_name}?recurse=true"
    res = requests.delete(url, auth=(USER, PASS))
    if res.status_code == 200:
        print(f"Deleted: {store_name}")
    else:
        print(f"Failed to delete {store_name}: {res.status_code}")

def run():
    stores = get_all_stores()
    print(f"Found {len(stores)} stores in workspace {WORKSPACE}")
    county_stores = [s for s in stores if "county_" in s or "CLCD_TimeSeries_" in s]
    print(f"Found {len(county_stores)} county stores to delete...")
    
    for store in county_stores:
        delete_store(store)
        
    print("Deletion complete.")

if __name__ == "__main__":
    run()
