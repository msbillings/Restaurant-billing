import React from 'react';

const Navbar = () => {
  return (
    <nav className="landing-navbar">
      <div className="landing-container">
        <div className="navbar-logo">MS Billings</div>
        <ul className="navbar-links">
          <li><a href="#home">Home</a></li>
          <li><a href="#experience">Experience</a></li>
          <li><a href="#food">Food</a></li>
          <li><a href="#features">Features</a></li>
          <li><a href="#gallery">Gallery</a></li>
          <li><a href="#ms-billings">MS Billings</a></li>
          <li><a href="#contact">Contact</a></li>
        </ul>
        <div className="navbar-actions">
          <a href="/login" className="btn-login">Login</a>
          <button className="btn-primary">Get Started</button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
