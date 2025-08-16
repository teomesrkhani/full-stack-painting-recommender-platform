import { useState, useEffect, useCallback, useRef } from 'react';
import { debounce } from 'lodash';
import '../styles/paintings.css';
import {
  addLikedPainting,
  removeLikedPaintingById,
  getLikedPaintingByUrl,
  getUniqueLikedArtistsWithCounts,
  getRecommendedArtists,
  getRandomUnviewedPainting,
  markPaintingAsViewed,
  addLikedPaintingToLocalStorage,
  isLikedPaintingInLocalStorage,
  removeLikedPaintingFromLocalStorage,
  getUniqueLikedArtistsFromLocalStorage
} from '../utils/db';

const PaintingInfo = ({ url, title, artist, originalUrl }) => (
  <div className='paintingInfo'>
    <div className="painting-image-wrapper">
      {originalUrl ? (
        <a 
          href={originalUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ cursor: 'pointer' }}
        >
          <img className='paintingImg' src={url} alt={title} loading="lazy" />
        </a>
      ) : (
        <img className='paintingImg' src={url} alt={title} loading="lazy" />
      )}
    </div>
    <h2>{title}</h2>
  </div>
);

function PaintingGenerator() {
  const [paintingData, setPaintingData] = useState(null);
  const [nextPainting, setNextPainting] = useState(null);
  const [likedArtistPool, setLikedArtistPool] = useState({ artists: [], counts: [] });

  const preloadImage = (url) => {
    const img = new Image();
    img.src = url;
  };

  const fetchAndPreload = useCallback(async () => {
    try {
      const painting = await getRandomUnviewedPainting();
      if (painting) {
        const isLiked = !!isLikedPaintingInLocalStorage(painting.imageUrl);
        preloadImage(painting.imageUrl);
        return { ...painting, liked: isLiked };
      }
      return null;
    } catch (error) {
      console.error("Error fetching and preloading painting:", error);
      return null;
    }
  }, []);

  useEffect(() => {
    const initialize = async () => {
      const firstPainting = await fetchAndPreload();
      if (firstPainting) {
        setPaintingData(firstPainting);
        markPaintingAsViewed(firstPainting._id);
        const preloadedNext = await fetchAndPreload();
        setNextPainting(preloadedNext);
      } else {
        setPaintingData({ title: "No paintings available" });
      }
    };
    initialize();
  }, [fetchAndPreload]);

  const refreshLikedArtistPool = useCallback(() => {
    try {
      const details = getUniqueLikedArtistsFromLocalStorage();
      setLikedArtistPool(details);
    } catch (error) {
      console.error("Error fetching liked artists for generator:", error);
      setLikedArtistPool({ artists: [], counts: [] });
    }
  }, []);

  useEffect(() => {
    refreshLikedArtistPool();
  }, [refreshLikedArtistPool]);

  const showNextPainting = useCallback(async () => {
    if (nextPainting) {
      setPaintingData(nextPainting);
      markPaintingAsViewed(nextPainting._id);
      setNextPainting(null); // Clear next painting, it will be fetched below
      const preloadedNext = await fetchAndPreload();
      setNextPainting(preloadedNext);
    } else {
      // Fallback if preloading failed or was slow
      const newPainting = await fetchAndPreload();
      if (newPainting) {
        setPaintingData(newPainting);
        markPaintingAsViewed(newPainting._id);
      } else {
        setPaintingData({ title: "No more paintings available" });
      }
    }
  }, [nextPainting, fetchAndPreload]);

  const toggleLikePainting = useCallback(() => {
    if (!paintingData || !paintingData.imageUrl) return;
    
    const currentlyLiked = paintingData.liked;
    const newLikedState = !currentlyLiked;
    
    setPaintingData(prev => ({ ...prev, liked: newLikedState }));
    
    try {
      if (newLikedState) {
        addLikedPaintingToLocalStorage({
          url: paintingData.imageUrl,
          imageUrl: paintingData.imageUrl,
          title: paintingData.title,
          artist: paintingData.artist,
          originalUrl: paintingData.url,
        });
      } else {
        const likedPainting = isLikedPaintingInLocalStorage(paintingData.imageUrl);
        if (likedPainting) {
          removeLikedPaintingFromLocalStorage(likedPainting.id);
        }
      }
      refreshLikedArtistPool();
    } catch (error) {
      console.error("Error toggling like state:", error);
      setPaintingData(prev => ({ ...prev, liked: currentlyLiked }));
    }
  }, [paintingData, refreshLikedArtistPool]);

  const debouncedShowNextPainting = useCallback(debounce(showNextPainting, 200), [showNextPainting]);

  if (!paintingData) {
    return (
      <div className='paintingContainer'>
        <div className='paintingInfo'>
        </div>
      </div>
    );
  }

  return (
    <div className='paintingContainer'>
      <PaintingInfo
        url={paintingData.imageUrl}
        title={paintingData.title}
        artist={paintingData.artist}
        originalUrl={paintingData.url}
      />
      <div className="actions-container">
        <button 
          className='action next' 
          onClick={debouncedShowNextPainting}
        >
          Next
        </button>
        <button
          className={`action like ${paintingData.liked ? 'liked' : ''}`}
          onClick={toggleLikePainting}
          disabled={!paintingData.imageUrl}
        >
          {paintingData.liked ? 'Unlike' : 'Like'}
        </button>
      </div>
    </div>
  );
}

export default PaintingGenerator;
