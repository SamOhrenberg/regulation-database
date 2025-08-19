import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ReactComponent as RegulationLogo } from '../logo.svg';
import GlobalSearchBar from './GlobalSearchBar';

function Header() {
  return (
    <header className="app-header">
      <Link to="/" className="header-logo-link">
        <RegulationLogo className="logo" />
      </Link>
      
      <GlobalSearchBar />

      <nav className="header-nav">
        <NavLink to="/search" className="nav-link">
          Advanced Search
        </NavLink>
      </nav>
    </header>
  );
}

export default Header;