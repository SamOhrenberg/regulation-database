import React, { useState } from 'react';

const REPO_OWNER = "SamOhrenberg";
const REPO_NAME = "regulation-podcast-transcriptions";
const TRANSCRIPTIONS_PATH = "transcriptions";

function App() {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchTranscriptions = async () => {
    setLoading(true);
    setResults([]);
    // Fetch list of transcription files
    const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${TRANSCRIPTIONS_PATH}`);
    const files = await res.json();
    let hits = [];

    for (const file of files) {
      if (file.type === 'file' && file.name.endsWith('.txt')) {
        const resp = await fetch(file.download_url);
        const text = await resp.text();
        if (text.toLowerCase().includes(search.toLowerCase())) {
          hits.push({ episode: file.name, excerpt: text.substring(0, 200) });
        }
      }
    }
    setResults(hits);
    setLoading(false);
  };

  return (
    <div style={{padding: '2rem'}}>
      <h1>Regulation Podcast Transcription Search</h1>
      <input
        type="text"
        placeholder="Enter search term..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <button onClick={searchTranscriptions} disabled={loading || !search}>
        {loading ? 'Searching...' : 'Search'}
      </button>
      <ul>
        {results.map(r => (
          <li key={r.episode}>
            <strong>{r.episode}</strong>: {r.excerpt}...
          </li>
        ))}
        {(!loading && results.length === 0 && search) && <p>No results found.</p>}
      </ul>
    </div>
  );
}

export default App;