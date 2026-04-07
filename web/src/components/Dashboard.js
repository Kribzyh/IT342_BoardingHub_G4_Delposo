import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RoleSidebar from './layout/RoleSidebar';

const Dashboard = () => {
  const user = JSON.parse(localStorage.getItem('user')) || {};
  const navigate = useNavigate();
  const normalizedRole = (user.role || '').toLowerCase();

  const menuItems = useMemo(() => {
    if (normalizedRole === 'landlord') {
      return [
        { key: 'records', label: 'Records' },
        { key: 'properties', label: 'Properties' },
        { key: 'tenants', label: 'Tenants' }
      ];
    }

    if (normalizedRole === 'tenant') {
      return [
        { key: 'rent', label: 'Rent' },
        { key: 'records', label: 'Records' }
      ];
    }

    return [{ key: 'records', label: 'Records' }];
  }, [normalizedRole]);

  const [activeItem, setActiveItem] = useState(menuItems[0].key);

  useEffect(() => {
    setActiveItem(menuItems[0].key);
  }, [menuItems]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Replace history entry to prevent back navigation
    navigate('/login', { replace: true });
  };

  return (
    <div className="dashboard-layout">
      <RoleSidebar
        role={normalizedRole}
        items={menuItems}
        activeItem={activeItem}
        onSelect={setActiveItem}
        onLogout={handleLogout}
      />

      <main className="dashboard-content">
        <h1>Welcome, {user.fullName || 'User'}!</h1>
        <p>Your role: {user.role || 'Not assigned'}</p>
        <div className="dashboard-card">
          <h2>{menuItems.find((item) => item.key === activeItem)?.label}</h2>
          <p>
            This is your {activeItem} section. You can now add page content for
            this menu option.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;