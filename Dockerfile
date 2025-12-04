FROM ubuntu:24.04

LABEL maintainer="xiechengqi01@gmail.com" \
      version="1.0" \
      description="Ubuntu with Chrome and NoVNC"

USER root

# vnc
# novnc
# chromium
# antigravity
# gotty
ENV \
	VNC_RESOLUTION="1920x1080" \
	NOVNC_VIEW_ONLY="false" \
        NOVNC_WEB_INDEX="/app/index" \
	CHROMIUM_DISPLAY=:0 \
	CHROMIUM_VNC_PORT="5900" \
	CHROMIUM_NOVNC_PORT="7900" \
	CHROMIUM_NOVNC_PASSWORD="" \
        CHROMIUM_NOVNC_TITLE="Chromium" \
	CHROMIUM_CLEAN_SINGLETONLOCK="false" \
	CHROMIUM_USER_DATA_DIR="/app/chromium/user-data" \
	CHROMIUM_REMOTE_DEBUGGING_PORT="9222" \
	CHROMIUM_START_URLS="chrome://version,http://localhost:5000" \
	CHROMIUM_LANG="en-US" \
	CHROMIUM_LOAD_EXTENSION="" \
        CHROMIUM_PROXY_SERVER="" \
        IF_IDE_ON="false" \
        IDE_DISPLAY=:1 \
        IDE_VNC_PORT="5800" \
        IDE_NOVNC_PORT="7800" \
        IDE_NOVNC_PASSWORD="" \
        IDE_NOVNC_TITLE="Antigravity" \
        IF_CCSWITCH_ON="true" \
        CCSWITCH_DISPLAY=:2 \
        CCSWITCH_VNC_PORT="5700" \
        CCSWITCH_NOVNC_PORT="7700" \
        CCSWITCH_NOVNC_PASSWORD="" \
        CCSWITCH_NOVNC_TITLE="CCSwitch" \
        IF_TERMINAL_ON="true" \
        TERMINAL_USER="" \
        TERMINAL_PASSWORD="" \
        TERMINAL_PROXY="" \
        TERMINAL_ONCE="false" \
        IF_DUFS_ON="true" \
        IF_SOCKS_PROXY="false" \
        SOCKS_PROXY="SSH_IP:SSH_PORT:SSH_USER:SSH_PASSWORD" \
        IF_CURSOR_CLI_ON="true" \
        IF_GEMINI_CLI_ON="true" \
        IF_CODEX_CLI_ON="true" \
        IF_CLAUDE_CLI_ON="true" \
        IF_GOLANG_ON="true" \
        IF_NODEJS_ON="true" \
        IF_JUPYTER_ON="true" \
        IF_YPROMPT_ON="true" \
        YPROMPT_USERNAME="admin" \
        YPROMPT_PASSWORD="admin123"

COPY app /app

RUN     apt update && \
        DEBIAN_FRONTEND=noninteractive apt-get install -y tzdata vim software-properties-common curl && \
        ln -fs /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
        update-alternatives --remove-all editor && \
        update-alternatives --remove-all vi && \
        update-alternatives --install /usr/bin/editor editor /usr/bin/vim.basic 1 && \
        update-alternatives --install /usr/bin/vi vi /usr/bin/vim.basic 1 && \
        add-apt-repository ppa:xtradeb/apps -y && \
        mkdir -p /etc/apt/keyrings && \
        curl -fsSL https://us-central1-apt.pkg.dev/doc/repo-signing-key.gpg | gpg --dearmor -o /etc/apt/keyrings/antigravity-repo-key.gpg && \
        echo "deb [signed-by=/etc/apt/keyrings/antigravity-repo-key.gpg] https://us-central1-apt.pkg.dev/projects/antigravity-auto-updater-dev/ antigravity-debian main" >> /etc/apt/sources.list.d/antigravity.list && \
        apt update && \
        apt install -y sshpass telnet net-tools iproute2 iputils-ping jq ca-certificates wget htop net-tools vnstat screen tmux git build-essential \
        supervisor \
        xvfb \
        openbox \
        x11vnc \
        websockify \
        libpcre3-dev libssl-dev zlib1g-dev libgd-dev \
        chromium chromium-driver \
        antigravity && \
        curl -LsSf https://astral.sh/uv/install.sh | sh && \
        curl -SsL https://raw.githubusercontent.com/Xiechengqi/scripts/refs/heads/master/install/Agent/agent -o /usr/local/bin/agent && chmod +x /usr/local/bin/agent && \
        echo 'source /app/scripts/.env' >> ~/.bashrc && \
        mkdir -p /app/logs && \
        rm -rf /var/cache/apt/* /tmp/*

# gotty
EXPOSE 2222
# dufs
EXPOSE 5000
# novnc
EXPOSE 7700 7800 7900

WORKDIR /app

# CMD ["sleep", "infinity"]
CMD ["supervisord", "-l", "/app/logs/supervisord.log", "-c", "/app/supervisor/supervisord.conf"]
