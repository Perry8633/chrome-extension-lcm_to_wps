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
});