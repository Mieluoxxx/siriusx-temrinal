import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const aiConfigPath = path.join(process.cwd(), 'ai-config.yaml');

export async function GET() {
    try {
        if (!fs.existsSync(aiConfigPath)) {
            // Create default AI config if it doesn't exist
            const defaultAiConfig = {
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
            
            const yamlStr = yaml.dump(defaultAiConfig);
            fs.writeFileSync(aiConfigPath, yamlStr, 'utf8');
            
            return new Response(JSON.stringify(defaultAiConfig), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const fileContents = fs.readFileSync(aiConfigPath, 'utf8');
        const config = yaml.load(fileContents);

        return new Response(JSON.stringify(config), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error reading AI config:', error);
        return new Response(JSON.stringify({ error: 'Failed to read AI config' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function POST({ request }) {
    try {
        const config = await request.json();
        
        // Backup existing config
        if (fs.existsSync(aiConfigPath)) {
            const backupPath = `${aiConfigPath}.backup`;
            fs.copyFileSync(aiConfigPath, backupPath);
        }
        
        const yamlStr = yaml.dump(config, {
            indent: 2,
            quotingType: '"',
            forceQuotes: false
        });
        
        fs.writeFileSync(aiConfigPath, yamlStr, 'utf8');
        
        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error saving AI config:', error);
        return new Response(JSON.stringify({ error: 'Failed to save AI config' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}