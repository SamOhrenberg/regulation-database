import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

// We can reuse the constants and the transcript parser from the EpisodePage
// In a larger app, we'd move these to a shared 'utils.js' file
const REPO_OWNER = process.env.REACT_APP_GITHUB_REPO_OWNER;
const REPO_NAME = process.env.REACT_APP_GITHUB_REPO_NAME;
const TRANSCRIPTIONS_PATH = "transcriptions";

const parseTranscript = (text) => {
    const lines = text.split(/\r?\n/);
    const transcript = [];
    const regex = /\[(\d{2}:\d{2}\.\d{3}) --> \d{2}:\d{2}\.\d{3}\]\s*(.*)/;

    for (const line of lines) {
        const match = line.match(regex);
        if (match) {
            const [_, startTime, textContent] = match;
            const timeParts = startTime.split(':').map(parseFloat);
            const startSeconds = Math.floor(timeParts[0] * 60 + timeParts[1]);
            transcript.push({ startTime, startSeconds, text: textContent });
        }
    }
    return transcript;
};

// This function recursively fetches all .txt files from the GitHub repo
const fetchAllTranscriptionFiles = async (path) => {
    const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`);
    if (!response.ok) return [];
    const items = await response.json();
    let files = [];
    for (const item of items) {
        if (item.type === 'file' && item.name.endsWith('.txt')) {
            files.push(item);
        } else if (item.type === 'dir') {
            const subFiles = await fetchAllTranscriptionFiles(item.path);
            files.push(...subFiles);
        }
    }
    return files;
};

function SearchPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [query, setQuery] = useState(searchParams.get('q') || '');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [expandedIndexes, setExpandedIndexes] = useState([]);

    // A helper to highlight the search term in text
    const highlightText = (text, term) => {
        if (!term) return text;
        const safeTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${safeTerm})`, 'gi');
        return text.split(regex).map((part, i) =>
            part.toLowerCase() === term.toLowerCase() ? <mark key={i}>{part}</mark> : part
        );
    };

    const handleSearch = async () => {
        if (!query || loading) return;

        setLoading(true);
        setHasSearched(true);
        setResults([]);
        setExpandedIndexes([]);
        setSearchParams({ q: query }); // Update URL with the query

        try {
            // Fetch all transcript file metadata from GitHub
            const files = await fetchAllTranscriptionFiles(TRANSCRIPTIONS_PATH);
            if (!Array.isArray(files)) throw new Error("Failed to fetch file list.");

            // Fetch metadata.json to get episode details like URLs
            const metaResponse = await fetch(`https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/transcriptions/metadata.json`);
            const allMetadata = await metaResponse.json();

            const searchPromises = files.map(async file => {
                const resp = await fetch(file.download_url);
                const text = await resp.text();
                const transcript = parseTranscript(text);
                const lowerQuery = query.toLowerCase();

                const matches = [];
                for (const line of transcript) {
                    if (line.text.toLowerCase().includes(lowerQuery)) {
                        matches.push(line);
                    }
                }

                if (matches.length > 0) {
                    // Find the corresponding metadata for this file
                    let episodeMeta = null;
                    for (const show in allMetadata) {
                        const meta = allMetadata[show].find(ep => ep.transcript_path === file.path);
                        if (meta) {
                            episodeMeta = meta;
                            break;
                        }
                    }

                    // Create the episode ID from the filename for the link
                    const episodeId = file.name.replace('.txt', '');

                    return {
                        episode: episodeMeta ? episodeMeta.title : episodeId.replace(/_/g, ' '),
                        episodeLink: `/episode/${encodeURIComponent(episodeId)}`,
                        youtubeUrl: episodeMeta ? episodeMeta.url : '#',
                        matches,
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

    // This effect will run the search if the page is loaded with a search query in the URL
    // e.g., /search?q=gurpler
    useEffect(() => {
        const queryFromUrl = searchParams.get('q');
        if (queryFromUrl) {
            setQuery(queryFromUrl);
            handleSearch();
        }
    }, [searchParams]);

    // The main JSX for the page
    return (
        <div className="search-page">
            <h1>Search Transcripts</h1>
            <div className="search-container">
                <input
                    className="search-input"
                    type="text"
                    placeholder="Search all episodes..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    disabled={loading}
                />
                <button
                    className="search-button"
                    onClick={handleSearch}
                    disabled={loading || !query}>
                    {loading ? 'Searching...' : 'Search'}
                </button>
            </div>

            {loading && <p className="status-message">Searching...</p>}

            {!loading && hasSearched && results.length === 0 && (
                <p className="status-message">No results found for "{query}".</p>
            )}

            {!loading && results.length > 0 && (
                <div className="results-summary">
                    <strong>Found {results.reduce((acc, r) => acc + r.matches.length, 0)} results in {results.length} episode{results.length !== 1 ? "s" : ""}</strong>
                </div>
            )}

            <ul className="results-list">
                {results.map((r, idx) => {
                    const expanded = expandedIndexes.includes(idx);
                    return (
                        <li key={r.episodeLink} className="result-item">
                            <button
                                className={`result-header${expanded ? ' expanded' : ''}`}
                                onClick={() => setExpandedIndexes(expanded ? expandedIndexes.filter(i => i !== idx) : [...expandedIndexes, idx])}
                                aria-expanded={expanded}
                            >
                                <span>
                                    <Link to={r.episodeLink}>{r.episode}</Link>
                                </span>
                                <span className="result-count">
                                    {r.matches.length} result{r.matches.length !== 1 ? 's' : ''}
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
                                    <div className="result-excerpt">
                                        {r.matches.map((match, i) => (
                                            <div key={i} className="search-result-snippet">
                                                <a
                                                    href={`${r.youtubeUrl}&t=${match.startSeconds}s`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="timestamp-link"
                                                    title={`Go to ${match.startTime.split('.')[0]} in video`}
                                                >
                                                    [{match.startTime.split('.')[0]}]
                                                </a>
                                                <p className="transcript-text">
                                                    {highlightText(match.text, query)}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export default SearchPage;