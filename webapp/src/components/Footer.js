import React from 'react';

function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-links">
        <span className="footer-tagline">Deep Lore About Nothing</span>
        <a 
          href="https://github.com/SamOhrenberg/regulation-database" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="footer-link"
        >
          GitHub Project
        </a>
        <a 
          href="https://www.patreon.com/TheRegulationPod" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="footer-link"
        >
          Regulation Podcast Patreon
        </a>
      </div>
    </footer>
  );
}

export default Footer;