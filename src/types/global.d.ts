// Global type declarations for the AI Terminal project

interface Window {
  terminals?: Map<number, any>;
  websockets?: Map<number, WebSocket>;
  fitAddons?: Map<number, any>;
  activeTabId?: number;
  aiService?: any;
  chatManager?: any;
  aiIntegration?: any;
  themeManager?: any;
}

// AI Service types
interface AISettings {
  ollamaHost: string;
  currentModel: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  systemPrompt: string;
}

interface ChatMessage {
  id: string;
  message: string;
  response: string;
  timestamp: Date;
  isCommand?: boolean;
  codeBlocks?: CodeBlock[];
  status?: 'pending' | 'completed' | 'error';
}

interface CodeBlock {
  id: string;
  code: string;
  explanation: string;
  language: string;
  fullMatch: string;
}

// Astro component props
interface Props {
  title?: string;
}

// Custom events
interface CustomEventMap {
  'themeChanged': CustomEvent<{ theme: { name: string } }>;
}

declare global {
  interface WindowEventMap extends CustomEventMap {}
}
