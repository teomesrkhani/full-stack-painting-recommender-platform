import React, { useState } from 'react';
import '../styles/gen_ai.css';

function PaintingRecommender() {
  const [prompt, setPrompt] = useState('');
  const [paintingUrl, setPaintingUrl] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toggleState, setToggleState] = useState(2); // Default to "Generate your own prompt"
  const [remainingCredits, setRemainingCredits] = useState(10);
  
  const decrementCredits = () => {
    setRemainingCredits(remainingCredits => remainingCredits - 1);
  };

  const generatePainting = async () => {
    setIsGenerating(true);
    
    try {
      const response = await fetch('http://localhost:5051/generate-painting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate painting');
      }

      const imageBlob = await response.blob();
      const imageUrl = URL.createObjectURL(imageBlob);
      setPaintingUrl(imageUrl);
    } catch (error) {
      console.error('Error generating painting:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleTab = (tab) => {
    setToggleState(tab);
    setPrompt(''); // Clear prompt when switching modes
    setPaintingUrl(null); // Clear any existing painting
  };

  return (
    <div className="gen-ai-container">
      <div className="input-section">
        {remainingCredits > 0 ? ( <>
        <h1>Generate a Painting</h1>
        
        <div className="radio-group">
          <label className="radio-label">
            <input 
              type="radio" 
              name="tab" 
              checked={toggleState === 1} 
              onChange={() => toggleTab(1)} 
            />
            <span className="radio-text">Use My Liked Artists</span>
          </label>

          <label className="radio-label">
            <input 
              type="radio" 
              name="tab" 
              checked={toggleState === 2} 
              onChange={() => toggleTab(2)} 
            />
            <span className="radio-text">Write My Own Prompt</span>
          </label>

          <label className="radio-label">
            <input 
              type="radio" 
              name="tab" 
              checked={toggleState === 3} 
              onChange={() => toggleTab(3)} 
            />
            <span className="radio-text">AI Write Prompt For Me</span>
          </label>
        </div>
          </> ) : (
            <h1>You have no credits remaining.</h1>
            )}
        
        <textarea
          className="prompt-input"
          placeholder={
            toggleState === 1 
              ? 'Textbox is disabled. Click "Generate Painting" to see... '
              : toggleState === 2 
                ? "Describe what you want to see... (e.g., A landscape in the style of Monet with vibrant colors and water lilies)"
                : "Upload a painting to generate a prompt..."
          }
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={10}
          disabled={toggleState === 1}
        />
        
        <button 
          className="generate-button"
          //onClick={generatePainting && decrementCredits}
          onClick={decrementCredits}
          disabled={isGenerating || (toggleState === 2 && !prompt)}
        >
          {isGenerating ? 'Generating...' : 'Generate Painting'}
        </button>
        <div>{remainingCredits} Credits Remaining</div>
      </div>
      
      <div className="painting-display">
        {isGenerating ? (
          <div className="loading-indicator">
            <p>Creating your painting...</p>
            <div className="spinner"></div>
          </div>
        ) : paintingUrl ? (
          <img 
            src={paintingUrl} 
            alt="AI generated painting" 
            className="generated-painting"
          />
        ) : (
          <div className="placeholder-display">
            <p>Your painting will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default PaintingRecommender;