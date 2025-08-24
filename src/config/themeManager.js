/**
 * AI Terminal - Theme Manager
 * ================================
 * 主题管理器，用于加载和应用TOML配置文件中的主题
 */

// 简单的TOML解析器
class SimpleTomlParser {
  parse(tomlString) {
    const result = {};
    const lines = tomlString.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
    
    let currentSection = result;
    let currentPath = [];
    
    for (const line of lines) {
      // 处理表头 [section] 或 [section.subsection]
      if (line.startsWith('[') && line.endsWith(']')) {
        const sectionPath = line.slice(1, -1).split('.');
        currentPath = sectionPath;
        currentSection = result;
        
        for (const part of sectionPath) {
          if (!currentSection[part]) {
            currentSection[part] = {};
          }
          currentSection = currentSection[part];
        }
      } 
      // 处理键值对
      else if (line.includes('=')) {
        const [key, ...valueParts] = line.split('=');
        const cleanKey = key.trim().replace(/['"]/g, '');
        let value = valueParts.join('=').trim().replace(/['"]/g, '');
        
        // 尝试解析为数字或布尔值
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (!isNaN(value) && !isNaN(parseFloat(value))) value = parseFloat(value);
        
        currentSection[cleanKey] = value;
      }
    }
    
    return result;
  }
}

// 主题管理器类
export class ThemeManager {
  constructor() {
    this.themes = new Map();
    this.currentTheme = null;
    this.parser = new SimpleTomlParser();
    this.defaultThemeId = 'dracula';
    
    // 初始化
    this.loadThemes();
  }
  
  /**
   * 从TOML文件加载主题配置
   */
  async loadThemes() {
    try {
      // 尝试多个可能的路径
      let response;
      const possiblePaths = [
        '/src/config/theme.toml',
        './src/config/theme.toml',
        '../config/theme.toml'
      ];
      
      for (const path of possiblePaths) {
        try {
          response = await fetch(path);
          if (response.ok) break;
        } catch (e) {
          continue;
        }
      }
      
      if (!response || !response.ok) {
        throw new Error('Could not load theme.toml');
      }
      
      const tomlText = await response.text();
      const config = this.parser.parse(tomlText);
      
      // 设置默认主题
      if (config.settings && config.settings.default_theme) {
        this.defaultThemeId = config.settings.default_theme;
      }
      
      // 加载所有主题
      for (const [key, value] of Object.entries(config)) {
        if (key !== 'settings' && value.id) {
          this.themes.set(value.id, {
            name: value.name,
            id: value.id,
            cssVariables: value.css_variables || {},
            xtermTheme: value.xterm_theme || {},
            terminalConfig: value.terminal_config || {}
          });
        }
      }
      
      // 设置默认主题
      this.setTheme(this.defaultThemeId);
      
    } catch (error) {
      console.error('Failed to load themes:', error);
      // 使用硬编码的默认主题
      this.useHardcodedTheme();
    }
  }
  
  /**
   * 使用硬编码的默认主题（当TOML加载失败时）
   */
  useHardcodedTheme() {
    const draculaTheme = {
      name: 'Dracula',
      id: 'dracula',
      cssVariables: {
        '--bg-primary': '#282a36',
        '--bg-secondary': '#21222c',
        '--bg-tertiary': '#1e1f29',
        '--bg-quaternary': '#44475a',
        '--border-primary': '#44475a',
        '--border-secondary': '#6272a4',
        '--text-primary': '#f8f8f2',
        '--text-secondary': '#f8f8f2',
        '--text-tertiary': '#6272a4',
        '--accent-blue': '#8be9fd',
        '--accent-green': '#50fa7b',
        '--accent-yellow': '#f1fa8c',
        '--accent-red': '#ff5555',
        '--accent-purple': '#bd93f9',
        '--accent-pink': '#ff79c6',
        '--accent-orange': '#ffb86c',
        '--terminal-green': '#50fa7b',
        '--shadow-light': 'rgba(0, 0, 0, 0.1)',
        '--shadow-medium': 'rgba(0, 0, 0, 0.25)',
        '--shadow-heavy': 'rgba(0, 0, 0, 0.6)',
        '--transition-smooth': 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        '--transition-spring': 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '--radius-small': '4px',
        '--radius-medium': '8px',
        '--radius-large': '12px',
        '--radius-full': '50%'
      },
      xtermTheme: {
        background: '#282a36',
        foreground: '#f8f8f2',
        cursor: '#f8f8f2',
        selection: '#44475a',
        black: '#21222c',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#8be9fd',
        magenta: '#bd93f9',
        cyan: '#8be9fd',
        white: '#f8f8f2',
        brightBlack: '#6272a4',
        brightRed: '#ff6e6e',
        brightGreen: '#69ff94',
        brightYellow: '#ffffa5',
        brightBlue: '#d6acff',
        brightMagenta: '#ff92df',
        brightCyan: '#a4ffff',
        brightWhite: '#ffffff'
      },
      terminalConfig: {
        fontFamily: 'SF Mono, Monaco, Inconsolata, Fira Code, Fira Mono, Roboto Mono, monospace',
        fontSize: 13,
        letterSpacing: 0.5,
        lineHeight: 1.2,
        scrollback: 1000,
        allowTransparency: false,
        cursorBlink: true
      }
    };
    
    this.themes.set('dracula', draculaTheme);
    this.setTheme('dracula');
  }
  
  /**
   * 获取所有可用主题
   */
  getAvailableThemes() {
    return Array.from(this.themes.values());
  }
  
  /**
   * 通过ID获取主题
   */
  getTheme(id) {
    return this.themes.get(id);
  }
  
  /**
   * 设置当前主题
   */
  setTheme(themeId) {
    const theme = this.themes.get(themeId);
    if (theme) {
      this.currentTheme = theme;
      this.applyTheme(theme);
      
      // 保存到localStorage
      localStorage.setItem('ai-terminal-theme', themeId);
    }
  }
  
  /**
   * 应用主题到文档
   */
  applyTheme(theme) {
    const root = document.documentElement;
    
    // 应用CSS变量
    Object.entries(theme.cssVariables).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });
    
    // 更新body的data-theme属性
    document.body.dataset.theme = theme.id;
    
    // 触发主题变更事件
    window.dispatchEvent(new CustomEvent('themeChanged', {
      detail: { theme: theme }
    }));
    
    console.log(`Theme applied: ${theme.name}`);
  }
  
  /**
   * 获取当前主题
   */
  getCurrentTheme() {
    return this.currentTheme;
  }
  
  /**
   * 切换主题
   */
  toggleTheme() {
    const availableThemes = this.getAvailableThemes();
    if (availableThemes.length < 2) return;
    
    const currentIndex = availableThemes.findIndex(theme => theme.id === this.currentTheme.id);
    const nextIndex = (currentIndex + 1) % availableThemes.length;
    const nextTheme = availableThemes[nextIndex];
    
    this.setTheme(nextTheme.id);
  }
  
  /**
   * 从localStorage加载保存的主题
   */
  loadSavedTheme() {
    const savedThemeId = localStorage.getItem('ai-terminal-theme');
    if (savedThemeId && this.themes.has(savedThemeId)) {
      this.setTheme(savedThemeId);
    }
  }
  
  /**
   * 获取终端配置（包含主题）
   */
  getTerminalConfig() {
    if (!this.currentTheme) return {};
    
    return {
      ...this.currentTheme.terminalConfig,
      theme: this.currentTheme.xtermTheme
    };
  }
}

// 创建全局主题管理器实例
export const themeManager = new ThemeManager();

// 默认导出
export default themeManager;
