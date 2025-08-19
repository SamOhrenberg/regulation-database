import React from 'react';
import { Link } from 'react-router-dom';
import { ReactComponent as RegulationLogo } from '../logo.svg';
import '../App.css';

function Header() {
  return (
    <header className="app-header">
      <Link to="/">
        <RegulationLogo className="logo" />
      </Link>
      
      <nav>
        <Link to="/search">Search</Link>
      </nav>
    </header>
  );
}

export default Header;