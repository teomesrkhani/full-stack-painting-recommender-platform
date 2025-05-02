import React, { useState, useEffect } from 'react';
import PaintingGenerator from './Paintings';
import PaintingRecommender from './GenAI';
import SavedPaintings from './SavedPaintings';
import { Link } from 'react-router-dom';
import '../styles/content.css';

function Content() {
  const [toggleState, setToggleState] = useState(1);
  const [hasRecords, setHasRecords] = useState(false);


async function checkHasRecords(){
  const response = await fetch("http://localhost:5050/record");
  const likes = await response.json();
  setHasRecords(likes.length > 0);
}

const toggleTab = async (tab) => {
  if (tab === 2 || tab === 3) {
    await checkHasRecords();
  }
  console.log('hasRecords', hasRecords);
  console.log('toggleState', toggleState);
  setToggleState(tab);
  console.log('toggleState', toggleState);
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
        <button 
          className={toggleState === 3 ? "tab active-tab" : "tab"}
          onClick={() => toggleTab(3)}
        >
          Liked Paintings
        </button>
      </div>

      <div className="content-container">
        {toggleState === 1 && <PaintingGenerator />}
        {toggleState === 2 && (
          hasRecords
          ? <PaintingRecommender />
          : <div className="error-text">Please like a painting first to use this feature.</div>
        )}
        {toggleState === 3 && (
          hasRecords
            ? <SavedPaintings />
            : <div className="error-text">No Liked Paintings to Show</div>
        )}
      </div>
    </div>
  );
}

export default Content;
