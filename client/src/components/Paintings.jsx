import React, { useState, useEffect, useCallback, memo } from 'react';
import { debounce, random } from 'lodash';
import { FaChevronLeft, FaHeart } from 'react-icons/fa';
import '../styles/paintings.css';
import '../styles/title.css';

const PaintingInfo = memo(({ url, title, artist }) => (
  <div className='paintingInfo'>
    <img className='paintingImg' src={url} alt={title} loading="lazy" />
    <h2>{title}</h2>
  </div>
));

function PaintingGenerator() {
  const [paintingData, setPaintingData] = useState({
    url: "",
    title: "",
    artist: "",
    liked: false,
  });

  const [artistIDs, setArtistIDs] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationGenerated, setRecommendationGenerated] = useState(false);

  const checkForRecommendations = async () => {
    try {
      const response = await fetch("http://localhost:5050/record");
      const likes = await response.json();
      console.log('likes', likes);
      
      if (likes.length > 0) {
        const artistCountMap = new Map();
  
        likes.forEach(like => {
          if (artistCountMap.has(like.artist)) {
            artistCountMap.set(like.artist, artistCountMap.get(like.artist) + 1);
          } else {
            artistCountMap.set(like.artist, 1);
          }
        });
        
        const artists = Array.from(artistCountMap.keys());
        const counts = Array.from(artistCountMap.values());
        
        const recResponse = await fetch("http://localhost:5050/recommend", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ artists, counts })
        });
        
        const recs = await recResponse.json();
        setRecommendations(recs);
        setRecommendationGenerated(true);

      }
    } catch (error) {
      setRecommendationGenerated(false);
      console.error("Recommendation error:", error);
    }
  };

  useEffect(() => {
    const fetchArtistIDs = async () => {
      try {
        const response = await fetch("/final_out.json");
        const text = await response.json();
        setArtistIDs(text);

      } catch (err) {
        console.error("Error loading artist IDs:", err);
      }
    };
    fetchArtistIDs();
  }, []);

  const generatePainting = useCallback(async () => {
    try {
      if (recommendations.length > 0) {
        const randomChoice = Math.random();
        if (randomChoice < 0.4) { // 40% chance to select from saved artists
          const savedArtists = await fetch("http://localhost:5050/record");
          const savedLikes = await savedArtists.json();
          const savedArtist = savedLikes[Math.floor(Math.random() * savedLikes.length)].artist;
          
          const numPaintings = artistIDs[savedArtist].length;
          const randomArtwork = Math.floor(Math.random() * numPaintings);
          const artworkName = artistIDs[savedArtist][randomArtwork].Artwork;
          const artworkURL = artistIDs[savedArtist][randomArtwork].URL;
          
          setPaintingData({
            url: artworkURL || "",
            title: artworkName || "Untitled",
            artist: savedArtist || "Unknown Artist",
            liked: false,
          });
          console.log('Select from liked artists', savedLikes);
        } else if (randomChoice < 0.8) { // 40% chance to select from top 5 recommended artists
          const recommendedArtist = recommendations[Math.floor(Math.random() * Math.min(5, recommendations.length))];
          
          if (artistIDs[recommendedArtist]) {
            const numPaintings = artistIDs[recommendedArtist].length;
            const randomArtwork = Math.floor(Math.random() * numPaintings);
            const artworkName = artistIDs[recommendedArtist][randomArtwork].Artwork;
            const artworkURL = artistIDs[recommendedArtist][randomArtwork].URL;
            
            setPaintingData({
              url: artworkURL || "",
              title: artworkName || "Untitled",
              artist: recommendedArtist || "Unknown Artist",
              liked: false,
            });
            console.log('Select from a top 5 recommendation', recommendations);
          } 
        } else { // 20% chance: Random artist
          const numArtists = Object.keys(artistIDs).length;
          const randomLine = Math.floor(Math.random() * numArtists);
          const curArtist = Object.keys(artistIDs)[randomLine];
          const numPaintings = artistIDs[curArtist].length;
          const randomArtwork = Math.floor(Math.random() * numPaintings);
          const artworkName = artistIDs[curArtist][randomArtwork].Artwork;
          const artworkURL = artistIDs[curArtist][randomArtwork].URL;
          
          setPaintingData({
            url: artworkURL || "",
            title: artworkName || "Untitled",
            artist: curArtist || "Unknown Artist",
            liked: false,
          });
          console.log('Select a random artist');
        }
      } else { // No recommendations
        const numArtists = Object.keys(artistIDs).length;
        const randomLine = Math.floor(Math.random() * numArtists);
        const curArtist = Object.keys(artistIDs)[randomLine];
        const numPaintings = artistIDs[curArtist].length;
        const randomArtwork = Math.floor(Math.random() * numPaintings);
        const artworkName = artistIDs[curArtist][randomArtwork].Artwork;
        const artworkURL = artistIDs[curArtist][randomArtwork].URL;
        
        setPaintingData({
          url: artworkURL || "",
          title: artworkName || "Untitled",
          artist: curArtist || "Unknown Artist",
          liked: false,
        });
        console.log('Select a random artist');
      }
    } catch (error) {
      console.error("Error fetching artwork:", error);
    }
  }, [artistIDs, recommendations]);

  const debouncedGeneratePainting = useCallback(
    debounce(generatePainting, 300),
    [generatePainting]
  );

  const likePainting = useCallback(async () => {
    const newLikedState = !paintingData.liked;
    setPaintingData(prev => ({ ...prev, liked: newLikedState }));
  
    if (newLikedState) {
      const response = await fetch("http://localhost:5050/record", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: paintingData.title,
          artist: paintingData.artist,
          url: paintingData.url
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to save painting');
      }
      
      const savedPainting = await response.json();
      setPaintingData(prev => ({ ...prev, id: savedPainting.insertedId }));
      console.log("Painting saved:", savedPainting);
      
    }
    else {      
      const response = await fetch(`http://localhost:5050/record/${paintingData.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: paintingData.title,
          artist: paintingData.artist,
          url: paintingData.url,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to delete painting');
      }
      
      const savedPainting = await response.json();
      checkForRecommendations();
      console.log("Painting deleted:", savedPainting);
    }
  }, [paintingData]);

  useEffect(() => {
    if (Object.keys(artistIDs).length > 0 && recommendations.length === 0) {
      checkForRecommendations();
    }
  }, [artistIDs, recommendations]);
  

  useEffect(() => {
    if (Object.keys(artistIDs).length > 0 && paintingData.url === "") {
      generatePainting();
    }
  }, [artistIDs, paintingData.url]);

  return (
    <div className='paintingContainer'>
      {paintingData.url ? (
        <PaintingInfo
          url={paintingData.url}
          title={paintingData.title}
          artist={paintingData.artist}
        />
      ) : (
        <></>
      )}
      <div className="actions-container">
        <button className='action next' onClick={debouncedGeneratePainting}>
          Next
        </button>
        
        <button
          className={`action like ${paintingData.liked ? 'liked' : ''}`}
          onClick={likePainting}
        >
          {paintingData.liked ? 'Unlike' : 'Like'}
        </button>
      </div>
    </div>
  );
}

export default PaintingGenerator;
