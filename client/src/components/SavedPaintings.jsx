import React, { useState, useEffect } from 'react';
import { FaTrash } from 'react-icons/fa';
import '../styles/saved_paintings.css';
import '../styles/home.css';

// Components
import Footer from '../components/Footer';
import Title from '../components/Title';


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
    async function getRecords() {
      const response = await fetch('http://localhost:5050/record/');
      if (!response.ok) {
        const message = 'An error occurred:' + response.statusText;
        window.alert(message);
        return;
      }
      const data = await response.json();
      setRecords(data);
    }
    getRecords();
  }, []);

  async function deleteRecord(id) {
    await fetch(`http://localhost:5050/record/${id}`, {
      method: 'DELETE'
    });
    const newRecords = records.filter((el) => el._id !== id);
    setRecords(newRecords);
  }

  function recordList() {
    return records.map((record) => (
      <PaintingProfile
        record={record}
        deleteRecord={deleteRecord}
        key={record._id}
      />
    ));
  }

  const hasRecords = recordList().length > 0;

  return (
    <div className="saved_paintings">
      {hasRecords ?
      <div className="container">{recordList()}</div>
      :
      <div className="error-text">No Liked Paintings to Show</div>
      }
    </div>
  );
}

export default SavedPaintings;