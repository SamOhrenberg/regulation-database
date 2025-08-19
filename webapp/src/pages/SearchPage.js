import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

// --- Constants and Helper Functions ---
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
// --- End of Helper Functions ---


function SearchPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const query = searchParams.get('q') || '';
    const initialShowFilter = searchParams.get('show');

    const [rawResults, setRawResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [expandedIndexes, setExpandedIndexes] = useState([]);
    const [allMetadata, setAllMetadata] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(15); // New state for items per page
    
    const [activeFilters, setActiveFilters] = useState({
        show: initialShowFilter ? [decodeURIComponent(initialShowFilter)] : [],
        category: [],
    });
    
    const [sortBy, setSortBy] = useState(query ? 'relevance' : 'newest');

    const highlightText = (text, term) => {
        if (!term) return text;
        const safeTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${safeTerm})`, 'gi');
        return text.split(regex).map((part, i) =>
            part.toLowerCase() === term.toLowerCase() ? <mark key={i}>{part}</mark> : part
        );
    };

    const handleFilterChange = (filterType, value) => {
        setCurrentPage(1);
        const newFilters = { ...activeFilters };
        const currentFilter = newFilters[filterType];
        if (currentFilter.includes(value)) {
            newFilters[filterType] = currentFilter.filter(item => item !== value);
        } else {
            newFilters[filterType] = [...currentFilter, value];
        }
        setActiveFilters(newFilters);
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete(filterType);
        newFilters[filterType].forEach(filterValue => {
            newSearchParams.append(filterType, filterValue);
        });
        setSearchParams(newSearchParams);
    };
    
    // New handler for changing items per page
    const handleItemsPerPageChange = (e) => {
        setItemsPerPage(Number(e.target.value));
        setCurrentPage(1); // Reset to the first page
    };

    useEffect(() => {
        const fetchAndProcessData = async () => {
            setLoading(true);
            setHasSearched(true);
            setRawResults([]);
            setExpandedIndexes([]);
            setCurrentPage(1);
            setSortBy(query ? 'relevance' : 'newest');

            try {
                const metaResponse = await fetch(`https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/transcriptions/metadata.json`);
                const metadata = await metaResponse.json();
                setAllMetadata(metadata);
                let hits = [];
                if (query) {
                    const files = await fetchAllTranscriptionFiles(TRANSCRIPTIONS_PATH);
                    if (!Array.isArray(files)) throw new Error("Failed to fetch file list.");
                    const searchPromises = files.map(async file => {
                        const resp = await fetch(file.download_url);
                        const text = await resp.text();
                        const transcript = parseTranscript(text);
                        const lowerQuery = query.toLowerCase();
                        const matches = transcript.filter(line => line.text.toLowerCase().includes(lowerQuery));
                        if (matches.length > 0) {
                            let epMeta = null;
                            for (const show in metadata) {
                                const meta = metadata[show].find(ep => ep.transcript_path === file.path);
                                if (meta) { epMeta = meta; break; }
                            }
                            const epId = file.name.replace('.txt', '');
                            return {
                                episode: epMeta ? epMeta.title : epId.replace(/_/g, ' '),
                                episodeLink: `/episode/${encodeURIComponent(epId)}`,
                                youtubeUrl: epMeta ? epMeta.url : '#',
                                matches, show: epMeta ? epMeta.show : 'Unknown',
                                category: epMeta ? epMeta.category : 'Unknown',
                                uploadDate: epMeta ? parseInt(epMeta.upload_date) : 0,
                            };
                        }
                        return null;
                    });
                    hits = (await Promise.all(searchPromises)).filter(Boolean);
                } else {
                    hits = Object.values(metadata).flat().map(ep => {
                        const epId = ep.transcript_path.split('/').pop().replace('.txt', '');
                        return {
                            episode: ep.title, episodeLink: `/episode/${encodeURIComponent(epId)}`,
                            youtubeUrl: ep.url, matches: [], show: ep.show,
                            category: ep.category,
                            uploadDate: ep.upload_date ? parseInt(ep.upload_date) : 0,
                        };
                    });
                }
                setRawResults(hits);
            } catch (error) {
                console.error("Error during search:", error);
            } finally {
                setLoading(false);
            }
        };
        if (query || initialShowFilter) { fetchAndProcessData(); } 
        else { setHasSearched(false); }
    }, [query, initialShowFilter]);

    const filteredAndSortedResults = useMemo(() => {
        if (!rawResults.length) return [];
        const filtered = rawResults.filter(result => {
            const showFilter = activeFilters.show;
            const categoryFilter = activeFilters.category;
            const showMatch = showFilter.length === 0 || showFilter.includes(result.show);
            const categoryMatch = categoryFilter.length === 0 || categoryFilter.includes(result.category);
            return showMatch && categoryMatch;
        });
        const sorted = [...filtered].sort((a, b) => {
            switch (sortBy) {
                case 'newest': return (b.uploadDate || 0) - (a.uploadDate || 0);
                case 'oldest': return (a.uploadDate || 0) - (b.uploadDate || 0);
                case 'most-matches':
                    if (a.matches.length === 0 && b.matches.length === 0) return 0;
                    return b.matches.length - a.matches.length;
                default: return 0;
            }
        });
        return sorted;
    }, [rawResults, activeFilters, sortBy]);
    
    const paginatedResults = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredAndSortedResults.slice(startIndex, startIndex + itemsPerPage);
    }, [currentPage, filteredAndSortedResults, itemsPerPage]); // Added itemsPerPage dependency

    const totalPages = Math.ceil(filteredAndSortedResults.length / itemsPerPage);
    const showNoResultsMessage = hasSearched && filteredAndSortedResults.length === 0;

    return (
        <div className="search-page">
            <h1>{query ? `Results for "${query}"` : 'Advanced Search & Browse'}</h1>
            <div className="filter-sort-container">
                <div className="filter-section">
                    <h3>Filter by Show</h3>
                    <div className="filter-options">
                        {allMetadata && Object.keys(allMetadata).map(show => (
                            <label key={show}><input type="checkbox" checked={activeFilters.show.includes(show)} onChange={() => handleFilterChange('show', show)} />{show}</label>
                        ))}
                    </div>
                </div>
                <div className="filter-section">
                    <h3>Filter by Category</h3>
                    <div className="filter-options">
                        {allMetadata && [...new Set(Object.values(allMetadata).flat().map(ep => ep.category))].sort().map(cat => (
                            <label key={cat}><input type="checkbox" checked={activeFilters.category.includes(cat)} onChange={() => handleFilterChange('category', cat)} />{cat}</label>
                        ))}
                    </div>
                </div>
                <div className="sort-section">
                    <h3>Sort by</h3>
                    <select value={sortBy} onChange={e => { setSortBy(e.target.value); setCurrentPage(1); }}>
                        <option value="relevance" disabled={!query}>Relevance</option>
                        {query && <option value="most-matches">Most Matches</option>}
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                    </select>
                </div>
                {/* New "Items per Page" control */}
                <div className="sort-section">
                    <h3>Items per Page</h3>
                    <select value={itemsPerPage} onChange={handleItemsPerPageChange}>
                        <option value={15}>15</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={1000000}>∞</option>
                    </select>
                </div>
            </div>
            {loading && <p className="status-message">Searching...</p>}
            {!loading && showNoResultsMessage && <p className="status-message">No results found for your criteria.</p>}
            {!loading && filteredAndSortedResults.length > 0 && (
                <div className="results-summary">
                    <strong>
                        Displaying {paginatedResults.length === filteredAndSortedResults.length ? paginatedResults.length : `${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, filteredAndSortedResults.length)} of ${filteredAndSortedResults.length}`} episode{filteredAndSortedResults.length !== 1 ? "s" : ""}
                        {query && ` with ${filteredAndSortedResults.reduce((acc, r) => acc + r.matches.length, 0)} total matches`}
                    </strong>
                </div>
            )}
            <ul className="results-list">
                {paginatedResults.map((r) => (
                    <li key={r.episodeLink} className="result-item">
                        <button className={`result-header${expandedIndexes.includes(r.episodeLink) ? ' expanded' : ''}`} onClick={() => setExpandedIndexes(expandedIndexes.includes(r.episodeLink) ? expandedIndexes.filter(i => i !== r.episodeLink) : [...expandedIndexes, r.episodeLink])} aria-expanded={expandedIndexes.includes(r.episodeLink)}>
                            <span><Link to={r.episodeLink}>{r.episode}</Link></span>
                            <span className="result-count">{r.matches.length > 0 ? `${r.matches.length} result${r.matches.length !== 1 ? 's' : ''}` : ''}</span>
                            <span className={`chevron${expandedIndexes.includes(r.episodeLink) ? ' chevron-down' : ''}`}></span>
                        </button>
                        {query && r.matches.length > 0 && (
                            <div className="result-excerpt-expand" style={{ maxHeight: expandedIndexes.includes(r.episodeLink) ? '1000px' : '0' }}>
                                {expandedIndexes.includes(r.episodeLink) && (
                                    <div className="result-excerpt">
                                        {r.matches.map((match, i) => (
                                            <div key={i} className="search-result-snippet">
                                                <a href={`${r.youtubeUrl}&t=${match.startSeconds}s`} target="_blank" rel="noopener noreferrer" className="timestamp-link" title={`Go to ${match.startTime.split('.')[0]}`}>
                                                    [{match.startTime.split('.')[0]}]
                                                </a>
                                                <p className="transcript-text">{highlightText(match.text, query)}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </li>
                ))}
            </ul>
            {totalPages > 1 && (
                <div className="pagination-controls">
                    <button className="pagination-button" onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1}>Previous</button>
                    <span className="pagination-info">Page {currentPage} of {totalPages}</span>
                    <button className="pagination-button" onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage === totalPages}>Next</button>
                </div>
            )}
        </div>
    );
}
export default SearchPage;