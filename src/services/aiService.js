/**
 * AI Service for managing Ollama API interactions
 * Based on the ai-terminal project implementation
 */

export class AIService {
    constructor() {
        this.defaultSettings = {
            // Service configuration
            aiServiceType: 'ollama', // 'ollama' or 'openai'
            
            // Ollama settings
            ollamaHost: 'http://localhost:11434',
            currentModel: 'llama3.2:latest',
            
            // OpenAI compatible settings
            openaiBaseUrl: 'https://api.openai.com/v1',
            openaiApiToken: '',
            openaiModel: 'gpt-3.5-turbo',
            
            // Common settings
            temperature: 0.7,
            topP: 0.9,
            maxTokens: 512,
            systemPrompt: ''
        };
        
        // Initialize with default settings first
        this.settings = { ...this.defaultSettings };
        this.isConnected = false;
        
        // Load settings asynchronously
        this.loadSettings().then(settings => {
            this.settings = settings;
        });
    }

    /**
     * Initialize settings asynchronously
     */
    async initialize() {
        this.settings = await this.loadSettings();
        return this;
    }

    /**
     * Load AI settings from ai-config.yaml via API
     */
    async loadSettings() {
        try {
            const response = await fetch('/api/ai-config');
            const config = await response.json();
            
            if (config.ai) {
                // Map ai-config.yaml structure to our settings structure
                const configSettings = {
                    aiServiceType: config.ai.serviceType || 'ollama',
                    
                    // Ollama settings
                    ollamaHost: config.ai.ollama?.host || 'http://localhost:11434',
                    currentModel: config.ai.ollama?.model || 'llama3.2:latest',
                    
                    // OpenAI settings
                    openaiBaseUrl: config.ai.openai?.baseUrl || 'https://api.openai.com/v1',
                    openaiApiToken: config.ai.openai?.apiToken || '',
                    openaiModel: config.ai.openai?.model || 'gpt-3.5-turbo',
                    
                    // Common parameters
                    temperature: config.ai.parameters?.temperature ?? 0.7,
                    topP: config.ai.parameters?.topP ?? 0.9,
                    maxTokens: config.ai.parameters?.maxTokens ?? 512,
                    systemPrompt: config.ai.parameters?.systemPrompt || ''
                };
                
                return { ...this.defaultSettings, ...configSettings };
            } else {
                return { ...this.defaultSettings };
            }
        } catch (error) {
            console.warn('Failed to load AI settings from ai-config.yaml:', error);
            return { ...this.defaultSettings };
        }
    }

    /**
     * Save AI settings to config.yaml via API
     */
    async saveSettings(settings) {
        try {
            // Update local settings
            this.settings = { ...this.settings, ...settings };
            
            // Get current config
            const response = await fetch('/api/config');
            const config = await response.json();
            
            // Update config structure with new settings
            if (!config.ai) config.ai = {};
            if (!config.ai.ollama) config.ai.ollama = {};
            if (!config.ai.openai) config.ai.openai = {};
            if (!config.ai.parameters) config.ai.parameters = {};
            
            // Map settings to config structure
            if (settings.aiServiceType !== undefined) {
                config.ai.serviceType = settings.aiServiceType;
            }
            
            // Ollama settings
            if (settings.ollamaHost !== undefined) {
                config.ai.ollama.host = settings.ollamaHost;
            }
            if (settings.currentModel !== undefined) {
                config.ai.ollama.model = settings.currentModel;
            }
            
            // OpenAI settings
            if (settings.openaiBaseUrl !== undefined) {
                config.ai.openai.baseUrl = settings.openaiBaseUrl;
            }
            if (settings.openaiApiToken !== undefined) {
                config.ai.openai.apiToken = settings.openaiApiToken;
            }
            if (settings.openaiModel !== undefined) {
                config.ai.openai.model = settings.openaiModel;
            }
            
            // Parameters
            if (settings.temperature !== undefined) {
                config.ai.parameters.temperature = settings.temperature;
            }
            if (settings.topP !== undefined) {
                config.ai.parameters.topP = settings.topP;
            }
            if (settings.maxTokens !== undefined) {
                config.ai.parameters.maxTokens = settings.maxTokens;
            }
            if (settings.systemPrompt !== undefined) {
                config.ai.parameters.systemPrompt = settings.systemPrompt;
            }
            
            // Save to config.yaml
            const saveResponse = await fetch('/api/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });
            
            if (!saveResponse.ok) {
                throw new Error('Failed to save settings to config.yaml');
            }
            
            console.log('Settings saved to config.yaml successfully');
            
        } catch (error) {
            console.error('Failed to save settings to config.yaml:', error);
            // Keep the error from breaking the application
        }
    }

    /**
     * Get current settings
     */
    getSettings() {
        return { ...this.settings };
    }

    /**
     * Test connection to configured AI service
     */
    async testConnection() {
        if (this.settings.aiServiceType === 'ollama') {
            return await this.testOllamaConnection();
        } else if (this.settings.aiServiceType === 'openai') {
            return await this.testOpenAIConnection();
        } else {
            throw new Error(`Unknown AI service type: ${this.settings.aiServiceType}`);
        }
    }

    /**
     * Test connection to Ollama API
     */
    async testOllamaConnection() {
        try {
            const response = await fetch(`${this.settings.ollamaHost}/api/tags`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            this.isConnected = true;
            return { success: true, data: await response.json() };
        } catch (error) {
            this.isConnected = false;
            throw error;
        }
    }

    /**
     * Test connection to OpenAI compatible API
     */
    async testOpenAIConnection() {
        if (!this.settings.openaiApiToken) {
            throw new Error('OpenAI API token is not configured. Please set your API token in settings.');
        }

        try {
            const response = await fetch(`${this.settings.openaiBaseUrl}/models`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.settings.openaiApiToken}`
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
            }

            this.isConnected = true;
            const data = await response.json();
            return { success: true, data: data };
        } catch (error) {
            this.isConnected = false;
            
            // Provide specific error messages
            if (error.message.includes('401')) {
                throw new Error('Invalid API token. Please check your OpenAI API token.');
            }
            
            if (error.message.includes('Failed to fetch')) {
                throw new Error(`Could not connect to OpenAI API at ${this.settings.openaiBaseUrl}.`);
            }
            
            throw error;
        }
    }

    /**
     * Get available models from configured AI service
     */
    async getAvailableModels() {
        if (this.settings.aiServiceType === 'ollama') {
            return await this.getOllamaModels();
        } else if (this.settings.aiServiceType === 'openai') {
            return await this.getOpenAIModels();
        } else {
            throw new Error(`Unknown AI service type: ${this.settings.aiServiceType}`);
        }
    }

    /**
     * Get available models from Ollama
     */
    async getOllamaModels() {
        try {
            const response = await fetch(`${this.settings.ollamaHost}/api/tags`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            return data.models || [];
        } catch (error) {
            console.error('Failed to fetch Ollama models:', error);
            throw error;
        }
    }

    /**
     * Get available models from OpenAI API
     */
    async getOpenAIModels() {
        if (!this.settings.openaiApiToken) {
            throw new Error('OpenAI API token is not configured');
        }

        try {
            const response = await fetch(`${this.settings.openaiBaseUrl}/models`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.settings.openaiApiToken}`
                }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
            }
            
            const data = await response.json();
            
            // Transform OpenAI API response to match our expected format
            return data.data.map(model => ({
                name: model.id,
                size: 0, // OpenAI API doesn't provide size info
                digest: model.id,
                details: {
                    families: null,
                    format: 'openai',
                    parameter_size: 'Unknown'
                }
            }));
        } catch (error) {
            console.error('Failed to fetch OpenAI models:', error);
            
            // Return common OpenAI models as fallback
            return [
                { name: 'gpt-3.5-turbo', size: 0, digest: 'gpt-3.5-turbo' },
                { name: 'gpt-4', size: 0, digest: 'gpt-4' },
                { name: 'gpt-4-turbo', size: 0, digest: 'gpt-4-turbo' },
                { name: 'gpt-4o', size: 0, digest: 'gpt-4o' },
                { name: 'gpt-4o-mini', size: 0, digest: 'gpt-4o-mini' }
            ];
        }
    }

    /**
     * Generate AI response using configured service (Ollama or OpenAI)
     */
    async generateResponse(message, options = {}) {
        const settings = { ...this.settings, ...options };
        
        if (settings.aiServiceType === 'ollama') {
            return await this.callOllamaAPI(message, settings);
        } else if (settings.aiServiceType === 'openai') {
            return await this.callOpenAIAPI(message, settings);
        } else {
            throw new Error(`Unknown AI service type: ${settings.aiServiceType}`);
        }
    }

    /**
     * Call Ollama API
     */
    async callOllamaAPI(message, settings) {
        try {
            // Get operating system info for context
            const os = this.getOperatingSystem();
            
            // Create system prompt with OS information and formatting instructions
            const systemPrompt = settings.systemPrompt || this.createDefaultSystemPrompt(os);
            
            // Combine system prompt with user message
            const combinedPrompt = `${systemPrompt}\n\nUser: ${message}`;

            const requestBody = {
                model: settings.currentModel,
                prompt: combinedPrompt,
                stream: false,
                options: {
                    temperature: settings.temperature,
                    top_p: settings.topP,
                    num_predict: settings.maxTokens
                }
            };

            console.log('Sending request to Ollama:', requestBody);

            const response = await fetch(`${settings.ollamaHost}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Ollama API error (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            console.log('Ollama response:', data);

            if (!data.response) {
                throw new Error('Unexpected response format from Ollama');
            }

            return data.response;
        } catch (error) {
            console.error('Error calling Ollama API:', error);
            
            // Provide specific error messages for different failure types
            if (error.message.includes('Failed to fetch')) {
                throw new Error(`Could not connect to Ollama at ${settings.ollamaHost}. Make sure Ollama is running.`);
            }
            
            throw error;
        }
    }

    /**
     * Call OpenAI compatible API
     */
    async callOpenAIAPI(message, settings) {
        try {
            console.log(`Calling OpenAI compatible API with model: ${settings.openaiModel}`);

            if (!settings.openaiApiToken) {
                throw new Error('OpenAI API token is not configured. Please set your API token in settings.');
            }

            // Get operating system info for context
            const os = this.getOperatingSystem();
            
            // Create system prompt with OS information and formatting instructions
            const systemPrompt = settings.systemPrompt || this.createDefaultSystemPrompt(os);

            const requestBody = {
                model: settings.openaiModel,
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    {
                        role: "user",
                        content: message
                    }
                ],
                temperature: settings.temperature,
                max_tokens: settings.maxTokens,
                stream: false
            };

            console.log(`Sending request to ${settings.openaiBaseUrl}/chat/completions`, requestBody);

            const response = await fetch(`${settings.openaiBaseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${settings.openaiApiToken}`
                },
                body: JSON.stringify(requestBody)
            });

            console.log(`OpenAI Response status: ${response.status}`);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`OpenAI API error (${response.status}):`, errorText);
                throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            console.log('OpenAI response:', data);

            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                console.error('Unexpected response format:', data);
                throw new Error('Unexpected response format from OpenAI API');
            }

            return data.choices[0].message.content;
        } catch (error) {
            console.error('Error calling OpenAI compatible API:', error);

            // Add more specific error messages for different failure types
            if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
                throw new Error(`Could not connect to OpenAI API at ${settings.openaiBaseUrl}. Please check your configuration.`);
            }
            
            if (error.message.includes('401')) {
                throw new Error('Invalid API token. Please check your OpenAI API token in settings.');
            }
            
            if (error.message.includes('429')) {
                throw new Error('Rate limit exceeded. Please try again later.');
            }
            
            if (error.message.includes('500')) {
                throw new Error('OpenAI service is temporarily unavailable. Please try again later.');
            }

            throw error;
        }
    }

    /**
     * Handle special AI commands (like /help, /models, etc.)
     */
    async handleSpecialCommand(command) {
        const parts = command.split(' ');
        const cmd = parts[0].toLowerCase();

        switch (cmd) {
            case '/help':
                return this.getHelpMessage();
                
            case '/models':
                try {
                    const models = await this.getAvailableModels();
                    let result = `Available models (${this.settings.aiServiceType}):\n`;
                    models.forEach(model => {
                        if (this.settings.aiServiceType === 'ollama') {
                            const sizeGB = (model.size / 1024 / 1024 / 1024).toFixed(1);
                            result += `- ${model.name} (${sizeGB}GB)\n`;
                        } else {
                            result += `- ${model.name}\n`;
                        }
                    });
                    return result;
                } catch (error) {
                    return `Error: Failed to get models: ${error.message}`;
                }
                
            case '/model':
                if (parts.length > 1) {
                    const modelName = parts[1];
                    if (this.settings.aiServiceType === 'ollama') {
                        this.saveSettings({ currentModel: modelName });
                        return `Switched Ollama model to: ${modelName}`;
                    } else {
                        this.saveSettings({ openaiModel: modelName });
                        return `Switched OpenAI model to: ${modelName}`;
                    }
                } else {
                    if (this.settings.aiServiceType === 'ollama') {
                        return `Current Ollama model: ${this.settings.currentModel}`;
                    } else {
                        return `Current OpenAI model: ${this.settings.openaiModel}`;
                    }
                }
                
            case '/service':
                if (parts.length > 1) {
                    const serviceType = parts[1];
                    if (serviceType === 'ollama' || serviceType === 'openai') {
                        this.saveSettings({ aiServiceType: serviceType });
                        return `Switched to ${serviceType} service`;
                    } else {
                        return 'Invalid service type. Use: ollama or openai';
                    }
                } else {
                    return `Current AI service: ${this.settings.aiServiceType}`;
                }
                
            case '/host':
                if (parts.length > 1) {
                    const hostUrl = parts.slice(1).join(' ');
                    if (this.settings.aiServiceType === 'ollama') {
                        this.saveSettings({ ollamaHost: hostUrl });
                        return `Changed Ollama API host to: ${hostUrl}`;
                    } else {
                        this.saveSettings({ openaiBaseUrl: hostUrl });
                        return `Changed OpenAI API base URL to: ${hostUrl}`;
                    }
                } else {
                    if (this.settings.aiServiceType === 'ollama') {
                        return `Current Ollama API host: ${this.settings.ollamaHost}`;
                    } else {
                        return `Current OpenAI API base URL: ${this.settings.openaiBaseUrl}`;
                    }
                }
                
            case '/token':
                if (this.settings.aiServiceType !== 'openai') {
                    return 'Token command is only available for OpenAI service';
                }
                if (parts.length > 1) {
                    const token = parts[1];
                    this.saveSettings({ openaiApiToken: token });
                    return `OpenAI API token updated`;
                } else {
                    const token = this.settings.openaiApiToken;
                    return `Current OpenAI API token: ${token ? `${token.substring(0, 10)}...` : 'Not set'}`;
                }
                
            case '/status':
                let status = `AI Service Configuration:\n`;
                status += `Service Type: ${this.settings.aiServiceType}\n\n`;
                
                if (this.settings.aiServiceType === 'ollama') {
                    status += `Ollama Configuration:\n`;
                    status += `- Host: ${this.settings.ollamaHost}\n`;
                    status += `- Model: ${this.settings.currentModel}\n`;
                } else {
                    status += `OpenAI Configuration:\n`;
                    status += `- Base URL: ${this.settings.openaiBaseUrl}\n`;
                    status += `- Model: ${this.settings.openaiModel}\n`;
                    const token = this.settings.openaiApiToken;
                    status += `- Token: ${token ? `${token.substring(0, 10)}...` : 'Not set'}\n`;
                }
                
                status += `\nCommon Settings:\n`;
                status += `- Temperature: ${this.settings.temperature}\n`;
                status += `- Max Tokens: ${this.settings.maxTokens}`;
                
                return status;
                
            case '/retry':
                try {
                    await this.testConnection();
                    return `Successfully reconnected to ${this.settings.aiServiceType} API!`;
                } catch (error) {
                    return `Failed to reconnect: ${error.message}`;
                }
                
            case '/clear':
                // This will be handled by the UI component
                return 'CLEAR_CHAT_HISTORY';
                
            default:
                return `Unknown command: ${cmd}. Type /help for available commands.`;
        }
    }

    /**
     * Get help message for available commands
     */
    getHelpMessage() {
        let helpMessage = `Available commands:
/help - Show this help message
/status - Show current configuration
/service [ollama|openai] - Show or switch AI service provider
/models - List available models for current service
/model [name] - Show current model or switch to a different model
/retry - Test connection to current AI service
/clear - Clear the AI chat history

Service-specific commands:
`;
        
        if (this.settings.aiServiceType === 'ollama') {
            helpMessage += `/host [url] - Show or set Ollama API host
Examples: /host http://localhost:11434`;
        } else {
            helpMessage += `/host [url] - Show or set OpenAI API base URL
/token [token] - Show or set OpenAI API token
Examples: /host https://api.openai.com/v1
         /token sk-...`;
        }

        helpMessage += `

Format rules for terminal commands:
• Each command must be wrapped in exactly three backticks (\`\`\`)
• Each command should be on one line only
• Follow each command with ": brief explanation"
• Use \\n to separate multiple command-explanation pairs`;
        
        return helpMessage;
    }

    /**
     * Create default system prompt based on OS
     */
    createDefaultSystemPrompt(os) {
        return `You are a helpful terminal assistant. The user is using a ${os} operating system.

When providing terminal commands, you MUST follow this EXACT format without any deviations:

CRITICAL FORMAT RULES:
1. Each command block must be on ONE LINE ONLY - NO NEWLINES INSIDE COMMAND BLOCKS
2. Each command must be followed by a colon and a space, then the explanation
3. Use exactly three backticks to wrap each command
4. Put each command-explanation pair on its own line using \\n
5. NEVER include language identifiers (like 'bash')
6. NEVER include newlines or line breaks inside the command blocks

Examples of CORRECT format:
\`\`\`ls\`\`\` : Lists files in current directory
\`\`\`pwd && ls\`\`\` : Shows current directory path and lists files
\`\`\`cd Documents\`\`\` : Changes to Documents directory

IMPORTANT RULES:
1. NEVER use 'bash' or any other language identifier
2. NEVER include backticks within the command itself
3. ALWAYS put each command on a new line using \\n
4. ALWAYS use exactly three backticks (\`\`\`) around each command
5. ALWAYS follow each command with : and a brief explanation`;
    }

    /**
     * Get current operating system
     */
    getOperatingSystem() {
        const platform = navigator.platform.toLowerCase();
        if (platform.includes('mac')) return 'macOS';
        if (platform.includes('win')) return 'Windows';
        return 'Linux';
    }

    /**
     * Parse command responses and extract code blocks
     */
    parseCommandResponse(response) {
        const results = [];
        let lastIndex = 0;

        // Handle triple backtick blocks
        const tripleCommandRegex = /```([^`]+)```/g;
        let match;

        while ((match = tripleCommandRegex.exec(response)) !== null) {
            // Get text before this command block
            const textBefore = response.slice(lastIndex, match.index);
            
            if (textBefore.trim()) {
                results.push({
                    type: 'text',
                    content: textBefore.trim()
                });
            }

            // Parse command and explanation
            const commandText = match[1].trim();
            const [command, ...explanationParts] = commandText.split(':');
            const explanation = explanationParts.join(':').trim();

            results.push({
                type: 'command',
                command: command.trim(),
                explanation: explanation || '',
                fullText: match[0]
            });

            lastIndex = match.index + match[0].length;

            // Check for escaped newline after command
            const nextChars = response.slice(lastIndex, lastIndex + 4);
            if (nextChars === '\\n') {
                lastIndex += 4;
            }
        }

        // Process remaining text
        const textAfter = response.slice(lastIndex);
        if (textAfter.trim()) {
            results.push({
                type: 'text',
                content: textAfter.trim()
            });
        }

        return results;
    }

    /**
     * Check if a model exists in available models
     */
    async checkModelExists(modelName) {
        try {
            const models = await this.getAvailableModels();
            return models.some(model => model.name === modelName);
        } catch (error) {
            console.error('Error checking model existence:', error);
            return false;
        }
    }

    /**
     * Get connection status
     */
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            host: this.settings.ollamaHost,
            model: this.settings.currentModel
        };
    }

    /**
     * Reset to default settings
     */
    async resetToDefaults() {
        this.settings = { ...this.defaultSettings };
        
        // Reset config.yaml to default values
        try {
            const defaultConfig = {
                ai: {
                    serviceType: 'ollama',
                    ollama: {
                        host: 'http://localhost:11434',
                        model: 'llama3.2:latest'
                    },
                    openai: {
                        baseUrl: 'https://api.openai.com/v1',
                        apiToken: '',
                        model: 'gpt-3.5-turbo'
                    },
                    parameters: {
                        temperature: 0.7,
                        topP: 0.9,
                        maxTokens: 512,
                        systemPrompt: ''
                    }
                }
            };
            
            // Get current config and only reset AI section
            const response = await fetch('/api/config');
            const config = await response.json();
            
            // Update only AI settings, keep other settings
            config.ai = defaultConfig.ai;
            
            // Save to config.yaml
            const saveResponse = await fetch('/api/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });
            
            if (!saveResponse.ok) {
                throw new Error('Failed to reset settings in config.yaml');
            }
            
            console.log('AI settings reset to defaults in config.yaml');
            
        } catch (error) {
            console.error('Failed to reset settings in config.yaml:', error);
        }
    }
}

// Create a singleton instance
const aiServiceInstance = new AIService();

// Initialize the instance asynchronously
const initializeAIService = async () => {
    return await aiServiceInstance.initialize();
};

// Export the initialized instance
export const aiService = aiServiceInstance;

// Export for direct usage
export default aiService;

// Export initialization function
export { initializeAIService };
