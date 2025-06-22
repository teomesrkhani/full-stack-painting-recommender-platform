import { useState, useEffect } from 'react';
import { FaTrash } from 'react-icons/fa';
import '../styles/saved_paintings.css';
import '../styles/home.css';
import { getAllLikedPaintings, removeLikedPaintingById } from '../utils/db';

const PaintingProfile = (props) => (
  <div className="profiles">
    <div className="profile-image-container">
      <img className="imgs" src={props.record.url} alt={props.record.title} />
    </div>
    <div className="profile-content">
      <div className="profile-text">
        <h2>{props.record.title}</h2>
        <p>By {props.record.artist}</p>
      </div>
      <button className="btn" onClick={() => props.deleteRecord(props.record._id)}>
        <FaTrash />
      </button>
    </div>
  </div>
);

function SavedPaintings() {
  const [records, setRecords] = useState([]);

  useEffect(() => {
    async function getRecordsFromDB() {
      try {
        const data = await getAllLikedPaintings();
        setRecords(data);
      } catch (error) {
        console.error("Error fetching liked paintings:", error);
      }
    }
    getRecordsFromDB();
  }, []);

  async function deleteRecordFromDB(id) {
    try {
      const success = await removeLikedPaintingById(id);
      if (success) {
        setRecords(prevRecords => prevRecords.filter((el) => el._id !== id));
      } else {
        console.warn("Painting to delete not found, ID:", id);
      }
    } catch (error) {
      console.error("Error deleting painting:", error);
    }
  }


  return (
    <div className="saved_paintings">
      <div className="container">
        {records.map((record) => (
          <PaintingProfile
            record={record}
            deleteRecord={deleteRecordFromDB}
            key={record._id}
          />
        ))}
      </div>
    </div>
  );

}

export default SavedPaintings;