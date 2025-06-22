import { useState, useEffect } from 'react';
import '../styles/gen_ai.css';
import { getUniqueLikedArtistsWithCounts } from '../utils/db';

const BACKEND_URL = 'http://localhost:5001';

function GenAIPaintingGenerator() { // Ensure component name is consistent if renamed
  const [prompt, setPrompt] = useState('');
  const [paintingUrl, setPaintingUrl] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationMode, setGenerationMode] = useState(2); // 1: Liked, 2: Own Prompt, 3: AI for Prompt
  const [availableLikedArtists, setAvailableLikedArtists] = useState([]);
  const [isLoadingLikedArtists, setIsLoadingLikedArtists] = useState(false);

  useEffect(() => {
    const fetchArtistsForMode = async () => {
      if (generationMode === 1) {
        setIsLoadingLikedArtists(true);
        try {
          const { artists } = await getUniqueLikedArtistsWithCounts();
          setAvailableLikedArtists(artists);
          if (artists.length > 0) {
            setPrompt(`Generate a painting inspired by styles similar to ${artists.slice(0, 3).join(', ')}...`);
          } else {
            setPrompt('No liked artists found. Please like some paintings first to use this mode.');
          }
        } catch (error) {
          console.error("Error fetching liked artists for GenAI:", error);
          setPrompt('Could not load your liked artists. Please try refreshing.');
          setAvailableLikedArtists([]);
        } finally {
          setIsLoadingLikedArtists(false);
        }
      }
    };
    fetchArtistsForMode();
  }, [generationMode]);

  const handlePaintingGeneration = async () => {
    let finalPrompt = prompt;
    if (generationMode === 1) {
      if (availableLikedArtists.length === 0) return alert("No liked artists available for this mode.");
      // Prompt is already set or can be edited by user
    } else if (generationMode === 3) {
      alert("'AI Write Prompt For Me' is a placeholder. Using current text.");
      // Future: call LLM to generate prompt based on some input, then set finalPrompt
    }
    if (!finalPrompt || !finalPrompt.trim()) return alert("Please provide a prompt.");

    setIsGenerating(true);
    if (paintingUrl) URL.revokeObjectURL(paintingUrl); 
    setPaintingUrl(null);
    try {
      const response = await fetch(`${BACKEND_URL}/generate-painting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: finalPrompt }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to generate painting: ${response.status} - ${errorText}`);
      }
      const imageBlob = await response.blob();
      const newImageUrl = URL.createObjectURL(imageBlob);
      setPaintingUrl(newImageUrl);
    } catch (error) {
      console.error('Error during painting generation:', error);
      alert(`Generation failed: ${error.message}`);
      setPaintingUrl(null);
    } finally {
      setIsGenerating(false);
    }
  };


  
  useEffect(() => { // Cleanup object URL
    return () => { if (paintingUrl) URL.revokeObjectURL(paintingUrl); };
  }, [paintingUrl]);

  return (
    <div className="gen-ai-container">
      <div className="input-section">
        <h1>Generate a Painting (AI)</h1>
        <div className="radio-group">
          <label className="radio-label">
            <input 
              type="radio" 
              name="genMode" 
              value={1} 
              checked={generationMode === 1}
              onChange={(e) => setGenerationMode(parseInt(e.target.value))}
            />
            <span className="radio-text">Based on My Liked Artists</span>
          </label>
          <label className="radio-label">
            <input 
              type="radio" 
              name="genMode" 
              value={2} 
              checked={generationMode === 2}
              onChange={(e) => setGenerationMode(parseInt(e.target.value))}
            />
            <span className="radio-text">Write My Own Prompt</span>
          </label>
          <label className="radio-label">
            <input 
              type="radio" 
              name="genMode" 
              value={3} 
              checked={generationMode === 3}
              onChange={(e) => setGenerationMode(parseInt(e.target.value))}
            />
            <span className="radio-text">AI Write Prompt For Me</span>
          </label>
        </div>
        <textarea
          className="prompt-input"
          placeholder={
            generationMode === 1
              ? (isLoadingLikedArtists ? "Loading liked artists..." : (availableLikedArtists.length > 0 ? prompt : "No liked artists found..."))
              : generationMode === 2
                ? "Describe the painting you want... (e.g., A serene lake at dawn in impressionist style)"
                : "Describe the style or upload an image (AI prompt generation coming soon)..."
          }
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={10}
          disabled={(generationMode === 1 && (isLoadingLikedArtists || availableLikedArtists.length === 0))}
        />
        <button
          className="generate-button"
          onClick={handlePaintingGeneration}
          disabled={isGenerating || (generationMode === 1 && (isLoadingLikedArtists || availableLikedArtists.length === 0))}
        >
          {isGenerating ? 'Generating...' : 'Generate Painting'}
        </button>
      </div>
      <div className="painting-display">
        {isGenerating ? (
          <div className="loading-indicator"><p>Creating your masterpiece...</p><div className="spinner"></div></div>
        ) : paintingUrl ? (
          <img src={paintingUrl} alt="AI generated painting" className="generated-painting" />
        ) : (
          <div className="placeholder-display"><p>Your AI-generated painting will appear here</p></div>
        )}
      </div>
    </div>
  );
}

export default GenAIPaintingGenerator;