import '../styles/home.css';
import { Route, Routes, Router } from "react-router-dom";
import React, { useState } from 'react';

// Components
import PaintingGenerator from '../components/Paintings';
import Title from '../components/Title';
import Footer from '../components/Footer';


function Home() {
  return (
    <div className="home">
      <Title currentPage="home"/>
      <PaintingGenerator/>
      <Footer />
    </div>
  );
}

export default Home;