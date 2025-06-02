// 内容脚本 - 用于与页面交互
(function() {
  'use strict';
  
  'use strict';

  const TABLE_SELECTOR_ATTR = 'data-table-extractor-target';
  let highlightedTable = null; // Keep track of the currently highlighted table

  // 监听右键点击事件
  document.addEventListener('contextmenu', function(e) {
    const element = document.elementFromPoint(e.clientX, e.clientY);
    const table = element ? element.closest('table') : null;

    // Clear previous attribute from any table
    const previouslyMarkedTable = document.querySelector(`[${TABLE_SELECTOR_ATTR}="true"]`);
    if (previouslyMarkedTable) {
      previouslyMarkedTable.removeAttribute(TABLE_SELECTOR_ATTR);
      if (highlightedTable === previouslyMarkedTable) { // only remove old highlight if it's the one we are clearing attr from
          removeHighlight(highlightedTable);
      }
    }
    
    if (highlightedTable && highlightedTable !== table) { // If a different table was highlighted, clear its highlight
        removeHighlight(highlightedTable);
        highlightedTable = null;
    }

    if (table) {
      table.setAttribute(TABLE_SELECTOR_ATTR, 'true');
      highlightTable(table);
      highlightedTable = table; // Store the currently highlighted table
      
      // Optional: remove highlight after a delay, but keep the attribute until extraction
      setTimeout(() => {
        if (table.getAttribute(TABLE_SELECTOR_ATTR) === 'true') { // Only remove highlight if it's still the target
             // We won't remove highlight here anymore, background will tell us when to clear or it clears attribute itself
        }
      }, 3500); // Slightly longer than before, just for visual cue
    }
  }, true); // Use capture phase to ensure this runs before other context menu listeners if any

  // 高亮表格 (Highlight table)
  function highlightTable(table) {
    if(table) {
      table.style.outline = '3px solid #007cba';
      table.style.backgroundColor = 'rgba(0, 124, 186, 0.1)';
    }
  }
  
  // 移除高亮 (Remove highlight)
  function removeHighlight(table) {
    if(table) {
      table.style.outline = '';
      table.style.backgroundColor = '';
    }
  }
  
  // 监听来自background script的消息 (Listen for messages from background script)
  function findAllPdfLinks() {
    // More robust selector for PDF links, attempting case-insensitivity for ".pdf"
    // This regex looks for .pdf at the end of the href, or .pdf? followed by other params.
    const links = Array.from(document.querySelectorAll('a')).filter(link =>
        link.href && /\.pdf(\?.*)?$/i.test(link.href)
    );
    const uniquePdfUrls = new Set();
    links.forEach(link => {
      try {
        const url = new URL(link.href, document.baseURI).href;
        uniquePdfUrls.add(url);
      } catch (e) {
        console.warn('Invalid URL found for PDF link:', link.href, e);
      }
    });
    return Array.from(uniquePdfUrls);
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getRightClickedTableInfo') {
      const targetTableElement = document.querySelector(`[${TABLE_SELECTOR_ATTR}="true"]`);
      if (targetTableElement) {
        sendResponse({ success: true, tableFound: true, selector: `[${TABLE_SELECTOR_ATTR}="true"]` });
      } else {
        sendResponse({ success: true, tableFound: false });
      }
      // Return true to indicate you wish to send a response asynchronously.
      return true;
    } else if (request.action === 'clearTableHighlightAndAttribute') {
        const targetTableElement = document.querySelector(`[${TABLE_SELECTOR_ATTR}="true"]`);
        if (targetTableElement) {
            removeHighlight(targetTableElement);
            targetTableElement.removeAttribute(TABLE_SELECTOR_ATTR);
            highlightedTable = null; // Reset the tracked highlighted table
            sendResponse({ success: true, cleared: true });
        } else {
            sendResponse({ success: false, cleared: false, message: "No target table found to clear." });
        }
        return true;
    } else if (request.action === 'getSelectedText') {
      const selectedText = window.getSelection().toString().trim();
      sendResponse({ selectedText: selectedText });
      // Return true even for synchronous operations like getSelection().toString()
      // to keep the message channel open until sendResponse is resolved, which is a good practice.
      return true;
    } else if (request.action === 'getSelectedTextAndPdfLinks') {
      const selectedText = window.getSelection().toString().trim();
      const pdfLinks = findAllPdfLinks();
      sendResponse({ selectedText: selectedText, pdfLinks: pdfLinks });
      return true;
    } else if (request.action === "getPageTextAndPdfLinks") {
      const pageText = document.body.innerText || '';
      const pdfLinks = findAllPdfLinks(); // Reuse existing function
      sendResponse({ pageText: pageText, pdfLinks: pdfLinks });
      return true;
    }
    // If no action matched, you might not call sendResponse, so returning undefined (by not having a return statement)
    // is appropriate. Or, explicitly return false if the channel should be closed synchronously.
    // For this structure, having each handled 'if' branch return true is safest for async operations.
  });
})();