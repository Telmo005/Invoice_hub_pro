'use client';

import { useState } from 'react';
import Navbar from '@/app/components/sections/Navbar';
import TemplateSlider from '@/app/components/templates/TemplateSlider/TemplateSlider';

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  return (
    <div className="bg-gray-50 min-vh-100">
      <Navbar
        isLoggedIn={isLoggedIn}
        onLoginToggle={() => setIsLoggedIn(!isLoggedIn)}
      />
      
        <TemplateSlider />    
    </div>
  );
}