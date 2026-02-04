(function() {
    'use strict';

    const CONFIG = window.FORM_AI_CONFIG;

    if (!CONFIG || !CONFIG.GEMINI_API_KEY) {
        console.error('Configuration missing! Please run google-forms-config.js first.');
        alert('Please load config file first!');
        return;
    }

    const style = document.createElement('style');
    style.textContent = `
        .ai-helper-panel {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 300px;
            background: #ffffff;
            border: 1px solid #dadce0;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            z-index: 10000;
            font-family: 'Roboto', 'Segoe UI', Arial, sans-serif;
            overflow: hidden;
            color: #3c4043;
        }
        .ai-helper-header {
            padding: 12px 16px;
            background: #f8f9fa;
            border-bottom: 1px solid #dadce0;
            color: #202124;
            font-size: 14px;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .ai-helper-header::before {
            content: 'Helper';
            font-size: 10px;
            font-weight: 700;
            color: #5f6368;
            border: 1px solid #dadce0;
            padding: 2px 4px;
            border-radius: 4px;
            text-transform: uppercase;
        }
        .ai-helper-body {
            padding: 16px;
        }
        .ai-helper-btn {
            width: 100%;
            padding: 10px;
            border: 1px solid #dadce0;
            border-radius: 4px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #ffffff;
            color: #3c4043;
        }
        .ai-helper-btn-primary {
            background: #1a73e8;
            color: white;
            border: none;
        }
        .ai-helper-btn-primary:hover {
            background: #1765cc;
        }
        .ai-helper-btn-secondary {
            background: #ffffff;
        }
        .ai-helper-btn-secondary:hover {
            background: #f1f3f4;
        }
        .ai-helper-btn:disabled {
            background: #f1f3f4;
            color: #9aa0a6;
            cursor: not-allowed;
        }
        .ai-helper-status {
            margin-top: 12px;
            padding: 8px;
            background: #f8f9fa;
            border: 1px solid #dadce0;
            border-radius: 4px;
            color: #3c4043;
            font-size: 12px;
            max-height: 120px;
            overflow-y: auto;
        }
        .ai-helper-log {
            margin: 4px 0;
            padding: 2px 0;
            border-bottom: 1px solid #e8eaed;
        }
        .ai-helper-log:last-child { border-bottom: none; }
        .ai-helper-log.success { color: #188038; }
        .ai-helper-log.error { color: #d93025; }
        .ai-helper-log.info { color: #5f6368; }
        .ai-helper-progress {
            width: 100%;
            height: 4px;
            background: #e8eaed;
            border-radius: 2px;
            margin-top: 8px;
            overflow: hidden;
        }
        .ai-helper-progress-bar {
            height: 100%;
            background: #1a73e8;
            width: 0%;
            transition: width 0.3s;
        }
        .ai-helper-minimize {
            position: absolute;
            top: 10px;
            right: 12px;
            background: none;
            border: none;
            color: #5f6368;
            font-size: 16px;
            cursor: pointer;
            padding: 4px;
        }
        .ai-helper-minimize:hover { background: #f1f3f4; border-radius: 4px; }
        .ai-helper-panel.minimized .ai-helper-body { display: none; }
    `;
    document.head.appendChild(style);

    let state = {
        isRunning: false,
        shouldCancel: false,
        questions: [],
        currentQuestion: 0,
        logs: []
    };

    function log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        state.logs.unshift({ message, type, timestamp });
        if (state.logs.length > 10) state.logs.pop();
        updateStatusUI();
        if (CONFIG.DEBUG) console.log(`[AI Helper] ${type.toUpperCase()}: ${message}`);
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function scrapeQuestions() {
        const questions = [];
        const questionContainers = document.querySelectorAll('[role="listitem"]');
        
        questionContainers.forEach((container, index) => {
            const questionTextEl = container.querySelector('[role="heading"]');
            if (!questionTextEl) return;
            
            const questionText = questionTextEl.textContent.trim();
            if (!questionText) return;
            
            const question = {
                index,
                text: questionText,
                type: 'unknown',
                options: [],
                element: container,
                required: container.querySelector('[aria-label*="Required"]') !== null
            };
            
            const radioInputs = container.querySelectorAll('[role="radio"]');
            if (radioInputs.length > 0) {
                question.type = 'multiple_choice';
                radioInputs.forEach(radio => {
                    const label = radio.closest('[data-value]');
                    if (label) {
                        question.options.push({
                            text: label.getAttribute('data-value'),
                            element: radio
                        });
                    }
                });
            }
            
            const checkboxInputs = container.querySelectorAll('[role="checkbox"]');
            if (checkboxInputs.length > 0) {
                question.type = 'checkbox';
                checkboxInputs.forEach(checkbox => {
                    const label = checkbox.closest('[data-answer-value]');
                    if (label) {
                        question.options.push({
                            text: label.getAttribute('data-answer-value'),
                            element: checkbox
                        });
                    }
                });
            }
            
            const shortAnswerInput = container.querySelector('input[type="text"]');
            if (shortAnswerInput) {
                question.type = 'short_answer';
                question.inputElement = shortAnswerInput;
            }
            
            const paragraphInput = container.querySelector('textarea');
            if (paragraphInput) {
                question.type = 'paragraph';
                question.inputElement = paragraphInput;
            }
            
            const dropdown = container.querySelector('[role="listbox"]');
            if (dropdown) {
                question.type = 'dropdown';
                question.dropdownElement = dropdown;
                const options = dropdown.querySelectorAll('[role="option"]');
                options.forEach(opt => {
                    const text = opt.getAttribute('data-value');
                    if (text) question.options.push({ text, element: opt });
                });
            }
            
            if (question.type !== 'unknown') {
                questions.push(question);
            }
        });
        
        return questions;
    }

    async function callGeminiBatch(questions, retryCount = 0) {
        if (state.shouldCancel) throw new Error('Cancelled');

        // Build a simpler, clearer prompt
        const questionLines = questions.map((q, i) => {
            let line = `${i + 1}. ${q.text}`;
            if (q.options.length > 0) {
                line += ` [${q.options.map(o => o.text).join(', ')}]`;
            }
            return line;
        }).join('\n');

        const systemPrompt = `Answer these ${questions.length} questions. Return ONLY a JSON array with ${questions.length} short answers.
Example: ["answer1", "answer2", "answer3"]

For multiple choice: pick one option exactly as written.
For checkboxes: pick one or more options, comma-separated.
For text: give a short answer.`;

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}:generateContent?key=${CONFIG.GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: `${systemPrompt}\n\n${questionLines}`
                            }]
                        }],
                        generationConfig: {
                            temperature: 0.1,
                            maxOutputTokens: 4096
                        }
                    })
                }
            );
            
            if (response.status === 429) {
                if (retryCount < (CONFIG.MAX_RETRIES || 3) && !state.shouldCancel) {
                    log(`Rate limited. Waiting ${CONFIG.RETRY_DELAY / 1000}s...`, 'error');
                    await delay(CONFIG.RETRY_DELAY || 5000);
                    if (state.shouldCancel) throw new Error('Cancelled');
                    return await callGeminiBatch(questions, retryCount + 1);
                } else {
                    throw new Error(state.shouldCancel ? 'Cancelled' : 'Rate limit exceeded.');
                }
            }

            const data = await response.json();
            
            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                let text = data.candidates[0].content.parts[0].text.trim();
                
                // Clean common issues
                text = text.replace(/```json\n?/g, '').replace(/\n?```/g, '');
                
                // Try direct JSON parse
                try {
                    const parsed = JSON.parse(text);
                    if (Array.isArray(parsed)) {
                        while (parsed.length < questions.length) parsed.push("");
                        return parsed.slice(0, questions.length);
                    }
                } catch (e) {}
                
                // Try extracting array with greedy regex
                const arrayMatch = text.match(/\[[\s\S]*\]/);
                if (arrayMatch) {
                    try {
                        const parsed = JSON.parse(arrayMatch[0]);
                        if (Array.isArray(parsed)) {
                            while (parsed.length < questions.length) parsed.push("");
                            return parsed.slice(0, questions.length);
                        }
                    } catch (e) {}
                }
                
                // Fallback: try to fix truncated JSON by adding closing bracket
                if (text.startsWith('[') && !text.endsWith(']')) {
                    // Find last complete string and close the array
                    const lastQuoteIndex = text.lastIndexOf('"');
                    if (lastQuoteIndex > 0) {
                        const fixedText = text.substring(0, lastQuoteIndex + 1) + ']';
                        try {
                            const parsed = JSON.parse(fixedText);
                            if (Array.isArray(parsed)) {
                                log(`Recovered ${parsed.length} answers from truncated response`, 'info');
                                while (parsed.length < questions.length) parsed.push("");
                                return parsed.slice(0, questions.length);
                            }
                        } catch (e) {}
                    }
                }
                
                // Ultimate fallback: extract all quoted strings
                const quotedStrings = text.match(/"([^"\\]*(\\.[^"\\]*)*)"/g);
                if (quotedStrings && quotedStrings.length > 0) {
                    const answers = quotedStrings.map(s => s.slice(1, -1)); // Remove quotes
                    log(`Extracted ${answers.length} answers from raw text`, 'info');
                    while (answers.length < questions.length) answers.push("");
                    return answers.slice(0, questions.length);
                }
                
                if (CONFIG.DEBUG) console.log('[AI Helper] Raw AI response:', text.substring(0, 500));
                
                log('Invalid AI format. Retrying...', 'error');
                if (retryCount < 2) return await callGeminiBatch(questions, retryCount + 1);
            }
            
            throw new Error('Invalid response from AI');
        } catch (error) {
            if (error.message === 'Cancelled') throw error;
            if (retryCount < (CONFIG.MAX_RETRIES || 3) && !state.shouldCancel) {
                log(`Error: ${error.message}. Retrying...`, 'error');
                await delay(CONFIG.RETRY_DELAY || 5000);
                if (state.shouldCancel) throw new Error('Cancelled');
                return await callGeminiBatch(questions, retryCount + 1);
            }
            throw error;
        }
    }

    async function fillQuestion(question, answer) {
        log(`Filling: ${question.text.substring(0, 50)}...`, 'info');
        
        switch (question.type) {
            case 'multiple_choice':
                const matchingRadio = question.options.find(opt => 
                    answer.toLowerCase().includes(opt.text.toLowerCase()) ||
                    opt.text.toLowerCase().includes(answer.toLowerCase())
                );
                if (matchingRadio) {
                    matchingRadio.element.click();
                    log(`Selected: ${matchingRadio.text}`, 'success');
                } else {
                    log(`No matching option for: ${answer}`, 'error');
                }
                break;
                
            case 'checkbox':
                const answers = answer.split(',').map(a => a.trim().toLowerCase());
                question.options.forEach(opt => {
                    if (answers.some(a => 
                        opt.text.toLowerCase().includes(a) || 
                        a.includes(opt.text.toLowerCase())
                    )) {
                        if (opt.element.getAttribute('aria-checked') !== 'true') {
                            opt.element.click();
                            log(`Checked: ${opt.text}`, 'success');
                        }
                    }
                });
                break;
                
            case 'short_answer':
            case 'paragraph':
                if (question.inputElement) {
                    question.inputElement.focus();
                    question.inputElement.value = answer;
                    question.inputElement.dispatchEvent(new Event('input', { bubbles: true }));
                    log(`Typed: ${answer.substring(0, 50)}...`, 'success');
                }
                break;
                
            case 'dropdown':
                if (question.dropdownElement) {
                    question.dropdownElement.click();
                    await delay(300);
                    const matchingOption = question.options.find(opt =>
                        answer.toLowerCase().includes(opt.text.toLowerCase())
                    );
                    if (matchingOption) {
                        matchingOption.element.click();
                        log(`Selected dropdown: ${matchingOption.text}`, 'success');
                    }
                }
                break;
        }
    }

    function checkAnswered(question) {
        try {
            switch (question.type) {
                case 'multiple_choice':
                case 'checkbox':
                    return question.options.some(opt => {
                        const isChecked = opt.element.getAttribute('aria-checked') === 'true';
                        const parentChecked = opt.element.parentElement?.getAttribute('aria-checked') === 'true';
                        return isChecked || parentChecked;
                    });
                case 'short_answer':
                case 'paragraph':
                    return question.inputElement && question.inputElement.value.trim() !== '';
                case 'dropdown':
                    if (question.dropdownElement) {
                        const selectedValue = question.dropdownElement.getAttribute('data-value');
                        const text = question.dropdownElement.textContent.trim();
                        // Usually has a generic text like "Choose" or "เลือก" if empty
                        return selectedValue && selectedValue !== '' && !text.includes('Choose') && !text.includes('เลือก');
                    }
                    return false;
                default:
                    return false;
            }
        } catch (e) {
            return false;
        }
    }

    async function startAutoFill() {
        if (state.isRunning) {
            state.shouldCancel = true;
            log('Cancelling...', 'error');
            return;
        }
        
        state.isRunning = true;
        state.shouldCancel = false;
        updateButtonsUI();
        
        try {
            log('Scraping questions...', 'info');
            const allQuestions = scrapeQuestions();
            
            const questionsToFill = allQuestions.filter((q, i) => {
                if (CONFIG.ONLY_FILL_EMPTY && checkAnswered(q)) {
                    log(`Skipping Q${i + 1}: Already answered`, 'info');
                    return false;
                }
                return true;
            });

            state.questions = allQuestions;
            log(`Found ${allQuestions.length} total, filling ${questionsToFill.length}`, 'success');
            
            if (questionsToFill.length === 0) {
                log('Nothing to fill!', 'error');
                state.isRunning = false;
                updateButtonsUI();
                return;
            }

            let currentBatchSize = CONFIG.INITIAL_BATCH_SIZE || 10;
            const maxBatchSize = CONFIG.MAX_BATCH_SIZE || 20;

            let i = 0;
            while (i < questionsToFill.length) {
                if (state.shouldCancel) {
                    log('Stopped by user.', 'error');
                    break;
                }

                const batchSize = Math.min(currentBatchSize, questionsToFill.length - i);
                const batch = questionsToFill.slice(i, i + batchSize);
                const batchIndices = batch.map(q => q.index + 1).join(', ');
                
                log(`Processing Batch (Size: ${batchSize}, Qs: ${batchIndices})...`, 'info');
                
                try {
                    const answers = await callGeminiBatch(batch);
                    
                    // On success: maybe grow batch size for next time
                    for (let j = 0; j < batch.length; j++) {
                        if (state.shouldCancel) break;
                        const question = batch[j];
                        const answer = answers[j];
                        
                        if (answer) {
                            state.currentQuestion = question.index;
                            updateProgressUI();
                            await fillQuestion(question, answer);
                        }
                    }

                    i += batch.length; // Advance index
                    
                    if (currentBatchSize < maxBatchSize) {
                        currentBatchSize = Math.min(maxBatchSize, currentBatchSize + 2);
                        if (CONFIG.DEBUG) console.log(`[AI Helper] Scaling up batch size to: ${currentBatchSize}`);
                    }

                } catch (error) {
                    if (error.message === 'Cancelled') break;
                    
                    log(`Batch failed: ${error.message}. Scaling down...`, 'error');
                    
                    // On error: scale down batch size and try again with smaller pieces
                    if (currentBatchSize > 1) {
                        currentBatchSize = Math.max(1, Math.floor(currentBatchSize / 2));
                        log(`Reducing batch size to ${currentBatchSize} and retrying...`, 'info');
                        // Don't advance 'i' so we retry the same questions
                    } else {
                        // If it fails even with batch size 1, log error and skip this question to avoid infinite loop
                        log(`Failed at minimum batch size. Skipping Q${batch[0].index + 1}`, 'error');
                        i++;
                    }
                }
                
                if (state.shouldCancel) break;
                if (i < questionsToFill.length) {
                    log(`Next batch in ${CONFIG.DELAY_BETWEEN_QUESTIONS / 1000}s...`, 'info');
                    await delay(CONFIG.DELAY_BETWEEN_QUESTIONS);
                }
            }
            
            if (!state.shouldCancel && i >= questionsToFill.length) {
                log('All tasks done!', 'success');
                if (CONFIG.AUTO_SUBMIT) {
                    await delay(2000);
                    const submitBtn = document.querySelector('[role="button"][jsname="M2UYVd"]');
                    if (submitBtn) {
                        submitBtn.click();
                        log('Form submitted!', 'success');
                    }
                }
            }
            
        } catch (error) {
            log(`Error: ${error.message}`, 'error');
        }
        
        state.isRunning = false;
        state.shouldCancel = false;
        updateButtonsUI();
    }

    function createUI() {
        const existing = document.getElementById('ai-helper-panel');
        if (existing) existing.remove();
        
        const panel = document.createElement('div');
        panel.className = 'ai-helper-panel';
        panel.id = 'ai-helper-panel';

        const minimizeBtn = document.createElement('button');
        minimizeBtn.className = 'ai-helper-minimize';
        minimizeBtn.id = 'ai-minimize';
        minimizeBtn.textContent = '−';
        
        const header = document.createElement('div');
        header.className = 'ai-helper-header';
        header.textContent = 'Google Forms AI Helper';

        const body = document.createElement('div');
        body.className = 'ai-helper-body';

        const startBtn = document.createElement('button');
        startBtn.className = 'ai-helper-btn ai-helper-btn-primary';
        startBtn.id = 'ai-start';
        startBtn.textContent = 'Start Auto-Fill';

        const scanBtn = document.createElement('button');
        scanBtn.className = 'ai-helper-btn ai-helper-btn-secondary';
        scanBtn.id = 'ai-scan';
        scanBtn.textContent = 'Scan Questions Only';

        const progressContainer = document.createElement('div');
        progressContainer.className = 'ai-helper-progress';
        const progressBar = document.createElement('div');
        progressBar.className = 'ai-helper-progress-bar';
        progressBar.id = 'ai-progress';
        progressContainer.appendChild(progressBar);

        const statusContainer = document.createElement('div');
        statusContainer.className = 'ai-helper-status';
        statusContainer.id = 'ai-status';
        
        const initialLog = document.createElement('div');
        initialLog.className = 'ai-helper-log info';
        initialLog.textContent = 'Ready! Click Start Auto-Fill';
        statusContainer.appendChild(initialLog);

        body.append(startBtn, scanBtn, progressContainer, statusContainer);
        panel.append(minimizeBtn, header, body);
        
        document.body.appendChild(panel);
        
        startBtn.addEventListener('click', startAutoFill);
        scanBtn.addEventListener('click', () => {
            const questions = scrapeQuestions();
            log(`Found ${questions.length} questions`, 'success');
            questions.forEach((q, i) => {
                log(`Q${i+1} [${q.type}]: ${q.text.substring(0, 40)}...`, 'info');
            });
        });
        minimizeBtn.addEventListener('click', () => {
            panel.classList.toggle('minimized');
        });
    }
    
    function updateStatusUI() {
        const statusEl = document.getElementById('ai-status');
        if (!statusEl) return;
        
        const fragment = document.createDocumentFragment();
        state.logs.forEach(logData => {
            const logItem = document.createElement('div');
            logItem.className = `ai-helper-log ${logData.type}`;
            logItem.textContent = `${logData.timestamp} - ${logData.message}`;
            fragment.appendChild(logItem);
        });
        
        statusEl.replaceChildren(fragment);
    }
    
    function updateProgressUI() {
        const progressEl = document.getElementById('ai-progress');
        if (!progressEl) return;
        const percent = state.questions.length > 0 
            ? ((state.currentQuestion + 1) / state.questions.length) * 100 
            : 0;
        progressEl.style.width = `${percent}%`;
    }
    
    function updateButtonsUI() {
        const startBtn = document.getElementById('ai-start');
        if (startBtn) {
            startBtn.disabled = false; // Never disable, so we can click to stop
            if (state.isRunning) {
                startBtn.textContent = 'Stop / Cancel';
                startBtn.style.background = '#d93025';
                startBtn.style.color = 'white';
            } else {
                startBtn.textContent = 'Start Auto-Fill';
                startBtn.style.background = '#1a73e8';
                startBtn.style.color = 'white';
            }
        }
    }

    createUI();
    console.log('Google Forms AI Helper loaded! Panel is on the top-right corner.');
    
})();

