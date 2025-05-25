# 表格数据提取器 Chrome 扩展 / Table Data Extractor Chrome Extension

## 项目简介 / Project Introduction
这是一个Chrome浏览器扩展，用于从网页中提取表格数据并导出为CSV文件。
This is a Chrome extension for extracting table data from web pages and exporting to CSV files.

## 主要功能 / Key Features
- 右键菜单提取表格数据 / Extract table data via right-click context menu
- 智能表格检测 / Intelligent table detection
- CSV格式导出 / Export to CSV format
- 支持中文内容 / Support Chinese content
- 可配置选项 / Configurable options

## 文件结构 / File Structure

### `background.js`
后台脚本，处理右键菜单和核心逻辑
Background script handling context menu and core logic

### `content.js`
内容脚本，与网页交互
Content script interacting with web pages

### `utils.js`
工具函数库，包含表格处理功能
Utility functions including table processing

### `popup.html`/`popup.js`
扩展弹出页面
Extension popup page

### `options.html`/`options.js`
设置页面
Options page

### `manifest.json`
扩展配置文件
Extension manifest file

## 安装说明 / Installation
1. 克隆或下载本项目
   Clone or download this project
2. 在Chrome中打开`chrome://extensions/`
   Open `chrome://extensions/` in Chrome
3. 启用"开发者模式"
   Enable "Developer mode"
4. 点击"加载已解压的扩展程序"
   Click "Load unpacked"
5. 选择本项目目录
   Select this project directory

## 使用方法 / Usage
1. 在包含表格的网页上右键点击
   Right-click on a web page with tables
2. 选择"提取表格数据"
   Select "Extract table data"
3. CSV文件将自动下载
   CSV file will be downloaded automatically

## 配置选项 / Configuration
点击扩展图标→"打开设置页面"可配置:
Click extension icon→"Open options" to configure:
- 默认文件名 / Default filename
- 是否包含日期时间 / Include timestamp
- 自动检测设置 / Auto-detection settings

## 开发说明 / Development Notes
- 使用Manifest V3规范
  Using Manifest V3 specification
- 主要API:
  Main APIs:
  - chrome.contextMenus
  - chrome.scripting
  - chrome.downloads
  - chrome.storage

## 许可证 / License
MIT License