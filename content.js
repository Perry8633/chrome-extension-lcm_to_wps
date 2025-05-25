// 内容脚本 - 用于与页面交互
(function() {
  'use strict';
  
  // 存储右键点击的位置
  let lastRightClickPosition = { x: 0, y: 0 };
  
  // 监听右键点击事件
  document.addEventListener('contextmenu', function(e) {
    lastRightClickPosition.x = e.clientX;
    lastRightClickPosition.y = e.clientY;
    
    // 检查点击位置是否在表格内
    const element = document.elementFromPoint(e.clientX, e.clientY);
    const table = element ? element.closest('table') : null;
    
    if (table) {
      // 高亮显示表格
      highlightTable(table);
      
      // 3秒后移除高亮
      setTimeout(() => {
        removeHighlight(table);
      }, 3000);
    }
  });
  
  // 高亮表格
  function highlightTable(table) {
    table.style.outline = '3px solid #007cba';
    table.style.backgroundColor = 'rgba(0, 124, 186, 0.1)';
  }
  
  // 移除高亮
  function removeHighlight(table) {
    table.style.outline = '';
    table.style.backgroundColor = '';
  }
  
  // 监听来自background script的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getLastClickPosition') {
      sendResponse(lastRightClickPosition);
    }
  });
})();