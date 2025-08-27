import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import HeroEpisodeCard from './HeroEpisodeCard';

const REPO_OWNER = process.env.REACT_APP_GITHUB_REPO_OWNER;
const REPO_NAME = process.env.REACT_APP_GITHUB_REPO_NAME;

const METADATA_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/transcriptions/metadata.json`;

function HomePage() {
  const [latestEpisode, setLatestEpisode] = useState(null);
  const [latestSupplemental, setLatestSupplemental] = useState(null);
  const [latestGameplay, setLatestGameplay] = useState(null);
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHomepageData = async () => {
      try {
        const response = await fetch(METADATA_URL);
        const metadata = await response.json();

        const allEpisodes = Object.values(metadata).flat();
        
        const episode = allEpisodes
          .filter(ep => ep.category === 'Episode')
          .sort((a, b) => parseInt(b.upload_date) - parseInt(a.upload_date))[0];
        setLatestEpisode(episode);

        const supplemental = allEpisodes
          .filter(ep => ep.category !== 'Episode' && ep.category !== 'Gameplay')
          .sort((a, b) => parseInt(b.upload_date) - parseInt(a.upload_date))[0];
        setLatestSupplemental(supplemental);

        const gameplay = allEpisodes
          .filter(ep => ep.category === 'Gameplay')
          .sort((a, b) => parseInt(b.upload_date) - parseInt(a.upload_date))[0];
        setLatestGameplay(gameplay);


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

  // Combine thumbnail and other images into a single array for the carousel
  const imageSources = [];
  if (latestEpisode && latestEpisode.thumbnail) {
    imageSources.push(latestEpisode.thumbnail);
  }
  if (latestEpisode && latestEpisode.images && Array.isArray(latestEpisode.images)) {
    // Use the spread operator to add all images from the episode
    imageSources.push(...latestEpisode.images);
  }

  return (
    <div className="homepage">
      <div className="hero-container">
        <HeroEpisodeCard title="Latest Episode" episode={latestEpisode} isPriority={true} />
        <HeroEpisodeCard title="Latest Supplemental" episode={latestSupplemental} />
        <HeroEpisodeCard title="Latest Gameplay" episode={latestGameplay} />
      </div>

      <section className="browse-section">
        <h2>Browse by Show</h2>
        <div className="show-grid">
          {shows.map(showName => (
            <div key={showName} className="show-card">
              <h3>{showName}</h3>
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