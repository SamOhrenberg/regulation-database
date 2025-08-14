import React, { useState, Fragment } from 'react';
// Import the logo as a React component (Create React App feature)
import { ReactComponent as RegulationLogo } from './logo.svg';
import './App.css'; // Import the new styles

const REPO_OWNER = "SamOhrenberg";
const REPO_NAME = "regulation-database";
const TRANSCRIPTIONS_PATH = "transcriptions";

function App() {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedIndexes, setExpandedIndexes] = useState([]);

  // Helper to construct GitHub link for a file
  const getGithubLink = (fileName) =>
    `https://github.com/${REPO_OWNER}/${REPO_NAME}/blob/main/${TRANSCRIPTIONS_PATH}/${encodeURIComponent(fileName)}`;

  // Helper to highlight search term in a string (case-insensitive)
  function highlightText(text, term) {
    if (!term) return text;
    // Escape special regex characters in the search term
    const safeTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${safeTerm})`, 'gi');
    // Use <mark> for highlighting
    return text.split(regex).map((part, i) =>
      part.toLowerCase() === term.toLowerCase() ? <mark key={i}>{part}</mark> : part
    );
  }

  // Improved search: return all matches per file, grouped in one result set, honor line breaks, highlight
  const handleSearch = async (e) => {
    if (e && e.key && e.key !== 'Enter') return;
    if (!search || loading) return;

    setLoading(true);
    setHasSearched(true);
    setResults([]);
    setExpandedIndexes([]);

    try {
      const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${TRANSCRIPTIONS_PATH}`);
      const files = await res.json();

      if (!Array.isArray(files)) {
        console.error("Failed to fetch files. Response:", files);
        setResults([]);
        setLoading(false);
        return;
      }

      const searchPromises = files
        .filter(file => file.type === 'file' && file.name.endsWith('.txt'))
        .map(async file => {
          const resp = await fetch(file.download_url);
          const text = await resp.text();

          // Split to lines for context-aware search
          const lines = text.split(/\r?\n/);
          const lowerSearch = search.toLowerCase();

          let matches = [];
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(lowerSearch)) {
              // Gather context: 2 lines before and after
              const contextStart = Math.max(0, i - 2);
              const contextEnd = Math.min(lines.length, i + 3);
              const excerptLines = lines.slice(contextStart, contextEnd);

              // Highlight the search term in each line
              const highlightedExcerpt = excerptLines.map((line, idx) => (
                <div key={idx} style={{ marginBottom: "0.1em" }}>
                  {highlightText(line, search)}
                </div>
              ));

              matches.push({
                context: highlightedExcerpt,
                line: i + 1,
                raw: excerptLines.join('\n'),
              });
            }
          }

          if (matches.length) {
            const episodeName = file.name.replace('.txt', '').replace(/_/g, ' '); // Clean up episode name
            return {
              episode: episodeName,
              episodeLink: getGithubLink(file.name),
              matches
            };
          }
          return null;
        });

      const hits = (await Promise.all(searchPromises)).filter(Boolean);
      setResults(hits);

    } catch (error) {
      console.error("Error during search:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = idx => {
    setExpandedIndexes(expanded =>
      expanded.includes(idx)
        ? expanded.filter(i => i !== idx)
        : [...expanded, idx]
    );
  };

  return (
    <div className="App">
      <header className="app-header">
        <RegulationLogo className="logo" />
      </header>

      <main>
        <div className="search-container">
          <input
            className="search-input"
            type="text"
            placeholder="Search all episodes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleSearch}
            disabled={loading}
          />
          <button
            className="search-button"
            onClick={handleSearch}
            disabled={loading || !search}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {loading && <p className="status-message">Searching...</p>}

        {!loading && hasSearched && results.length === 0 && (
          <p className="status-message">No results found for "{search}".</p>
        )}

        {!loading && results.length > 0 && (
          <div className="results-summary">
            <strong>{results.length} episode{results.length !== 1 ? "s" : ""} found</strong>
          </div>
        )}

        <ul className="results-list">
          {results.map((r, idx) => {
            const expanded = expandedIndexes.includes(idx);
            return (
              <li key={r.episode + idx} className="result-item">
                <button
                  className={`result-header${expanded ? ' expanded' : ''}`}
                  onClick={() => handleToggle(idx)}
                  aria-expanded={expanded}
                >
                  <span>
                    <a
                      href={r.episodeLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {r.episode}
                    </a>
                  </span>
                  <span className="result-count">
                    {r.matches?.length ?? 0} result{(r.matches?.length ?? 0) !== 1 ? 's' : ''}
                  </span>
                  <span className={`chevron${expanded ? ' chevron-down' : ''}`}></span>
                </button>
                <div
                  className="result-excerpt-expand"
                  style={{
                    maxHeight: expanded ? '1000px' : '0',
                    overflow: 'hidden',
                    transition: 'max-height 0.45s cubic-bezier(.4,0,.2,1)'
                  }}
                >
                  {expanded && (
                    <div className="result-excerpt" style={{ whiteSpace: 'pre-wrap' }}>
                      {(Array.isArray(r.matches) ? r.matches : []).map((m, i) => (
                        <Fragment key={i}>
                          <div style={{ marginBottom: "1.2em" }}>
                            {m.context}
                          </div>
                          {i !== r.matches.length - 1 && (
                            <hr className="transcription-divider" />
                          )}
                        </Fragment>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}

export default App;