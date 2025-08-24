/**
 * Chat Manager for handling AI chat history and state
 * Manages conversation history, command execution, and UI interactions
 */

export class ChatManager {
    constructor() {
        this.chatHistory = [];
        this.isProcessing = false;
        this.maxHistorySize = 100; // Maximum number of chat entries to keep
        
        // Load existing chat history
        this.loadChatHistory();
        
        // Bind event handlers
        this.eventHandlers = {
            onNewMessage: [],
            onCommandExecute: [],
            onError: []
        };
    }

    /**
     * Load chat history from localStorage
     */
    loadChatHistory() {
        try {
            const saved = localStorage.getItem('ai-chat-history');
            if (saved) {
                this.chatHistory = JSON.parse(saved);
                // Convert timestamp strings back to Date objects
                this.chatHistory.forEach(entry => {
                    entry.timestamp = new Date(entry.timestamp);
                });
            }
        } catch (error) {
            console.error('Failed to load chat history:', error);
            this.chatHistory = [];
        }
    }

    /**
     * Save chat history to localStorage
     */
    saveChatHistory() {
        try {
            // Keep only the most recent entries
            if (this.chatHistory.length > this.maxHistorySize) {
                this.chatHistory = this.chatHistory.slice(-this.maxHistorySize);
            }
            
            localStorage.setItem('ai-chat-history', JSON.stringify(this.chatHistory));
        } catch (error) {
            console.error('Failed to save chat history:', error);
        }
    }

    /**
     * Add a new message to chat history
     */
    addMessage(message, response, options = {}) {
        const chatEntry = {
            id: this.generateId(),
            message: message,
            response: response,
            timestamp: new Date(),
            isCommand: options.isCommand || false,
            codeBlocks: options.codeBlocks || [],
            status: options.status || 'completed', // 'pending', 'completed', 'error'
            ...options
        };

        this.chatHistory.push(chatEntry);
        this.saveChatHistory();
        
        // Notify event handlers
        this.eventHandlers.onNewMessage.forEach(handler => {
            try {
                handler(chatEntry);
            } catch (error) {
                console.error('Error in onNewMessage handler:', error);
            }
        });

        return chatEntry;
    }

    /**
     * Update an existing message
     */
    updateMessage(id, updates) {
        const index = this.chatHistory.findIndex(entry => entry.id === id);
        if (index !== -1) {
            this.chatHistory[index] = { ...this.chatHistory[index], ...updates };
            this.saveChatHistory();
            return this.chatHistory[index];
        }
        return null;
    }

    /**
     * Get chat history
     */
    getChatHistory() {
        return [...this.chatHistory];
    }

    /**
     * Clear chat history
     */
    clearChatHistory() {
        this.chatHistory = [];
        this.saveChatHistory();
        localStorage.removeItem('ai-chat-history');
    }

    /**
     * Remove a specific message
     */
    removeMessage(id) {
        const index = this.chatHistory.findIndex(entry => entry.id === id);
        if (index !== -1) {
            const removed = this.chatHistory.splice(index, 1)[0];
            this.saveChatHistory();
            return removed;
        }
        return null;
    }

    /**
     * Get the last N messages for context
     */
    getRecentMessages(count = 5) {
        return this.chatHistory.slice(-count);
    }

    /**
     * Search chat history
     */
    searchHistory(query) {
        const lowercaseQuery = query.toLowerCase();
        return this.chatHistory.filter(entry => 
            entry.message.toLowerCase().includes(lowercaseQuery) ||
            entry.response.toLowerCase().includes(lowercaseQuery)
        );
    }

    /**
     * Export chat history as JSON
     */
    exportHistory() {
        const exportData = {
            exportDate: new Date().toISOString(),
            version: '1.0',
            chatHistory: this.chatHistory
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
            type: 'application/json' 
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-chat-history-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Import chat history from JSON
     */
    async importHistory(file) {
        try {
            const text = await file.text();
            const importData = JSON.parse(text);
            
            if (importData.chatHistory && Array.isArray(importData.chatHistory)) {
                // Convert timestamps back to Date objects
                importData.chatHistory.forEach(entry => {
                    entry.timestamp = new Date(entry.timestamp);
                    if (!entry.id) {
                        entry.id = this.generateId();
                    }
                });
                
                this.chatHistory = importData.chatHistory;
                this.saveChatHistory();
                return true;
            } else {
                throw new Error('Invalid chat history format');
            }
        } catch (error) {
            console.error('Failed to import chat history:', error);
            throw error;
        }
    }

    /**
     * Process AI response and extract code blocks
     */
    processAIResponse(response) {
        const codeBlocks = [];
        let processedResponse = response;

        // Extract code blocks with triple backticks
        const codeBlockRegex = /```([^`]*?)```/g;
        let match;
        let blockIndex = 0;

        while ((match = codeBlockRegex.exec(response)) !== null) {
            const [fullMatch, code] = match;
            
            if (code.trim()) {
                // Parse command and explanation
                const [command, ...explanationParts] = code.split(':');
                const explanation = explanationParts.join(':').trim();

                codeBlocks.push({
                    id: `code-block-${blockIndex}`,
                    code: command.trim(),
                    explanation: explanation || '',
                    language: 'shell',
                    fullMatch: fullMatch
                });

                // Replace with placeholder
                processedResponse = processedResponse.replace(
                    fullMatch, 
                    `<code-block-${blockIndex}></code-block-${blockIndex}>`
                );
                
                blockIndex++;
            }
        }

        return {
            response: processedResponse,
            codeBlocks: codeBlocks
        };
    }

    /**
     * Check if response contains commands
     */
    hasCommands(response) {
        return /```[^`]*```/.test(response);
    }

    /**
     * Get statistics about chat history
     */
    getStatistics() {
        const totalMessages = this.chatHistory.length;
        const commandMessages = this.chatHistory.filter(entry => entry.isCommand).length;
        const totalCodeBlocks = this.chatHistory.reduce((sum, entry) => 
            sum + (entry.codeBlocks ? entry.codeBlocks.length : 0), 0
        );
        
        const oldestMessage = this.chatHistory.length > 0 ? 
            this.chatHistory[0].timestamp : null;
        const newestMessage = this.chatHistory.length > 0 ? 
            this.chatHistory[this.chatHistory.length - 1].timestamp : null;

        return {
            totalMessages,
            commandMessages,
            totalCodeBlocks,
            oldestMessage,
            newestMessage
        };
    }

    /**
     * Set processing status
     */
    setProcessing(processing) {
        this.isProcessing = processing;
    }

    /**
     * Get processing status
     */
    getProcessingStatus() {
        return this.isProcessing;
    }

    /**
     * Add event handler
     */
    addEventListener(event, handler) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event].push(handler);
        }
    }

    /**
     * Remove event handler
     */
    removeEventListener(event, handler) {
        if (this.eventHandlers[event]) {
            const index = this.eventHandlers[event].indexOf(handler);
            if (index !== -1) {
                this.eventHandlers[event].splice(index, 1);
            }
        }
    }

    /**
     * Generate unique ID for chat entries
     */
    generateId() {
        return `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Format timestamp for display
     */
    formatTimestamp(timestamp) {
        const now = new Date();
        const date = new Date(timestamp);
        
        // If today, show time only
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        // If this year, show month and day
        if (date.getFullYear() === now.getFullYear()) {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
        
        // Otherwise show full date
        return date.toLocaleDateString();
    }

    /**
     * Create a message suitable for copying
     */
    getMessageForCopy(entry) {
        let content = `> ${entry.message}\n\n`;
        
        if (entry.codeBlocks && entry.codeBlocks.length > 0) {
            // For messages with code blocks, reconstruct the original with commands
            let response = entry.response;
            entry.codeBlocks.forEach((block, index) => {
                const placeholder = `<code-block-${index}></code-block-${index}>`;
                const commandText = block.explanation ? 
                    `${block.code} : ${block.explanation}` : block.code;
                response = response.replace(placeholder, commandText);
            });
            content += response;
        } else {
            content += entry.response;
        }
        
        return content;
    }

    /**
     * Validate chat entry structure
     */
    isValidChatEntry(entry) {
        return entry && 
               typeof entry.id === 'string' && 
               typeof entry.message === 'string' && 
               typeof entry.response === 'string' && 
               entry.timestamp instanceof Date;
    }
}

// Create singleton instance
export const chatManager = new ChatManager();

// Export for direct usage
export default chatManager;
