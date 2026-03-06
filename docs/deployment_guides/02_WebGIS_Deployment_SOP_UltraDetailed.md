# WebGIS 生产环境实施标准作业程序 (SOP) - 保姆级超详版

> **特别警告**：本演练手册没有任何可省略的步骤。请严格按照 1、2、3 的顺序依次执行。任何提前执行或跳过步骤都将导致极其严重的部署失败或数据异常。本教程假设目标云服务器系统为 **Ubuntu 22.04 LTS**。

---

## 第一阶段：本地 Windows 电脑侧（打包数据）

本阶段目标：在您的 Windows 本地，生成用于带去云服务器的行李包裹。

### 1.1 高压缩导出 PostGIS 空间数据库
1. 在您的 Windows 电脑上按下键盘 `Win + R`，输入 `cmd`，按回车键打开命令行黑窗口。
2. 假设您打算把备份保存在 D 盘根目录，依次输入以下命令并回车：
```cmd
D:
cd \
set PGPASSWORD=password
"C:\Program Files\PostgreSQL\15\bin\pg_dump.exe" -U postgres -h localhost -p 5432 -F c -b -v -f "D:\yunnan_CLCD_backup.dump" yunnan_CLCD
```
*(注意：请检查您的 PostgreSQL 安装路径是否为 `C:\Program Files\PostgreSQL\15\bin`，如不同请替换为实际路径。这一步会生成一个叫 `yunnan_CLCD_backup.dump` 的文件，这是压缩最高的数据文件，进度跑完代表备份成功)。*

### 1.2 打包 GeoServer 配置数据文件夹
1. 打开“我的电脑/文件资源管理器”。
2. 导航至 `E:\GeoServer\`。
3. 找到名为 `GerServer_Data` 的文件夹。
4. 右键点击该文件夹 -> 选择“发送到” -> “压缩(zipped) 文件夹”。
5. 这将生成一个 `GerServer_Data.zip` 压缩包文件。把它复制到 D 盘根目录与刚才的数据库合并放置。

### 1.3 梳理巨型 TIF 数据文件
确认您的 `E:\yunnan_CLCD_data` 文件夹存在。它不需要压缩，包含 70GB 原文件，稍后将直接上传服务器。

---

## 第二阶段：云服务器侧 - 基础设施与磁盘挂载

本阶段目标：初始化全新的 Ubuntu 系统服务器，激活一块至少 100GB 的空数据盘。

### 2.1 登录云服务器并初始化环境
使用 Xshell 或系统自带 SSH 终端，使用管理员 `root` 账密登录云服务器：
```bash
ssh root@<您的云服务器外部公网IP>
```

登录成功后，更新基础软件库并安装 Docker 和依赖：
```bash
# 1. 强制更新服务器底层软件源
apt-get update -y && apt-get upgrade -y

# 2. 安装并启动解压工具、Nginx和传输依赖
apt-get install -y unzip curl wget nginx tree

# 3. 部署核心集装箱平台：Docker 及 Docker-Compose
apt-get install -y docker.io docker-compose
systemctl enable docker
systemctl start docker
```

### 2.2 挂载 100GB+ 云数据盘 (极端关键)
由于系统盘装不下 70GB 照片，您在此前购买的 100GB 云数据盘需要被系统识别。
```bash
# 1. 查看磁盘名字（通常为 /dev/vdb 或 /dev/sdb）
fdisk -l

# 2. 假设这块空硬盘叫 /dev/vdb，格式化这块空硬盘为 EXT4 格式 (非常危险，确认是空的新盘再敲)
mkfs.ext4 /dev/vdb

# 3. 在 Linux 中给硬盘建一个挂载的大门
mkdir -p /mnt/gis_data

# 4. 把硬盘永久挂载到这个门上
echo "/dev/vdb /mnt/gis_data ext4 defaults 0 0" >> /etc/fstab
mount -a

# 5. 检查是否挂载成功 (看 /mnt/gis_data 是否显示了大概 100G)
df -h
```

---

## 第三阶段：云服务器侧 - 数据上传与解压放置

本阶段目标：把 Windows 的 3 大包裹传递至 Linux。

### 3.1 创建标准化目录阵列
在云服务器的 SSH 端执行：
```bash
# 创建代码与数据库存放主目录
mkdir -p /opt/webgis
mkdir -p /opt/webgis/database_dump

# 这几个是在挂载的 100GB 数据盘上建立真实存储点
mkdir -p /mnt/gis_data/geoserver_config
mkdir -p /mnt/gis_data/yunnan_CLCD_data
```

### 3.2 启动数据大传输
1. 打开您本地电脑的 WinSCP 软件。主机名填云服务器 IP，用户 `root`。
2. 将本地 `D:\yunnan_CLCD_backup.dump` 上传至云服务器的 `/opt/webgis/database_dump/`。
3. 将本地 `D:\GerServer_Data.zip` 上传至云服务器的 `/opt/webgis/` 目录下。
4. 将本地巨大的 70G 遥感库整体 `E:\yunnan_CLCD_data` 内的所有文件与文件夹，一点不漏地全部拖入云服务器的 `/mnt/gis_data/yunnan_CLCD_data/` 目录中。（这可能需要数小时，请不要断开网络）。

### 3.3 解压 GeoServer 配置文件
数据传完后，回到云服务器的 SSH 终端：
```bash
cd /opt/webgis
# 解压配置文件到数据盘位置
unzip GerServer_Data.zip -d /mnt/gis_data/geoserver_config/
# 重命名文件夹确保路径一致（去掉外层的压缩壳名）
mv /mnt/gis_data/geoserver_config/GerServer_Data/* /mnt/gis_data/geoserver_config/
rm -rf /mnt/gis_data/geoserver_config/GerServer_Data
```

---

## 第四阶段：编写神级 Docker 剧本与启动服务

本阶段目标：利用一行脚本唤起整套庞大的后系统。

### 4.1 创建 Docker-Compose 编排文件
回到云端的 SSH 控制台，输入：
```bash
cd /opt/webgis
nano docker-compose.yml
```

然后在黑色的记事本中把以下内容**原封不动地完整粘贴进去** (右键粘贴即可)：

```yaml
version: '3.7'

services:
  # 服务1：PostGIS 空间数据库
  db:
    image: postgis/postgis:15-3.3
    container_name: webgis_postgis
    restart: always
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: yunnan_CLCD
    ports:
      - "5432:5432" # 如果不需要外网访问数据库提升安全性，可改为 "127.0.0.1:5432:5432"
    volumes:
      - /mnt/gis_data/pg_data:/var/lib/postgresql/data # 将数据库保存在 100G大盘中防爆炸

  # 服务2：GeoServer 渲染与切片引擎
  geoserver:
    image: kartoza/geoserver:2.22.2
    container_name: webgis_geoserver
    restart: always
    depends_on:
      - db
    ports:
      - "8080:8080"
    environment:
      # GeoServer 全局大内存抗并发 OOM 死机指令（极其重要）
      - INITIAL_MEMORY=2048M
      - MAXIMUM_MEMORY=4096M
      - CORS_ENABLED=true
      - CORS_ALLOWED_ORIGINS=*
      - CORS_ALLOWED_METHODS=GET,POST,PUT,DELETE,HEAD,OPTIONS
      - STABLE_EXTENSIONS=wps,querylayer,css
      # 防假死的高级垃圾回收调优参数
      - EXTRA_JAVA_OPTS=-XX:+UseG1GC -XX:SoftRefLRUPolicyMSPerMB=36000 -XX:MaxGCPauseMillis=200
    volumes:
      # 挂载您的项目配置文件
      - /mnt/gis_data/geoserver_config:/opt/geoserver/data_dir
      # >>>>>>> 注意！这是最精华的“凭空造E盘路径欺骗术”！ <<<<<<<
      - /mnt/gis_data/yunnan_CLCD_data:/E:/yunnan_CLCD_data
```

贴完后，按下 `Ctrl + O` (保存)，回车，然后按下 `Ctrl + X` (退出)。

### 4.2 一键暴力启动容器
```bash
cd /opt/webgis
docker-compose up -d
```
*验证指标：等待屏幕上 `webgis_postgis` 和 `webgis_geoserver` 均显示绿色的 `Started` 或 `done` 意味着您的服务阵列已经全面启动。*

### 4.3 将本地带来的数据库包，倒灌回云端数据库里
此时虽然数据库容器在跑，但里面是空的。必须将我们刚才打的包塞进去。
```bash
# 复制压缩包到数据库容器内部
docker cp /opt/webgis/database_dump/yunnan_CLCD_backup.dump webgis_postgis:/tmp/

# 登录进容器，使用 pg_restore 开始灌装恢复 (利用 -j 4 开启四线程 CPU 加速恢复)
docker exec -it webgis_postgis bash -c "pg_restore -U postgres -d yunnan_CLCD -j 4 /tmp/yunnan_CLCD_backup.dump"
```
*验证指标：若屏幕疯狂飘出代码且最后没有报 FATAL 级别错误并重返命令行说明数据库重建成功，千万级图斑全部复活。*

---

## 第五阶段：前端打包与 Nginx Web 托管发布

本阶段目标：处理前方的展示页面。

### 5.1 在本地电脑上 (Windows) 重构前端包
这步在您的个人电脑里做。打开 `my_webgis_project`，打开 VS Code 终端。
因为即将上云，所有代码里的 `localhost:8080/geoserver` 必须被干掉。如果您已经改为了相对路径(`/geoserver/WebGIS/wms...`)，请执行：
```bash
npm run build
```
这将会在项目目录生成一个叫 `dist` 的文件夹。请使用 WinSCP 将整个 `dist` 文件夹上传到云服务器的 `/var/www/webgis/` 目录下。

### 5.2 云端 Nginx 配置反向跨域代理
回到云服务器 SSH 界面。修改 Nginx 规则将 80 端口的前面摊子支起来：
```bash
nano /etc/nginx/sites-available/default
```

清空里面原有内容，直接粘贴核心的跨域路由分配法则：
```nginx
server {
    listen 80 default_server;
    server_name _; 

    # 将巨大的切片访问日志关闭以节约系统盘空间
    access_log off;
    
    # 核心 1: 托管 Vue 打包的静态前端资源
    location / {
        root /var/www/webgis/dist;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }

    # 核心 2: 解决前台请求 GeoServer 的跨域问题，全额代理转发
    # 前端只要向 "/geoserver/..." 发请求，就会秘密转发到容器的 8080
    location /geoserver/ {
        proxy_pass http://127.0.0.1:8080/geoserver/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # 提高切片传送速度的缓存器
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
    }

    # 核心 3: 解决 Node API (人工智能) 接口转发跨域
    # 假设您的服务端 Node.js 监听在本地 3000
    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
```
保存退出 (`Ctrl+O`, `Enter`, `Ctrl+X`)。

### 5.3 重启 Web 服务器激活一切
```bash
nginx -t
# 如果上面显示 test is successful，强行重启：
systemctl restart nginx
```

### 🏁 最终仪式
在浏览器输入：`http://<您的云服务器外部公网IP>` 
一切将毫无违和感地顺滑运行。
您的 WebGIS 已在互联网云端宣告正式落成！
