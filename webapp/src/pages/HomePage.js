import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const REPO_OWNER = process.env.REACT_APP_GITHUB_REPO_OWNER;
const REPO_NAME = process.env.REACT_APP_GITHUB_REPO_NAME;

const METADATA_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/transcriptions/metadata.json`;

function HomePage() {
  const [latestEpisode, setLatestEpisode] = useState(null);
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHomepageData = async () => {
      try {
        const response = await fetch(METADATA_URL);
        const metadata = await response.json();

        // Find the latest "Episode" from the "Regulation Podcast"
        if (metadata['Regulation Podcast']) {
          const latest = metadata['Regulation Podcast']
            .filter(ep => ep.category === 'Episode') // Filter by category
            .sort((a, b) => parseInt(b.upload_date) - parseInt(a.upload_date)) // Sort by newest
            [0]; // Get the very first one
          setLatestEpisode(latest);
        }

        // Get the list of all available shows
        setShows(Object.keys(metadata));

      } catch (error) {
        console.error("Failed to fetch homepage data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHomepageData();
  }, []);

  if (loading) {
    return <div className="status-message">Loading...</div>;
  }

  // Helper to create a URL-friendly slug from a show name
  const getEpisodeId = (path) => path.split('/').pop().replace('.txt', '');

  return (
    <div className="homepage">
      {/* --- LATEST EPISODE HERO SECTION --- */}
      {latestEpisode && (
        <section className="hero-section">
          <h2>Latest Episode</h2>
          <div className="latest-episode-card">
            <img src={latestEpisode.thumbnail} alt={latestEpisode.title} className="latest-episode-thumbnail" />
            <div className="latest-episode-meta">
              <span className="show-badge">{latestEpisode.show}</span>
              <h3>{latestEpisode.title}</h3>
              <p className="episode-description">
                {/* Truncate the description to a reasonable length */}
                {latestEpisode.description.substring(0, 200)}...
              </p>
              <Link 
                to={`/episode/${encodeURIComponent(getEpisodeId(latestEpisode.transcript_path))}`} 
                className="button-primary"
              >
                View Full Transcript
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* --- BROWSE BY SHOW SECTION --- */}
      <section className="browse-section">
        <h2>Browse by Show</h2>
        <div className="show-grid">
          {shows.map(showName => (
            <div key={showName} className="show-card">
              <h3>{showName}</h3>
              {/* This link is a placeholder for now, but we can build it out later */}
              <Link to={`/search?q=&show=${encodeURIComponent(showName)}`} className="button-secondary">
                View All Transcripts
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default HomePage;