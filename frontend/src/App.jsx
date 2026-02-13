import { useState, useEffect, useRef } from 'react';
import './App.css';
import TokenCard from './components/TokenCard';
import Header from './components/Header';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

function App() {
  const [tokens, setTokens] = useState([]);
  const [connected, setConnected] = useState(false);
  const ws = useRef(null);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  const connectWebSocket = () => {
    try {
      ws.current = new WebSocket(WS_URL);

      ws.current.onopen = () => {
        console.log('✅ Connected to server');
        setConnected(true);
      };

      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'INITIAL_TOKENS') {
            setTokens(message.data);
          } else if (message.type === 'NEW_TOKEN') {
            setTokens((prev) => [message.data, ...prev]);
          }
        } catch (e) {
          console.error('Error parsing message:', e);
        }
      };

      ws.current.onclose = () => {
        console.log('❌ Disconnected from server');
        setConnected(false);
        // Reconnect after 5 seconds
        setTimeout(connectWebSocket, 5000);
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Connection error:', error);
      setTimeout(connectWebSocket, 5000);
    }
  };

  return (
    <div className="app">
      <Header connected={connected} tokenCount={tokens.length} />
      <main className="main-content">
        <div className="token-grid">
          {tokens.length === 0 ? (
            <div className="empty-state">
              <div className="spinner"></div>
              <p>Waiting for tokens...</p>
            </div>
          ) : (
            tokens.map((token, index) => (
              <TokenCard key={`${token.contract}-${index}`} token={token} />
            ))
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
