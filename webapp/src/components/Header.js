// src/components/Header.js
import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ReactComponent as RegulationLogo } from '../logo.svg';
import GlobalSearchBar from './GlobalSearchBar'; // Import the new component

function Header() {
  return (
    <header className="app-header">
      <Link to="/" className="header-logo-link">
        <RegulationLogo className="logo" />
      </Link>
      
      {/* Add the new search bar to the middle of the header */}
      <GlobalSearchBar />
      
    </header>
  );
}

export default Header;