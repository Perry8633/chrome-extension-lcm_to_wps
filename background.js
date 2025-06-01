// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "extractKeywordData",
    title: "提取页面关键词数据",
    contexts: ["all"]
  });
});

// 处理右键菜单点击事件
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "extractKeywordData" && tab) {
    fetchSettingsAndInject(tab.id);
  }
});

function fetchSettingsAndInject(tabId) {
  chrome.storage.sync.get(['keywordSettings', 'filename', 'dateFormat'], (settings) => {
    const keywordSettings = settings.keywordSettings || [];
    const filename = settings.filename || 'page_keyword_data'; // Changed default filename
    const dateFormat = settings.dateFormat !== undefined ? settings.dateFormat : false;

    chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: extractPageKeywordData,
      args: [settings.keywordSettings, settings.filename, settings.dateFormat]
    });
  });
}

// Injected script for keyword-based extraction
function extractPageKeywordData(keywordSettings, filename, dateFormat) {

  // Helper function to get clean text from an element
  function getElementText(element) {
    if (!element) return '';
    let text = element.textContent || element.innerText || '';
    return text.trim().replace(/\s+/g, ' ');
  }

  // Helper function to find all occurrences of a keyword
  function findKeywordOccurrences(contextNode, keyword) {
    const occurrences = [];
    if (!keyword || !contextNode) return occurrences; // Guard against null/empty keyword or contextNode
    const lowerKeyword = keyword.toLowerCase();
    const walker = document.createTreeWalker(contextNode, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while (node = walker.nextNode()) {
      if (node.nodeValue && node.nodeValue.toLowerCase().includes(lowerKeyword)) {
        occurrences.push({ textNode: node, element: node.parentElement });
      }
    }
    return occurrences;
  }

  // Helper function to find a significant block-level parent
  function getSignificantBlockParent(element) {
      let current = element;
      while (current && current !== document.body) {
          const display = window.getComputedStyle(current).display;
          // Consider common block-level display types or semantic container elements
          if (display === 'block' || display === 'list-item' || display === 'table-cell' || display === 'flex' || display === 'grid' ||
              current.tagName.match(/^(P|DIV|LI|TD|TH|SECTION|ARTICLE|MAIN|ASIDE|HEADER|FOOTER|NAV)$/i)) {
              if (current.tagName.toLowerCase() !== 'body' && current.tagName.toLowerCase() !== 'html') {
                   // Avoid parents that are too generic or too large unless they are the direct keyword element's parent
                  if (current.contains(element) && current !== element && current.textContent.trim().length < 1000) { // Heuristic: avoid huge containers
                    return current;
                  }
              }
          }
          current = current.parentElement;
      }
      return element; // Fallback to the element itself
  }


  // Helper function to get data around a keyword
  function getDataAroundKeyword(keywordElement, direction, extractBelowType, extractRightType, keywordValue) {
    const results = [];
    if (!keywordElement) return [''];

    // Use the keywordElement itself initially, or its significant parent for broader context
    const baseElementForNavigation = getSignificantBlockParent(keywordElement);

    if (direction === "Above") {
        let previousElem = baseElementForNavigation.previousElementSibling;
        if (previousElem) {
            results.push(getElementText(previousElem));
        } else {
            // If no previous sibling, try parent's previous sibling if keywordElement was the first child
            if (baseElementForNavigation.parentElement && baseElementForNavigation === baseElementForNavigation.parentElement.firstElementChild) {
                previousElem = baseElementForNavigation.parentElement.previousElementSibling;
                if (previousElem) results.push(getElementText(previousElem));
            }
        }
    } else if (direction === "Below") {
        let nextElem = baseElementForNavigation.nextElementSibling;
        if (nextElem) {
            results.push(getElementText(nextElem));
            if (extractBelowType === "Entire Column") { // Re-interpret "Entire Column" as "next few siblings"
                let count = 0;
                let currentSibling = nextElem;
                while(currentSibling.nextElementSibling && count < 3) { // Get up to 3 more next siblings
                    currentSibling = currentSibling.nextElementSibling;
                    results.push(getElementText(currentSibling));
                    count++;
                }
            }
        } else {
             // If no next sibling, try parent's next sibling if keywordElement was the last child
            if (baseElementForNavigation.parentElement && baseElementForNavigation === baseElementForNavigation.parentElement.lastElementChild) {
                nextElem = baseElementForNavigation.parentElement.nextElementSibling;
                if (nextElem) results.push(getElementText(nextElem));
            }
        }
    } else if (direction === "Right") {
        let combinedText = "";
        let sibling = keywordElement.nextSibling;

        // Attempt 1: Accumulate adjacent text nodes immediately following the keyword's text node (within same parent)
        // This is tricky because keywordElement is parentElement of the text node.
        // We need to find the text node that contained the keyword, then look at *its* nextSibling.
        // For simplicity, let's first try getting text from keywordElement itself, excluding the keyword.
        // This is complex. A simpler start:

        let elementToSearchIn = keywordElement; // Start with the keyword's direct parent

        // Try to find text content immediately to the right of the keyword *within* the keywordElement
        // This would involve splitting the text node, which is too complex for injected script.
        // Alternative: use nextElementSibling of the keywordElement.

        let nextElemSibling = keywordElement.nextElementSibling;
        if (nextElemSibling && keywordElement.parentElement === nextElemSibling.parentElement) { // Ensure it's a true sibling
            results.push(getElementText(nextElemSibling));
        } else {
            // If no next element sibling, or if keywordElement is part of a larger text block,
            // try to get the text of the parent, and remove the keyword and text before it.
            // This is also complex. Fallback: if keywordElement has text after the keyword itself.
            const parentText = getElementText(keywordElement);
            const keywordIndex = parentText.toLowerCase().indexOf(keywordValue.toLowerCase());
            if (keywordIndex !== -1) {
                const textAfterKeyword = parentText.substring(keywordIndex + keywordValue.length).trim();
                if (textAfterKeyword) {
                    results.push(textAfterKeyword.split(/\s+/).slice(0, 5).join(' ')); // Take a few words
                }
            }
        }


        if (extractRightType === "Entire Row" && results.length > 0) { // "Entire Row" means get more siblings to the right
            let currentElement = keywordElement.nextElementSibling; // Start from the one we might have already processed
            if (currentElement && keywordElement.parentElement !== currentElement.parentElement) currentElement = null; // not a real sibling

            let count = 0;
            while(currentElement && count < 3) { // get up to 3-4 elements
                 const currentElementText = getElementText(currentElement);
                 if (!results.includes(currentElementText)) { // avoid duplicates
                    results.push(currentElementText);
                 }
                 currentElement = currentElement.nextElementSibling;
                 if (!currentElement || keywordElement.parentElement !== currentElement.parentElement) break;
                 count++;
            }
        }
         // If results are still empty, and keywordElement is small, try parent's next sibling
        if (results.filter(s => s).length === 0 && baseElementForNavigation !== keywordElement) { // if significant parent was used
            let parentNextSibling = baseElementForNavigation.nextElementSibling;
            if (parentNextSibling) results.push(getElementText(parentNextSibling));
        }

    }
    return results.length > 0 ? results.filter(s => s && s.trim() !== '') : [''];
  }

  // Main logic for extractPageKeywordData
  let extractedData = [];
  const activeKeywords = keywordSettings.filter(ks => ks && ks.keyword && ks.keyword.trim() !== '' && ks.direction !== "None");

  if (activeKeywords.length === 0) {
    alert("未定义活动关键词，请在设置页面配置。 (No active keywords defined, please configure in settings.)");
    return;
  }

  activeKeywords.forEach(setting => {
    const occurrences = findKeywordOccurrences(document.body, setting.keyword);

    if (occurrences.length === 0) {
      extractedData.push([setting.keyword, "KEYWORD_NOT_FOUND"]);
    } else {
      // Process only the first occurrence for now
      const firstOccurrence = occurrences[0];
      const keywordElement = firstOccurrence.element; // Parent element of the text node

      let values = getDataAroundKeyword(keywordElement, setting.direction, setting.extractBelow, setting.extractRight, setting.keyword);

      if (values.length > 0 && (values.length > 1 || values[0] !== '')) {
        // If multiple values returned (e.g., "Entire Column/Row"), spread them
        if (Array.isArray(values)) {
            if (values.length > 1 && (setting.extractBelow === "Entire Column" || setting.extractRight === "Entire Row")) {
                 values.forEach(val => extractedData.push([setting.keyword, val]));
            } else {
                 extractedData.push([setting.keyword, ...values.slice(0,5)]); // Limit to 5 values for multiple non-column/row
            }
        } else {
            extractedData.push([setting.keyword, values]);
        }
      } else {
        extractedData.push([setting.keyword, '']); // Keyword found, but no data extracted
      }
    }
  });

  if (extractedData.length === 0) {
    alert("未找到任何关键词或未提取到有效数据。 (No keywords found or no valid data extracted.)");
    return;
  }

  const csvContent = convertToCSV(extractedData);
  
  let fullFilename = filename || 'page_keyword_data';
  if (dateFormat) {
    const date = new Date();
    const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}_${date.getHours().toString().padStart(2, '0')}-${date.getMinutes().toString().padStart(2, '0')}`;
    fullFilename += `_${formattedDate}`;
  }
  fullFilename += '.csv';

  downloadCSV(csvContent, fullFilename);
}


// --- Utility functions (convertToCSV, downloadCSV) ---
// These are defined in the global scope of the service worker, but need to be part of the injected function string.
// So, they are duplicated here, or the injection needs to be more complex (e.g. injecting an object with methods).
// For simplicity, they are effectively part of extractPageKeywordData when it's stringified for injection.

function convertToCSV(data) {
  return data.map(row => {
    return row.map(cell => {
      // 处理包含逗号、引号或换行符的单元格
      if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
        return '"' + cell.replace(/"/g, '""') + '"';
      }
      return cell;
    }).join(',');
  }).join('\n');
}

function downloadCSV(csvContent, filename) {
  // 添加BOM以支持中文
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
  
  alert('表格数据已成功导出为CSV文件！');
}