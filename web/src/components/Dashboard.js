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
  const [selectedPropertyId, setSelectedPropertyId] = useState(null);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [isEditingRooms, setIsEditingRooms] = useState(false);
  const [editingPropertyId, setEditingPropertyId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState({
    open: false,
    type: '',
    id: null
  });
  const [tenantAssignments, setTenantAssignments] = useState(() => {
    const saved = localStorage.getItem('tenantAssignments');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedTenantKey, setSelectedTenantKey] = useState(null);
  const [enrollCode, setEnrollCode] = useState('');
  const [enrollMessage, setEnrollMessage] = useState('');
  const [showEnrollForm, setShowEnrollForm] = useState(false);

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
    localStorage.setItem('tenantAssignments', JSON.stringify(tenantAssignments));
  }, [tenantAssignments]);

  useEffect(() => {
    if (
      location.pathname === '/dashboard/properties/new' ||
      location.pathname === '/dashboard/rooms/new'
    ) {
      setActiveItem('properties');
    }
  }, [location.pathname]);

  useEffect(() => {
    setSelectedRoomId(null);
    setSelectedTenantKey(null);
  }, [selectedPropertyId]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Replace history entry to prevent back navigation
    navigate('/login', { replace: true });
  };

  const handleMenuSelect = (itemKey) => {
    setActiveItem(itemKey);
    setShowActions(false);
    setEditingPropertyId(null);
    setSelectedPropertyId(null);
    setSelectedRoomId(null);
    setSelectedTenantKey(null);
    setIsEditingRooms(false);
    setConfirmDelete({ open: false, type: '', id: null });
    setEnrollCode('');
    setEnrollMessage('');
    setShowEnrollForm(false);
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

  const handleRoomDetailChange = (roomId, field, value) => {
    setRooms((prev) =>
      prev.map((room) =>
        room.id === roomId
          ? {
              ...room,
              [field]: field === 'monthlyRate' ? Number(value) : value
            }
          : room
      )
    );
  };

  const handleDeleteProperty = (propertyId) => {
    setProperties((prev) => prev.filter((property) => property.id !== propertyId));
    setRooms((prev) => prev.filter((room) => room.propertyId !== propertyId));
    setTenantAssignments((prev) =>
      prev.filter((assignment) => assignment.propertyId !== propertyId)
    );
    setSelectedPropertyId(null);
    setSelectedRoomId(null);
    setSelectedTenantKey(null);
    setIsEditingRooms(false);
    setConfirmDelete({ open: false, type: '', id: null });
  };

  const handleDeleteRoom = (roomId) => {
    setRooms((prev) => {
      const nextRooms = prev.filter((room) => room.id !== roomId);
      const nextInProperty = nextRooms.filter(
        (room) => room.propertyId === selectedPropertyId
      );
      setSelectedRoomId(nextInProperty.length ? nextInProperty[0].id : null);
      return nextRooms;
    });
    setTenantAssignments((prev) => prev.filter((assignment) => assignment.roomId !== roomId));
    setSelectedTenantKey(null);
    setIsEditingRooms(false);
    setConfirmDelete({ open: false, type: '', id: null });
  };

  const generateEnrollmentCode = () => {
    return `${Math.floor(100000000 + Math.random() * 900000000)}`;
  };

  const handleGenerateRoomCode = () => {
    if (!selectedRoom || selectedRoom.status !== 'Available') {
      return;
    }
    const code = generateEnrollmentCode();
    const expiresAt = Date.now() + 5 * 60 * 1000;
    setRooms((prev) =>
      prev.map((room) =>
        room.id === selectedRoom.id
          ? { ...room, enrollmentCode: code, enrollmentExpiresAt: expiresAt }
          : room
      )
    );
  };

  const handleTenantEnroll = (event) => {
    event.preventDefault();
    if (!/^\d{9}$/.test(enrollCode)) {
      setEnrollMessage('Code must be exactly 9 digits.');
      return;
    }

    const now = Date.now();
    const targetRoom = rooms.find(
      (room) =>
        room.enrollmentCode === enrollCode &&
        room.enrollmentExpiresAt &&
        room.enrollmentExpiresAt > now &&
        room.status === 'Available'
    );

    if (!targetRoom) {
      setEnrollMessage('Invalid or expired code.');
      return;
    }

    const tenantKey = user.email || user.id || user.fullName || `tenant-${Date.now()}`;
    const tenantName = user.fullName || user.email || 'Tenant';

    setRooms((prev) =>
      prev.map((room) =>
        room.id === targetRoom.id
          ? {
              ...room,
              status: 'Occupied',
              tenantKey,
              tenantName,
              enrollmentCode: null,
              enrollmentExpiresAt: null
            }
          : room
      )
    );

    setTenantAssignments((prev) => {
      const filtered = prev.filter((assignment) => assignment.tenantKey !== tenantKey);
      return [
        ...filtered,
        {
          tenantKey,
          tenantName,
          propertyId: targetRoom.propertyId,
          roomId: targetRoom.id,
          monthlyRate: targetRoom.monthlyRate,
          enrolledAt: new Date().toISOString()
        }
      ];
    });

    setEnrollCode('');
    setEnrollMessage('Enrolled successfully.');
    setShowEnrollForm(false);
  };

  const handleEditPropertyDetails = () => {
    if (!selectedProperty) {
      return;
    }
    setEditingPropertyId(selectedProperty.id);
    setPropertyForm({
      name: selectedProperty.name,
      address: selectedProperty.address
    });
    navigate('/dashboard/properties/new');
  };

  const openDeleteModal = (type, id) => {
    setConfirmDelete({ open: true, type, id });
  };

  const closeDeleteModal = () => {
    setConfirmDelete({ open: false, type: '', id: null });
  };

  const handleConfirmDelete = () => {
    if (confirmDelete.type === 'property' && confirmDelete.id) {
      handleDeleteProperty(confirmDelete.id);
      return;
    }

    if (confirmDelete.type === 'room' && confirmDelete.id) {
      handleDeleteRoom(confirmDelete.id);
    }
  };

  const isCreatePropertyPage = location.pathname === '/dashboard/properties/new';
  const isCreateRoomPage = location.pathname === '/dashboard/rooms/new';
  const isLandlordProperties =
    normalizedRole === 'landlord' &&
    activeItem === 'properties' &&
    !isCreatePropertyPage &&
    !isCreateRoomPage;
  const isTenantRent = normalizedRole === 'tenant' && activeItem === 'rent';
  const selectedProperty = properties.find(
    (property) => property.id === selectedPropertyId
  );
  const propertyRooms = rooms.filter((room) => room.propertyId === selectedPropertyId);
  const selectedRoom = propertyRooms.find((room) => room.id === selectedRoomId);
  const selectedRoomTenant = tenantAssignments.find(
    (assignment) =>
      assignment.propertyId === selectedPropertyId && assignment.roomId === selectedRoomId
  );
  const selectedTenantDetail = tenantAssignments.find(
    (assignment) => assignment.tenantKey === selectedTenantKey
  );
  const tenantKey = user.email || user.id || user.fullName;
  const tenantEnrollment = tenantAssignments.find(
    (assignment) => assignment.tenantKey === tenantKey
  );
  const tenantProperty = properties.find(
    (property) => property.id === tenantEnrollment?.propertyId
  );
  const tenantRoom = rooms.find((room) => room.id === tenantEnrollment?.roomId);

  useEffect(() => {
    if (propertyRooms.length && !selectedRoomId) {
      setSelectedRoomId(propertyRooms[0].id);
    }
  }, [propertyRooms, selectedRoomId]);

  useEffect(() => {
    if (selectedRoomTenant) {
      setSelectedTenantKey(selectedRoomTenant.tenantKey);
    } else {
      setSelectedTenantKey(null);
    }
  }, [selectedRoomTenant]);

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
                selectedProperty ? (
                  <section className="property-details-view">
                    <div className="property-column property-column-left">
                      <h3>{selectedProperty.name}</h3>
                      <p className="property-address">{selectedProperty.address}</p>

                      <div className="property-rooms-list">
                        <h4>Rooms</h4>
                        {propertyRooms.length ? (
                          propertyRooms.map((room) => (
                            <button
                              key={room.id}
                              type="button"
                              className={`room-list-item ${
                                selectedRoomId === room.id ? 'active' : ''
                              }`}
                              onClick={() => setSelectedRoomId(room.id)}
                            >
                              <span>Room {room.roomNumber}</span>
                              <span>{room.status}</span>
                            </button>
                          ))
                        ) : (
                          <p>No rooms yet for this property.</p>
                        )}
                      </div>

                      <div className="property-detail-actions">
                        <button
                          type="button"
                          className="primary-btn"
                          onClick={handleEditPropertyDetails}
                        >
                          Edit Property Details
                        </button>
                        <button
                          type="button"
                          className="danger-btn"
                          onClick={() =>
                            openDeleteModal('property', selectedProperty.id)
                          }
                        >
                          Delete Property
                        </button>
                      </div>
                    </div>

                    <div className="property-column property-column-middle">
                      <h4>Room Details</h4>
                      {selectedRoom ? (
                        <div className="room-item room-detail-pane">
                          <label>
                            Room Number
                            <input
                              value={selectedRoom.roomNumber}
                              onChange={(event) =>
                                handleRoomDetailChange(
                                  selectedRoom.id,
                                  'roomNumber',
                                  event.target.value
                                )
                              }
                              readOnly={!isEditingRooms}
                            />
                          </label>
                          <label>
                            Monthly Rate
                            <input
                              type="number"
                              min="1"
                              value={selectedRoom.monthlyRate}
                              onChange={(event) =>
                                handleRoomDetailChange(
                                  selectedRoom.id,
                                  'monthlyRate',
                                  event.target.value
                                )
                              }
                              readOnly={!isEditingRooms}
                            />
                          </label>
                          <label>
                            Status
                            <input value={selectedRoom.status} readOnly />
                          </label>
                          {selectedRoom.status === 'Available' ? (
                            <div className="room-code-box">
                              <button
                                type="button"
                                className="secondary-btn"
                                onClick={handleGenerateRoomCode}
                              >
                                Generate 9-digit Code
                              </button>
                              {selectedRoom.enrollmentCode ? (
                                <p>
                                  Code: <strong>{selectedRoom.enrollmentCode}</strong> (expires in
                                  5 minutes)
                                </p>
                              ) : null}
                            </div>
                          ) : null}

                          {selectedRoomTenant ? (
                            <div className="tenant-thumb-list">
                              <h5>Tenant</h5>
                              <button
                                type="button"
                                className={`tenant-thumb ${
                                  selectedTenantKey === selectedRoomTenant.tenantKey
                                    ? 'active'
                                    : ''
                                }`}
                                onClick={() => setSelectedTenantKey(selectedRoomTenant.tenantKey)}
                              >
                                {selectedRoomTenant.tenantName}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <p>Select a room to view details.</p>
                      )}

                      <div className="property-detail-actions">
                        <button
                          type="button"
                          className="primary-btn"
                          onClick={() => setIsEditingRooms((prev) => !prev)}
                          disabled={!selectedRoom}
                        >
                          {isEditingRooms ? 'Save Room Details' : 'Edit Room Details'}
                        </button>
                        <button
                          type="button"
                          className="danger-btn"
                          onClick={() => openDeleteModal('room', selectedRoom.id)}
                          disabled={!selectedRoom}
                        >
                          Delete Room
                        </button>
                      </div>
                    </div>

                    <div className="property-column property-column-right">
                      <h4>Tenant Details</h4>
                      {selectedTenantDetail ? (
                        <div className="tenant-detail-card">
                          <p>
                            <strong>Tenant:</strong> {selectedTenantDetail.tenantName}
                          </p>
                          <p>
                            <strong>Property:</strong> {selectedProperty?.name || '-'}
                          </p>
                          <p>
                            <strong>Room:</strong> {selectedRoom?.roomNumber || '-'}
                          </p>
                          <p>
                            <strong>Monthly Rate:</strong>{' '}
                            {selectedTenantDetail.monthlyRate}
                          </p>
                          <p>
                            <strong>Enrolled Date:</strong>{' '}
                            {new Date(selectedTenantDetail.enrolledAt).toLocaleString()}
                          </p>
                        </div>
                      ) : (
                        <p>No tenant selected.</p>
                      )}
                    </div>
                  </section>
                ) : properties.length ? (
                  <div className="properties-grid">
                    {properties.map((property) => (
                      <article
                        key={property.id}
                        className="property-item"
                        onClick={() => {
                          setSelectedPropertyId(property.id);
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            setSelectedPropertyId(property.id);
                          }
                        }}
                      >
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
                <>
                  {isTenantRent ? (
                    tenantEnrollment && tenantProperty && tenantRoom ? (
                      <div className="tenant-rent-view">
                        <div className="tenant-rent-column">
                          <h3>Boarding House Details</h3>
                          <p>
                            <strong>Property:</strong> {tenantProperty.name}
                          </p>
                          <p>
                            <strong>Address:</strong> {tenantProperty.address}
                          </p>
                          <p>
                            <strong>Room:</strong> {tenantRoom.roomNumber}
                          </p>
                          <p>
                            <strong>Monthly Rate:</strong> {tenantEnrollment.monthlyRate}
                          </p>
                          <p>
                            <strong>Enrolled Date:</strong>{' '}
                            {new Date(tenantEnrollment.enrolledAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="tenant-rent-column tenant-rent-column-blank" />
                      </div>
                    ) : (
                      <div className="tenant-enroll-form">
                        {!showEnrollForm ? (
                          <button
                            type="button"
                            className="primary-btn"
                            onClick={() => {
                              setShowEnrollForm(true);
                              setEnrollMessage('');
                            }}
                          >
                            Enroll
                          </button>
                        ) : (
                          <form onSubmit={handleTenantEnroll}>
                            <h3>Enroll to a Room</h3>
                            <label htmlFor="enrollCode">
                              Enter 9-digit code
                              <input
                                id="enrollCode"
                                value={enrollCode}
                                onChange={(event) => setEnrollCode(event.target.value)}
                                placeholder="#########"
                                maxLength={9}
                                required
                              />
                            </label>
                            <div className="form-actions">
                              <button
                                type="button"
                                className="secondary-btn"
                                onClick={() => {
                                  setShowEnrollForm(false);
                                  setEnrollCode('');
                                  setEnrollMessage('');
                                }}
                              >
                                Cancel
                              </button>
                              <button type="submit" className="primary-btn">
                                Submit Code
                              </button>
                            </div>
                          </form>
                        )}
                        {enrollMessage ? <p>{enrollMessage}</p> : null}
                      </div>
                    )
                  ) : (
                    <p>
                      This is your {activeItem} section. You can now add page
                      content for this menu option.
                    </p>
                  )}
                </>
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

        {confirmDelete.open && (
          <div className="confirm-modal-backdrop">
            <div className="confirm-modal">
              <h3>Confirm Deletion</h3>
              <p>
                {confirmDelete.type === 'property'
                  ? 'Are you sure you want to delete this property and all associated rooms?'
                  : 'Are you sure you want to delete this room?'}
              </p>
              <div className="confirm-modal-actions">
                <button type="button" className="secondary-btn" onClick={closeDeleteModal}>
                  Cancel
                </button>
                <button type="button" className="danger-btn" onClick={handleConfirmDelete}>
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;