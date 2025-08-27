import React, { useState } from 'react';
import { Link } from 'react-router-dom';

// Helper to create a URL-friendly slug from a transcript path
const getEpisodeId = (path) => path.split('/').pop().replace('.txt', '');

function HeroEpisodeCard({ title, episode, isPriority = false  }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Combine thumbnail and other images into a single array for the carousel
  const imageSources = [];
  if (episode && episode.thumbnail) {
    imageSources.push(episode.thumbnail);
  }
  if (episode && episode.images && Array.isArray(episode.images)) {
    imageSources.push(...episode.images);
  }

  // Carousel navigation handlers
  const handleNextImage = () => {
    setCurrentImageIndex((prevIndex) => (prevIndex + 1) % imageSources.length);
  };
  const handlePrevImage = () => {
    setCurrentImageIndex((prevIndex) => (prevIndex - 1 + imageSources.length) % imageSources.length);
  };

  if (!episode) {
    return null; // Don't render anything if there's no episode
  }

  return (
    <section className="hero-section">
      <h2>{title}</h2>
      <div className="latest-episode-card">
        {imageSources.length > 0 && (
          <div className="image-carousel">
            <img
              src={imageSources[currentImageIndex]}
              alt={`${episode.title} - Image ${currentImageIndex + 1}`}
              className="latest-episode-thumbnail"
              loading={isPriority ? 'eager' : 'lazy'}
            />
            {imageSources.length > 1 && (
              <>
                <button onClick={handlePrevImage} className="carousel-button prev">‹</button>
                <button onClick={handleNextImage} className="carousel-button next">›</button>
                <span className="carousel-indicator">{currentImageIndex + 1} / {imageSources.length}</span>
              </>
            )}
          </div>
        )}
        <div className="latest-episode-meta">
          <span className="show-badge">{episode.show}</span>
          <h3>{episode.title}</h3>
          <p className="episode-description">
            {episode.description.substring(0, 200)}...
          </p>
          <Link
            to={`/episode/${encodeURIComponent(getEpisodeId(episode.transcript_path))}`}
            className="button-primary"
          >
            View Full Transcript
          </Link>
        </div>
      </div>
    </section>
  );
}

export default HeroEpisodeCard;