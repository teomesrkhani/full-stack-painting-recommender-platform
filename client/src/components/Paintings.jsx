import { useState, useEffect, useCallback } from 'react';
import { debounce } from 'lodash';
import '../styles/paintings.css';
import {
  addLikedPainting,
  removeLikedPaintingById,
  getLikedPaintingByUrl,
  getUniqueLikedArtistsWithCounts,
  getRecommendedArtists
} from '../utils/db';

const PaintingInfo = ({ url, title, artist }) => (
  <div className='paintingInfo'>
    <img className='paintingImg' src={url} alt={title} loading="lazy" />
    <h2>{title}</h2>
  </div>
);

function PaintingGenerator() {
  const [paintingData, setPaintingData] = useState({
    url: "",
    title: "",
    artist: "",
    liked: false,
  });

  const [artistMasterList, setArtistMasterList] = useState({});
  const [likedArtistPool, setLikedArtistPool] = useState({ artists: [], counts: [] });

  // Fetch the main artwork data from `final_out.json`
  useEffect(() => {
    const fetchArtworkData = async () => {
      try {
        const jsonUrl = `${import.meta.env.BASE_URL}final_out.json`;
        const response = await fetch(jsonUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status} for ${jsonUrl}`);
        }
        const data = await response.json();
        setArtistMasterList(data);
      } catch (err) {
        console.error("Error loading artist master list:", err);
      }
    };
    fetchArtworkData();
  }, []);

  // Fetch liked artists from the database for the generator pool
  const refreshLikedArtistPool = useCallback(async () => {
    try {
      const details = await getUniqueLikedArtistsWithCounts();
      setLikedArtistPool(details);
    } catch (error) {
      console.error("Error fetching liked artists for generator:", error);
      setLikedArtistPool({ artists: [], counts: [] });
    }
  }, []);

  // fetch liked artists pool after list is ready
  useEffect(() => {
    if (Object.keys(artistMasterList).length > 0) {
      refreshLikedArtistPool();
    }
  }, [artistMasterList, refreshLikedArtistPool]);

  const checkIfPaintingIsLiked = useCallback(async (url) => {
    if (!url) return false;
    try {
      const likedPainting = await getLikedPaintingByUrl(url);
      return !!likedPainting;
    } catch (error) {
      console.error("Error checking if painting is liked:", error);
      return false;
    }
  }, []);

  const generateNewPainting = useCallback(async () => {
    if (Object.keys(artistMasterList).length === 0) {
      return;
    }
    try {
      let selectedArtistName = "";
      const availableArtistsInMasterList = Object.keys(artistMasterList);
      if (availableArtistsInMasterList.length === 0) {
        setPaintingData({ url: "", title: "No artwork data found", artist: "", liked: false });
        return;
      }

      if (likedArtistPool.artists.length > 0) {
        const randomChoice = Math.random();
        
        if (randomChoice < 0.4) { // 40% chance to select from liked artists
          selectedArtistName = likedArtistPool.artists[Math.floor(Math.random() * likedArtistPool.artists.length)];
          console.log('Select from liked artists', likedArtistPool.artists);
          
        } else if (randomChoice < 0.8) { // 40% chance to get a recommendation
          const recommendedArtists = await getRecommendedArtists(likedArtistPool.artists, likedArtistPool.counts);
          if (recommendedArtists.length > 0) {
            const top5Recommended = recommendedArtists.slice(0, 5);
            selectedArtistName = top5Recommended[Math.floor(Math.random() * top5Recommended.length)];
            console.log('Selected from top 5 recommendations:', selectedArtistName);
          } else {
            selectedArtistName = availableArtistsInMasterList[Math.floor(Math.random() * availableArtistsInMasterList.length)];
            console.log('Recommendation failed, selected random artist');
          }
        } else { // 20% chance: Random artist
          selectedArtistName = availableArtistsInMasterList[Math.floor(Math.random() * availableArtistsInMasterList.length)];
          console.log('Select a random artist');
        }
      } else { // No liked artists - select random
        selectedArtistName = availableArtistsInMasterList[Math.floor(Math.random() * availableArtistsInMasterList.length)];
        console.log('No liked artists - select random artist');
      }

      const artworksBySelectedArtist = artistMasterList[selectedArtistName];
      if (artworksBySelectedArtist && artworksBySelectedArtist.length > 0) {
        const randomArtwork = artworksBySelectedArtist[Math.floor(Math.random() * artworksBySelectedArtist.length)];
        const isNowLiked = await checkIfPaintingIsLiked(randomArtwork.URL);
        setPaintingData({
          url: randomArtwork.URL || "",
          title: randomArtwork.Artwork || "Untitled",
          artist: selectedArtistName || "Unknown Artist",
          liked: isNowLiked,
        });
      } else {
        // Fallback if error, try generating again
        if(availableArtistsInMasterList.length > 0) generateNewPainting(); 
      }
    } catch (error) {
      console.error("Error in generateNewPainting:", error);
    }
  }, [artistMasterList, likedArtistPool, checkIfPaintingIsLiked]);

  const debouncedGeneratePainting = useCallback(debounce(generateNewPainting, 300), [generateNewPainting]);

  // Like/Unlike Painting Logic
  const toggleLikePainting = useCallback(async () => {
    if (!paintingData.url) return;
    const currentlyLiked = paintingData.liked;
    const newLikedState = !currentlyLiked;
    setPaintingData(prev => ({ ...prev, liked: newLikedState }));
    try {
      if (newLikedState) {
        await addLikedPainting({
          url: paintingData.url,
          title: paintingData.title,
          artist: paintingData.artist,
        });
      } else {
        const likedPainting = await getLikedPaintingByUrl(paintingData.url);
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

  useEffect(() => {
    if (paintingData.url === "" && Object.keys(artistMasterList).length > 0) {
      generateNewPainting();
    }
  }, [paintingData.url, artistMasterList, generateNewPainting]);
  

  return (
    <div className='paintingContainer'>
      {paintingData.url ? (
        <PaintingInfo
          url={paintingData.url}
          title={paintingData.title}
          artist={paintingData.artist}
        />
      ) : (
        <div className="paintingInfo"><h2>&nbsp;</h2></div>
      )}
      <div className="actions-container">
        <button className='action next' onClick={debouncedGeneratePainting}>
          Next
        </button>
        {
          <button
            className={`action like ${paintingData.liked ? 'liked' : ''}`}
            onClick={toggleLikePainting}
          >
            {paintingData.liked ? 'Unlike' : 'Like'}
          </button>
        }
      </div>
    </div>
  );
}

export default PaintingGenerator;
