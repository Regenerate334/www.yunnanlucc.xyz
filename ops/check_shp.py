import shapefile
import os

shp_path = r'c:\projects\webgis\my_webgis_project\public\data\yunan_boundary_SHP\2022县矢量.shp'

try:
    sf = shapefile.Reader(shp_path)
    print(f"SHP Path: {shp_path}")
    print(f"Number of shapes: {len(sf.shapes())}")
    print(f"Fields: {[f[0] for f in sf.fields]}")
    
    # Print first few records
    records = sf.records()
    for i in range(min(10, len(records))):
        print(f"Record {i}: {records[i]}")

except Exception as e:
    print(f"Error reading SHP: {e}")
