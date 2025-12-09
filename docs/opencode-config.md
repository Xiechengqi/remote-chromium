
# 本文档介绍如何通过 Docker 容器挂载来持久化 OpenCode 的配置文件和目录

## 需要挂载的目录和文件

### 全局配置目录

OpenCode 的全局配置存储在 `~/.config/opencode/` 目录（或 `$XDG_CONFIG_HOME/opencode/`），包含以下内容：

| 路径 | 说明 |
|------|------|
| `~/.config/opencode/opencode.json` | 主配置文件（主题、模型、快捷键等） |
| `~/.config/opencode/agent/` | 自定义 Agent 定义文件 |
| `~/.config/opencode/command/` | 自定义命令定义文件 |
| `~/.config/opencode/themes/` | 自定义主题文件 |
| `~/.config/opencode/plugin/` | 插件文件 |
| `~/.config/opencode/mode/` | 模式定义文件 |
| `~/.config/opencode/tool/` | 自定义工具文件 |
| `~/.config/opencode/AGENTS.md` | 全局规则文件 |

### 凭据存储目录

**重要**：通过 `/connect` 命令添加的 API 密钥和认证信息存储在 `~/.local/share/opencode/` 目录中：

| 路径 | 说明 |
|------|------|
| `~/.local/share/opencode/auth.json` | API 密钥和 Provider 认证信息（通过 `/connect` 命令添加） |
| `~/.local/share/opencode/mcp-auth.json` | MCP 服务器的认证令牌 |
| `~/.local/share/opencode/log/` | 日志文件目录 |

:::important[重要提示]
如果不挂载 `~/.local/share/opencode/` 目录，通过 `/connect` 命令添加的模型配置和 API 密钥在容器重启后会丢失，需要重新配置。
:::

### 项目配置目录

项目级配置存储在项目根目录的 `.opencode/` 目录中，包含相同的子目录结构：

| 路径 | 说明 |
|------|------|
| `<project-root>/.opencode/` | 项目级配置目录（包含 agent/, command/, themes/ 等子目录） |
| `<project-root>/opencode.json` | 项目级配置文件 |

---

## Docker Compose 配置示例

以下是一个完整的 `docker-compose.yml` 示例：

```yaml
version: '3.8'

services:
  opencode:
    image: opencode/opencode:latest
    container_name: opencode
    volumes:
      # 挂载全局配置目录
      - ~/.config/opencode:/root/.config/opencode:rw
      
      # 挂载凭据存储目录（重要：包含 API 密钥和认证信息）
      - ~/.local/share/opencode:/root/.local/share/opencode:rw
      
      # 挂载项目目录（包含项目配置和代码）
      - ./:/workspace:rw
      
      # 可选：挂载 SSH 密钥（用于 Git 操作）
      - ~/.ssh:/root/.ssh:ro
      
      # 可选：挂载 Git 配置
      - ~/.gitconfig:/root/.gitconfig:ro
      
    working_dir: /workspace
    environment:
      # 可选：指定自定义配置目录
      # OPENCODE_CONFIG_DIR: /custom/config/dir
      
      # 可选：指定自定义配置文件路径
      # OPENCODE_CONFIG: /path/to/config.json
      
    # 如果需要网络访问（用于 API 调用）
    network_mode: bridge
    
    # 如果需要交互式终端
    stdin_open: true
    tty: true
```

---

## Docker Run 命令示例

### 基础挂载示例

```bash
docker run -it --rm \
  -v ~/.config/opencode:/root/.config/opencode:rw \
  -v ~/.local/share/opencode:/root/.local/share/opencode:rw \
  -v $(pwd):/workspace:rw \
  -w /workspace \
  opencode/opencode:latest
```

### 完整配置示例

```bash
docker run -it --rm \
  # 挂载全局配置目录
  -v ~/.config/opencode:/root/.config/opencode:rw \
  
  # 挂载凭据存储目录（重要：包含 API 密钥）
  -v ~/.local/share/opencode:/root/.local/share/opencode:rw \
  
  # 挂载项目目录
  -v $(pwd):/workspace:rw \
  
  # 挂载 SSH 密钥（如果需要 Git 操作）
  -v ~/.ssh:/root/.ssh:ro \
  
  # 挂载 Git 配置
  -v ~/.gitconfig:/root/.gitconfig:ro \
  
  # 设置工作目录
  -w /workspace \
  
  # 设置环境变量（可选）
  -e OPENCODE_CONFIG_DIR=/root/.config/opencode \
  
  # 如果需要访问网络
  --network bridge \
  
  opencode/opencode:latest
```

---

## 常用配置场景

### 场景 1：仅持久化全局配置

如果你只想持久化全局配置（主题、快捷键、模型等），而不需要项目配置：

```yaml
volumes:
  - ~/.config/opencode:/root/.config/opencode:rw
```

### 场景 2：完整配置持久化

如果你需要同时持久化全局配置、凭据和项目配置：

```yaml
volumes:
  # 全局配置
  - ~/.config/opencode:/root/.config/opencode:rw
  # 凭据存储（API 密钥等）
  - ~/.local/share/opencode:/root/.local/share/opencode:rw
  # 项目目录（包含 .opencode/ 和 opencode.json）
  - ./:/workspace:rw
```

### 场景 3：多项目共享配置

如果你有多个项目，希望共享全局配置但使用不同的项目配置：

```yaml
volumes:
  # 共享的全局配置
  - ~/.config/opencode:/root/.config/opencode:rw
  # 每个项目挂载自己的目录
  - ./project1:/workspace/project1:rw
  - ./project2:/workspace/project2:rw
```

---

## 配置文件示例

### 全局配置文件示例

创建 `~/.config/opencode/opencode.json`：

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  // 主题配置
  "theme": "opencode",
  
  // 模型配置
  "model": "anthropic/claude-sonnet-4-5",
  "small_model": "anthropic/claude-haiku-4-5",
  
  // Provider 配置
  "provider": {
    "anthropic": {
      "options": {
        "apiKey": "{env:ANTHROPIC_API_KEY}"
      }
    }
  },
  
  // 自动更新
  "autoupdate": true,
  
  // TUI 配置
  "tui": {
    "scroll_speed": 3
  },
  
  // 快捷键配置
  "keybinds": {},
  
  // 权限配置
  "permission": {
    "edit": "allow",
    "bash": "ask"
  }
}
```

### 项目配置文件示例

在项目根目录创建 `opencode.json`：

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  // 项目特定的模型配置
  "model": "anthropic/claude-sonnet-4-5",
  
  // 项目特定的 Agent 配置
  "agent": {
    "code-reviewer": {
      "description": "代码审查专家",
      "model": "anthropic/claude-sonnet-4-5",
      "prompt": "你是一个代码审查专家，专注于安全性、性能和可维护性。"
    }
  },
  
  // 项目特定的命令配置
  "command": {
    "test": {
      "template": "运行完整的测试套件并显示覆盖率报告。",
      "description": "运行测试"
    }
  },
  
  // 项目特定的规则文件
  "instructions": ["./CONTRIBUTING.md", "docs/guidelines.md"]
}
```

---

## 目录结构示例

挂载后的完整目录结构示例：

```
~/.config/opencode/
├── opencode.json          # 主配置文件
├── AGENTS.md              # 全局规则文件
├── agent/                 # 自定义 Agents
│   ├── reviewer.md
│   └── docs-writer.md
├── command/               # 自定义命令
│   ├── test.md
│   └── build.md
├── themes/                # 自定义主题
│   └── my-theme.json
├── plugin/                # 插件
│   └── custom-plugin.js
├── mode/                  # 模式定义
│   └── review.md
└── tool/                  # 自定义工具
    └── database.ts

~/.local/share/opencode/   # 凭据存储目录（重要）
├── auth.json              # API 密钥和 Provider 认证信息
├── mcp-auth.json          # MCP 服务器认证令牌
└── log/                   # 日志文件
    └── ...

/workspace/                # 项目目录
├── opencode.json          # 项目配置文件
├── .opencode/             # 项目配置目录
│   ├── agent/
│   ├── command/
│   ├── themes/
│   └── ...
└── ...                    # 项目代码文件
```

---

## 模型配置持久化

### 两种配置方式

OpenCode 支持两种方式配置模型和 Provider：

#### 方式 1：通过 `/connect` 命令（推荐）

使用 `/connect` 命令添加 Provider 的 API 密钥，这些凭据会存储在 `~/.local/share/opencode/auth.json` 中。

**优点**：
- 交互式配置，简单易用
- 支持 OAuth 认证流程
- 凭据加密存储

**持久化要求**：
- ✅ **必须挂载** `~/.local/share/opencode/` 目录
- ✅ 重启容器后**无需重新配置**，凭据会自动加载

#### 方式 2：通过配置文件

在 `opencode.json` 中直接配置 Provider 和 API 密钥：

```jsonc
{
  "provider": {
    "anthropic": {
      "options": {
        "apiKey": "{env:ANTHROPIC_API_KEY}"
      }
    }
  }
}
```

**优点**：
- 可以通过环境变量管理敏感信息
- 配置版本可控（如果使用环境变量）

**持久化要求**：
- ✅ 挂载 `~/.config/opencode/opencode.json` 或项目 `opencode.json`
- ✅ 重启容器后**无需重新配置**，配置会自动加载
- ⚠️ 需要确保环境变量在容器中可用

### 重启容器后的行为

| 配置方式 | 是否挂载凭据目录 | 重启后是否需要重新配置 |
|---------|----------------|---------------------|
| `/connect` 命令 | ✅ 是 | ❌ **不需要**，凭据已持久化 |
| `/connect` 命令 | ❌ 否 | ✅ **需要**，凭据会丢失 |
| 配置文件 + 环境变量 | ✅ 是 | ❌ **不需要**，配置已持久化 |

:::tip[最佳实践]
**推荐同时挂载两个目录**：
- `~/.config/opencode/` - 配置文件
- `~/.local/share/opencode/` - 凭据存储

这样可以确保无论是通过 `/connect` 命令还是配置文件添加的模型配置，在容器重启后都能自动恢复。
:::

---

## 注意事项

1. **权限问题**：确保挂载的目录有正确的读写权限。如果容器内用户不是 root，可能需要调整权限：
   ```bash
   chmod -R 755 ~/.config/opencode
   chmod -R 755 ~/.local/share/opencode
   ```

2. **路径映射**：容器内的路径是 `/root/.config/opencode` 和 `/root/.local/share/opencode`（如果使用 root 用户），确保挂载路径正确。

3. **配置文件合并**：OpenCode 会合并多个配置文件（全局、项目、自定义），优先级从低到高：
   - 全局配置 (`~/.config/opencode/opencode.json`)
   - 项目配置 (`./opencode.json`)
   - 环境变量指定的配置 (`OPENCODE_CONFIG`)

4. **敏感信息**：API 密钥等敏感信息建议使用环境变量或 `{env:VARIABLE_NAME}` 语法，而不是直接写在配置文件中。

5. **Git 集成**：如果需要 Git 操作，记得挂载 SSH 密钥或配置 Git 凭据。

6. **凭据安全**：`~/.local/share/opencode/auth.json` 包含敏感信息，确保该目录的权限设置正确，避免泄露。

---

## 验证配置

启动容器后，可以通过以下方式验证配置是否正确加载：

```bash
# 检查配置文件是否存在
ls -la ~/.config/opencode/

# 检查凭据文件是否存在（如果使用 /connect 命令）
ls -la ~/.local/share/opencode/

# 检查项目配置
ls -la .opencode/

# 查看已认证的 Provider（验证凭据是否加载）
opencode auth list

# 运行 opencode 查看配置
opencode --help
```

### 验证模型配置是否持久化

重启容器后，运行以下命令验证模型配置是否已正确加载：

```bash
# 查看已配置的 Provider
opencode auth list

# 查看可用的模型
opencode models
# 或使用 TUI 命令
/models
```

如果看到之前配置的 Provider 和模型，说明配置已成功持久化。

---

## 相关文档

- [配置文件文档](/docs/config) - 了解配置文件的详细选项
- [Agents 文档](/docs/agents) - 了解如何配置自定义 Agents
- [Commands 文档](/docs/commands) - 了解如何配置自定义命令
- [Themes 文档](/docs/themes) - 了解如何配置主题
- [Providers 文档](/docs/providers) - 了解如何配置 AI 提供商
