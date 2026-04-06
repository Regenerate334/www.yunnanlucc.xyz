import requests

GEOSERVER_URL = "http://localhost:8080/geoserver/rest"
USER = "admin"
PASS = "sMqq2TPR7kY75FN"

def run():
    workspaces_url = f"{GEOSERVER_URL}/workspaces.json"
    r = requests.get(workspaces_url, auth=(USER, PASS))
    if r.status_code != 200:
        print(f"Failed to list workspaces: {r.status_code}")
        return

    workspaces = r.json()["workspaces"]["workspace"]
    for ws in workspaces:
        ws_name = ws["name"]
        stores_url = f"{GEOSERVER_URL}/workspaces/{ws_name}/coveragestores.json"
        rs = requests.get(stores_url, auth=(USER, PASS))
        if rs.status_code == 200:
            data = rs.json()
            if "coverageStores" in data and "coverageStore" in data["coverageStores"]:
                for s in data["coverageStores"]["coverageStore"]:
                    if "CLCD_AAA" in s["name"]:
                        print(f"FOUND: Workspace={ws_name}, Store={s['name']}")
                        return
    print("CLCD_AAA not found in any workspace.")

if __name__ == "__main__":
    run()
