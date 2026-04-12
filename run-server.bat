@echo off

:: 检查 Python 是否安装
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未找到 Python。请先安装 Python 3.6+
    pause
    exit /b 1
)

echo 正在启动本地服务器...
echo 服务器将在 http://localhost:8000 上运行

:: 启动 Python 简单 HTTP 服务器
python -m http.server 8000

pause