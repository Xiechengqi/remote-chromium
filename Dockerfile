FROM ubuntu:24.04

LABEL maintainer="xiechengqi01@gmail.com" \
      version="1.0" \
      description="Ubuntu with Chrome and NoVNC"

USER root

# vnc resolution
# novnc
# gotty
# chromium
ENV \
	DISPLAY=:0 \
	VNC_RESOLUTION="1920x1080" \
	VNC_PORT="5900" \
	NOVNC_PASSWORD="" \
	NOVNC_VIEW_ONLY="false" \
	NOVNC_TITLE="Chromium" \
	NOVNC_WEB_INDEX="/app/index" \
	NOVNC_PORT="7900" \
	CHROMIUM_CLEAN_SINGLETONLOCK="false" \
	CHROMIUM_USER_DATA_DIR="/app/chromium/user-data" \
	CHROMIUM_REMOTE_DEBUGGING_PORT="9222" \
	CHROMIUM_START_URLS="chrome://version,http://localhost:2222,http://localhost:5000" \
	CHROMIUM_LANG="en-US" \
	CHROMIUM_LOAD_EXTENSION="" \
        CHROMIUM_PROXY_SERVER="" \
        IF_TERMINAL_ON="true" \
        TERMINAL_USER="" \
        TERMINAL_PASSWORD="" \
        TERMINAL_RPOXY="" \
        TERMINAL_ONCE="false" \
        IF_DUFS_ON="true" \
        IF_SOCKS_PROXY="false" \
        SOCKS_PROXY="SSH_IP:SSH_PORT:SSH_USER:SSH_PASSWORD" \
        IF_CURSOR_ON="true" \
        IF_GEMINI_ON="true" \
        IF_CODEX_ON="true" \
        IF_CLAUDE_ON="true" \
        IF_GOLANG_ON="true" \
        IF_NODEJS_ON="true" \
        IF_JUPYTER_ON="true"

COPY app /app

RUN     apt update && \
        DEBIAN_FRONTEND=noninteractive apt-get install -y tzdata vim software-properties-common && \
        ln -fs /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
        update-alternatives --remove-all editor && \
        update-alternatives --remove-all vi && \
        update-alternatives --install /usr/bin/editor editor /usr/bin/vim.basic 1 && \
        update-alternatives --install /usr/bin/vi vi /usr/bin/vim.basic 1 && \
        add-apt-repository ppa:xtradeb/apps -y && \
        apt install -y sshpass telnet net-tools iproute2 iputils-ping jq ca-certificates curl wget htop net-tools vnstat screen tmux git build-essential \
        supervisor \
        xvfb \
        openbox \
        x11vnc \
        websockify \
        libpcre3-dev libssl-dev zlib1g-dev libgd-dev \
        chromium chromium-driver && \
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
EXPOSE ${NOVNC_PORT}

WORKDIR /app

# CMD ["sleep", "infinity"]
CMD ["supervisord", "-l", "/app/logs/supervisord.log", "-c", "/app/supervisor/supervisord.conf"]
