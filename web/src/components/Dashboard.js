import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import RoleSidebar from './layout/RoleSidebar';

const Dashboard = () => {
  const user = JSON.parse(localStorage.getItem('user')) || {};
  const navigate = useNavigate();
  const location = useLocation();
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
  const [showActions, setShowActions] = useState(false);
  const [properties, setProperties] = useState(() => {
    const saved = localStorage.getItem('landlordProperties');
    return saved ? JSON.parse(saved) : [];
  });
  const [rooms, setRooms] = useState(() => {
    const saved = localStorage.getItem('landlordRooms');
    return saved ? JSON.parse(saved) : [];
  });
  const [propertyForm, setPropertyForm] = useState({
    name: '',
    address: ''
  });
  const [roomForm, setRoomForm] = useState({
    propertyId: '',
    roomNumber: '',
    monthlyRate: ''
  });
  const [editingPropertyId, setEditingPropertyId] = useState(null);
  const [openPropertyMenuId, setOpenPropertyMenuId] = useState(null);

  useEffect(() => {
    setActiveItem(menuItems[0].key);
  }, [menuItems]);

  useEffect(() => {
    localStorage.setItem('landlordProperties', JSON.stringify(properties));
  }, [properties]);

  useEffect(() => {
    localStorage.setItem('landlordRooms', JSON.stringify(rooms));
  }, [rooms]);

  useEffect(() => {
    if (
      location.pathname === '/dashboard/properties/new' ||
      location.pathname === '/dashboard/rooms/new'
    ) {
      setActiveItem('properties');
    }
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Replace history entry to prevent back navigation
    navigate('/login', { replace: true });
  };

  const handleMenuSelect = (itemKey) => {
    setActiveItem(itemKey);
    setShowActions(false);
    setOpenPropertyMenuId(null);
    setEditingPropertyId(null);
    if (location.pathname !== '/dashboard') {
      navigate('/dashboard');
    }
  };

  const handleAddPropertyClick = () => {
    setShowActions(false);
    navigate('/dashboard/properties/new');
  };

  const handleAddRoomClick = () => {
    if (!properties.length) {
      return;
    }
    setShowActions(false);
    navigate('/dashboard/rooms/new');
  };

  const handlePropertyFormChange = (event) => {
    const { name, value } = event.target;
    setPropertyForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePropertySubmit = (event) => {
    event.preventDefault();
    if (!propertyForm.name.trim() || !propertyForm.address.trim()) {
      return;
    }

    if (editingPropertyId) {
      setProperties((prev) =>
        prev.map((property) =>
          property.id === editingPropertyId
            ? {
                ...property,
                name: propertyForm.name.trim(),
                address: propertyForm.address.trim()
              }
            : property
        )
      );
      setEditingPropertyId(null);
    } else {
      const newProperty = {
        id: Date.now(),
        name: propertyForm.name.trim(),
        address: propertyForm.address.trim()
      };
      setProperties((prev) => [...prev, newProperty]);
    }

    setPropertyForm({ name: '', address: '' });
    navigate('/dashboard');
    setActiveItem('properties');
  };

  const handleRoomFormChange = (event) => {
    const { name, value } = event.target;
    setRoomForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleRoomSubmit = (event) => {
    event.preventDefault();
    if (!roomForm.propertyId || !roomForm.roomNumber.trim() || !roomForm.monthlyRate) {
      return;
    }

    const newRoom = {
      id: Date.now(),
      propertyId: Number(roomForm.propertyId),
      roomNumber: roomForm.roomNumber.trim(),
      monthlyRate: Number(roomForm.monthlyRate),
      status: 'Available'
    };

    setRooms((prev) => [...prev, newRoom]);
    setRoomForm({ propertyId: '', roomNumber: '', monthlyRate: '' });
    navigate('/dashboard');
    setActiveItem('properties');
  };

  const handleEditProperty = (property) => {
    setOpenPropertyMenuId(null);
    setEditingPropertyId(property.id);
    setPropertyForm({
      name: property.name,
      address: property.address
    });
    navigate('/dashboard/properties/new');
  };

  const isCreatePropertyPage = location.pathname === '/dashboard/properties/new';
  const isCreateRoomPage = location.pathname === '/dashboard/rooms/new';
  const isLandlordProperties =
    normalizedRole === 'landlord' &&
    activeItem === 'properties' &&
    !isCreatePropertyPage &&
    !isCreateRoomPage;

  return (
    <div className="dashboard-layout">
      <RoleSidebar
        role={normalizedRole}
        items={menuItems}
        activeItem={activeItem}
        onSelect={handleMenuSelect}
        onLogout={handleLogout}
      />

      <main className="dashboard-content">
        {isCreatePropertyPage ? (
          <section className="dashboard-card property-form-card">
            <h2>{editingPropertyId ? 'Edit Property' : 'Add Property'}</h2>
            <form onSubmit={handlePropertySubmit} className="property-form">
              <label htmlFor="name">Property Name</label>
              <input
                id="name"
                name="name"
                value={propertyForm.name}
                onChange={handlePropertyFormChange}
                required
              />

              <label htmlFor="address">Address</label>
              <input
                id="address"
                name="address"
                value={propertyForm.address}
                onChange={handlePropertyFormChange}
                required
              />

              <div className="form-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => {
                    setPropertyForm({ name: '', address: '' });
                    setEditingPropertyId(null);
                    navigate('/dashboard');
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-btn">
                  {editingPropertyId ? 'Update Property' : 'Save Property'}
                </button>
              </div>
            </form>
          </section>
        ) : isCreateRoomPage ? (
          <section className="dashboard-card property-form-card">
            <h2>Add Room</h2>
            {!properties.length ? (
              <p>Please add a property first before creating a room.</p>
            ) : null}
            <form onSubmit={handleRoomSubmit} className="property-form">
              <label htmlFor="propertyId">Select Property</label>
              <select
                id="propertyId"
                name="propertyId"
                value={roomForm.propertyId}
                onChange={handleRoomFormChange}
                required
                disabled={!properties.length}
              >
                <option value="">Choose property</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>

              <label htmlFor="roomNumber">Room Number</label>
              <input
                id="roomNumber"
                name="roomNumber"
                value={roomForm.roomNumber}
                onChange={handleRoomFormChange}
                required
                disabled={!properties.length}
              />

              <label htmlFor="monthlyRate">Monthly Rate</label>
              <input
                id="monthlyRate"
                name="monthlyRate"
                type="number"
                min="1"
                value={roomForm.monthlyRate}
                onChange={handleRoomFormChange}
                required
                disabled={!properties.length}
              />

              <label htmlFor="roomStatus">Status</label>
              <input id="roomStatus" value="Available" readOnly />

              <div className="form-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => navigate('/dashboard')}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-btn" disabled={!properties.length}>
                  Save Room
                </button>
              </div>
            </form>
          </section>
        ) : (
          <>
            <h1>Welcome, {user.fullName || 'User'}!</h1>
            <p>Your role: {user.role || 'Not assigned'}</p>
            <div className="dashboard-card">
              <h2>{menuItems.find((item) => item.key === activeItem)?.label}</h2>
              {isLandlordProperties ? (
                properties.length ? (
                  <div className="properties-grid">
                    {properties.map((property) => (
                      <article key={property.id} className="property-item">
                        <div className="property-menu-wrap">
                          <button
                            type="button"
                            className="property-kebab-btn"
                            onClick={() =>
                              setOpenPropertyMenuId((prev) =>
                                prev === property.id ? null : property.id
                              )
                            }
                            aria-label="Property actions"
                          >
                            ...
                          </button>
                          {openPropertyMenuId === property.id && (
                            <div className="property-kebab-menu">
                              <button
                                type="button"
                                onClick={() => handleEditProperty(property)}
                              >
                                Edit Property
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="property-thumb">{property.name}</div>
                        <p className="property-address">{property.address}</p>
                        <p className="property-meta">
                          Rooms: {rooms.filter((room) => room.propertyId === property.id).length}
                        </p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p>No properties yet. Use the + button to add your first property.</p>
                )
              ) : (
                <p>
                  This is your {activeItem} section. You can now add page content
                  for this menu option.
                </p>
              )}
            </div>
          </>
        )}

        {isLandlordProperties && (
          <div className="fab-wrapper">
            {showActions && (
              <div className="fab-menu">
                <button type="button" className="fab-option" onClick={handleAddPropertyClick}>
                  Add Property
                </button>
                <button
                  type="button"
                  className="fab-option"
                  onClick={handleAddRoomClick}
                  disabled={!properties.length}
                >
                  Add Room
                </button>
              </div>
            )}
            <button
              type="button"
              className="fab-main"
              onClick={() => setShowActions((prev) => !prev)}
              aria-label="Open create menu"
            >
              +
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;