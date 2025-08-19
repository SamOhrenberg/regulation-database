// src/components/GlobalSearchBar.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function GlobalSearchBar() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSearchSubmit = (e) => {
    // Prevent the form from doing a full page reload
    e.preventDefault(); 
    if (query.trim()) {
      // Navigate to the search page with the user's query
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setQuery(''); // Optional: clear the search bar after submitting
    }
  };

  return (
    <form onSubmit={handleSearchSubmit} className="global-search-form">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Deep lore search..."
        className="global-search-input"
      />
      <button type="submit" className="global-search-button">Search</button>
    </form>
  );
}

export default GlobalSearchBar;