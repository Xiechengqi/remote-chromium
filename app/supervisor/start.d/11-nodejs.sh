#!/usr/bin/env bash

source /app/supervisor/start.d/common.sh

source ~/.bashrc

export NODE_VERSION=20
export NVM_DIR=~/.nvm
export NVM_NODEJS_ORG_MIRROR=http://mirrors.tuna.tsinghua.edu.cn/nodejs-release/

if [ "${IF_NODEJS_ON}" = "true" ]
then

cat >> ~/.bashrc << EOF

## NodeJs
export NODE_VERSION=${NODE_VERSION}
export NVM_DIR=${NVM_DIR}
export NVM_NODEJS_ORG_MIRROR=${NVM_NODEJS_ORG_MIRROR}
[ -s "\${NVM_DIR}/nvm.sh" ] && . "\${NVM_DIR}/nvm.sh"  # This loads nvm
[ -s "\${NVM_DIR}/bash_completion" ] && . "\${NVM_DIR}/bash_completion"  # This loads nvm bash_completion

EOF
curl -SsL https://gh-proxy.com/https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && . "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

INFO "nvm install ${NODE_VERSION}" && nvm install ${NODE_VERSION}
SLEEP_INFITY $0

else
SLEEP_INFITY $0
fi
