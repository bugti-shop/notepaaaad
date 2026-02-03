import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// TodoSettings now redirects to the unified Settings page
const TodoSettings = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Redirect to the main Settings page
    navigate('/settings', { replace: true });
  }, [navigate]);
  
  return null;
};

export default TodoSettings;
