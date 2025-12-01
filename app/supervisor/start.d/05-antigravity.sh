#!/usr/bin/env bash
# ============================================================================
# Antigravity IDE (DISPLAY :1)
# ============================================================================

source /app/supervisor/start.d/common.sh

if [ "${IF_IDE_ON}" = "true" ]
then

# 设置 DISPLAY
export DISPLAY=${IDE_DISPLAY}

# 等待 X11 Display 就绪
while ! xdpyinfo -display ${DISPLAY} &>/dev/null
do
INFO "Waiting for IDE X server..."
EXEC "sleep 1"
done

echo "Starting (Antigravity IDE)..."

# 工作区目录
WORKSPACE_DIR="/app/antigravity/workspace"
mkdir -p ${WORKSPACE_DIR}

# 配置目录
USER_DATA_DIR="/app/antigravity/user-data"
EXTENSIONS_DIR="/app/antigravity/extensions"

mkdir -p ${USER_DATA_DIR} ${EXTENSIONS_DIR}

# 清理崩溃标记
find ${USER_DATA_DIR} -name "*.lock" -delete 2>/dev/null || true
find ${USER_DATA_DIR} -name "*crash*" -delete 2>/dev/null || true

# 配置 设置
SETTINGS_FILE="${USER_DATA_DIR}/User/settings.json"
mkdir -p "$(dirname ${SETTINGS_FILE})"

if [ ! -f "${SETTINGS_FILE}" ]; then
    cat > ${SETTINGS_FILE} << 'EOF'
{
    "workbench.startupEditor": "none",
    "workbench.colorTheme": "Default Dark+",
    "files.autoSave": "afterDelay",
    "files.autoSaveDelay": 1000,
    "editor.fontSize": 14,
    "editor.tabSize": 4,
    "editor.minimap.enabled": true,
    "editor.formatOnSave": true,
    "terminal.integrated.fontSize": 13,
    "telemetry.telemetryLevel": "off",
    "update.mode": "none",
    "extensions.autoUpdate": false,
    "git.confirmSync": false,
    "git.autofetch": true,
    "security.workspace.trust.enabled": false,
    "window.menuBarVisibility": "toggle"
}
EOF
fi

# 启动参数
OPTS=""

# 容器环境配置
OPTS="${OPTS} --no-sandbox"
OPTS="${OPTS} --disable-gpu"
OPTS="${OPTS} --disable-dev-shm-usage"

# 禁用更新和遥测
OPTS="${OPTS} --disable-updates"
OPTS="${OPTS} --disable-crash-reporter"
OPTS="${OPTS} --disable-telemetry"

# 跳过欢迎页面
OPTS="${OPTS} --skip-welcome"
OPTS="${OPTS} --skip-release-notes"

# 目录配置
OPTS="${OPTS} --user-data-dir=${USER_DATA_DIR}"
# OPTS="${OPTS} --extensions-dir=${EXTENSIONS_DIR}"

# 启动 Antigravity
INFO "Launching Antigravity ..."
INFO "  Workspace: ${WORKSPACE_DIR}"
INFO "  User Data: ${USER_DATA_DIR}"
INFO "  Extensions: ${EXTENSIONS_DIR}"

for i in {1..3}
do
INFO "antigravity ${OPTS} ${WORKSPACE_DIR}"
antigravity ${OPTS} ${WORKSPACE_DIR}
EXEC "sleep 10"
ps aux | grep -v grep | grep antigravity &> /dev/null && break
done

SLEEP_INFITY $0

else

SLEEP_INFITY $0

fi
