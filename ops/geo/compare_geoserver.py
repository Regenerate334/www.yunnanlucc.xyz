import requests
import json

GEOSERVER_URL = "http://localhost:8080/geoserver/rest"
USER = "admin"
PASS = "sMqq2TPR7kY75FN"
WORKSPACE = "WebGIS"

WORKING_STORE = "AAA"
WORKING_COVERAGE = "CLCD_AAA"
BROKEN_STORE = "CLCD_TimeSeries_anningshi"
BROKEN_COVERAGE = "county_anningshi"

def fetch_json(endpoint):
    url = f"{GEOSERVER_URL}/{endpoint}.json"
    res = requests.get(url, auth=(USER, PASS))
    if res.status_code == 200:
        return res.json()
    else:
        print(f"Error fetching {url}: {res.status_code}")
        return None

def run():
    print(f"Fetching Working Config ({WORKING_STORE})...")
    working_store = fetch_json(f"workspaces/{WORKSPACE}/coveragestores/{WORKING_STORE}")
    working_coverage = fetch_json(f"workspaces/{WORKSPACE}/coveragestores/{WORKING_STORE}/coverages/{WORKING_COVERAGE}")
    working_layer = fetch_json(f"layers/{WORKSPACE}:{WORKING_COVERAGE}")

    print(f"Fetching Broken Config ({BROKEN_STORE})...")
    broken_store = fetch_json(f"workspaces/{WORKSPACE}/coveragestores/{BROKEN_STORE}")
    broken_coverage = fetch_json(f"workspaces/{WORKSPACE}/coveragestores/{BROKEN_STORE}/coverages/{BROKEN_COVERAGE}")
    broken_layer = fetch_json(f"layers/{WORKSPACE}:{BROKEN_COVERAGE}")

    with open("c:/projects/webgis/my_webgis_project/ops/geo/working_config.json", "w", encoding="utf-8") as f:
        json.dump(working_coverage, f, indent=4)
    with open("c:/projects/webgis/my_webgis_project/ops/geo/broken_config.json", "w", encoding="utf-8") as f:
        json.dump(broken_coverage, f, indent=4)
    
    print("\nFiles 'working_config.json' and 'broken_config.json' created.")

if __name__ == "__main__":
    run()
