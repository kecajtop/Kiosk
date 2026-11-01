import React, { useState, useEffect, useRef } from 'react';
import { Terminal, X, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

interface LogEntry {
  id: number;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  data?: any;
}

export const DebugConsole: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [filter, setFilter] = useState<'all' | 'info' | 'success' | 'warning' | 'error'>('all');
  const logContainerRef = useRef<HTMLDivElement>(null);
  const logIdCounter = useRef(0);

  useEffect(() => {
    // Override console methods to capture logs
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    console.log = (...args: any[]) => {
      originalLog(...args);
      addLog('info', args.map(String).join(' '), args.length > 1 ? args : undefined);
    };

    console.warn = (...args: any[]) => {
      originalWarn(...args);
      addLog('warning', args.map(String).join(' '), args.length > 1 ? args : undefined);
    };

    console.error = (...args: any[]) => {
      originalError(...args);
      addLog('error', args.map(String).join(' '), args.length > 1 ? args : undefined);
    };

    // Add initial log
    addLog('success', 'Debug console initialized');

    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom when new logs are added
    if (logContainerRef.current && !isMinimized) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, isMinimized]);

  const addLog = (type: LogEntry['type'], message: string, data?: any) => {
    const entry: LogEntry = {
      id: logIdCounter.current++,
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      data
    };
    setLogs(prev => [...prev, entry]);
  };

  const clearLogs = () => {
    setLogs([]);
    console.log('Console cleared');
  };

  const getTypeColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'info': return '#61dafb';
      case 'success': return '#4caf50';
      case 'warning': return '#ff9800';
      case 'error': return '#f44336';
    }
  };

  const getTypeIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'info': return 'ℹ';
      case 'success': return '✓';
      case 'warning': return '⚠';
      case 'error': return '✗';
    }
  };

  const filteredLogs = filter === 'all' 
    ? logs 
    : logs.filter(log => log.type === filter);

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: isMinimized ? '40px' : '250px',
        backgroundColor: '#1e1e1e',
        borderTop: '2px solid #444',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.5)'
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          backgroundColor: '#2c2c2c',
          borderBottom: isMinimized ? 'none' : '1px solid #444',
          cursor: 'pointer'
        }}
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Terminal size={16} color="#61dafb" />
          <span style={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}>
            Debug Console ({filteredLogs.length})
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!isMinimized && (
            <>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  backgroundColor: '#1e1e1e',
                  color: '#fff',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                <option value="all">All</option>
                <option value="info">Info</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
              </select>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearLogs();
                }}
                style={{
                  backgroundColor: '#444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Trash2 size={12} />
                Clear
              </button>
            </>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(!isMinimized);
            }}
            style={{
              backgroundColor: 'transparent',
              color: '#aaa',
              border: 'none',
              padding: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            {isMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsVisible(false);
            }}
            style={{
              backgroundColor: 'transparent',
              color: '#aaa',
              border: 'none',
              padding: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Logs */}
      {!isMinimized && (
        <div
          ref={logContainerRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px',
            fontFamily: 'monospace',
            fontSize: '12px'
          }}
        >
          {filteredLogs.length === 0 ? (
            <div style={{ color: '#666', textAlign: 'center', padding: '20px' }}>
              No logs to display
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                style={{
                  marginBottom: '4px',
                  padding: '6px 8px',
                  backgroundColor: '#252526',
                  borderLeft: `3px solid ${getTypeColor(log.type)}`,
                  borderRadius: '3px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: getTypeColor(log.type), fontWeight: 'bold' }}>
                    {getTypeIcon(log.type)}
                  </span>
                  <span style={{ color: '#666', fontSize: '11px' }}>
                    {log.timestamp}
                  </span>
                  <span style={{ color: '#fff', flex: 1 }}>
                    {log.message}
                  </span>
                </div>
                {log.data && (
                  <pre
                    style={{
                      marginTop: '4px',
                      marginLeft: '24px',
                      color: '#aaa',
                      fontSize: '11px',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all'
                    }}
                  >
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
