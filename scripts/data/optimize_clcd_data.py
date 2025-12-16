#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
优化CLCD统计数据表格
- 统一数据格式为长表
- 规范化字段命名
- 转换单位（平方米 → 平方公里）
- 导出为JSON格式
"""

import pandas as pd
import json
import os
from pathlib import Path

# 土地利用类型映射（VALUE_1-9 到语义化字段名）
LAND_USE_MAPPING = {
    'VALUE_1': 'cropland',
    'VALUE_2': 'forest',
    'VALUE_3': 'grassland',
    'VALUE_4': 'shrubland',
    'VALUE_5': 'wetland',
    'VALUE_6': 'water',
    'VALUE_7': 'tundra',
    'VALUE_8': 'impervious',
    'VALUE_9': 'bareland'
}

# 文件路径
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / 'public' / 'data'

INPUT_FILES = {
    'province': DATA_DIR / 'CLCD_Sta_Province.xlsx',
    'prefecture': DATA_DIR / 'CLCD_Sta_Prefeature.xlsx',
    'county': DATA_DIR / 'CLCD_Sta_County.xlsx'
}

OUTPUT_FILES = {
    'province': DATA_DIR / 'clcd_province.json',
    'prefecture': DATA_DIR / 'clcd_prefecture.json',
    'county': DATA_DIR / 'clcd_county.json'
}


def sqm_to_sqkm(value):
    """平方米转平方公里，保留2位小数"""
    return round(value / 1_000_000, 2) if pd.notna(value) else 0


def process_province_data(filepath):
    """处理省级数据：从宽表转为长表"""
    print(f"处理省级数据: {filepath}")
    
    # 读取Excel
    df = pd.read_excel(filepath)
    
    # 获取年份列（除第一列外的所有列）
    year_columns = [col for col in df.columns if col != 'Land_use_type']
    
    # 数据重塑：宽表 → 长表
    records = []
    for year in year_columns:
        year_data = {
            'level': 'province',
            'region_code': '53',  # 云南省代码
            'region_name': '云南省',
            'year': int(year)
        }
        
        # 提取9种土地类型的面积
        for i, land_type in enumerate(LAND_USE_MAPPING.values(), start=1):
            # Land_use_type 列中，i 代表第 i 种土地类型
            value = df[df['Land_use_type'] == i][year].values
            if len(value) > 0:
                year_data[land_type] = sqm_to_sqkm(value[0])
            else:
                year_data[land_type] = 0
        
        year_data['unit'] = 'km²'
        records.append(year_data)
    
    print(f"  ✓ 转换完成: {len(records)} 条记录")
    return records


def process_prefecture_data(filepath):
    """处理地级市数据"""
    print(f"处理地级市数据: {filepath}")
    
    df = pd.read_excel(filepath)
    
    records = []
    for _, row in df.iterrows():
        record = {
            'level': 'prefecture',
            'region_code': str(row['OBJECTID']),
            'region_name': row['地级市'],
            'year': int(row['year'])
        }
        
        # 转换字段名并单位转换
        for old_name, new_name in LAND_USE_MAPPING.items():
            record[new_name] = sqm_to_sqkm(row[old_name])
        
        record['unit'] = 'km²'
        records.append(record)
    
    print(f"  ✓ 转换完成: {len(records)} 条记录")
    return records


def process_county_data(filepath):
    """处理县级数据"""
    print(f"处理县级数据: {filepath}")
    
    df = pd.read_excel(filepath)
    
    records = []
    for _, row in df.iterrows():
        record = {
            'level': 'county',
            'region_code': str(row['OBJECTID *']),
            'region_name': row['地名'],
            'year': int(row['year'])
        }
        
        # 转换字段名并单位转换
        for old_name, new_name in LAND_USE_MAPPING.items():
            record[new_name] = sqm_to_sqkm(row[old_name])
        
        record['unit'] = 'km²'
        records.append(record)
    
    print(f"  ✓ 转换完成: {len(records)} 条记录")
    return records


def save_to_json(data, filepath):
    """保存为JSON文件"""
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  ✓ 已保存: {filepath}")


def validate_data(records, level_name):
    """验证数据完整性"""
    print(f"\n验证 {level_name} 数据:")
    
    df = pd.DataFrame(records)
    
    # 检查年份范围
    min_year = df['year'].min()
    max_year = df['year'].max()
    unique_years = df['year'].nunique()
    print(f"  年份范围: {min_year}-{max_year} ({unique_years} 个年份)")
    
    # 检查区域数量
    unique_regions = df['region_name'].nunique()
    print(f"  区域数量: {unique_regions}")
    
    # 检查缺失值
    land_use_cols = list(LAND_USE_MAPPING.values())
    missing_count = df[land_use_cols].isna().sum().sum()
    print(f"  缺失值: {missing_count}")
    
    # 统计总面积
    total_area = df[land_use_cols].sum().sum()
    print(f"  总面积: {total_area:,.2f} km²")
    
    return True


def main():
    print("=" * 60)
    print("CLCD 数据优化处理")
    print("=" * 60)
    
    # 确保输出目录存在
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    # 处理省级数据
    print("\n[1/3] 省级数据")
    province_data = process_province_data(INPUT_FILES['province'])
    save_to_json(province_data, OUTPUT_FILES['province'])
    validate_data(province_data, '省级')
    
    # 处理地级市数据
    print("\n[2/3] 地级市数据")
    prefecture_data = process_prefecture_data(INPUT_FILES['prefecture'])
    save_to_json(prefecture_data, OUTPUT_FILES['prefecture'])
    validate_data(prefecture_data, '地级市')
    
    # 处理县级数据
    print("\n[3/3] 县级数据")
    county_data = process_county_data(INPUT_FILES['county'])
    save_to_json(county_data, OUTPUT_FILES['county'])
    validate_data(county_data, '县级')
    
    print("\n" + "=" * 60)
    print("✓ 所有数据处理完成！")
    print("=" * 60)
    print(f"\n输出文件:")
    for name, filepath in OUTPUT_FILES.items():
        file_size = filepath.stat().st_size / 1024
        print(f"  - {filepath.name}: {file_size:.1f} KB")


if __name__ == '__main__':
    main()
