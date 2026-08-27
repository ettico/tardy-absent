import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useScopeParams } from '../hooks/useScope';

interface SearchResults {
  students: { id: string; fullName: string; className: string; gradeName: string }[];
  classes: { id: string; name: string; gradeName: string }[];
}

export default function GlobalSearch() {
  const scopeParams = useScopeParams();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }
    const timeout = setTimeout(() => {
      api.get<SearchResults>('/search', { params: { q: query, ...scopeParams } }).then((res) => {
        setResults(res.data);
        setOpen(true);
      });
    }, 250);
    return () => clearTimeout(timeout);
  }, [query, scopeParams]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function goToStudent(id: string) {
    setOpen(false);
    setQuery('');
    navigate(`/students/${id}`);
  }

  function goToClass(id: string) {
    setOpen(false);
    setQuery('');
    navigate(`/classes/${id}`);
  }

  const hasResults = results && (results.students.length > 0 || results.classes.length > 0);

  return (
    <div className="global-search" ref={wrapRef}>
      <input
        type="search"
        placeholder="חיפוש תלמידה או כיתה..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query.trim().length >= 2 && setOpen(true)}
      />
      {open && query.trim().length >= 2 && (
        <div className="global-search-dropdown">
          {!hasResults && <div className="empty-note" style={{ padding: '0.75rem' }}>אין תוצאות</div>}
          {results && results.classes.length > 0 && (
            <div>
              <div className="search-group-title">כיתות</div>
              {results.classes.map((c) => (
                <button key={c.id} className="search-result-item" onClick={() => goToClass(c.id)}>
                  כיתה {c.name} <span className="stat-pill">שכבת {c.gradeName}</span>
                </button>
              ))}
            </div>
          )}
          {results && results.students.length > 0 && (
            <div>
              <div className="search-group-title">תלמידות</div>
              {results.students.map((s) => (
                <button key={s.id} className="search-result-item" onClick={() => goToStudent(s.id)}>
                  {s.fullName} <span className="stat-pill">{s.className}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
