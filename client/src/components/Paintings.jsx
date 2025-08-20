import { useState, useEffect, useCallback, useRef } from 'react';
import { debounce } from 'lodash';
import '../styles/paintings.css';
import {
  addLikedPainting,
  removeLikedPaintingById,
  getLikedPaintingByUrl,
  getUniqueLikedArtistsWithCounts,
  getRandomUnviewedPainting,
  markPaintingAsViewed,
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
  const [likedArtistPool, setLikedArtistPool] = useState({ artists: [], counts: [] });
  const effectRan = useRef(false);

  const fetchPainting = useCallback(async () => {
    try {
      const painting = await getRandomUnviewedPainting();
      if (painting) {
        const likedPainting = await getLikedPaintingByUrl(painting.imageUrl);
        return { ...painting, liked: !!likedPainting };
      }
      return null;
    } catch (error) {
      console.error("Error fetching painting:", error);
      return null;
    }
  }, []);

  // Effect for INITIAL load. Runs only ONCE, even in StrictMode.
  useEffect(() => {
    if (effectRan.current === false) {
      const initialize = async () => {
        const firstPainting = await fetchPainting();
        if (firstPainting) {
          setPaintingData(firstPainting);
        } else {
          setPaintingData({ title: "No paintings available" });
        }
      };
      initialize();
    }
    return () => {
      effectRan.current = true;
    };
  }, [fetchPainting]);

  const refreshLikedArtistPool = useCallback(async () => {
    try {
      const details = await getUniqueLikedArtistsWithCounts();
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
    if (paintingData && paintingData._id) {
      markPaintingAsViewed(paintingData._id);
    }
    
    const newPainting = await fetchPainting();
    if (newPainting) {
      setPaintingData(newPainting);
    } else {
      setPaintingData({ title: "No more paintings available" });
    }
  }, [paintingData, fetchPainting]);

  const toggleLikePainting = useCallback(async () => {
    if (!paintingData || !paintingData.imageUrl) return;
    
    const currentlyLiked = paintingData.liked;
    const newLikedState = !currentlyLiked;
    
    setPaintingData(prev => ({ ...prev, liked: newLikedState }));
    
    try {
      if (newLikedState) {
        console.log(`\n\npaintingData ${JSON.stringify(paintingData)} paintingData\n\n`)
        await addLikedPainting({
          title: paintingData.title,
          artist: paintingData.artist,
          url: paintingData.url,
          imageUrl: paintingData.imageUrl,
          originalUrl: paintingData.url,
          _id: paintingData._id
        });
      } else {
        const likedPainting = await getLikedPaintingByUrl(paintingData.imageUrl);
        if (likedPainting) {
          await removeLikedPaintingById(likedPainting._id);
        }
      }
      await refreshLikedArtistPool();
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
