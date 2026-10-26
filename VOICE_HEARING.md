# 砚屿声音感知（可选）

砚屿现有录音发送、STT 和 Android 自动通话不依赖本功能。新声音入口默认关闭；不额外获取麦克风权限，不启动后台录音。

- [ears](https://github.com/eveacla11/ears) 通过 POST /api/listen（字段 file）提供转写、个人声学基线与可选声纹 / 环境声。
- [Seven Ears](https://github.com/joyflow-commons/seven-ears) 自带本地 dashboard_server.py，通过 POST /analyze（字段 audio、transcript 等）提供声学证据卡；不用于实时通话。

## 本地运行

1. 在可信的电脑或服务器安装 Python 3.11+、ffmpeg。
2. 克隆 ears，按其 README 配置 .env 中 GROQ_API_KEY；运行 python -m uvicorn server:app --host 127.0.0.1 --port 8020。ears 默认会把音频发送给所配置的云端转写供应商。
3. 克隆 Seven Ears 并安装其 requirements.txt；运行 python dashboard_server.py --host 127.0.0.1 --port 8765。首次使用本地 Whisper 需下载模型。
4. 在本仓库安装 pip install -r hearing-gateway-requirements.txt。
5. 设置环境变量 XY_HEARING_TOKEN（至少 24 位随机值）、XY_HEARING_ORIGIN（砚屿页面的精确 origin，例如 https://tusumy.github.io）。
6. 启动 python -m uvicorn hearing-gateway:app --host 127.0.0.1 --port 8788。使用 Caddy / Nginx / Cloudflare Tunnel 等安全 HTTPS 反向代理对外提供此端口，务必保留授权头。**不能直接将 ears:8020 或 Seven Ears:8765 暴露到公网。**

代理只转发到本机后端，要求 Bearer 令牌且仅允许声明的跨域来源。声音原始文件只用于当次处理，代理不持久化它。上游自己的记录 / 缓存 / 云端转写行为仍以各项目配置为准。

## 砚屿手机端

进入「语音」设置，打开「声音感知」相应开关，填：

- ears 地址：https://voice.example.com/ears
- Seven Ears 地址：https://voice.example.com/seven
- 代理令牌：XY_HEARING_TOKEN 的值（仅保留在当前浏览器会话）

服务地址必须是 HTTPS，localhost 本地开发除外。令牌需要在重新启动应用后重新填写。没有可用后端时不要开启，两条服务各自独立。

## 生效范围

- 聊天语音留言：优先 ears 转写，并在启用 Seven Ears 时增加深度分析；将分析线索存入本条语音附件，折叠显示，并作为同一条消息的非权威上下文发送给 AI。
- 通话里手动录好的片段：仅调用 ears，不走 Seven Ears；不另开一个麦克风。
- Android SpeechRecognizer 自动通话：没有可用录音文件，不调用 ears / Seven Ears，继续使用现有轻量声学探针。
- 声纹服务明确拒绝的声音：不回退到原云端 STT，也不发送这条语音。
- 网络或模型故障：正常语音按原 STT 逻辑回退；Seven Ears 故障不会阻止发送。

请勿把音高、停顿或模型标签直接当作情绪、健康或身份的确定判断。服务未上线不代表本功能已运行。
