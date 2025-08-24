import { WebSocketServer } from 'ws';
import * as pty from 'node-pty';
import { createServer } from 'http';
import os from 'os';

const PORT = 8080;

// 创建HTTP服务器
const server = createServer();

// 创建WebSocket服务器
const wss = new WebSocketServer({ 
  server,
  path: '/terminal'
});

console.log(`🚀 终端WebSocket服务器启动在端口 ${PORT}`);

// 存储终端会话
const terminals = new Map();

wss.on('connection', (ws, req) => {
  console.log('🔗 新的终端连接建立');
  
  const terminalId = generateId();
  
  // 根据操作系统选择shell
  const shell = os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash';
  
  try {
    // 创建伪终端进程
    const terminal = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: process.cwd(),
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor'
      }
    });

    // 存储终端实例
    terminals.set(terminalId, terminal);
    
    console.log(`✅ 终端进程创建成功: PID ${terminal.pid}, Shell: ${shell}`);

    // 监听终端输出并发送到客户端
    terminal.onData((data) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'output',
          data: data
        }));
      }
    });

    // 监听终端退出
    terminal.onExit((code, signal) => {
      console.log(`🔚 终端进程退出: code=${code}, signal=${signal}`);
      terminals.delete(terminalId);
      
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'exit',
          code: code,
          signal: signal
        }));
        ws.close();
      }
    });

    // 处理客户端消息
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        switch (data.type) {
          case 'input':
            // 将用户输入发送到终端
            terminal.write(data.data);
            break;
            
          case 'resize':
            // 调整终端大小
            terminal.resize(data.cols, data.rows);
            console.log(`🔄 终端大小调整为: ${data.cols}x${data.rows}`);
            break;
            
          default:
            console.warn('⚠️ 未知消息类型:', data.type);
        }
      } catch (error) {
        console.error('❌ 处理消息时出错:', error);
      }
    });

    // 发送连接成功消息
    ws.send(JSON.stringify({
      type: 'connected',
      terminalId: terminalId,
      shell: shell,
      pid: terminal.pid
    }));

  } catch (error) {
    console.error('❌ 创建终端进程失败:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: '创建终端进程失败: ' + error.message
    }));
    ws.close();
  }

  // 处理连接关闭
  ws.on('close', () => {
    console.log('🔌 终端连接断开');
    const terminal = terminals.get(terminalId);
    if (terminal) {
      terminal.kill();
      terminals.delete(terminalId);
    }
  });

  // 处理错误
  ws.on('error', (error) => {
    console.error('❌ WebSocket错误:', error);
    const terminal = terminals.get(terminalId);
    if (terminal) {
      terminal.kill();
      terminals.delete(terminalId);
    }
  });
});

// 启动服务器
server.listen(PORT, () => {
  console.log(`🎯 HTTP服务器监听端口 ${PORT}`);
  console.log(`🔗 WebSocket终端服务: ws://localhost:${PORT}/terminal`);
});

// 生成唯一ID
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n🛑 正在关闭服务器...');
  
  // 关闭所有终端进程
  terminals.forEach((terminal, id) => {
    console.log(`🔚 关闭终端进程: ${id}`);
    terminal.kill();
  });
  
  wss.close(() => {
    console.log('✅ WebSocket服务器已关闭');
    process.exit(0);
  });
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的异常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的Promise拒绝:', reason);
});
