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
        TERMINAL_USER="" \
        TERMINAL_PASSWORD="" \
        TERMINAL_RPOXY="" \
	CHROMIUM_CLEAN_SINGLETONLOCK="false" \
	CHROMIUM_USER_DATA_DIR="/app/chromium/user-data" \
	CHROMIUM_REMOTE_DEBUGGING_PORT="9222" \
	CHROMIUM_START_URLS="chrome://version,http://localhost:2222,http://localhost:5000" \
	CHROMIUM_LANG="en-US" \
	CHROMIUM_LOAD_EXTENSION="" \
	CHROMIUM_PROXY_SERVER=""

COPY app /app

RUN     rm -f /etc/apt/sources.list.d/ubuntu.sources && \
        echo "deb http://mirrors.tuna.tsinghua.edu.cn/ubuntu/ noble main restricted universe multiverse" > /etc/apt/sources.list && \
        echo "deb http://mirrors.tuna.tsinghua.edu.cn/ubuntu/ noble-updates main restricted universe multiverse" >> /etc/apt/sources.list && \
        echo "deb http://mirrors.tuna.tsinghua.edu.cn/ubuntu/ noble-backports main restricted universe multiverse" >> /etc/apt/sources.list && \
        echo "deb http://security.ubuntu.com/ubuntu/ noble-security main restricted universe multiverse" >> /etc/apt/sources.list && \
        apt update && \
        DEBIAN_FRONTEND=noninteractive apt-get install -y tzdata vim software-properties-common && \
        ln -fs /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
        update-alternatives --remove-all editor && \
        update-alternatives --remove-all vi && \
        update-alternatives --install /usr/bin/editor editor /usr/bin/vim.basic 1 && \
        update-alternatives --install /usr/bin/vi vi /usr/bin/vim.basic 1 && \
        add-apt-repository ppa:xtradeb/apps -y && \
        apt install -y ca-certificates curl wget htop net-tools vnstat screen tmux git build-essential \
        supervisor \
        xvfb \
        openbox \
        x11vnc \
        websockify \
        libpcre3-dev libssl-dev zlib1g-dev libgd-dev \
        chromium chromium-driver && \
        UV_INSTALLER_GITHUB_BASE_URL=https://gh-proxy.com/https://github.com curl -LsSf https://astral.sh/uv/install.sh | sh && \
        curl -SsL https://gh-proxy.com/https://raw.githubusercontent.com/Xiechengqi/scripts/refs/heads/master/install/Agent/agent -o /usr/local/bin/agent && chmod +x /usr/local/bin/agent && \
        curl -SsL https://cursor.com/install | bash && echo 'export PATH="$HOME/.local/bin:$PATH"' >> /etc/profile && \
        echo 'source /app/scripts/.env' >> /etc/profile && \
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
