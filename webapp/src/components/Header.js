import React from 'react';
import { Link } from 'react-router-dom';
import { ReactComponent as RegulationLogo } from '../logo.svg';
import GlobalSearchBar from './GlobalSearchBar';

function Header() {
  return (
    <header className="app-header">
      <Link to="/" className="header-logo-link">
        <RegulationLogo className="logo" />
      </Link>
      
      <GlobalSearchBar />
    </header>
  );
}

export default Header;