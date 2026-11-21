import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.jsx';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('AstraGrade Caught Runtime Error:', error, info);
    this.setState({ info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            backgroundColor: '#13171e',
            color: '#e5d8be',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            fontFamily: 'Cormorant Garamond, Georgia, serif',
          }}
        >
          <div
            style={{
              maxWidth: '680px',
              width: '100%',
              backgroundColor: '#181d26',
              border: '1px solid rgba(196, 164, 104, 0.4)',
              borderRadius: '12px',
              padding: '32px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
              textAlign: 'center',
            }}
          >
            <h1
              style={{
                fontFamily: 'Cinzel, Georgia, serif',
                color: '#d4af6a',
                fontSize: '24px',
                margin: '0 0 12px',
              }}
            >
              SmartEd Evaluation Studio Notice
            </h1>
            <p style={{ color: '#c4a468', fontSize: '16px', margin: '0 0 20px' }}>
              The workspace encountered a component load delay or display exception.
            </p>
            <div
              style={{
                backgroundColor: '#12151b',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid #2d3646',
                color: '#f87171',
                fontFamily: 'monospace',
                fontSize: '13px',
                textAlign: 'left',
                overflowX: 'auto',
                maxHeight: '220px',
                marginBottom: '24px',
              }}
            >
              <div style={{ fontWeight: 'bold' }}>{this.state.error?.toString()}</div>
              {(this.state.error?.stack || this.state.info?.componentStack) && (
                <pre style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px', whiteSpace: 'pre-wrap', maxHeight: '160px', overflowY: 'auto' }}>
                  {this.state.error?.stack || this.state.info?.componentStack}
                </pre>
              )}
            </div>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              style={{
                backgroundColor: '#d4af6a',
                color: '#13171e',
                fontWeight: 'bold',
                fontFamily: 'Cinzel, Georgia, serif',
                border: 'none',
                padding: '10px 24px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                boxShadow: '0 4px 14px rgba(212, 175, 106, 0.3)',
              }}
            >
              ↻ Reload Evaluation Workspace
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
