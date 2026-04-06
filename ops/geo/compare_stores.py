import requests
import json

GEOSERVER_URL = "http://localhost:8080/geoserver/rest"
USER = "admin"
PASS = "sMqq2TPR7kY75FN"

def get_store(store):
    url = f"{GEOSERVER_URL}/workspaces/WebGIS/coveragestores/{store}.json"
    res = requests.get(url, auth=(USER, PASS))
    if res.status_code == 200:
        return res.json()
    return f"Error: {res.status_code}"

manual_store = get_store("AAA")
auto_store = get_store("CLCD_TimeSeries_anningshi")

with open('compare_stores.json', 'w', encoding='utf-8') as f:
    json.dump({"manual": manual_store, "auto": auto_store}, f, indent=2, ensure_ascii=False)

print("Done comparing stores. Check compare_stores.json")
