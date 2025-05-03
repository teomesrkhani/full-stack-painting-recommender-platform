import '../styles/home.css';
import { Route, Routes, Router } from "react-router-dom";
import React, { useState } from 'react';

// Components
import Title from '../components/Title';
import Content from '../components/Content'

function Home() {
  return (
    <div className="recommend-painting">
      <Content/>
      <Title currentPage="recommend-painting"/>
    </div>
  );
}

export default Home;