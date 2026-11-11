# 砚屿开发助手（前端接入 v1）

入口：工具中心 → 开发助手；「我 → 连接与设置」；可加入工具收藏。

该模块与现有聊天、书房、创作角、群聊、MCP、主题独立，不改变其数据结构。

## 当前功能
- 手机端写代码任务，选择 owner/repository 仓库；
- 没有后端时保存本地草稿，不伪造运行状态；
- 配置受控 HTTPS 任务服务后，发起任务、查询状态、查看摘要、PR 或 diff，手动确认或取消；
- 只在任务页面可见时轮询运行中的任务；
- 服务地址保存在 localStorage；Bearer Token 只保留当前页面内存。

## 为什么需要后端
Google Antigravity CLI 运行在有用户授权的计算环境中，不等于一个能直接从静态网页调用的 API。浏览器不可保存云主机密钥、GitHub 私钥、Service Account JSON，也不应直接运行 shell。

后端必须自行完成身份认证、允许的 GitHub 仓库白名单、限流、日志、隔离工作目录、可审阅的变更、人工确认以及超时与成本控制。前端传入 mode=plan 和 approval_required=true 只是契约，真正的只读与审批限制必须由后端强制保证。

## HTTPS API 合约

响应均为 JSON；前端使用 Authorization: Bearer TOKEN，credentials: omit。服务端需限定 CORS 允许的来源与 Authorization、Content-Type、GET/POST/OPTIONS，禁止公开匿名执行代码。

### GET /health
响应示例：

    {"ok":true,"name":"XY Task Bridge"}

### POST /tasks
请求示例：

    {
      "repository":"tusumy/aevren-xy",
      "instruction":"检查手机端聊天输入框，先给方案",
      "mode":"plan",
      "approval_required":true
    }

响应示例：

    {"task_id":"task_123","status":"queued","summary":"已排队"}

### GET /tasks/task_123
响应示例：

    {
      "task_id":"task_123",
      "status":"needs_approval",
      "summary":"提出三处样式调整",
      "diff":"--- a/styles.css\n+++ b/styles.css\n...",
      "pr_url":"https://github.com/tusumy/aevren-xy/pull/123"
    }

推荐 status：queued、planning、running、needs_approval、completed、failed、cancelled。
返回 PR URL 或变更 diff 供用户检查后才能批准。服务端在 planning 阶段不得直接修改主分支。

### POST /tasks/task_123/approve
请求：

    {"action":"apply"}

### POST /tasks/task_123/cancel
请求：

    {}

服务端对任务所属用户、状态、仓库权限和审批记录再次校验。浏览器确认按钮不是安全边界。

## 与 Google Cloud 的关系
可使用已有的 GCP VM 作为后端主机候选，但必须先确认服务器联网、CLI 的安装认证方式及 Google 账号额度。Google Cloud 300 美元试用金不等于 Google AI Pro/Ultra 订阅，不能假定反重力全部功能都被包含。

先在受控测试环境验证，不额外开通付费资源、不改已有账单。Cloudflare Worker 可以担任认证代理，但不适合直接运行 CLI。

## 当前限制
尚未部署后端服务、登录 Antigravity CLI 或成功运行真实任务。这个版本提供可操作的前端任务中心和 API 合约，不能视为已经与反重力连通。

## 回归检查
1. 工具中心及「我」页能找到开发助手；
2. 无后端时提交只创建本地草稿；
3. 草稿刷新后仍存在，聊天数据不变；
4. 公网 HTTP、含密码或查询参数的地址被拒绝；
5. 后端连接失败展示真实错误；
6. 令牌刷新网页后不自动填回；
7. 有真实任务且返回 diff 或 PR 时才可以发起批准；
8. 手机端可正常滚动，不遮挡聊天框。
