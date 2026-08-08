# Poster Wall

Poster Wall 是一个 Local First 的 Obsidian 插件。它把包含指定标签的 Markdown 笔记展示为响应式海报墙，不需要 Dataview、Bases 或独立媒体数据库。

> 当前版本只在 macOS 和 Obsidian 1.12.7+ 上进行支持性测试。插件被标记为桌面端专用；它可能在 Windows 或 Linux 上运行，但暂不承诺支持。

## 功能

- 按一个或多个标签展示笔记，父标签自动包含层级子标签。
- 按标题或 Vault 路径搜索，支持最近修改和名称排序。
- 点击海报打开原始笔记，`Command` 点击在新标签页打开。
- 在卡片上直接设置或清除 0.5–5 星评分；点击星星左右半区可选择半星，评分保存在插件数据库中。
- 封面优先级：Property → 插件数据库 → 正文第一张 Markdown 图片 → 占位图。
- 支持 Vault 图片、`[[wikilink]]`、HTTPS 图片和从 Finder 导入图片。
- 监听笔记、附件与文件夹的创建、删除和重命名；编辑标签、Property 或正文图片后自动刷新。
- 默认不修改 Markdown 正文或 Properties。

## 使用

1. 在 Obsidian 中启用 Poster Wall。
2. 打开 **设置 → 社区插件 → Poster Wall**。
3. 添加要展示的标签，例如 `#读书`、`#电影`。
4. 点击左侧 ribbon 的网格图标，或在命令面板执行“打开海报墙”。

卡片主区域始终用于打开笔记。卡片上的图片按钮用于添加或修改插件数据库封面。如果笔记已有有效的封面 Property，Property 保持权威，插件会提示你在笔记中修改它。

### 默认设置

- 封面字段：`cover`
- Finder 图片导入目录：`PosterWall/Covers`
- 支持的导入格式：PNG、JPEG、WebP、GIF、AVIF、SVG

## 数据与隐私

插件通过 Obsidian 的 `loadData()`/`saveData()` 将自身设置、封面覆盖和评分保存在插件目录的 `data.json` 中。它不建立内容数据库，不写入 Markdown，也不包含遥测、广告、账号系统或在线元数据搜索。

如果笔记或插件数据库引用 HTTPS 封面，Obsidian 会直接连接该图片所属服务器以显示图片，因此服务器可能看到你的 IP 地址和常规网络请求信息。插件不会预先探测、下载或代理这些图片，并设置 `no-referrer`。本地导入只会读取用户在系统文件选择器中明确选择的图片。

替换或移除数据库封面不会删除已导入的图片文件，以避免误删用户数据。

## 开发

```bash
npm install
npm run dev
```

完整验证：

```bash
npm run check
```

生产构建生成根目录下的 `main.js`。手动安装时，将 `main.js`、`manifest.json` 和 `styles.css` 复制到测试 Vault 的插件目录。不要在主 Vault 中开发或验证插件。

正式发布前需要把 `manifest.json` 和 `package.json` 中的作者信息替换为维护者公开身份，并确认 Release 仓库地址。

## English

Poster Wall is a local-first Obsidian desktop plugin that displays tagged Markdown notes in a responsive poster grid. It supports search, tag switching, basic sorting, local and HTTPS covers, Finder image import, and live Vault updates. It does not modify Markdown or collect telemetry. The current release is tested and supported on macOS with Obsidian 1.12.7 or newer.

## License

[MIT](LICENSE)
