import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import RoleSidebar from './layout/RoleSidebar';
import {
  createProperty,
  createRoom,
  deleteProperty,
  deleteRoom,
  enrollTenant,
  generateRoomCode,
  getLandlordProperties,
  getLandlordTenants,
  getTenantCurrentRent,
  getTenantRent,
  createPaymongoCheckout,
  completePaymongoPayment,
  getTenantPaymentRecords,
  getLandlordPaymentRecords,
  updateProperty,
  updateRoom
} from '../services/dashboard';

const Dashboard = () => {
  const user = JSON.parse(localStorage.getItem('user')) || {};
  const navigate = useNavigate();
  const location = useLocation();
  const normalizedRole = (user.role || '').toLowerCase();
  const menuItems = useMemo(
    () =>
      normalizedRole === 'landlord'
        ? [{ key: 'records', label: 'Records' }, { key: 'properties', label: 'Properties' }, { key: 'tenants', label: 'Tenants' }]
        : normalizedRole === 'tenant'
          ? [{ key: 'rent', label: 'Rent' }, { key: 'records', label: 'Records' }]
          : [{ key: 'records', label: 'Records' }],
    [normalizedRole]
  );

  const [activeItem, setActiveItem] = useState(menuItems[0].key);
  const [properties, setProperties] = useState([]);
  const [showActions, setShowActions] = useState(false);
  const [propertyForm, setPropertyForm] = useState({ name: '', address: '' });
  const [roomForm, setRoomForm] = useState({ propertyId: '', roomNumber: '', monthlyRate: '' });
  const [editingPropertyId, setEditingPropertyId] = useState(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState(null);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [isEditingRooms, setIsEditingRooms] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState({ open: false, type: '', id: null });
  const [tenantRent, setTenantRent] = useState(null);
  const [showEnrollForm, setShowEnrollForm] = useState(false);
  const [enrollCode, setEnrollCode] = useState('');
  const [enrollMessage, setEnrollMessage] = useState('');
  const [tenantFilterPropertyId, setTenantFilterPropertyId] = useState('');
  const [landlordTenants, setLandlordTenants] = useState([]);
  const [selectedTenantKey, setSelectedTenantKey] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentRecords, setPaymentRecords] = useState([]);
  const [paymentSyncMessage, setPaymentSyncMessage] = useState('');
  const [paymentChoiceOpen, setPaymentChoiceOpen] = useState(false);
  const [cashPaymentNotice, setCashPaymentNotice] = useState('');

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);
  const propertyRooms = selectedProperty?.rooms || [];
  const selectedRoom = propertyRooms.find((r) => r.id === selectedRoomId);
  const filteredLandlordTenants = landlordTenants;
  const selectedTenant = filteredLandlordTenants.find(
    (tenant) =>
      `${tenant.tenantId}-${tenant.propertyId}-${tenant.roomNumber}` ===
      selectedTenantKey
  );

  const refreshLandlord = async () => setProperties(await getLandlordProperties());

  const currentBillingMonthLabel = (d = new Date()) =>
    d.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  /** Calendar days from today through the last day of the month (matches backend ChronoUnit.DAYS). */
  const daysUntilEndOfBillingMonth = (d = new Date()) => {
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return Math.max(0, lastDay - d.getDate());
  };

  const formatRentStatus = (s) => {
    if (!s) return '-';
    const labels = {
      PENDING: 'Pending',
      PAID: 'Paid',
      OVERDUE: 'Overdue',
      UPCOMING: 'Upcoming',
      DUE: 'Due'
    };
    return labels[s] || s;
  };

  const rentPaidForCurrentMonth = tenantRent?.currentInvoiceStatus === 'PAID';

  /** Merges GET /dashboard/tenant/current-rent with rent details; falls back to monthlyRate if the call fails. */
  const fetchOptionalInvoiceFields = async (rent) => {
    const fallback = {
      currentInvoiceAmount: rent?.monthlyRate ?? null,
      currentInvoiceStatus: 'PENDING',
      currentBillingMonth: currentBillingMonthLabel(),
      currentRemainingDaysInBillingMonth: daysUntilEndOfBillingMonth()
    };
    try {
      const currentInvoice = await getTenantCurrentRent();
      const amount =
        currentInvoice.amount != null && currentInvoice.amount !== ''
          ? currentInvoice.amount
          : rent?.monthlyRate;
      const remaining =
        currentInvoice.remainingDaysInBillingMonth != null
          ? currentInvoice.remainingDaysInBillingMonth
          : daysUntilEndOfBillingMonth();
      return {
        currentInvoiceAmount: amount != null ? amount : fallback.currentInvoiceAmount,
        currentInvoiceStatus: currentInvoice.status || fallback.currentInvoiceStatus,
        currentBillingMonth: currentInvoice.billingMonth || fallback.currentBillingMonth,
        currentRemainingDaysInBillingMonth: remaining
      };
    } catch {
      return fallback;
    }
  };

  const refreshTenant = async () => {
    try {
      const rent = await getTenantRent();
      setTenantRent({ ...rent, ...(await fetchOptionalInvoiceFields(rent)) });
    } catch {
      setTenantRent(null);
    }
  };
  const refreshLandlordTenants = async (propertyId) => {
    setLandlordTenants(await getLandlordTenants(propertyId));
  };

  useEffect(() => {
    if (location.pathname === '/dashboard/properties/new' || location.pathname === '/dashboard/rooms/new') setActiveItem('properties');
  }, [location.pathname]);
  useEffect(() => {
    if (normalizedRole === 'landlord') refreshLandlord();
  }, [normalizedRole]);
  useEffect(() => {
    if (normalizedRole === 'tenant' && activeItem === 'rent') refreshTenant();
  }, [activeItem, normalizedRole]);
  useEffect(() => {
    if (normalizedRole === 'landlord' && activeItem === 'tenants') {
      refreshLandlordTenants(tenantFilterPropertyId ? Number(tenantFilterPropertyId) : undefined);
    }
  }, [normalizedRole, activeItem, tenantFilterPropertyId]);
  useEffect(() => {
    if (!filteredLandlordTenants.length) {
      setSelectedTenantKey('');
      return;
    }
    const exists = filteredLandlordTenants.some(
      (tenant) =>
        `${tenant.tenantId}-${tenant.propertyId}-${tenant.roomNumber}` ===
        selectedTenantKey
    );
    if (!exists) {
      const first = filteredLandlordTenants[0];
      setSelectedTenantKey(
        `${first.tenantId}-${first.propertyId}-${first.roomNumber}`
      );
    }
  }, [filteredLandlordTenants, selectedTenantKey]);
  useEffect(() => {
    if (!selectedRoomId && propertyRooms.length) setSelectedRoomId(propertyRooms[0].id);
  }, [propertyRooms, selectedRoomId]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('payment') !== 'complete') return;
    const pi = params.get('payment_intent_id');
    if (!pi) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await completePaymongoPayment(pi);
        if (!cancelled) {
          setPaymentSyncMessage(res.message || 'Payment saved to your records.');
          if (normalizedRole === 'tenant') await refreshTenant();
        }
      } catch (error) {
        const msg = error.response?.data?.message || error.message;
        if (!cancelled) setPaymentSyncMessage(typeof msg === 'string' ? msg : 'Could not confirm payment.');
      } finally {
        if (!cancelled) {
          navigate('/dashboard', { replace: true });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [location.search, navigate, normalizedRole]);

  useEffect(() => {
    if (activeItem !== 'records') return;
    let cancelled = false;
    (async () => {
      try {
        if (normalizedRole === 'tenant') {
          setPaymentRecords(await getTenantPaymentRecords());
        } else if (normalizedRole === 'landlord') {
          setPaymentRecords(await getLandlordPaymentRecords());
        } else {
          setPaymentRecords([]);
        }
      } catch {
        if (!cancelled) setPaymentRecords([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeItem, normalizedRole]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };
  const handleMenuSelect = (key) => {
    setActiveItem(key);
    setPaymentSyncMessage('');
    setPaymentChoiceOpen(false);
    setCashPaymentNotice('');
    setShowActions(false);
    setSelectedPropertyId(null);
    setSelectedRoomId(null);
    setEditingPropertyId(null);
    setIsEditingRooms(false);
    setShowEnrollForm(false);
    setEnrollCode('');
    setEnrollMessage('');
    setTenantFilterPropertyId('');
    setSelectedTenantKey('');
    if (location.pathname !== '/dashboard') navigate('/dashboard');
  };

  const handlePropertySubmit = async (e) => {
    e.preventDefault();
    if (editingPropertyId) await updateProperty(editingPropertyId, propertyForm);
    else await createProperty(propertyForm);
    await refreshLandlord();
    setEditingPropertyId(null);
    setPropertyForm({ name: '', address: '' });
    navigate('/dashboard');
  };
  const handleRoomSubmit = async (e) => {
    e.preventDefault();
    await createRoom({ propertyId: Number(roomForm.propertyId), roomNumber: roomForm.roomNumber, monthlyRate: Number(roomForm.monthlyRate) });
    await refreshLandlord();
    setRoomForm({ propertyId: '', roomNumber: '', monthlyRate: '' });
    navigate('/dashboard');
  };
  const handleSaveRoomDetails = async () => {
    if (!selectedRoom) return;
    await updateRoom(selectedRoom.id, { roomNumber: selectedRoom.roomNumber, monthlyRate: Number(selectedRoom.monthlyRate) });
    await refreshLandlord();
    setIsEditingRooms(false);
  };
  const handleRoomField = (field, value) =>
    setProperties((prev) => prev.map((p) => ({ ...p, rooms: (p.rooms || []).map((r) => (r.id === selectedRoomId ? { ...r, [field]: field === 'monthlyRate' ? Number(value) : value } : r)) })));
  const handleGenerateCode = async () => {
    if (!selectedRoom) return;
    await generateRoomCode(selectedRoom.id);
    await refreshLandlord();
  };
  const handleEnroll = async (e) => {
    e.preventDefault();
    try {
      const rent = await enrollTenant(enrollCode);
      setEnrollMessage('Enrolled successfully.');
      setShowEnrollForm(false);
      setEnrollCode('');
      setTenantRent({ ...rent, ...(await fetchOptionalInvoiceFields(rent)) });
    } catch (error) {
      setEnrollMessage(error.response?.data?.message || 'Invalid or expired code.');
    }
  };
  const openPaymentChoice = () => {
    if (tenantRent?.currentInvoiceStatus === 'PAID') return;
    setPaymentError('');
    setCashPaymentNotice('');
    setPaymentChoiceOpen(true);
  };

  const runOnlineCheckout = async () => {
    if (tenantRent?.currentInvoiceStatus === 'PAID') return;
    setPaymentChoiceOpen(false);
    setPaymentError('');
    setPaymentLoading(true);
    try {
      const origin = window.location.origin;
      const { redirectUrl } = await createPaymongoCheckout({
        paymentMethod: 'gcash',
        returnUrl: `${origin}/dashboard?payment=complete`
      });
      if (redirectUrl) window.location.assign(redirectUrl);
      else setPaymentError('No redirect URL returned from PayMongo.');
    } catch (error) {
      const msg = error.response?.data?.message || error.response?.data?.error || error.message;
      setPaymentError(typeof msg === 'string' ? msg : 'Payment could not be started.');
    } finally {
      setPaymentLoading(false);
    }
  };

  const selectCashPayment = () => {
    setPaymentChoiceOpen(false);
    setCashPaymentNotice(
      'Cash payment: pay your landlord in person. This app only tracks online (GCash/Maya) payments automatically.'
    );
  };

  const handleConfirmDelete = async () => {
    if (confirmDelete.type === 'property') {
      await deleteProperty(confirmDelete.id);
      setSelectedPropertyId(null);
    }
    if (confirmDelete.type === 'room') {
      await deleteRoom(confirmDelete.id);
      setSelectedRoomId(null);
    }
    await refreshLandlord();
    setConfirmDelete({ open: false, type: '', id: null });
  };

  const isCreatePropertyPage = location.pathname === '/dashboard/properties/new';
  const isCreateRoomPage = location.pathname === '/dashboard/rooms/new';
  const isLandlordProperties = normalizedRole === 'landlord' && activeItem === 'properties' && !isCreatePropertyPage && !isCreateRoomPage;
  const isLandlordTenants = normalizedRole === 'landlord' && activeItem === 'tenants';
  const isTenantRent = normalizedRole === 'tenant' && activeItem === 'rent';
  const isRecords = activeItem === 'records' && (normalizedRole === 'tenant' || normalizedRole === 'landlord');

  const formatRecordedAt = (v) => {
    if (v == null) return '-';
    if (Array.isArray(v)) {
      const [y, mo, d, h = 0, mi = 0, s = 0] = v;
      const dt = new Date(y, mo - 1, d, h, mi, s);
      return Number.isNaN(dt.getTime()) ? String(v) : dt.toLocaleString();
    }
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
  };

  const formatMoney = (n) => {
    if (n == null || n === '') return '-';
    const x = Number(n);
    return Number.isNaN(x) ? String(n) : `₱${x.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="dashboard-layout">
      <RoleSidebar role={normalizedRole} items={menuItems} activeItem={activeItem} onSelect={handleMenuSelect} onLogout={handleLogout} />
      <main className="dashboard-content">
        {isCreatePropertyPage ? (
          <section className="dashboard-card property-form-card">
            <h2>{editingPropertyId ? 'Edit Property' : 'Add Property'}</h2>
            <form className="property-form" onSubmit={handlePropertySubmit}>
              <label htmlFor="name">Property Name</label>
              <input id="name" value={propertyForm.name} onChange={(e) => setPropertyForm({ ...propertyForm, name: e.target.value })} required />
              <label htmlFor="address">Address</label>
              <input id="address" value={propertyForm.address} onChange={(e) => setPropertyForm({ ...propertyForm, address: e.target.value })} required />
              <div className="form-actions"><button type="button" className="secondary-btn" onClick={() => navigate('/dashboard')}>Cancel</button><button type="submit" className="primary-btn">{editingPropertyId ? 'Update Property' : 'Save Property'}</button></div>
            </form>
          </section>
        ) : isCreateRoomPage ? (
          <section className="dashboard-card property-form-card">
            <h2>Add Room</h2>
            <form className="property-form" onSubmit={handleRoomSubmit}>
              <label htmlFor="propertyId">Select Property</label>
              <select id="propertyId" value={roomForm.propertyId} onChange={(e) => setRoomForm({ ...roomForm, propertyId: e.target.value })} required>
                <option value="">Choose property</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <label htmlFor="roomNumber">Room Number</label>
              <input id="roomNumber" value={roomForm.roomNumber} onChange={(e) => setRoomForm({ ...roomForm, roomNumber: e.target.value })} required />
              <label htmlFor="monthlyRate">Monthly Rate</label>
              <input id="monthlyRate" type="number" min="1" value={roomForm.monthlyRate} onChange={(e) => setRoomForm({ ...roomForm, monthlyRate: e.target.value })} required />
              <label htmlFor="roomStatus">Status</label><input id="roomStatus" value="AVAILABLE" readOnly />
              <div className="form-actions"><button type="button" className="secondary-btn" onClick={() => navigate('/dashboard')}>Cancel</button><button type="submit" className="primary-btn">Save Room</button></div>
            </form>
          </section>
        ) : (
          <div className="dashboard-card">
            <h2>{menuItems.find((item) => item.key === activeItem)?.label}</h2>
            {paymentSyncMessage ? (
              <p className="payment-sync-notice" role="status">{paymentSyncMessage}</p>
            ) : null}
            {isRecords ? (
              <div className="payment-records-section">
                {paymentRecords.length ? (
                  <table className="payment-records-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        {normalizedRole === 'landlord' ? <th>Tenant</th> : <th>Landlord</th>}
                        <th>Property</th>
                        <th>Room</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Status</th>
                        <th>PayMongo ref.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentRecords.map((row) => (
                        <tr key={row.id}>
                          <td>{formatRecordedAt(row.recordedAt)}</td>
                          <td>{normalizedRole === 'landlord' ? row.tenantName : row.landlordName}</td>
                          <td>{row.propertyName}</td>
                          <td>{row.roomNumber}</td>
                          <td>{formatMoney(row.amountPesos)} {row.currency || 'PHP'}</td>
                          <td>{row.paymentMethodType || '-'}</td>
                          <td>{row.paymongoStatus || '-'}</td>
                          <td className="payment-ref-cell"><code>{row.paymongoPaymentIntentId}</code></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p>No payment records yet.</p>
                )}
              </div>
            ) : isLandlordProperties ? (
              selectedProperty ? (
                <section className="property-details-view">
                  <div className="property-column property-column-left">
                    <button type="button" className="secondary-btn" onClick={() => { setSelectedPropertyId(null); setSelectedRoomId(null); }}>Back to Properties</button>
                    <h3>{selectedProperty.name}</h3><p className="property-address">{selectedProperty.address}</p>
                    <div className="property-rooms-list">{propertyRooms.map((room) => <button key={room.id} type="button" className={`room-list-item ${selectedRoomId === room.id ? 'active' : ''}`} onClick={() => setSelectedRoomId(room.id)}><span>Room {room.roomNumber}</span><span>{room.status}</span></button>)}</div>
                    <div className="property-detail-actions">
                      <button type="button" className="primary-btn" onClick={() => { setEditingPropertyId(selectedProperty.id); setPropertyForm({ name: selectedProperty.name, address: selectedProperty.address }); navigate('/dashboard/properties/new'); }}>Edit Property Details</button>
                      <button type="button" className="danger-btn" onClick={() => setConfirmDelete({ open: true, type: 'property', id: selectedProperty.id })}>Delete Property</button>
                    </div>
                  </div>
                  <div className="property-column property-column-middle">
                    <h4>Room Details</h4>
                    {selectedRoom ? (
                      <>
                        <div className="room-item">
                          <label>Room Number<input value={selectedRoom.roomNumber} onChange={(e) => handleRoomField('roomNumber', e.target.value)} readOnly={!isEditingRooms} /></label>
                          <label>Monthly Rate<input type="number" value={selectedRoom.monthlyRate} onChange={(e) => handleRoomField('monthlyRate', e.target.value)} readOnly={!isEditingRooms} /></label>
                          <label>Status<input value={selectedRoom.status} readOnly /></label>
                        </div>
                        {selectedRoom.status === 'AVAILABLE' ? <div className="room-code-box"><button type="button" className="secondary-btn" onClick={handleGenerateCode}>Generate 9-digit Code</button>{selectedRoom.enrollmentCode ? <p>Code: <strong>{selectedRoom.enrollmentCode}</strong> (expires in 5 minutes)</p> : null}</div> : null}
                        {selectedRoom.tenant ? <div className="tenant-thumb-list"><h5>Tenant</h5><button type="button" className="tenant-thumb active">{selectedRoom.tenant.fullName}</button></div> : null}
                      </>
                    ) : <p>Select a room to view details.</p>}
                    <div className="property-detail-actions">
                      <button type="button" className="primary-btn" onClick={() => (isEditingRooms ? handleSaveRoomDetails() : setIsEditingRooms(true))}>{isEditingRooms ? 'Save Room Details' : 'Edit Room Details'}</button>
                      <button type="button" className="danger-btn" onClick={() => setConfirmDelete({ open: true, type: 'room', id: selectedRoom.id })} disabled={!selectedRoom}>Delete Room</button>
                    </div>
                  </div>
                  <div className="property-column property-column-right">
                    <h4>Tenant Details</h4>
                    {selectedRoom?.tenant ? <div className="tenant-detail-card"><p><strong>Property:</strong> {selectedProperty.name}</p><p><strong>Room:</strong> {selectedRoom.roomNumber}</p><p><strong>Monthly Rate:</strong> {selectedRoom.monthlyRate}</p><p><strong>Enrolled Date:</strong> {selectedRoom.tenant.enrolledAt ? new Date(selectedRoom.tenant.enrolledAt).toLocaleString() : '-'}</p></div> : <p>No tenant selected.</p>}
                  </div>
                </section>
              ) : (
                <div className="properties-grid">
                  {properties.map((property) => <article key={property.id} className="property-item" onClick={() => setSelectedPropertyId(property.id)} role="button" tabIndex={0}><div className="property-thumb">{property.name}</div><p className="property-address">{property.address}</p><p className="property-meta">Rooms: {(property.rooms || []).length}</p></article>)}
                </div>
              )
            ) : isLandlordTenants ? (
              <div>
                <div className="form-actions" style={{ justifyContent: 'flex-start', marginBottom: '12px' }}>
                  <label htmlFor="tenantPropertyFilter">Filter by property:&nbsp;</label>
                  <select
                    id="tenantPropertyFilter"
                    value={tenantFilterPropertyId}
                    onChange={(e) => setTenantFilterPropertyId(e.target.value)}
                  >
                    <option value="">All properties</option>
                    {properties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.name}
                      </option>
                    ))}
                  </select>
                </div>
                {filteredLandlordTenants.length ? (
                  <div className="tenant-tab-layout">
                    <div className="tenant-list-column">
                      {filteredLandlordTenants.map((tenant) => {
                        const key = `${tenant.tenantId}-${tenant.propertyId}-${tenant.roomNumber}`;
                        return (
                          <button
                            key={key}
                            type="button"
                            className={`tenant-list-item ${
                              selectedTenantKey === key ? 'active' : ''
                            }`}
                            onClick={() => setSelectedTenantKey(key)}
                          >
                            <div className="tenant-list-name">{tenant.tenantName}</div>
                            <div className="tenant-list-meta">{tenant.propertyName}</div>
                            <div className="tenant-list-meta">Room {tenant.roomNumber}</div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="tenant-detail-column">
                      {selectedTenant ? (
                        <div className="tenant-detail-card">
                          <p><strong>Name:</strong> {selectedTenant.tenantName}</p>
                          <p><strong>Email:</strong> {selectedTenant.tenantEmail}</p>
                          <p><strong>Property:</strong> {selectedTenant.propertyName}</p>
                          <p><strong>Room:</strong> {selectedTenant.roomNumber}</p>
                          <p><strong>Monthly Rate:</strong> {selectedTenant.monthlyRate}</p>
                          <p>
                            <strong>Enrolled Date:</strong>{' '}
                            {selectedTenant.enrolledAt
                              ? new Date(selectedTenant.enrolledAt).toLocaleString()
                              : '-'}
                          </p>
                        </div>
                      ) : (
                        <p>Select a tenant to view details.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p>No tenants found for the selected filter.</p>
                )}
              </div>
            ) : isTenantRent ? (
              tenantRent ? (
                <div className="tenant-rent-view">
                  <div className="tenant-rent-column">
                    <h3>Boarding House Details</h3>
                    <p><strong>Property:</strong> {tenantRent.propertyName}</p>
                    <p><strong>Address:</strong> {tenantRent.propertyAddress}</p>
                    <p><strong>Room:</strong> {tenantRent.roomNumber}</p>
                    <p><strong>Monthly Rate:</strong> {tenantRent.monthlyRate}</p>
                    <p><strong>Enrolled Date:</strong> {tenantRent.enrolledAt ? new Date(tenantRent.enrolledAt).toLocaleString() : '-'}</p>
                  </div>
                  <div className="tenant-rent-column">
                    <h3>This Month&apos;s Payment</h3>
                    <p><strong>Billing Month:</strong> {tenantRent.currentBillingMonth || '-'}</p>
                    <p><strong>Status:</strong> {formatRentStatus(tenantRent.currentInvoiceStatus)}</p>
                    <p><strong>Days left in billing month:</strong> {tenantRent.currentRemainingDaysInBillingMonth ?? '-'}</p>
                    <p><strong>Amount:</strong> {tenantRent.currentInvoiceAmount ?? '-'}</p>
                    {paymentError ? <p className="payment-error" role="alert">{paymentError}</p> : null}
                    {cashPaymentNotice ? (
                      <p className="cash-payment-notice" role="status">
                        {cashPaymentNotice}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={openPaymentChoice}
                      disabled={paymentLoading || rentPaidForCurrentMonth}
                    >
                      {paymentLoading ? 'Redirecting…' : rentPaidForCurrentMonth ? 'Paid for this month' : 'Pay Now'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="tenant-enroll-form">
                  {!showEnrollForm ? <button type="button" className="primary-btn" onClick={() => setShowEnrollForm(true)}>Enroll</button> : <form onSubmit={handleEnroll}><h3>Enroll to a Room</h3><label htmlFor="enrollCode">Enter 9-digit code<input id="enrollCode" value={enrollCode} onChange={(e) => setEnrollCode(e.target.value)} maxLength={9} placeholder="#########" required /></label><div className="form-actions"><button type="button" className="secondary-btn" onClick={() => setShowEnrollForm(false)}>Cancel</button><button type="submit" className="primary-btn">Submit Code</button></div></form>}
                  {enrollMessage ? <p>{enrollMessage}</p> : null}
                </div>
              )
            ) : <p>This section is not available.</p>}
          </div>
        )}

        {isLandlordProperties ? <div className="fab-wrapper">{showActions ? <div className="fab-menu"><button type="button" className="fab-option" onClick={() => navigate('/dashboard/properties/new')}>Add Property</button><button type="button" className="fab-option" onClick={() => navigate('/dashboard/rooms/new')} disabled={!properties.length}>Add Room</button></div> : null}<button type="button" className="fab-main" onClick={() => setShowActions((prev) => !prev)} aria-label="Open create menu">+</button></div> : null}

        {confirmDelete.open ? <div className="confirm-modal-backdrop"><div className="confirm-modal"><h3>Confirm Deletion</h3><p>{confirmDelete.type === 'property' ? 'Are you sure you want to delete this property and all associated rooms?' : 'Are you sure you want to delete this room?'}</p><div className="confirm-modal-actions"><button type="button" className="secondary-btn" onClick={() => setConfirmDelete({ open: false, type: '', id: null })}>Cancel</button><button type="button" className="danger-btn" onClick={handleConfirmDelete}>Yes, Delete</button></div></div></div> : null}

        {paymentChoiceOpen ? (
          <div className="confirm-modal-backdrop">
            <div className="confirm-modal payment-choice-modal" role="dialog" aria-labelledby="payment-choice-title">
              <h3 id="payment-choice-title">Payment method</h3>
              <p className="payment-choice-hint">
                Amount is your room&apos;s monthly rate from the server. PayMongo uses centavos (rate × 100), e.g. ₱
                {tenantRent?.monthlyRate != null ? Number(tenantRent.monthlyRate).toLocaleString('en-PH') : '—'} →{' '}
                {tenantRent?.monthlyRate != null
                  ? `${(Math.round(Number(tenantRent.monthlyRate) * 100)).toLocaleString('en-PH')} centavos`
                  : '—'}
                .
              </p>
              <div className="payment-choice-actions">
                <button type="button" className="primary-btn" onClick={runOnlineCheckout} disabled={paymentLoading}>
                  Online (GCash / Maya)
                </button>
                <button type="button" className="secondary-btn" onClick={selectCashPayment}>
                  Cash
                </button>
                <button type="button" className="secondary-btn" onClick={() => setPaymentChoiceOpen(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
};

export default Dashboard;