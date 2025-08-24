/**
 * AI Integration Script for XTerminal
 * This script contains the complete AI functionality implementation
 */

// Import AI services (dynamic imports will be handled by main script)
let aiService = null;
let chatManager = null;

/**
 * Initialize AI services
 */
export async function initializeAIServices() {
	try {
		const { aiService: ai, initializeAIService } = await import('../services/aiService.js');
		const { chatManager: chat } = await import('../services/chatManager.js');

		// Initialize AI service with ai-config.yaml settings
		await initializeAIService();

		aiService = ai;
		chatManager = chat;

		// Make available globally
		window.aiService = aiService;
		window.chatManager = chatManager;

		return { aiService, chatManager };
	} catch (error) {
		console.error('Failed to load AI services:', error);
		throw error;
	}
}

/**
 * Initialize AI status and connection
 */
export async function initializeAIStatus() {
	const statusDot = document.getElementById('status-dot');
	const statusText = document.getElementById('status-text');
	const modelDisplay = document.getElementById('current-model-display');
	const aiInput = document.getElementById('ai-input');
	const sendBtn = document.getElementById('send-ai');

	try {
		// Test Ollama connection
		await aiService.testConnection();

		// Update status to connected
		if (statusDot) statusDot.textContent = '🟢';
		if (statusText) statusText.textContent = 'Connected';

		// Update model display based on service type
		const settings = aiService.getSettings();
		if (modelDisplay) {
			if (settings.aiServiceType === 'ollama') {
				modelDisplay.textContent = settings.currentModel;
			} else {
				modelDisplay.textContent = settings.openaiModel;
			}
		}

		// Enable input box
		if (aiInput) aiInput.disabled = false;
		if (sendBtn) sendBtn.disabled = false;

		console.log('✅ AI service initialized successfully');
		return true;
	} catch (error) {
		console.warn('⚠️ AI service connection failed:', error.message);

		// Update status to disconnected
		if (statusDot) statusDot.textContent = '🔴';
		if (statusText) statusText.textContent = 'Disconnected';

		// Disable input box
		if (aiInput) {
			aiInput.disabled = true;
			aiInput.placeholder = 'AI service unavailable. Check configuration in settings.';
		}
		if (sendBtn) sendBtn.disabled = true;

		// Show error message
		const settings = aiService ? aiService.getSettings() : { aiServiceType: 'ollama' };
		const serviceName = settings.aiServiceType === 'ollama' ? 'Ollama' : 'OpenAI API';
		addAIMessage('System', `Could not connect to ${serviceName}. Please check your configuration in settings and try again.`, {
			isSystem: true,
			isError: true
		});

		return false;
	}
}

/**
 * Setup AI event listeners
 */
export function setupAIEventListeners() {
	const aiInput = document.getElementById('ai-input');
	const sendBtn = document.getElementById('send-ai');

	// AI input handling
	if (aiInput) {
		aiInput.addEventListener('keydown', async (e) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				await handleAIInput();
			}
		});
	}

	if (sendBtn) {
		sendBtn.addEventListener('click', handleAIInput);
	}

	// 确保滚动条正确初始化
	initializeScrollbar();
}

/**
 * 初始化滚动条显示
 */
function initializeScrollbar() {
	const messagesContainer = document.getElementById('ai-messages');
	if (!messagesContainer) return;

	// 强制触发滚动条显示
	requestAnimationFrame(() => {
		// 临时添加足够的内容来触发滚动条
		const tempDiv = document.createElement('div');
		tempDiv.style.height = '1px';
		tempDiv.style.width = '100%';
		tempDiv.style.visibility = 'hidden';
		messagesContainer.appendChild(tempDiv);

		// 强制重新计算布局
		messagesContainer.offsetHeight;

		// 移除临时元素
		setTimeout(() => {
			if (tempDiv.parentNode) {
				tempDiv.parentNode.removeChild(tempDiv);
			}
		}, 100);
	});
}

/**
 * 显示 typing 指示器
 */
function showTypingIndicator() {
	const typingIndicator = document.getElementById('typing-indicator');
	const messagesContainer = document.getElementById('ai-messages');

	if (typingIndicator && messagesContainer) {
		typingIndicator.classList.add('show');

		// 滚动到底部显示typing指示器
		requestAnimationFrame(() => {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		});
	}
}

/**
 * 隐藏 typing 指示器
 */
function hideTypingIndicator() {
	const typingIndicator = document.getElementById('typing-indicator');

	if (typingIndicator) {
		typingIndicator.classList.remove('show');
	}
}

/**
 * Handle AI input and generate response
 */
export async function handleAIInput() {
	const aiInput = document.getElementById('ai-input');
	const sendBtn = document.getElementById('send-ai');
	const typingIndicator = document.getElementById('typing-indicator');

	if (!aiInput || !aiService || !chatManager) {
		console.error('AI service not initialized');
		return;
	}

	const message = aiInput.value.trim();
	if (!message) return;

	// Clear input box
	aiInput.value = '';

	// Show user message
	addAIMessage('🚀', message, { isUser: true });

	// Set loading state - show typing in input box and indicator
	if (sendBtn) sendBtn.disabled = true;
	if (aiInput) {
		aiInput.disabled = true;
		aiInput.classList.add('typing');
		aiInput.placeholder = 'AI is typing...';
	}

	// Typing indicator removed - only show in input placeholder

	try {
		let response;

		// Handle special commands
		if (message.startsWith('/')) {
			if (message === '/clear') {
				clearChatHistory();
				// Restore UI state immediately for /clear command
				if (sendBtn) sendBtn.disabled = false;
				if (aiInput) {
					aiInput.disabled = false;
					aiInput.classList.remove('typing');
					aiInput.placeholder = 'Ask AI or type /help, /models...';
				}
				return;
			}
			response = await aiService.handleSpecialCommand(message);
		} else {
			// Regular AI conversation
			response = await aiService.generateResponse(message);
		}

		// Parse response for commands
		const parsedResponse = aiService.parseCommandResponse(response);
		const processedResponse = chatManager.processAIResponse(response);

		// Show AI response
		const isCommand = chatManager.hasCommands(response);
		addAIMessage('🤖', processedResponse.response, {
			isAI: true,
			isCommand: isCommand,
			codeBlocks: processedResponse.codeBlocks
		});

		// Save to chat history
		chatManager.addMessage(message, response, {
			isCommand: isCommand,
			codeBlocks: processedResponse.codeBlocks
		});

	} catch (error) {
		console.error('AI request failed:', error);
		addAIMessage('System', `Error: ${error.message}`, { isSystem: true, isError: true });
	} finally {
		// Restore UI state
		if (sendBtn) sendBtn.disabled = false;
		if (aiInput) {
			aiInput.disabled = false;
			aiInput.classList.remove('typing');
			aiInput.placeholder = 'Ask AI or type /help, /models...';
		}
		// Typing indicator removed - only input placeholder used
	}
}

/**
 * Add AI message to chat (Warp-style block layout)
 */
export function addAIMessage(sender, content, options = {}) {
	const messagesContainer = document.getElementById('ai-messages');
	if (!messagesContainer) return;

	// Create message block
	const messageBlock = document.createElement('div');
	
	// 根据消息类型设置不同的CSS类
	if (options.isUser) {
		messageBlock.className = 'message-block user-message';
	} else if (options.isSystem || options.isError) {
		messageBlock.className = 'message-block welcome-message'; // 系统消息使用welcome样式
	} else {
		messageBlock.className = 'message-block ai-message'; // AI消息使用紫色主题
	}

	if (options.isError) {
		messageBlock.classList.add('error-message');
	}

	if (options.isProcessing) {
		messageBlock.classList.add('processing');
	}

	// Create message header
	const messageHeader = document.createElement('div');
	messageHeader.className = 'message-header';

	const avatar = document.createElement('div');
	avatar.className = 'avatar';

	const senderName = document.createElement('span');
	senderName.className = 'sender-name';

	const timestamp = document.createElement('span');
	timestamp.className = 'timestamp';
	timestamp.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

	if (options.isUser) {
		avatar.textContent = 'U';
		senderName.textContent = 'You';
	} else {
		avatar.textContent = 'AI';
		senderName.textContent = 'AI Assistant';
	}

	messageHeader.appendChild(avatar);
	messageHeader.appendChild(senderName);
	messageHeader.appendChild(timestamp);

	// Add copy button for all messages in header
	if (!options.isProcessing) {
		const copyIcon = document.createElement('span');
		copyIcon.className = 'copy-icon';
		copyIcon.onclick = () => window.copyResponseToClipboard(copyIcon);
		copyIcon.innerHTML = `
			<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
				<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
			</svg>
		`;
		messageHeader.appendChild(copyIcon);
	}

	// Create message body
	const messageBody = document.createElement('div');
	messageBody.className = 'message-body';

	const messageText = document.createElement('div');
	messageText.className = 'message-text';

	// Handle AI response with code blocks
	if (options.codeBlocks && options.codeBlocks.length > 0) {
		let processedContent = content;

		options.codeBlocks.forEach((block, index) => {
			const placeholder = `<code-block-${index}></code-block-${index}>`;
			const commandBlock = createCommandBlock(block.code, block.explanation);
			processedContent = processedContent.replace(placeholder, commandBlock);
		});

		messageText.innerHTML = processedContent.trim();
	} else {
		messageText.innerHTML = formatTextResponse(content);
	}

	messageBody.appendChild(messageText);

	// Assemble the message block
	messageBlock.appendChild(messageHeader);
	messageBlock.appendChild(messageBody);

	messagesContainer.appendChild(messageBlock);

	// 确保滚动条可见并滚动到底部
	requestAnimationFrame(() => {
		// 强制重新计算布局
		messagesContainer.offsetHeight;

		// 滚动到底部
		messagesContainer.scrollTop = messagesContainer.scrollHeight;

		// 也可以使用 scrollIntoView 作为备选
		messageBlock.scrollIntoView({ behavior: 'smooth', block: 'end' });
	});

	// Setup command buttons
	setupCommandButtons(messageBlock);

	return messageBlock; // 返回创建的元素，方便后续操作
}

/**
 * Create command block HTML
 */
function createCommandBlock(command, explanation) {
	const blockId = `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

	return `
		<div class="command-block" data-block-id="${blockId}">
			<div class="command-content">
				<div class="simple-command">
					<span class="command-text">${escapeHtml(command)}</span>
					<span class="command-actions">
						<button class="command-action-button copy-command" data-command="${escapeHtml(command)}" title="Copy">
							<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
								<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
							</svg>
						</button>
						<button class="command-action-button run-command" data-command="${escapeHtml(command)}" title="Run">
							<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<polygon points="5 3 19 12 5 21 5 3"></polygon>
							</svg>
						</button>
					</span>
				</div>
				${explanation ? `<span class="command-explanation">${escapeHtml(explanation)}</span>` : ''}
			</div>
		</div>
	`;
}

/**
 * Create message actions
 */
function createMessageActions(content, codeBlocks) {
	const actions = document.createElement('div');
	actions.className = 'message-actions';

	actions.innerHTML = `
		<button class="message-action-btn copy-message" title="Copy message" data-content="${escapeHtml(content)}">
			<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
				<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
			</svg>
		</button>
	`;

	return actions;
}

/**
 * Format text response
 */
function formatTextResponse(text) {
	// Basic text formatting - ensure no leading/trailing whitespace
	return escapeHtml(text.trim())
		.replace(/\n/g, '<br>')
		.replace(/`([^`]+)`/g, '<code>$1</code>');
}

/**
 * Setup command buttons
 */
export function setupCommandButtons(container = document) {
	// Copy command buttons
	const copyBtns = container.querySelectorAll('.copy-command');
	copyBtns.forEach(btn => {
		btn.addEventListener('click', async (e) => {
			e.preventDefault();
			const command = btn.dataset.command;
			if (command) {
				await copyToClipboard(command);
				showButtonFeedback(btn, '✅', 'copy');
			}
		});
	});

	// Run command buttons
	const runBtns = container.querySelectorAll('.run-command');
	runBtns.forEach(btn => {
		btn.addEventListener('click', (e) => {
			e.preventDefault();
			const command = btn.dataset.command;
			if (command) {
				executeCommandInTerminal(command);
				showButtonFeedback(btn, '✅', 'run');
			}
		});
	});

	// Copy message buttons
	const copyMessageBtns = container.querySelectorAll('.copy-message');
	copyMessageBtns.forEach(btn => {
		btn.addEventListener('click', async (e) => {
			e.preventDefault();
			const content = btn.dataset.content;
			if (content) {
				await copyToClipboard(content);
				showButtonFeedback(btn, '✅', 'copy');
			}
		});
	});
}

/**
 * Execute command in terminal
 */
function executeCommandInTerminal(command) {
	// Check if terminal globals are available
	if (typeof window.websockets !== 'undefined' && typeof window.activeTabId !== 'undefined') {
		const websocket = window.websockets.get(window.activeTabId);
		if (websocket && websocket.readyState === WebSocket.OPEN) {
			const commandWithNewline = command + '\n';
			websocket.send(JSON.stringify({
				type: 'input',
				data: commandWithNewline
			}));
		} else {
			console.warn('Terminal WebSocket connection not available');
		}
	} else {
		console.warn('Terminal globals not available. Make sure terminal is initialized.');
	}
}

/**
 * Copy text to clipboard
 */
async function copyToClipboard(text) {
	try {
		await navigator.clipboard.writeText(text);
	} catch (err) {
		console.error('Copy failed:', err);
		// Fallback method
		const textArea = document.createElement('textarea');
		textArea.value = text;
		document.body.appendChild(textArea);
		textArea.select();
		document.execCommand('copy');
		document.body.removeChild(textArea);
	}
}

/**
 * Show button feedback
 */
function showButtonFeedback(btn, successIcon, originalType) {
	const originalContent = btn.innerHTML;
	btn.innerHTML = successIcon;
	btn.disabled = true;

	setTimeout(() => {
		btn.innerHTML = originalContent;
		btn.disabled = false;
	}, 1000);
}

/**
 * Load chat history
 */
export function loadChatHistory() {
	if (!chatManager) return;

	const history = chatManager.getChatHistory();
	// Only show recent messages to avoid UI clutter
	const recentHistory = history.slice(-5);

	recentHistory.forEach(entry => {
		// Show user message
		addAIMessage('🚀', entry.message, { isUser: true });

		// Show AI response
		addAIMessage('🤖', entry.response, {
			isAI: true,
			isCommand: entry.isCommand,
			codeBlocks: entry.codeBlocks
		});
	});
}

/**
 * Clear chat history
 */
export function clearChatHistory() {
	if (chatManager) {
		chatManager.clearChatHistory();
	}

	const messagesContainer = document.getElementById('ai-messages');
	if (messagesContainer) {
		// Keep welcome message
		const welcomeMessage = messagesContainer.querySelector('.welcome-message');
		messagesContainer.innerHTML = '';
		if (welcomeMessage) {
			messagesContainer.appendChild(welcomeMessage);
		}
	}
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}

// Export all functions for use in main script
export default {
	initializeAIServices,
	initializeAIStatus,
	setupAIEventListeners,
	handleAIInput,
	addAIMessage,
	setupCommandButtons,
	loadChatHistory,
	clearChatHistory
};
