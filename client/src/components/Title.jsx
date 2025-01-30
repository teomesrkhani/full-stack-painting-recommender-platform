import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Title.css';
import { FaPaintBrush } from 'react-icons/fa';

function Title({ currentPage }) {
    return (
        <div className="title-container">
            {currentPage === "home" ? (
                <div className="title">
                <Link className="title" to="/"> 
                    Painting Recommender <FaPaintBrush className="paint-brush" />
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
