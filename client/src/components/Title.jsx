import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Title.css';

function Title({ currentPage }) {
    return (
        <div className="title-container">
            {currentPage === "recommend-painting" ? (
                <div className="title">
                <Link className="title" to="/"> 
                    Painting Recommender <div className="paint-brush">🎨</div>
                </Link>
            </div>
            ) : (
                <div className="title">
                <Link className="title" to="/"> 
                    Saved Paintings
                </Link>
            </div>
            )}
            <nav className="navbar">
                <Link className="nav-link" to="/">Home</Link>
                <Link className="nav-link" to="/saved">Saved Paintings</Link>
            </nav>
            
        </div>
    );
}

export default Title;
