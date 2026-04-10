import { useEffect } from 'react';
import './Copyright.css';

const Copyright = () => {

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/health`);
        const data = await response.json();
        console.log('Health API response:', data);
      } catch (error) {
        console.error('Health API error:', error);
      }
    };

    checkHealth();
  }, []);

  return (
    <div className='copyright-text'>
      Developer - Aman Sharma
    </div>
  );
};

export default Copyright;