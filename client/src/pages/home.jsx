import '../styles/home.css';
import { Route, Routes, Router } from "react-router-dom";
import React, { useState } from 'react';

// Components
import Title from '../components/Title';
import Footer from '../components/Footer';
import Content from '../components/Content'

function Home() {
  return (
    <div className="recommend-painting">
      <Title currentPage="recommend-painting"/>
      <Content/>
      <Footer />
    </div>
  );
}

export default Home;