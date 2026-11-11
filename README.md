# @melt-js/comps-vue3

Vue 3 + TypeScript 的 hel 远程组件提供方，由 [hel-tpl-remote-vue3-comps-ts](https://github.com/hel-eco/hel-tpl-remote-vue3-comps-ts) 拆分为独立 workspace 包。

| 项 | 值 |
| --- | --- |
| npm 包名 | `@melt-js/comps-vue3` |
| hel 组名（`appGroupName` / `LIB_NAME`） | `comps-vue3` |
| 本地联调地址 | `http://localhost:20020` |
| 开发 / 构建 | `vue-cli-service`（Vue CLI 5 + webpack 5），产物为 UMD |

## 目录说明

```
src/
  main.ts                    入口：libReady 暴露组件；独立访问时挂载调试页
  loadApp.ts                 独立开发页的挂载逻辑
  components/
    index.ts                 对外暴露的组件集合（见下方组件表）
    HelloWorld.vue           演示组件
    CircularMenu.vue         环形菜单（wheel 半环 / fan 整环，定位可切 relative / sticky / fixed / absolute）
    MagneticButton.vue       磁吸按钮（指针偏移 + 回弹，强度 / 主色 / 光点可调）
    SpotlightButton.vue      聚光灯按钮（指针处径向光斑，半径 / 配色可调）
    GlowBorder.vue           流光边框（渐变光块绕框跑圈 + 呼吸光晕，尺寸 / 厚度 / 时长 / 配色可调）
    Typewriter.vue           逐字打印（字速 / 延迟 / 循环 / 光标可调，支持 restart / finish）
    TiltCard.vue             倾斜卡片（指针驱动 3D 倾斜 + 可选反光，图片或插槽内容）
    FloatingLabelInput.vue   浮动标签输入框（标签浮起 + 流动光边）
    PasswordInput.vue        密码框（明文切换，SVG 眼睛图标）
    ExpandSearch.vue         收缩搜索框（圆形收起 / 胶囊展开 + 清除按钮）
    CyberInput.vue           赛博朋克故障输入框（抖动 / 扫描线 / 色差 / 数据碎片）
    CorgiInput.vue           柯基交互输入框（眼睛跟随指针 + 打字弹跳 + 思考气泡）
    GridLoading.vue          九宫格 loading（九个方块错峰缩放呼吸）
    GooeyBallsLoading.vue    元素交融 loading（SVG gooey 滤镜 + 小球绕圈）
    DnaLoading.vue           DNA 双螺旋 loading（纯 CSS 错峰摆动）
    NeonRingLoading.vue      霓虹呼吸环 loading（四层环 + 轨道粒子 + 脉冲波纹）
    GearLoading.vue          齿轮联动 loading（程序化生成 SVG 齿轮 + 蒸汽 + 进度条）
    VortexLoading.vue        粒子漩涡 loading（canvas 三层粒子 + 光晕 + 连线）
    WaterBallLoading.vue     水球进度 loading（波浪水面 + 水滴涟漪 + 百分比）
    HourglassLoading.vue     沙漏 loading（纯 CSS 沙流 + 自动翻转）
    CubeWaveLoading.vue      盒子波场 loading（N×N CSS 3D 方块错峰起伏）
    JellyLoading.vue         果冻弹跳 loading（canvas 果冻球 + 压扁拉长 + 碎屑）
    DominoLoading.vue        多米诺 loading（canvas 骨牌连锁倒下 + 进度条）
    SlideAuthPanel.vue       拟态登录 / 注册卡片（面板互换滑动，v-model:mode + submit 事件）
    TerminalAuth.vue         终端极客风登录面板（3D 翻转切换 + 日志行 + 密码强度条）
    WheelMenuButton.vue      可拖拽的悬浮轮盘按钮（轻点展开环形菜单，拖拽不误触）
    PhotoSphere.vue          3D 照片球（Fibonacci 球面 + 拖拽惯性 + 点击放大 + 本地上传）
    WarpStarfield.vue        星际穿越（曲速星流 + 星云 / 速度线 / 晕影，可交互调速）
    ChinaRouteMap.vue        中国地图轨迹（轮廓 / 省份线 / 路线站点 / 播放镜头跟随）
    china-route-map.data.ts  上面这张地图的底图数据（轮廓折线 + 城市 / 景点坐标，来自原 map-data.js）
    SplitCodePreview.vue     界面 ↔ 代码分割线（Shadow DOM 渲染 + 代码编辑 + 拖动切换）
    BookFlip.vue             书本翻页（对开页绕书脊翻转，正反面内容 + 按钮 / 键盘 / 自动播放）
    MinecraftChest.vue       Minecraft 箱子（纯 CSS 3D 面片拼的方块模型，拖动环视 + 点击开盖）
    FilmRoll.vue             旅行胶卷（横向胶片轮播，拖动拉扯 / 重影 + 惯性吸附 + 时间轴 + 全屏预览）
    RopeGallery.vue          绳串图片（会晃的绳子串起照片，风吹摆动 + 拖动拉绳回弹）
    CompareSlider.vue        图片对比（Before / After 叠加，拖中线 / 方向键 / 双击回正 / 自动巡航）
    PosterCollage.vue        海报拼贴（设计稿分层摆放 + 悬停放大置顶 + 容器等比缩放）
    LiftCard.vue             立体卡片（hover 时底板仰起 / 照片沿 Z 轴弹出 / 倒影浮现）
    BilibiliBanner/          B 站节日横幅（23 套主题，多层图片 / 视频跟随指针横向视差）
    *.propsSchema.json       与组件同名的属性面板 schema（vue3-leva-gen-schema 生成，勿手改）
  configs/subApp.ts          hel 组名，需与 package.json appGroupName 一致
  entrance/
    libProperties.ts         暴露给使用方的组件对象
    libTypes.ts              类型入口 + rollup 打包入口（产出 hel_proxy 空壳代理）
public/bilibili/<theme>/      上面横幅的图层资源（图片 / 视频 / logo，dev 与 unpkg 都按绝对地址加载）
public/index.html            独立访问时的页面；vue 以 data-helappend="0" 引入
playground.config.mjs        生成 propsSchema 的组件清单 + 控件范围（滑杆 min/max/step）
vue.config.js                publicPath / UMD / vue external / 产物拆包 / 端口 20020
appInfo.js                   hel-dev-utils 生成的子应用元信息
rollup.config.mjs            产出 hel_proxy / hel_proxy_es
scripts/                     check_name、meta、preview、prepublishOnly
```

## 本地开发 / 构建

```bash
# 在仓库根目录
pnpm comps-vue3:dev         # 起 20020 端口（vue-cli-service serve）
pnpm comps-vue3:build       # webpack 构建 + 生成 hel-meta.json + 生成 hel_proxy
pnpm comps-vue3:build:local # 构建并把产物资源地址固定为 http://localhost:20020
pnpm comps-vue3:preview     # 本地预览 hel_dist（需先 build:local）
```

- `publicPath` 由 `appInfo.getPublicPathOrUrl(...)` 推导：dev 为 `http://localhost:20020/`，build 为 unpkg 地址；`HEL_APP_HOME_PAGE` 优先级最高（`build:local` 用的就是它）。
- 远程产物把 `vue` external 成 `window.Vue`，独立访问时由 `public/index.html` 里的 Vue CDN 提供；宿主通过 hel 加载本模块时，该脚本带 `data-helappend="0"`，会被跳过，从而复用宿主 `bindVueRuntime` 注入的那一份 vue，避免双 vue 导致响应式失效。
- `vue.config.js` 里 `output.library` 为 hel 组名、`libraryTarget: 'umd'`、`chunkLoadingGlobal` 为 hel 生成的 jsonp 名。
- `vue.config.js` 用 `splitChunks` 拆包（不再限制 chunk 数量）：`vendors`（node_modules 依赖）、`comp-<组件名>`（每个组件一块，含它的样式与 propsSchema）、`libProperties` / `loadApp`（`main.ts` 里用 `webpackChunkName` 命名），`app.js` 只剩入口壳。改一个组件只会让它的块换 hash，`vendors` 能长期命中 CDN 缓存。
- 与 [`demo-vue3`](../demo-vue3) 配合使用：宿主 `preFetchLib('comps-vue3')` 加载本模块并渲染各示例组件。

## CircularMenu 定位

组件 root 就是「按钮中心」这个锚点盒子（`display: grid`，宽高等于按钮尺寸，字号 16px 基准，内部全部 em 排版）。
按钮居中、圆环盒子以 root 中心为圆心，所以**定位方式完全由 root 决定**，和 `variant`（半环 / 整环）无关：

| prop | 说明 |
| --- | --- |
| `position` | `relative`（默认，留在文档流里随页面滚动）/ `sticky` / `fixed` / `absolute` |
| `anchor` | 非 `relative` 时按钮中心贴哪条边：`top` / `bottom` / `left` / `right` / 四角 / `center`；单边锚点在另一轴居中 |
| `offset` | 距锚点边的距离（px），`sticky` 时就是吸顶/吸底的留白 |
| `direction` | `up` / `down` / `auto`（默认，贴顶锚点向下）；只有会裁半圆的 `wheel` 用得到 |

```vue
<!-- 随页面滚动：什么都不用写，默认就是 relative -->
<CircularMenu :items="items" />

<!-- 原来贴视口底部的效果 -->
<CircularMenu position="fixed" anchor="bottom" :offset="24" :items="items" />

<!-- 容器内吸顶（按钮吸在滚动容器顶部，圆环自动朝下） -->
<CircularMenu position="sticky" anchor="top" :offset="12" :items="items" />

<!-- 贴在卡片的右上角（卡片需要 position: relative） -->
<CircularMenu position="absolute" anchor="top-right" :items="items" />
```

注意：

- `sticky` 只负责纵向吸附，横向位置留给文档流，需要居中时给组件加 `margin-inline: auto`。
- `fixed` / `absolute` 的包含块遵循 CSS 规则：祖先带 `transform` / `filter` / `backdrop-filter` 时，`fixed` 会改以该祖先为包含块。
- 遮罩（`overlay`）是视口级 `position: fixed`；root 上不要加 `transform`，否则遮罩会被限制在按钮盒子里。
- 层叠上下文由 root 提供，默认 `z-index: 41`，可用 `--cm-z-index` 覆盖。

## 组件一览

| 组件 | 来源 / 说明 | 主要 props |
| --- | --- | --- |
| `HelloWorld` | 模板自带的演示组件 | `msg`、`name` |
| `CircularMenu` | 圆形菜单 | `items`、`variant`、`position`、`anchor`、`offset`、`direction`、`overlay` |
| `MagneticButton` | 磁吸按钮：指针在按钮内时按偏移比例朝指针位移，离开时慢速回弹 | `label`、`strength`、`color`、`cursorDot` |
| `SpotlightButton` | 聚光灯按钮：指针处跟出径向光斑，移出后淡出 | `label`、`color`、`radius` |
| `GlowBorder` | 流光边框：渐变光块绕四条边跑圈 + 外圈呼吸光晕 | `size`、`radius`、`thickness`、`color`、`color2`、`duration`、`glow`、`background` |
| `Typewriter` | 逐字打印：支持 `\n` 换行、循环、光标，暴露 `restart()` / `finish()` | `text`、`speed`、`startDelay`、`loop`、`loopDelay`、`cursor`、`cursorChar` |
| `TiltCard` | 倾斜卡片：指针驱动 3D 倾斜，可选高光反光；图片或插槽内容 | `src`、`alt`、`maxTilt`、`scale`、`radius`、`glare`、`shadow` |
| `FloatingLabelInput` | 浮动标签输入框：聚焦或有值时标签浮到框上方，框外流动光边（纯 CSS 选择器驱动） | `label`、`modelValue`、`type`、`color`、`height`、`disabled` |
| `PasswordInput` | 密码框：一键在 `password` / `text` 间切换看明文，按钮可关 | `label`、`modelValue`、`placeholder`、`color`、`toggleable`、`autocomplete` |
| `ExpandSearch` | 收缩搜索框：收起是圆钮，聚焦摊成胶囊，带清除按钮与 `search` / `clear` 事件 | `modelValue`、`placeholder`、`color`、`collapsedWidth`、`radius`、`height`、`clearable` |
| `CyberInput` | 赛博朋克故障输入框：抖动 / 扫描线 / 红蓝错位 / 数据碎片 / 十六进制计数 | `label`、`modelValue`、`placeholder`、`statusText`、`version`、`footerLeft`、`pink`、`cyan`、`glitch`、`fragment`、`flash` |
| `CorgiInput` | 柯基交互输入框：眼睛跟随指针、打字弹跳 + 思考气泡、点击眨眼 | `modelValue`、`placeholder`、`tipShort`、`tipMid`、`tipLong`、`bubble`、`trackEye`、`eyeRange`、`dogSize` |
| `GridLoading` | 九宫格 loading：九个方块依次缩放呼吸 | `size`、`color`、`speed`、`stagger`、`gap`、`radius`、`paused`、`text` |
| `GooeyBallsLoading` | 元素交融 loading：小球绕圈并用 SVG gooey 滤镜融合 | `size`、`ballSize`、`ballCount`、`colors`、`color`、`speed`、`stagger`、`gooey`、`paused` |
| `DnaLoading` | DNA 双螺旋 loading：两列节点摆动 + 碱基桥，纯 CSS 驱动 | `height`、`width`、`nodeCount`、`amplitude`、`dotSize`、`color`、`color2`、`speed`、`text` |
| `NeonRingLoading` | 霓虹呼吸环 loading：四层环顺逆旋转 + 轨道粒子 + 脉冲波纹 | `size`、`color`~`color4`、`speed`、`auto`、`progress`、`showPercent`、`paused` |
| `GearLoading` | 齿轮联动 loading：按齿数程序化生成 SVG 齿轮 + 蒸汽 + 进度条 | `size`、`colors`、`speed`、`showBar`、`steam`、`paused`、`text` |
| `VortexLoading` | 粒子漩涡 loading：canvas 三层粒子绕心旋转 + 光晕 + 同层连线 | `size`、`count`、`hue`、`speed`、`connect`、`trail`、`paused`、`text` |
| `WaterBallLoading` | 水球进度 loading：波浪裁出水面 + 水滴涟漪 + 百分比 | `size`、`color`、`color2`、`auto`、`progress`、`duration`、`speed`、`showPercent`、`drops` |
| `HourglassLoading` | 沙漏 loading：纯 CSS 上下锥沙量此消彼长 + 自动翻转 | `size`、`speed`、`sandColor`、`frameColor`、`paused` |
| `CubeWaveLoading` | 盒子波场 loading：N×N 个 CSS 3D 方块按中心距离错峰起伏 | `size`、`gridSize`、`hue`、`speed`、`paused`、`text` |
| `JellyLoading` | 果冻弹跳 loading：带表情的果冻球轮流弹跳、压扁拉长、落地碎屑 | `size`、`count`、`speed`、`stagger`、`face`、`paused`、`text` |
| `DominoLoading` | 多米诺 loading：3D 骨牌连锁倒下 + 进度条，倒完自动重来 | `size`、`count`、`speed`、`showBar`、`paused`、`text` |
| `SlideAuthPanel` | 拟态登录 / 注册卡片：两块面板左右互换滑动，表单值走 `submit` | `mode`、`accent`、`height`、`duration`、两套标题与文案、`social`、`forgot` |
| `TerminalAuth` | 终端荧光风登录面板：登录 / 注册 3D 翻转 + 日志行 + 密码强度条 | `mode`、`accent`、`sysTag`、`loginTitle`、`registerTitle`、按钮与链接文案、提示符、`strength`、`logs`、`scanline` |
| `WheelMenuButton` | 可拖拽的悬浮轮盘：轻点展开环形菜单，拖拽不误触，拖动范围预留圆环空间 | `items`、`size`、`itemSize`、`radius`、`color`、`color2`、`itemColor`、`accent`、`openText`、`closeText`、`open`、`draggable`、`dragThreshold`、`edgeMargin`、`initialX`、`initialY`、`duration`、`zIndex` |
| `PhotoSphere` | 3D 照片球：Fibonacci 球面铺图、拖动旋转带惯性、点击放大、本地上传（压缩后替换） | `images`、`size`、`thumbSize`、`radius`、`maxItems`、`draggable`、`autoRotate`、`autoSpeed`、`sensitivity`、`friction`、`upload`、`maxUploadSize`、`zoomable` |
| `WarpStarfield` | 星际穿越：曲速星流 + 星云 / 速度线 / 晕影，指针控方向、按住加速、滚轮调速 | `stars`、`speed`、`boost`、`minSpeed`、`maxSpeed`、`interactive`、`hud`、`tip`、`tipText`、`color`、`nebula`、`paused` |
| `ChinaRouteMap` | 中国地图轨迹：canvas 画轮廓 + 省份线，按经纬度铺路线，点地图加点、缩放平移、播放镜头跟随 | `points`、`editable`、`duration`、`color`、`followZoom`、`showCities`、`showLabels`、`controls`、`tip`、`tipText`、`playing` |
| `SplitCodePreview` | 界面 ↔ 代码分割线：左 Shadow DOM 渲染、右代码可编辑，拖动分割线切换 | `code`、`split`、`editable`、`glitch`、`radius`、`accent`、`minSplit`、`maxSplit` |
| `BookFlip` | 书本翻页：对开页绕书脊翻转，正反面各有标题 / 正文 / 底图 | `pages`、`cover`、`endCover`、`width`、`height`、`duration`、`paper`、`ink`、`modelValue`、`controls`、`hint`、`autoplay`、`autoplayInterval` |
| `MinecraftChest` | Minecraft 箱子：纯 CSS 3D 面片拼的方块箱，拖动环视 + 点击开盖 + WebAudio 音效 | `open`、`width`、`depth`、`height`、`lidHeight`、`wall`、`scale`、`yaw`、`pitch`、`draggable`、`clickable`、`sound`、`scene`、`duration`、`hint` |
| `FilmRoll` | 旅行胶卷：横向胶片轮播，拖动时按速度拉扯 / 模糊 / 重影，惯性 + 吸附 | `photos`、`frame`、`photoHeight`、`gap`、`index`、`rollLabel`、`rollSubLabel`、`draggable`、`wheelable`、`details`、`controls`、`timeline`、`viewer` |
| `RopeGallery` | 绳串图片：一根会晃的绳子串起照片，风吹摆动 + 拖动拉绳回弹 | `photos`、`wind`、`photoWidth`、`photoHeight`、`inset`、`draggable`、`controls`、`hint`、`hintText`、`paused` |
| `CompareSlider` | 图片对比：Before / After 叠加对比，拖中线 / 方向键 / 双击回正 / 自动巡航 | `before`、`after`、`position`、`ratio`、`beforeLabel`、`afterLabel`、`showLabels`、`handleSize`、`accent`、`autoSweep`、`sweepSpeed` |
| `PosterCollage` | 海报拼贴：设计稿上分层摆放的图，悬停放大并置顶，整张画布按容器等比缩放 | `items`、`width`、`height`、`background`、`paper`、`hoverScale`、`hoverLift`、`maxScale`、`clickable` |
| `LiftCard` | 立体卡片：hover 时底板仰起、照片沿 Z 轴弹出、倒影浮现 | `image`、`alt`、`width`、`height`、`tilt`、`liftZ`、`hoverLift`、`radius`、`from`、`to`、`reflection`、`title`、`subtitle`、`active` |
| `BilibiliBanner` | B 站节日横幅：从 `bilibili-banner-master` 的 Vue 版本迁移，23 套主题，多层图片 / 视频按 bench 系数跟随指针横向错位 | `theme`、`height`、`logo`、`background` |

```vue
<MagneticButton label="MAGNETIC" :strength="0.5" color="#4ade80" @click="onClick" />
<SpotlightButton label="SPOTLIGHT" :radius="140" />
<GlowBorder :size="240" :thickness="4" color="#00f5ff" color2="#6e00ff">
  <span>内容</span>
</GlowBorder>
<Typewriter text="hello\n欢迎来到 comps-vue3" :speed="90" @done="onDone" />
<TiltCard :max-tilt="12" glare>
  <img src="/cover.png" alt="" />
</TiltCard>

<!-- 输入框：都是 v-model + 一个原生 input -->
<FloatingLabelInput v-model="username" label="用户名" />
<PasswordInput v-model="password" label="登录密码" />
<ExpandSearch v-model="keyword" placeholder="搜索..." @search="onSearch" />
<CyberInput v-model="command" label="NEURAL_LINK" @enter="onEnter" />
<CorgiInput v-model="nickname" placeholder="输入点什么吧～" />
```

> 输入框组件都通过 `v-model` 双向绑定，并额外透出 `enter` / `focus` / `blur` 等事件；`modelValue` 是受控值，但组件内部也存了一份，所以不写 `v-model` 直接当非受控输入框用也能正常输入。

每个组件的 props 上方都有 `/** @description */` 注释，`pnpm run gen:schema`（`start` / `build` 会自动跑）据此生成同名的 `*.propsSchema.json`，`demo-vue3` 的属性面板直接读它渲染控件；控件范围在 `playground.config.mjs` 的 `hints` 里调。

## BilibiliBanner 主题

组件只暴露 `theme`，23 套主题的数据在 `src/components/BilibiliBanner/themes/<theme>.ts`，由 `bilibili-banner-master/vue` 的 inst 组件迁移而来：

| 季节 | 主题 |
| --- | --- |
| 春 | `spring-1` ~ `spring-6` |
| 夏 | `summer-1` ~ `summer-7` |
| 秋 | `autumn-1` ~ `autumn-5` |
| 冬 | `winter-1` ~ `winter-5` |

- 图层资源放在 `public/bilibili/<theme>/`；`vue.config.js` 用 `DefinePlugin` 把 `publicPath` 注入成 `__BILIBILI_BANNER_ASSET_BASE__`，所以远程加载时图片 / 视频从 unpkg 上的 `hel_dist/bilibili/...` 取，而不是宿主的域名。
- 只保留主题数据里实际会请求的文件 + `logo.png`（原仓库里同名的 gif 备用图、多格式副本没有被 Vue 版引用，没有带进来）；每套主题的 `type` 都是 `'video'`，所以视频用的是 webm / mp4。
- 原版数据里 `x` / `newX` 会被 `marginLeft` 整体平移，多个实例共用同一份数组会互相污染，所以 `createBilibiliBannerTheme()` 每次调用都返回新的图层数组。
- 拖动逻辑与原版一致：鼠标 / 手指拖动时每层按自己的 `bench` 系数插值 `x / y / rotate / scale / opacity`，边界由 `maxLeftPosition` / `maxRightPosition`（或 `maxMove`）限制，触摸端点左上角 logo 复位。

## 产物与发布

`pnpm build` 产出：

- `hel_dist/`：webpack 的 UMD 产物 + `hel-meta.json` + `hel_proxy/entry.js`。产物按块输出，例如：

```
js/app.<hash>.js                入口壳（runtime + main.ts）
js/vendors.<hash>.js            node_modules 依赖
js/libProperties.<hash>.js      组件集合（expose 给宿主的那份）
js/loadApp.<hash>.js            独立访问时的调试页
js/comp-<组件名>.<hash>.js       一个组件一块
css/...                         组件样式按块输出
```
- `hel_proxy/`、`hel_proxy_es/`：消费方 `npm i @melt-js/comps-vue3` 后 import 到的空壳代理

发布相关脚本：

- `prepublishOnly`：发布前校验 `package.json` 版本号与 `hel_dist/hel-meta.json` 的 `build_version` 一致，且产物已构建。
- `publish:stage`：`pnpm run build && npx -y npm@11 stage publish`，走 npm stage 发布。
