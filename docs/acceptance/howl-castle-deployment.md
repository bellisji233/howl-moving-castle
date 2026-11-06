# GitHub 与在线发布验收

2026-11-06。用户明确回复“允许公开仓库并发布网页”，授权将源码和项目文档公开。仓库 bellisji233/howl-moving-castle 已公开，GitHub Pages 已启用。备份、依赖、构建目录与本地QA截图不进入源码仓库。

- 浏览：https://bellisji233.github.io/howl-moving-castle/
- 仓库：https://github.com/bellisji233/howl-moving-castle
- 已发布应用版本：51feb5c7541cf6425fcf8138480728634106b03d
- 成功发布任务：https://github.com/bellisji233/howl-moving-castle/actions/runs/42157617265

| ID | 可观察结果 | 验证方法 | 状态 |
|---|---|---|---|
| AC-DP1 | GitHub仓库包含最新同步圆盘源码，main与本地提交一致 | remote HEAD与本地SHA比对 | [x] 应用版本51feb5c已推送并发布；随后仅补充验收文档，应用与工作流无变动 |
| AC-DP2 | main推送触发构建、9项测试与Pages发布成功 | Actions完整运行结果 | [x] 42157617265的依赖安装、9项测试、构建、Pages配置、制品上传、部署全部success |
| AC-DP3 | 公共浏览URL返回200；JS、CSS、字体加载成功；实际Three.js画面就绪 | HTTP与生产浏览器检查 | [x] 正式URL HTTP200，app ready，JS/CSS/两种字体请求200；页面错误与失败请求均0 |
| AC-DP4 | 线上沉浸展开后无控件重叠；点击四色圆盘换景、实体指针同步；桌面/375px检查 | 生产浏览器实际交互 | [x] 1600×900、375×844，沉浸画布全屏、底部三组控件无相交/横溢、按钮≥44px；6次选景完成；951帧采样指针角差0°；收起inert、Escape返回正常 |

证据：本地 `howl-castle-app/artifacts/deployment/production-verification.json` 和 `desktop-initial.png`、`immersive-1600.png`、`immersive-375.png`。实际Chrome / ANGLE Metal / Apple M5 Pro，DPR1；不是实体手机和低端GPU测试。本次仅部署，没有改变上一轮视觉设计；屏幕造型主观判断范围仍见圆盘验收。

历史阻塞已解除：最初私有仓库无法启用当前套餐下的Pages；取得用户明确公开授权后启用成功。AC-DP1～DP4均通过，无剩余阻塞项。
