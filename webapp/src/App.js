import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ReactComponent as RegulationLogo } from './logo.svg';
import './App.css';

// We will create these page components in the next step.
// For now, we'll just define placeholder functions.
const HomePage = () => <div><h1>Home Page</h1><p>This will be the main landing page.</p></div>;
const SearchPage = () => <div><h1>Search Page</h1><p>This page will contain the search results.</p></div>;
const EpisodePage = () => <div><h1>Episode Page</h1><p>This page will show a full transcript.</p></div>;


function App() {
  return (
    <div className="App">
      {/* We will move this header to a dedicated component later */}
      <header className="app-header">
        <RegulationLogo className="logo" />
      </header>

      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          {/* The ':id' is a URL parameter for the specific episode */}
          <Route path="/episode/:id" element={<EpisodePage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;