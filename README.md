# 哈尔的移动城堡 · 奇想建筑工坊

可交互的 Three.js 城堡：自由绕行、四足行走、结构拆解、四色魔法门与五处目的地，以及全屏沉浸与自动导览。

**[打开在线体验](https://bellisji233.github.io/howl-moving-castle/)**

左下四色黄铜圆盘可直接选景，中央返回工坊；屏幕指针与实体门锁同步。支持鼠标、键盘和移动屏幕，遵循系统减少动态效果设置。

## 本地运行

需要 Node.js 22.12 或更新版本。

```sh
cd howl-castle-app
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

## 发布

推送到 `main` 后，GitHub Actions 会安装锁定依赖、运行测试、构建并发布到 GitHub Pages。构建目录为 `howl-castle-app/dist`，资源使用相对路径，支持仓库子目录访问。发布记录见 [Actions](https://github.com/bellisji233/howl-moving-castle/actions)。

## 项目资料

- [详细使用说明](howl-castle-app/README.md)
- [同步圆盘设计](docs/design/howl-castle-portal-dial.md)
- [圆盘交互与布局验证](docs/qa-portal-dial.md)

这是程序化风格化的创意结构研究，内部机构为创意推演，不是工程动力学仿真。未内嵌电影画面、音乐或第三方城堡模型；原作形象归相应权利方。字体许可证位于 `howl-castle-app/public/fonts/`。
