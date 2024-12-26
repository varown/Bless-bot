#!/bin/bash

# 脚本保存路径
SCRIPT_PATH="$HOME/Bless.sh"

# 检查是否以 root 用户运行脚本
if [ "$(id -u)" != "0" ]; then
    echo "此脚本需要以 root 用户权限运行。"
    echo "请尝试使用 'sudo -i' 命令切换到 root 用户，然后再次运行此脚本。"
    exit 1
fi

# 安装 Node.js
install_nodejs() {
    case $PKG_MANAGER in
        "apt")
            curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
            sudo $INSTALL_CMD nodejs npm tmux
            ;;
        "dnf" | "yum")
            curl -sL https://rpm.nodesource.com/setup_16.x | sudo bash -
            sudo $INSTALL_CMD nodejs npm tmux
            ;;
        "pacman")
            sudo $INSTALL_CMD nodejs npm tmux
            ;;
        *)
            echo "不支持的包管理器: $PKG_MANAGER"
            exit 1
            ;;
    esac
}
install_git() {
    case $PKG_MANAGER in
        "apt")
            sudo $INSTALL_CMD git
            ;;
        "dnf" | "yum")
            sudo $INSTALL_CMD git
            ;;
        "pacman")
            sudo $INSTALL_CMD git
            ;;
        *)
            echo "不支持的包管理器: $PKG_MANAGER"
            exit 1
            ;;
    esac
}

# 安装和配置 Blessnode 函数
function setup_blessnode() {
    # 检查 Bless 目录是否存在，如果存在则删除
    if [ -d "Bless node" ]; then
        echo "检测到 Bless 目录已存在，正在删除..."
        rm -rf "Bless node" || { echo "删除 Bless node 目录失败"; exit 1; }
        echo "Bless node 目录已删除。"
    fi

    # 检查并终止已存在的 Bless tmux 会话
    if tmux has-session -t Bless 2>/dev/null; then
        echo "检测到正在运行的 Bless 会话，正在终止..."
        tmux kill-session -t Bless || { echo "终止 Bless 会话失败"; exit 1; }
        echo "已终止现有的 Bless 会话。"
    fi
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
    
    
    # 安装 npm 环境
    echo "使用 $PKG_MANAGER 包管理器安装 Node.js 和 npm..."
    sudo $UPDATE_CMD

    # 检查 Node.js 版本
    node_version=$(node -v | sed 's/v//')
    required_version="16.0.0"

    if ! command -v node &> /dev/null; then
        echo "Node.js 未安装，正在安装..."
        install_nodejs
    elif ! [[ "$(printf '%s\n' "$required_version" "$node_version" | sort -V | head -n1)" = "$required_version" ]]; then
        echo "Node.js 版本需要 >= 16.0.0，当前版本：$node_version"
        echo "正在更新 Node.js 版本..."
    else
        echo "Node.js 版本符合要求：v$node_version"
    fi

    # 安装 git

    echo "使用 $PKG_MANAGER 包管理器安装 git..."
    if ! command -v git &> /dev/null; then
        install_git
    else
        echo "git 已安装"
    fi
    echo "正在从 GitHub 克隆 Bless 仓库..."
    git clone https://github.com/varown/Bless-bot.git Bless || { echo "克隆失败，请检查网络连接或仓库地址。"; exit 1; }

    cd Bless || { echo "无法进入 Bless 目录"; exit 1; }
    # 检查 config.js 是否存在
    if [ ! -f "config.js" ]; then
        # 如果不存在，创建基本结构
        cat > config.js << EOF
module.exports = [
];
EOF
    fi

    # 在最后的 ]; 之前插入新的配置
    sed -i '' -e '$d' config.js  # 删除最后一行 '];'

    # 提示用户输入 token
    read -p "请输入 usertoken: " usertoken
    
    # 添加新的配置对象
    cat >> config.js << EOF
    {
        usertoken: '${usertoken}',
        nodes: [
EOF

    # 循环添加节点信息
    first_node=true
    while true; do
        read -p "请输入 nodeid (直接按回车结束添加): " nodeid
        if [ -z "$nodeid" ]; then
            break
        fi
        
        if [ "$first_node" = false ]; then
            echo "," >> config.js
        fi
        first_node=false

        read -p "请输入 hardwareid: " hardwareid
        read -p "请输入 proxy (如果没有请直接按回车): " proxy

        if [ -z "$proxy" ]; then
            proxy_value="null"
        else
            proxy_value="'${proxy}'"
        fi

        cat >> config.js << EOF
            { 
                nodeId: '${nodeid}',
                hardwareId: '${hardwareid}',
                proxy: ${proxy_value}
            }
EOF
    done

    # 完成配置对象
    cat >> config.js << EOF
        ]
    }
];
EOF
    echo "配置文件 config.js 已创建"

    # 使用 tmux 自动运行 npm start
    tmux new-session -d -s Bless  # 创建新的 tmux 会话，名称为 Bless
    tmux send-keys -t Bless "cd Bless" C-m  # 切换到 Bless node 目录
    tmux send-keys -t Bless "npm install" C-m  # 安装 npm install
    tmux send-keys -t Bless "npm start" C-m # 启动 npm start
    echo "npm 已在 tmux 会话中启动。"
    echo "使用 'tmux attach -t Bless' 命令来查看日志。"
    echo "要退出 tmux 会话，请按 Ctrl+B 然后按 D。"

    # 提示用户按任意键返回主菜单
    read -n 1 -s -r -p "按任意键返回主菜单..."
}

# 生成 NodeID 函数
function generate_nodeid() {
    echo "正在进入目录 ..."
    cd /root/Bless || { 
        echo "无法进入 Bless 目录"
        return 1
    }

    # 检查 node 是否安装
    if ! command -v node &> /dev/null; then
        echo "Node.js 未安装，请先安装 Node.js"
        return 1
    fi

    # 运行生成器
    node gen.js || {
        echo "生成 NodeID 失败"
        return 1
    }
    
    echo "NodeID 生成完成。"
    read -n 1 -s -r -p "按任意键返回主菜单..."
}

# 主菜单函数
function main_menu() {
    while true; do
        clear
        echo "脚本免费开源，请勿相信收费"
        echo "================================================================"
        echo "退出脚本，请按键盘 ctrl + C 退出即可"
        echo "请选择要执行的操作:"
        echo "1. 安装部署 Bless节点"
        echo "2. 生成 NodeID"
        echo "3. 退出"

        read -p "请输入您的选择 (1,2): " choice
        case $choice in
            1)
                setup_blessnode  # 调用安装和配置函数
                ;;
            2)
                generate_nodeid
                ;;
            3)
                echo "退出脚本..."
                exit 0
                ;;
            *)
                echo "无效的选择，请重试."
                read -n 1 -s -r -p "按任意键继续..."
                ;;
        esac
    done
}

# 进入主菜单
main_menu