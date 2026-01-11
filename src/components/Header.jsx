import { memo } from 'react';

const Header = memo(function Header({ onShowStats, onShowSettings }) {
  return (
    <header className="header">
      <h1>자세 교정 알리미</h1>
      <div className="header-buttons">
        <button
          className="settings-btn"
          onClick={onShowStats}
          aria-label="통계 보기"
        >
          📊
        </button>
        <button
          className="settings-btn"
          onClick={onShowSettings}
          aria-label="설정"
        >
          ⚙️
        </button>
      </div>
    </header>
  );
});

export default Header;
