import React, { useState } from 'react';
import PaintingGenerator from './Paintings';
import PaintingRecommender from './GenAI';
import '../styles/content.css';

function Content() {
  const [toggleState, setToggleState] = useState(1);
  const toggleTab = (index) => {
    setToggleState(index);
  };

  return (
    <div className="art-app">
      <div className="tab-container">
        <button 
          className={toggleState === 1 ? "tab active-tab" : "tab"}
          onClick={() => toggleTab(1)}
        >
          Painting Recommender
        </button>
        <button 
          className={toggleState === 2 ? "tab active-tab" : "tab"}
          onClick={() => toggleTab(2)}
        >
          Painting Generator
        </button>
      </div>

      <div className="content-container">
        {toggleState === 1 && <PaintingGenerator />}
        {toggleState === 2 && <PaintingRecommender />}
      </div>
    </div>
  );
}

export default Content;
