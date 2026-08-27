import { Link } from 'react-router-dom';

export interface Crumb {
  label: string;
  to?: string;
}

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="breadcrumbs" aria-label="ניווט">
      {items.map((item, i) => (
        <span key={i}>
          {item.to ? (
            <Link to={item.to}>{item.label}</Link>
          ) : (
            <span className="breadcrumb-current">{item.label}</span>
          )}
          {i < items.length - 1 && <span className="breadcrumb-sep"> ← </span>}
        </span>
      ))}
    </nav>
  );
}
