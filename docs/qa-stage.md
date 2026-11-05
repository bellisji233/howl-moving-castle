# 主舞台与沉浸验证记录

2026-11-03～04。主舞台用Three.js真实几何，底部常用操作、按需展开工作台。历史证据为 howl-castle-app/artifacts/stage/；最新沉浸布局和转场以 [魔法门QA](qa-magic-door.md) 为准，旧版白色底条已替换。

- 桌面1600×900、1280×800与375/390px尺寸检查：原左右栏移除，说明与控制按文档流排布；工作台桌面独立列、手机位于模型下方。stage/responsive.json、final-375.jpg、final-390.jpg、final-1280.jpg。
- 导览与沉浸独立：stage/guide-immersive.json；最新 immersive/fold-guide.json 证明收起操作后仍 enabled/active。
- 一键分层拆解正反采样见 stage/explode-out/in-*.jpg。新增门锁后重新验证完整网格矩阵，door-v2/roundtrip.json：0→1→0最大矩阵差0，早期反向终点0，14个结构组。
- 9项纯状态测试通过，覆盖世界触地、双骨IK、周期边界、时钟/确定性、导览顺序和接管；当前构建日志见 door-v2/build.log、tests.log。
- 最新沉浸是满窗口画布、默认收起操作、可展开深色半透明工具。隐藏控件inert，Escape返回普通模式；手机视口扩展垂直视角使四足完整可见。

尚未完成用户对电影造型/材质的最终审美确认。手机是真实Chrome尺寸覆盖，未覆盖实体手机触控；低端GPU/集显与完整无障碍扫描仍未测。截图与帧序列分别证明对应静态/过程，未将其声称为60fps成片或完整动作捕捉。
