// Footer
import React, { useState } from 'react';
import '../styles/footer.css';
import { FaGithub} from 'react-icons/fa';

function Footer(){
    return (
        <div className="footer">
            <a href="https://github.com/teomesrkhani/full-stack-painting-recommender-platform" className="github"><FaGithub/></a>
        </div>
    );
}

export default Footer;