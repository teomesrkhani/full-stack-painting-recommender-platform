import React, { useState, useEffect, useCallback, memo } from 'react';
import { debounce } from 'lodash';
import { FaChevronLeft, FaHeart } from 'react-icons/fa';
import '../styles/paintings.css';
import '../styles/title.css';

const PaintingInfo = memo(({ url, title, artist }) => (
  <div className='paintingInfo'>
    <img className='paintingImg' src={url} alt={title} loading="lazy" />
    <h2>{title}</h2>
    <p>By {artist}</p>
  </div>
));

function PaintingGenerator() {
  const [paintingData, setPaintingData] = useState({
    url: "",
    title: "",
    artist: "",
    liked: false,
  });
  const [xappToken, setXappToken] = useState("");
  const [artistIDs, setArtistIDs] = useState([]);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const response = await fetch("https://api.artsy.net/api/tokens/xapp_token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: "ENTER_YOUR_ID",
            client_secret: "ENTER_YOUR_PASSWORD"
          })
        });
        const data = await response.json();
        setXappToken(data.token);
      } catch (error) {
        console.error("Error fetching token:", error);
      }
    };
    fetchToken();
  }, []);

  useEffect(() => {
    const fetchArtistIDs = async () => {
      try {
        const response = await fetch("/artists.txt");
        const text = await response.text();
        const lines = text.split("\n")
          .map(line => line.trim())
          .filter(Boolean)
          .map(line => {
            const [name, id] = line.split(',');
            return {name, id};
          })
        setArtistIDs(lines);
      } catch (err) {
        console.error("Error loading artist IDs:", err);
      }
    };
    fetchArtistIDs();
  }, []);

  const generatePainting = useCallback(async () => {
    if (!xappToken || artistIDs.length === 0) return;

    try {
      const randomLine = Math.floor(Math.random() * artistIDs.length)

      const curArtistName = artistIDs[randomLine].name;
      const curArtistID = artistIDs[randomLine].id;
      
      const artworkResponse = await fetch(
        `https://api.artsy.net/api/artworks?page=1&size=100&artist_id=${curArtistID}`,
        { headers: { 'X-Xapp-Token': xappToken } }
      );
      const artworkData = await artworkResponse.json();
      const artworks = artworkData?._embedded?.artworks || [];

      if (artworks.length > 0) {
        const randomIndex = Math.floor(Math.random() * artworks.length);
        const artwork = artworks[randomIndex];

        const imageUrl = artwork._links?.image?.href?.replace('{image_version}', 'normalized');

        setPaintingData({
          url: imageUrl || "",
          title: artwork.title || "Untitled",
          artist: artwork.artist_names || curArtistName || "Unknown Artist",
          liked: false,
        });
      }
    } catch (error) {
      console.error("Error fetching artwork:", error);
    }
  }, [xappToken, artistIDs]);

  const debouncedGeneratePainting = useCallback(debounce(generatePainting, 300), [generatePainting]);

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
      console.log("Painting deleted:", savedPainting);
    }
  }, [paintingData]);
  

  useEffect(() => {
    const newPainting = {
      url: paintingData.url,
      title: paintingData.title,
      artist: paintingData.artist,
      liked: paintingData.liked
    };
    setPaintingData(newPainting);
  }, [paintingData.url, paintingData.title, paintingData.artist, paintingData.liked]);

  useEffect(() => {
    if (xappToken && artistIDs.length > 0 && !paintingData.url) {
      generatePainting();
    }
  }, [xappToken, artistIDs, paintingData.url, generatePainting]);

  return (
    <div className='paintingContainer'>
      <button className='action next' onClick={debouncedGeneratePainting}>
        <FaChevronLeft />
      </button>
      <button
        className={`action like ${paintingData.liked ? 'liked' : ''}`}
        onClick={likePainting}
      >
        <FaHeart />
      </button>
      {paintingData.url ? (
        <PaintingInfo
          url={paintingData.url}
          title={paintingData.title}
          artist={paintingData.artist}
        />
      ) : (
        <p>Loading...</p>
      )}
    </div>
  );
}

export default PaintingGenerator;
