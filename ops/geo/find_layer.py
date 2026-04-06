import requests

GEOSERVER_URL = "http://localhost:8080/geoserver/rest"
USER = "admin"
PASS = "sMqq2TPR7kY75FN"

def run():
    layers_url = f"{GEOSERVER_URL}/layers.json"
    r = requests.get(layers_url, auth=(USER, PASS))
    if r.status_code != 200:
        print(f"Failed to list layers: {r.status_code}")
        return

    layers = r.json()["layers"]["layer"]
    for layer in layers:
        if "CLCD_AAA" in layer["name"]:
            print(f"FOUND LAYER: {layer['name']}")
            # Fetch details to find the resource/store
            rd = requests.get(layer["href"], auth=(USER, PASS)).json()
            resource = rd["layer"]["resource"]
            print(f"Resource: {resource}")
            return
    print("Layer CLCD_AAA not found.")

if __name__ == "__main__":
    run()
