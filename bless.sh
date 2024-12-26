# 检测包管理器类型
if command -v apt &> /dev/null; then
    # Debian/Ubuntu 系统
    PKG_MANAGER="apt"
    INSTALL_CMD="apt install -y"
    UPDATE_CMD="apt update"
elif command -v dnf &> /dev/null; then
    # 新版 RHEL/CentOS/Fedora 系统
    PKG_MANAGER="dnf"
    INSTALL_CMD="dnf install -y"
    UPDATE_CMD="dnf update"
elif command -v yum &> /dev/null; then
    # 旧版 RHEL/CentOS 系统
    PKG_MANAGER="yum"
    INSTALL_CMD="yum install -y"
    UPDATE_CMD="yum update"
elif command -v pacman &> /dev/null; then
    # Arch Linux 系统
    PKG_MANAGER="pacman"
    INSTALL_CMD="pacman -S --noconfirm"
    UPDATE_CMD="pacman -Syu --noconfirm"
else
    echo "未找到支持的包管理器"
    exit 1
fi

# 安装依赖
echo "使用 ${PKG_MANAGER} 安装依赖..."
sudo $UPDATE_CMD
case $PKG_MANAGER in
    "apt")
        sudo $INSTALL_CMD nodejs npm tmux node-cacache node-gyp node-mkdirp node-nopt node-tar node-which
        ;;
    "dnf"|"yum")
        sudo $INSTALL_CMD nodejs npm tmux
        ;;
    "pacman")
        sudo $INSTALL_CMD nodejs npm tmux
        ;;
esac