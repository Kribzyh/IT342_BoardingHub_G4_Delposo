import React from 'react';
import './RoleSidebar.css';

const roleTitleMap = {
  landlord: 'Landlord',
  tenant: 'Tenant'
};

const RoleSidebar = ({ role, items, activeItem, onSelect, onLogout }) => {
  return (
    <aside className="role-sidebar">
      <div className="role-sidebar-logo">
        <h2>BoardingHub</h2>
        <p>{roleTitleMap[role] || 'User'} Panel</p>
      </div>

      <nav className="role-sidebar-nav">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`role-sidebar-link ${
              activeItem === item.key ? 'active' : ''
            }`}
            onClick={() => onSelect(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <button type="button" className="role-sidebar-logout" onClick={onLogout}>
        Logout
      </button>
    </aside>
  );
};

export default RoleSidebar;
