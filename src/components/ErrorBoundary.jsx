import { Component } from 'react';
import PropTypes from 'prop-types';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="app">
          <div className="loading-screen">
            <div className="error-icon">⚠️</div>
            <h2 style={{ color: '#F8FAFC', marginBottom: '12px' }}>
              오류가 발생했습니다
            </h2>
            <p className="error-message">
              앱에서 예상치 못한 오류가 발생했습니다.
              <br />
              페이지를 새로고침 해주세요.
            </p>
            <button className="retry-btn" onClick={this.handleReload}>
              새로고침
            </button>
            {import.meta.env.DEV && this.state.error && (
              <details style={{
                marginTop: '20px',
                padding: '12px',
                background: 'rgba(239, 68, 68, 0.1)',
                borderRadius: '8px',
                maxWidth: '300px',
                textAlign: 'left'
              }}>
                <summary style={{ cursor: 'pointer', color: '#94A3B8' }}>
                  오류 상세 (개발용)
                </summary>
                <pre style={{
                  fontSize: '11px',
                  color: '#EF4444',
                  overflow: 'auto',
                  marginTop: '8px'
                }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
};

export default ErrorBoundary;
