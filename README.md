# LCM Text Extractor Chrome Extension

## Purpose

LCM Text Extractor is a Chrome Manifest V3 extension designed to extract selected text from web pages on `*.zte.com.cn` domains. The extracted text is processed based on user-defined keywords and then exported as a CSV file named `lcm.csv`.

## Features

*   **Website Specific:** Operates exclusively on `*.zte.com.cn` websites.
*   **Text Selection Based:** Processes text that the user selects on the webpage.
*   **Keyword-Driven Extraction:**
    *   Users can define a list of keywords.
    *   The text selected by the user is split based on these keywords. The content between the first and second keyword becomes the first row in the CSV, the content between the second and third keyword becomes the second row, and so on.
*   **Keyword Set Management:**
    *   Users can save sets of keywords as named records.
    *   Saved records can be loaded for later use.
    *   Records can be deleted.
*   **CSV Export:** The processed data is downloaded as a `lcm.csv` file.

## Installation

1.  **Download Extension Files:** Obtain the folder containing the extension files (manifest.json, popup.html, etc.).
2.  **Open Chrome Extensions Page:** Open Google Chrome and navigate to `chrome://extensions/`.
3.  **Enable Developer Mode:** In the top right corner of the Extensions page, toggle "Developer mode" ON.
4.  **Load Unpacked:** Click the "Load unpacked" button that appears.
5.  **Select Extension Folder:** In the file dialog, navigate to and select the folder containing the extension files.
6.  The LCM Text Extractor extension should now be installed and visible in your extensions list.

## How to Use

1.  **Navigate to Target Site:** Go to a webpage within the `*.zte.com.cn` domain.
2.  **Open the Extension Popup:** Click on the LCM Text Extractor icon in your Chrome toolbar to open the popup.
3.  **Manage Keywords:**
    *   **Add Keyword:** Type a keyword into the "New Keyword" input field and click "Add Keyword".
    *   **Current Keywords:** View the list of currently added keywords. You can delete individual keywords using the "delete" button next to them.
    *   **Clear Keywords:** Click "Clear All Keywords" to remove all keywords from the current list.
4.  **Manage Keyword Records (Optional):**
    *   **Save Record:** To save the current list of keywords for future use, enter a name in the "Record Name" input field and click "Save Current Keywords".
    *   **Load Record:** Select a previously saved record from the "Load Record" dropdown and click "Load Selected". The keywords from that record will populate the "Current Keywords" list.
    *   **Delete Record:** Select a record from the dropdown and click "Delete Selected" to remove it.
5.  **Select Text on Page:** On the `*.zte.com.cn` webpage, select the block of text you want to process.
6.  **Process and Export:**
    *   In the extension popup, ensure you have at least two keywords in your "Current Keywords" list.
    *   Click the "Process Selected Text & Export CSV" button.
7.  **Download:** The `lcm.csv` file containing the extracted data will be automatically downloaded to your browser's default download location.

## CSV Output Logic

*   The text content found between your 1st and 2nd keywords will form the content of the first row in the CSV.
*   The text content found between your 2nd and 3rd keywords will form the content of the second row in the CSV.
*   And so on for subsequent keyword pairs.
*   Each extracted segment is placed in a single cell for its respective row.
*   If a keyword pair is not found in sequence in the selected text, that row will be skipped in the CSV.


## Context Menu Features

The extension also provides context menu options for quick actions when right-clicking on a `*.zte.com.cn` page.

1.  **Main Menu: "Export Page Data"**
    *   This parent menu item appears when you right-click anywhere on a `*.zte.com.cn` page. It groups the specific extraction actions.

2.  **Sub-Menu: "Extract by Keywords to CSV & Download PDFs"**
    *   **Context:** Appears when you have selected text on the page and then right-click.
    *   **Action:**
        *   Uses the keywords currently stored by the extension (typically the last set active in the popup or a loaded record). Ensure keywords are set via the popup first.
        *   Processes the **selected text** based on these keywords, following the same CSV output logic as the popup.
        *   Downloads the processed selected text as `lcm_keyword_extract.csv`.
        *   Additionally, it finds and downloads **all discoverable PDF files linked on the entire page**.

3.  **Sub-Menu: "Save Entire Page as CSV & Download PDFs"**
    *   **Context:** Appears when you right-click anywhere on the page (no text selection needed).
    *   **Action:**
        *   Extracts all visible text content from the **entire page** (`document.body.innerText`).
        *   Saves this entire text content into a single-cell CSV file named `lcm_full_page.csv`.
        *   Additionally, it finds and downloads **all discoverable PDF files linked on the entire page** (same PDF download behavior as the option above).
