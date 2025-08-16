import { useState, useEffect } from 'react';
import { FaTrash } from 'react-icons/fa';
import '../styles/saved_paintings.css';
import '../styles/home.css';
import { 
  getAllLikedPaintingsFromLocalStorage, 
  removeLikedPaintingFromLocalStorage 
} from '../utils/db';

const PaintingProfile = (props) => (
  <div className="profiles">
    <div className="profile-image-container">
      {props.record.originalUrl ? (
        <a 
          href={props.record.originalUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ cursor: 'pointer' }}
        >
          <img className="imgs" src={props.record.imageUrl || props.record.url} alt={props.record.title} />
        </a>
      ) : (
        <img className="imgs" src={props.record.imageUrl || props.record.url} alt={props.record.title} />
      )}
    </div>
    <div className="profile-content">
      <div className="profile-text">
        <h2>{props.record.title}</h2>
        <p>By {props.record.artist}</p>
      </div>
      <button className="btn" onClick={() => props.deleteRecord(props.record.id)}>
        <FaTrash />
      </button>
    </div>
  </div>
);

function SavedPaintings() {
  const [records, setRecords] = useState([]);

  useEffect(() => {
    function getRecordsFromLocalStorage() {
      try {
        const data = getAllLikedPaintingsFromLocalStorage();
        setRecords(data);
      } catch (error) {
        console.error("Error fetching liked paintings from LocalStorage:", error);
      }
    }
    getRecordsFromLocalStorage();
  }, []);

  function deleteRecordFromLocalStorage(id) {
    try {
      const success = removeLikedPaintingFromLocalStorage(id);
      if (success) {
        setRecords(prevRecords => prevRecords.filter((el) => el.id !== id));
      } else {
        console.warn("Painting to delete not found, ID:", id);
      }
    } catch (error) {
      console.error("Error deleting painting from LocalStorage:", error);
    }
  }


  return (
    <div className="saved_paintings">
      <div className="container">
        {records.map((record) => (
          <PaintingProfile
            record={record}
            deleteRecord={deleteRecordFromLocalStorage}
            key={record.id}
          />
        ))}
      </div>
    </div>
  );

}

export default SavedPaintings;