# GPT-SoVITS 部署脚本
# 执行: bash setup_gptsovits.sh

# ==== 1. 确保 conda 在 PATH ====
export PATH="$HOME/miniconda3/bin:$PATH"

# ==== 2. 配置清华镜像（国内加速）====
conda config --add channels https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/main/
conda config --add channels https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/free/

# ==== 3. 创建 Python 3.10 环境 ====
conda create -n GPTSoVits python=3.10 -y

# ==== 4. 克隆 GPT-SoVITS ====
git clone https://github.com/RVC-Boss/GPT-SoVITS.git ~/GPT-SoVITS
cd ~/GPT-SoVITS

# ==== 5. 安装依赖（CPU 模式 + HF 国内镜像）====
conda activate GPTSoVits && bash install.sh --device CPU --source HF-Mirror

echo ""
echo "=========================================="
echo "安装完成！启动 API 服务："
echo "  conda activate GPTSoVits"
echo "  cd ~/GPT-SoVITS && python api.py -a 0.0.0.0 -p 9880"
echo "=========================================="
