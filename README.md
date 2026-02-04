# Google Forms AI Auto-Filler

A lightweight browser console tool to automatically answer Google Forms using Gemini AI.

## Features

- FLAT & Minimalist UI (Matches Google Forms aesthetic)
- Supports Multiple Choice, Checkboxes, Short Answers, Paragraphs, and Dropdowns.
- TrustedHTML compliant (Works on sites with strict CSP).
- Completely separate configuration for easy API Key management.

## Setup

1. Get a Gemini API Key from [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Open `google-forms-config.js` and replace `'GEMINI_API_KEY'` with your actual key.

## How to Use

1. Open the Google Form you want to fill.
2. Open Browser DevTools (**F12** or **Cmd+Option+I**).
3. Go to the **Console** tab.
4. Copy and paste the contents of `google-forms-config.js` into the console and press **Enter**.
5. Copy and paste the contents of `google-forms-console.js` into the console and press **Enter**.
6. A minimalist panel will appear in the top-right corner.
7. Click **Start Auto-Fill** to begin.

## Configuration Options

In `google-forms-config.js`, you can adjust:

- `GEMINI_MODEL`: The model version to use (default: `gemini-3-flash-preview`).
- `ONLY_FILL_EMPTY`: Set to `true` to only fill questions that are currently empty/unselected (default: `false`).
- `MAX_RETRIES`: Number of times to retry when hitting rate limits or errors (default: `3`).
- `RETRY_DELAY`: Milliseconds to wait before retrying (default: `5000`).
- `DELAY_BETWEEN_QUESTIONS`: Milliseconds to wait between questions (default: `1500`).
- `AUTO_SUBMIT`: Set to `true` to automatically click the submit button after filling (default: `false`).
- `DEBUG`: Set to `false` to hide console logs (default: `true`).

---

**Disclaimer**: This tool is for educational purposes. Use responsibly and in accordance with the terms of service of the forms you are filling.
