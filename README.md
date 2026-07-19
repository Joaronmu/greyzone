# GREY ZONE / 灰域

《灰域》是由 Aaron Mu 创作的第一人称潜行游戏原型。玩家需要在昏暗、充满监控与巡逻敌人的区域中寻找路线并完成行动。

在线入口：[greyzone.17hiking.cn](https://greyzone.17hiking.cn)

## 运行方式

本项目是基于 HTML、JavaScript 与 WebGL 的浏览器游戏，不需要安装独立客户端。

1. 下载或克隆本仓库。
2. 使用最新版 Chrome、Safari 或 Edge 打开 `stealth-game-3d.html`。
3. 点击游戏画面以启用第一人称鼠标视角。

若浏览器限制直接打开本地 HTML 文件，可在项目目录启动任意静态文件服务器后，再访问 `stealth-game-3d.html`。

## 主要入口

| 文件 | 用途 |
| --- | --- |
| `index.html` | 网站根入口，打开域名即可进入游戏 |
| `stealth-game-3d.html` | 当前 3D 游戏版本与主运行入口 |
| `stealth-game.html` | 早期网页版本 |
| `three.min.js` | Three.js 渲染库 |
| `engine-core/` | 游戏引擎核心模块原型 |
| `*_model.*`、`*_rig.*` | 角色、敌人与动画资源 |

## 开发说明

项目包含用于模型转换、动画验证和画面检查的辅助脚本与素材。运行游戏本身不依赖 `node_modules`；该目录已被忽略，开发测试所需依赖可按 `package.json` 另行安装。
