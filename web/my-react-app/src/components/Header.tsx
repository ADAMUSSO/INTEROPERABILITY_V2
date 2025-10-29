import './Header.css';
import type { Page } from '../types/Page';

interface HeaderProps {
  page: Page;
  onSelect: (page: Page) => void;
}

export default function Header({ page, onSelect }: HeaderProps) {
  const links: { key: Page; label: string }[] = [
    { key: 'transfer', label: 'Transfer' },
    { key: 'balance', label: 'Check Balance' },
    { key: 'wrap', label: 'Wrap' },
    { key: 'docs', label: 'Docs' },
  ];

  return (
    <header className="site-header">
      <div className="container header-inner">
        <div className="brand">Turbo exchange</div>
        <nav className="nav">
          {links.map(({ key, label }) => (
            <button
              key={key}
              className={page === key ? 'active' : ''}
              onClick={() => onSelect(key)}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
