import os

def clean_arcgis_extra_files(root_dir, dry_run=False):
    """
    清理指定目录下除了 .tif 以外的所有文件。
    :param root_dir: 根目录路径
    :param dry_run: 如果为 True，则仅列出将要删除的文件而不真正删除
    """
    print(f"正在扫描目录: {root_dir}")
    print(f"模式: {'[演练] (仅打印列表)' if dry_run else '[执行] (永久删除)'}")
    print("-" * 50)

    count = 0
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            # 检查文件后缀
            if not file.lower().endswith('.tif'):
                file_path = os.path.join(root, file)
                if dry_run:
                    print(f"将要删除: {file_path}")
                else:
                    try:
                        os.remove(file_path)
                        print(f"已删除: {file_path}")
                    except Exception as e:
                        print(f"无法删除 {file_path}: {e}")
                count += 1

    print("-" * 50)
    if dry_run:
        print(f"扫描完成。共预估清除 {count} 个文件。")
    else:
        print(f"清理完成。共删除了 {count} 个文件。")

if __name__ == "__main__":
    # 配置目标目录
    TARGET_PATH = r"D:\yunnan_CLCD_Data\clipped_regions"
    
    # 按照用户确认，执行物理删除 (dry_run=False)
    clean_arcgis_extra_files(TARGET_PATH, dry_run=False)