import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const configPath = path.join(process.cwd(), 'config.yaml');

export async function GET() {
    try {
        if (!fs.existsSync(configPath)) {
            // Create default config if it doesn't exist (AI config is now in ai-config.yaml)
            const defaultConfig = {
                terminal: {
                    fontFamily: 'SF Mono, Monaco, monospace',
                    fontSize: 14,
                    lineHeight: 1.2,
                    cursorBlink: true,
                    allowTransparency: false
                },
                appearance: {
                    theme: 'dark',
                    aiPanelWidth: 35,
                    showAiPanel: true
                },
                advanced: {
                    scrollbackLines: 1000,
                    gpuAcceleration: true
                }
            };
            
            const yamlStr = yaml.dump(defaultConfig);
            fs.writeFileSync(configPath, yamlStr, 'utf8');
            
            return new Response(JSON.stringify(defaultConfig), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const fileContents = fs.readFileSync(configPath, 'utf8');
        const config = yaml.load(fileContents);

        return new Response(JSON.stringify(config), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error reading config:', error);
        return new Response(JSON.stringify({ error: 'Failed to read config' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function POST({ request }) {
    try {
        const config = await request.json();
        
        // Backup existing config
        if (fs.existsSync(configPath)) {
            const backupPath = `${configPath}.backup`;
            fs.copyFileSync(configPath, backupPath);
        }
        
        const yamlStr = yaml.dump(config, {
            indent: 2,
            quotingType: '"',
            forceQuotes: false
        });
        
        fs.writeFileSync(configPath, yamlStr, 'utf8');
        
        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error saving config:', error);
        return new Response(JSON.stringify({ error: 'Failed to save config' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
