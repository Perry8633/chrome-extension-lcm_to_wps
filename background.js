// Ensure this is at the top level or within an onInstalled listener.
chrome.runtime.onInstalled.addListener(() => {
  // Remove any existing context menus from this extension first to avoid duplicates
  // during development (especially when reloading the extension).
  chrome.contextMenus.removeAll(() => {
    if (chrome.runtime.lastError) {
        console.error("Error removing existing context menus: ", chrome.runtime.lastError.message);
        // Proceed with creating new ones anyway, duplicates might appear if removal failed
    }
    chrome.contextMenus.create({
      id: "exportPageDataParent",
      title: "Export Page Data",
      contexts: ["page"], // Show only when right-clicking on the page itself
      documentUrlPatterns: ["*://*.zte.com.cn/*"]
    });

    chrome.contextMenus.create({
      id: "extractKeywordsAndPdfs",
      parentId: "exportPageDataParent",
      title: "Extract by Keywords to CSV & Download PDFs",
      contexts: ["selection"], // Show only when text is selected
      documentUrlPatterns: ["*://*.zte.com.cn/*"]
    });

    chrome.contextMenus.create({
      id: "savePageAndPdfs",
      parentId: "exportPageDataParent",
      title: "Save Entire Page as CSV & Download PDFs",
      contexts: ["page"], // Show only when right-clicking on the page itself
      documentUrlPatterns: ["*://*.zte.com.cn/*"]
    });
    console.log("Context menus created/updated.");
  });
});

// Helper function to escape text for CSV cells
function escapeCsvCell(cellText) {
  if (typeof cellText !== 'string') {
    cellText = String(cellText); // Ensure it's a string
  }
  if (cellText.includes(',') || cellText.includes('"') || cellText.includes('\n')) {
    // Replace any existing double quotes with two double quotes
    const escapedText = cellText.replace(/"/g, '""');
    // Enclose the entire string in double quotes
    return `"${escapedText}"`;
  }
  return cellText;
}

// Listener for messages from the popup script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'processTextToXlsx') { // Action name kept for compatibility with popup.js
    const { text, keywords } = request;

    if (!text) {
      console.error("No text provided for processing.");
      sendResponse({ success: false, message: 'No text provided.' });
      return true; // Indicate async response
    }
    if (!keywords || keywords.length < 2) {
      console.error("Not enough keywords provided for processing.");
      sendResponse({ success: false, message: 'At least two keywords are required.' });
      return true; // Indicate async response
    }

    try {
      const csvRows = [];
      for (let i = 0; i < keywords.length - 1; i++) {
        const kw1 = keywords[i];
        const kw2 = keywords[i + 1];

        let startIndex = text.indexOf(kw1);
        if (startIndex === -1) {
          console.warn(`Keyword "${kw1}" not found.`);
          continue;
        }
        startIndex += kw1.length; // Start search for kw2 after kw1

        const endIndex = text.indexOf(kw2, startIndex);
        if (endIndex === -1) {
          console.warn(`Keyword "${kw2}" not found after "${kw1}".`);
          continue;
        }

        const rawSubstring = text.substring(startIndex, endIndex);
        const trimmedSubstring = rawSubstring.trim();
        const escapedCellText = escapeCsvCell(trimmedSubstring);
        csvRows.push(escapedCellText); // Each piece of extracted text is a row
      }

      if (csvRows.length === 0) {
        sendResponse({ success: false, message: 'No data extracted based on keywords.' });
        return true; // Indicate async response
      }

      const csvFileContent = csvRows.join('\n');
      const bomAndCsvContent = '\uFEFF' + csvFileContent; // BOM for UTF-8

      const blob = new Blob([bomAndCsvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      chrome.downloads.download({
        url: url,
        filename: 'lcm.csv',
        saveAs: false
      }, (downloadId) => {
        // It's important to revoke the object URL after the download process.
        // Checking if the URL exists before revoking is a good practice.
        if (url) {
          URL.revokeObjectURL(url);
        }

        if (chrome.runtime.lastError) {
          console.error('Download failed:', chrome.runtime.lastError.message);
          sendResponse({ success: false, message: 'Download failed: ' + chrome.runtime.lastError.message });
        } else if (downloadId === undefined) {
          // This case can happen if the download is blocked or an issue occurred that didn't set chrome.runtime.lastError.
          console.warn('Download initiated, but no download ID returned and no error reported. Check browser download settings/permissions.');
          // It might be that the download was blocked by the browser.
           sendResponse({ success: false, message: 'Download may have been blocked by the browser or failed to start.' });
        } else {
          sendResponse({ success: true, message: 'CSV file lcm.csv initiated for download.' });
        }
      });

    } catch (error) {
      console.error("Error processing text to CSV:", error);
      sendResponse({ success: false, message: 'Error during processing: ' + error.message });
    }
    // Return true to indicate that sendResponse will be called asynchronously (due to the download callback)
    return true;
  }
  // If you have other synchronous message handlers, they can return false or nothing.
  // If all message handlers for a specific message are asynchronous, ensure at least one returns true.
  return true; // Explicitly return true if any handler is async. Default to true if unsure.
});

function deriveFilenameFromUrl(pdfUrl) {
  try {
    const urlPath = new URL(pdfUrl).pathname;
    let filename = urlPath.substring(urlPath.lastIndexOf('/') + 1);
    // Ensure it's a .pdf, otherwise append .pdf. Handle cases where filename might be empty.
    if (filename && !filename.toLowerCase().endsWith('.pdf')) {
        filename = filename + '.pdf';
    }
    return filename || 'downloaded.pdf';
  } catch (e) {
    console.error("Error deriving filename from URL:", pdfUrl, e);
    return 'downloaded.pdf';
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "extractKeywordsAndPdfs") {
    if (!tab || !tab.id) {
      console.error("Tab ID not found.");
      return;
    }

    // 1. Retrieve keywords from storage
    chrome.storage.local.get(['currentKeywords'], (result) => {
      if (chrome.runtime.lastError) {
        console.error("Error retrieving keywords:", chrome.runtime.lastError.message);
        // Optionally, notify the user via a desktop notification or by opening the popup
        return;
      }

      const keywords = result.currentKeywords;
      if (!keywords || keywords.length < 2) {
        console.error("Keywords not found or insufficient. Please set them in the popup.");
        // Consider creating a notification to inform the user
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png', // Ensure you have this icon
            title: 'Keyword Error',
            message: 'Please set at least two keywords in the extension popup before using this feature.'
        });
        return;
      }

      // 2. Send message to content script for selected text and PDF links
      chrome.tabs.sendMessage(tab.id, { action: "getSelectedTextAndPdfLinks" }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Error sending message to content script:", chrome.runtime.lastError.message);
          return;
        }
        if (!response) {
          console.error("No response from content script.");
          return;
        }

        const { selectedText, pdfLinks } = response;

        if (!selectedText || selectedText.trim() === "") {
          console.warn("No text selected on the page or selection is empty.");
           chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'Text Selection Error',
            message: 'No text was selected on the page. Please select text to extract.'
          });
          // Still proceed to download PDFs if any
        } else {
            // 3. Process selected text to CSV
            try {
                const csvRows = [];
                for (let i = 0; i < keywords.length - 1; i++) {
                    const kw1 = keywords[i];
                    const kw2 = keywords[i + 1];
                    let startIndex = selectedText.indexOf(kw1);
                    if (startIndex === -1) continue;
                    startIndex += kw1.length;
                    const endIndex = selectedText.indexOf(kw2, startIndex);
                    if (endIndex === -1) continue;
                    const rawSubstring = selectedText.substring(startIndex, endIndex);
                    csvRows.push(escapeCsvCell(rawSubstring.trim()));
                }

                if (csvRows.length > 0) {
                    const csvFileContent = csvRows.join('\n');
                    const bomAndCsvContent = '\uFEFF' + csvFileContent;
                    const blob = new Blob([bomAndCsvContent], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    chrome.downloads.download({
                        url: url,
                        filename: 'lcm_keyword_extract.csv',
                        saveAs: false
                    }, (downloadId) => {
                        if (url) URL.revokeObjectURL(url);
                        if (chrome.runtime.lastError) console.error("CSV Download failed:", chrome.runtime.lastError.message);
                        else console.log("CSV Download initiated, ID:", downloadId);
                    });
                } else {
                     console.warn("No data extracted for CSV based on keywords and selected text.");
                     if(selectedText && selectedText.trim() !== "") { // only notify if text was selected but no keywords matched
                        chrome.notifications.create({
                            type: 'basic',
                            iconUrl: 'icons/icon48.png',
                            title: 'CSV Extraction Notice',
                            message: 'Selected text processed, but no data was extracted for the CSV based on the current keywords.'
                        });
                     }
                }
            } catch (error) {
                console.error("Error processing text to CSV for context menu action:", error);
            }
        }

        // 4. Download PDFs
        if (pdfLinks && pdfLinks.length > 0) {
          pdfLinks.forEach(pdfUrl => {
            if (pdfUrl) { // Ensure URL is not empty or null
              const filename = deriveFilenameFromUrl(pdfUrl);
              chrome.downloads.download({
                url: pdfUrl,
                filename: filename
              }, (downloadId) => {
                if (chrome.runtime.lastError) console.error(`PDF Download failed for ${pdfUrl}:`, chrome.runtime.lastError.message);
                else console.log(`PDF Download initiated for ${filename}, ID:`, downloadId);
              });
            }
          });
        } else {
          console.log("No PDF links found on the page or in the selection.");
        }
      });
    });
  } else if (info.menuItemId === "savePageAndPdfs") {
    if (!tab || !tab.id) {
      console.error("Tab ID not found for savePageAndPdfs.");
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: "getPageTextAndPdfLinks" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error sending getPageTextAndPdfLinks message to content script:", chrome.runtime.lastError.message);
        return;
      }
      if (!response) {
        console.error("No response from content script for getPageTextAndPdfLinks.");
        return;
      }

      const { pageText, pdfLinks } = response;

      if (pageText && pageText.trim() !== "") {
        try {
          const escapedPageText = escapeCsvCell(pageText.trim()); // Entire page text as one CSV cell
          const bomAndCsvContent = '\uFEFF' + escapedPageText;
          const blob = new Blob([bomAndCsvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);

          chrome.downloads.download({
            url: url,
            filename: 'lcm_full_page.csv',
            saveAs: false
          }, (downloadId) => {
            if (url) URL.revokeObjectURL(url);
            if (chrome.runtime.lastError) console.error("Full page CSV Download failed:", chrome.runtime.lastError.message);
            else console.log("Full page CSV Download initiated, ID:", downloadId);
          });
        } catch (error) {
          console.error("Error processing full page text to CSV:", error);
        }
      } else {
        console.warn("Page text is empty or not available.");
        // Optionally notify user if page text is empty
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'Page Text Notice',
            message: 'No text content found on the page to save as CSV.'
        });
      }

      // Download PDFs (same logic as for extractKeywordsAndPdfs)
      if (pdfLinks && pdfLinks.length > 0) {
        pdfLinks.forEach(pdfUrl => {
          if (pdfUrl) {
            const filename = deriveFilenameFromUrl(pdfUrl);
            chrome.downloads.download({
              url: pdfUrl,
              filename: filename
            }, (downloadId) => {
              if (chrome.runtime.lastError) console.error(`PDF Download failed for ${pdfUrl}:`, chrome.runtime.lastError.message);
              else console.log(`PDF Download initiated for ${filename}, ID:`, downloadId);
            });
          }
        });
      } else {
        console.log("No PDF links found on the page for savePageAndPdfs action.");
      }
    });
  }
  // Add other context menu item handlers here if needed
});