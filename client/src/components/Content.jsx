import { useState } from 'react';
import PaintingGenerator from './Paintings';
import GenAIPaintingGenerator from './GenAI';
import SavedPaintings from './SavedPaintings';
import '../styles/content.css';
import { hasLikedRecords } from '../utils/db';

const TabNavigation = ({ activeTab, onTabChange }) => (
  <div className="tab-container" role="tablist">
    <button
      role="tab"
      aria-selected={activeTab === 1}
      aria-controls="painting-recommender"
      className={activeTab === 1 ? "tab active-tab" : "tab"}
      onClick={() => onTabChange(1)}
    >
      Painting Recommender
    </button>
    <button
      role="tab"
      aria-selected={activeTab === 2}
      aria-controls="painting-generator"
      className={activeTab === 2 ? "tab active-tab" : "tab"}
      onClick={() => onTabChange(2)}
    >
      Painting Generator (Gen AI)
    </button>
    <button
      role="tab"
      aria-selected={activeTab === 3}
      aria-controls="liked-paintings"
      className={activeTab === 3 ? "tab active-tab" : "tab"}
      onClick={() => onTabChange(3)}
    >
      Liked Paintings
    </button>
  </div>
);

const TabContent = ({ activeTab, hasRecords }) => {
  switch (activeTab) {
    case 1:
      return <PaintingGenerator />;
    case 2:
      return hasRecords ? (
        <GenAIPaintingGenerator />
      ) : (
        <div className="error-text" role="alert">
          Please like a painting first to use this feature
        </div>
      );
    case 3:
      return hasRecords ? (
        <SavedPaintings />
      ) : (
        <div className="error-text" role="alert">
          No Liked Paintings to Show
        </div>
      );
  }
};

function Content() {
  const [toggleState, setToggleState] = useState(1);
  const [hasRecords, setHasRecords] = useState(false);
  const [error, setError] = useState(null);

  const checkHasRecords = async () => {
    setError(null);
    try {
      const recordsExist = await hasLikedRecords();
      setHasRecords(recordsExist);
    } catch (error) {
      console.error("Error checking for records:", error);
      setError("Failed to load records. Please try again.");
      setHasRecords(false);
    }
  };

  const handleTabChange = async (tab) => {
    if (tab === 2 || tab === 3) {
      await checkHasRecords();
    }
    setToggleState(tab);
  };

  return (
    <div className="art-app">
      <TabNavigation activeTab={toggleState} onTabChange={handleTabChange} />
      <div className="content-container" role="tabpanel">
        {error && <div className="error-text" role="alert">{error}</div>}
        <TabContent
          activeTab={toggleState}
          hasRecords={hasRecords}
        />
      </div>
    </div>
  );
}

export default Content;
