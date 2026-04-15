import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import RoleSidebar from './layout/RoleSidebar';
import api from '../services/api';
import {
  createProperty,
  createRoom,
  deleteProperty,
  deleteRoom,
  enrollTenant,
  generateRoomCode,
  getLandlordProperties,
  getLandlordTenants,
  getLandlordTenantCurrentRent,
  getTenantCurrentRent,
  getTenantRent,
  createPaymongoCheckout,
  completePaymongoPayment,
  getTenantPaymentRecords,
  getLandlordPaymentRecords,
  getTenantCashStatus,
  submitCashPaymentRequest,
  getLandlordCashRequests,
  getLandlordCashRequestDetail,
  acceptLandlordCashRequest,
  rejectLandlordCashRequest,
  getCashRequestPhotoBlob,
  updateProperty,
  updateRoom
} from '../services/dashboard';

const LANDLORD_SELECTION_KEY = 'boardinghub_landlord_selection';

/** Parse Spring/Jackson LocalDateTime (ISO string or array). */
function parseServerDateTime(v) {
  if (v == null) return null;
  if (Array.isArray(v)) {
    const [y, mo, d, h = 0, mi = 0, s = 0] = v;
    const dt = new Date(y, mo - 1, d, h, mi, s);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isEnrollmentCodeActive(room) {
  if (!room?.enrollmentCode) return false;
  const exp = parseServerDateTime(room.enrollmentExpiresAt);
  if (!exp) return false;
  return exp.getTime() > Date.now();
}

/** _refreshTick forces re-computation while a code is active (1s interval). */
function formatEnrollmentTimeRemaining(expiresAt, _refreshTick = 0) {
  void _refreshTick;
  const exp = parseServerDateTime(expiresAt);
  if (!exp) return '';
  const ms = exp.getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m >= 1) return `${m}m ${rs}s`;
  return `${rs}s`;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const PAYMENT_COMPLETE_INITIAL_DELAY_MS = 2000;
const PAYMENT_COMPLETE_RETRY_DELAY_MS = 3000;
const PAYMENT_COMPLETE_MAX_ATTEMPTS = 6;

/** Infrequent fallback poll if SSE is blocked or drops (primary updates come from /dashboard/stream). */
const DASHBOARD_FALLBACK_POLL_MS = 120000;

/** Transient cash-payment messages (submit success / already pending) auto-hide. */
const CASH_PAYMENT_NOTICE_DISMISS_MS = 6000;

function isRetryablePaymentCompleteError(error) {
  if (!error) return false;
  const msg = String(error.response?.data?.message || error.message || '');
  if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') return true;
  if (error.message === 'Network Error') return true;
  if (!error.response) return true;
  const st = error.response.status;
  if (st === 502 || st === 503 || st === 504) return true;
  if (st === 400 && (msg.includes('not successful yet') || msg.includes('Try again'))) return true;
  return false;
}

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
  /** True until first getTenantRent attempt finishes; avoids showing Enroll before we know enrollment status. */
  const [tenantRentLoading, setTenantRentLoading] = useState(
    () => normalizedRole === 'tenant'
  );
  const [showEnrollForm, setShowEnrollForm] = useState(false);
  const [enrollCode, setEnrollCode] = useState('');
  const [enrollMessage, setEnrollMessage] = useState('');
  const [tenantFilterPropertyId, setTenantFilterPropertyId] = useState('');
  const [landlordTenants, setLandlordTenants] = useState([]);
  const [selectedTenantKey, setSelectedTenantKey] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentConfirming, setPaymentConfirming] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentRecords, setPaymentRecords] = useState([]);
  const [paymentSyncMessage, setPaymentSyncMessage] = useState('');
  const [paymentChoiceOpen, setPaymentChoiceOpen] = useState(false);
  const [cashPaymentNotice, setCashPaymentNotice] = useState('');
  const [tenantCashPending, setTenantCashPending] = useState(false);
  const [cashFormOpen, setCashFormOpen] = useState(false);
  const [cashFormDescription, setCashFormDescription] = useState('');
  const [cashPhotoFile, setCashPhotoFile] = useState(null);
  const [cashFormSubmitting, setCashFormSubmitting] = useState(false);
  const [cashFormError, setCashFormError] = useState('');
  const [recordsSubTab, setRecordsSubTab] = useState('payments');
  const [landlordCashRequests, setLandlordCashRequests] = useState([]);
  const [cashReviewOpen, setCashReviewOpen] = useState(false);
  const [cashReviewDetail, setCashReviewDetail] = useState(null);
  const [cashReviewPhotoUrl, setCashReviewPhotoUrl] = useState('');
  const [cashReviewLoading, setCashReviewLoading] = useState(false);
  const [cashReviewActionLoading, setCashReviewActionLoading] = useState(false);
  const [generatingRoomCode, setGeneratingRoomCode] = useState(false);
  const [codeCountdownTick, setCodeCountdownTick] = useState(0);
  /** Landlord Properties → Room details: current-month payment status for selected room's tenant */
  const [selectedRoomPaymentStatus, setSelectedRoomPaymentStatus] = useState(null);
  const landlordHydratedRef = useRef(false);
  const tenantRentPrefetchRef = useRef(false);
  const runLiveRefreshRef = useRef(async () => {});
  const prevNormalizedRoleRef = useRef(normalizedRole);

  useEffect(() => {
    if (prevNormalizedRoleRef.current !== normalizedRole) {
      landlordHydratedRef.current = false;
      prevNormalizedRoleRef.current = normalizedRole;
    }
  }, [normalizedRole]);

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

  const refreshTenant = async (opts = {}) => {
    const silent = Boolean(opts.silent);
    if (!silent) setTenantRentLoading(true);
    try {
      const rent = await getTenantRent();
      setTenantRent({ ...rent, ...(await fetchOptionalInvoiceFields(rent)) });
    } catch {
      setTenantRent(null);
    } finally {
      if (!silent) setTenantRentLoading(false);
    }
  };
  const refreshLandlordTenants = async (propertyId) => {
    const list = await getLandlordTenants(propertyId);
    const enriched = await Promise.all(
      list.map(async (t) => {
        try {
          const current = await getLandlordTenantCurrentRent(t.tenantId);
          return {
            ...t,
            paymentStatus: current.status,
            billingMonth: current.billingMonth,
            remainingDaysInBillingMonth: current.remainingDaysInBillingMonth
          };
        } catch {
          return { ...t, paymentStatus: t.paymentStatus ?? null };
        }
      })
    );
    setLandlordTenants(enriched);
  };

  const refreshTenantRef = useRef(refreshTenant);
  refreshTenantRef.current = refreshTenant;
  const refreshLandlordTenantsRef = useRef(refreshLandlordTenants);
  refreshLandlordTenantsRef.current = refreshLandlordTenants;

  useEffect(() => {
    if (location.pathname === '/dashboard/properties/new' || location.pathname === '/dashboard/rooms/new') setActiveItem('properties');
  }, [location.pathname]);
  useEffect(() => {
    if (normalizedRole === 'landlord') refreshLandlord();
  }, [normalizedRole]);

  useLayoutEffect(() => {
    if (normalizedRole !== 'landlord' || !properties.length || landlordHydratedRef.current) return;
    landlordHydratedRef.current = true;
    try {
      const raw = sessionStorage.getItem(LANDLORD_SELECTION_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.activeItem) setActiveItem(data.activeItem);
      if (data.propertyId == null) return;
      const prop = properties.find((p) => p.id === data.propertyId);
      if (!prop) return;
      setSelectedPropertyId(data.propertyId);
      const rooms = prop.rooms || [];
      if (data.roomId != null && rooms.some((r) => r.id === data.roomId)) {
        setSelectedRoomId(data.roomId);
      } else if (rooms.length) {
        setSelectedRoomId(rooms[0].id);
      }
    } catch {
      /* ignore */
    }
  }, [normalizedRole, properties]);

  useEffect(() => {
    if (normalizedRole !== 'landlord' || !landlordHydratedRef.current) return;
    try {
      sessionStorage.setItem(
        LANDLORD_SELECTION_KEY,
        JSON.stringify({
          activeItem,
          propertyId: selectedPropertyId,
          roomId: selectedRoomId
        })
      );
    } catch {
      /* ignore */
    }
  }, [normalizedRole, activeItem, selectedPropertyId, selectedRoomId]);
  useEffect(() => {
    if (normalizedRole !== 'tenant') {
      tenantRentPrefetchRef.current = false;
      return;
    }
    const onRentTab = activeItem === 'rent';
    if (onRentTab || !tenantRentPrefetchRef.current) {
      if (!tenantRentPrefetchRef.current) tenantRentPrefetchRef.current = true;
      refreshTenant();
    }
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
    if (!selectedRoom?.enrollmentCode || !selectedRoom?.enrollmentExpiresAt) return;
    const id = setInterval(() => setCodeCountdownTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [selectedRoom?.enrollmentCode, selectedRoom?.enrollmentExpiresAt, selectedRoomId]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('payment') !== 'complete') return;
    const pi = params.get('payment_intent_id');
    if (!pi) return;
    setPaymentConfirming(true);
    let cancelled = false;
    (async () => {
      try {
        await sleep(PAYMENT_COMPLETE_INITIAL_DELAY_MS);
        if (cancelled) return;
        for (let attempt = 0; attempt < PAYMENT_COMPLETE_MAX_ATTEMPTS; attempt++) {
          if (cancelled) return;
          try {
            const res = await completePaymongoPayment(pi);
            if (!cancelled) {
              setPaymentSyncMessage(res.message || 'Payment saved to your records.');
              if (normalizedRole === 'tenant') {
                await refreshTenantRef.current({ silent: true });
                try {
                  const s = await getTenantCashStatus();
                  setTenantCashPending(Boolean(s.hasPendingRequest));
                } catch {
                  /* ignore */
                }
                try {
                  setPaymentRecords(await getTenantPaymentRecords());
                } catch {
                  /* ignore */
                }
              }
            }
            break;
          } catch (error) {
            const retry = isRetryablePaymentCompleteError(error) && attempt < PAYMENT_COMPLETE_MAX_ATTEMPTS - 1;
            if (retry) {
              await sleep(PAYMENT_COMPLETE_RETRY_DELAY_MS);
              continue;
            }
            const msg = error.response?.data?.message || error.message;
            if (!cancelled) {
              if (isRetryablePaymentCompleteError(error)) {
                setPaymentSyncMessage(
                  'Payment may still be finalizing. Check Rent or Records in a minute, or try again.'
                );
              } else {
                setPaymentSyncMessage(typeof msg === 'string' ? msg : 'Could not confirm payment.');
              }
            }
            break;
          }
        }
      } finally {
        if (!cancelled) {
          setPaymentConfirming(false);
          navigate('/dashboard', { replace: true });
        }
      }
    })();
    return () => {
      cancelled = true;
      setPaymentConfirming(false);
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

  useEffect(() => {
    if (normalizedRole !== 'tenant') {
      setTenantCashPending(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const s = await getTenantCashStatus();
        if (!cancelled) setTenantCashPending(Boolean(s.hasPendingRequest));
      } catch {
        if (!cancelled) setTenantCashPending(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeItem, normalizedRole]);

  useEffect(() => {
    if (normalizedRole !== 'landlord' || activeItem !== 'records') return;
    let cancelled = false;
    (async () => {
      try {
        const list = await getLandlordCashRequests();
        if (!cancelled) setLandlordCashRequests(list);
      } catch {
        if (!cancelled) setLandlordCashRequests([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [normalizedRole, activeItem]);

  useEffect(() => {
    if (!cashPaymentNotice) return undefined;
    const id = window.setTimeout(() => setCashPaymentNotice(''), CASH_PAYMENT_NOTICE_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [cashPaymentNotice]);

  useEffect(() => {
    const runLiveRefresh = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        if (normalizedRole === 'tenant') {
          if (activeItem === 'rent' || activeItem === 'records') {
            await refreshTenantRef.current({ silent: true });
            try {
              const s = await getTenantCashStatus();
              setTenantCashPending(Boolean(s.hasPendingRequest));
            } catch {
              /* ignore */
            }
            try {
              setPaymentRecords(await getTenantPaymentRecords());
            } catch {
              /* ignore */
            }
          }
        } else if (normalizedRole === 'landlord') {
          if (activeItem === 'records') {
            try {
              setPaymentRecords(await getLandlordPaymentRecords());
            } catch {
              /* ignore */
            }
            try {
              setLandlordCashRequests(await getLandlordCashRequests());
            } catch {
              /* ignore */
            }
          }
          if (activeItem === 'tenants') {
            await refreshLandlordTenantsRef.current(
              tenantFilterPropertyId ? Number(tenantFilterPropertyId) : undefined
            );
          }
          if (activeItem === 'properties' && selectedRoom?.tenant?.id) {
            try {
              const current = await getLandlordTenantCurrentRent(selectedRoom.tenant.id);
              setSelectedRoomPaymentStatus(current.status ?? null);
            } catch {
              setSelectedRoomPaymentStatus(null);
            }
          } else if (activeItem === 'properties') {
            setSelectedRoomPaymentStatus(null);
          }
        }
      } catch {
        /* ignore transient errors */
      }
    };

    runLiveRefreshRef.current = runLiveRefresh;

    const shouldPoll =
      (normalizedRole === 'tenant' && (activeItem === 'rent' || activeItem === 'records')) ||
      (normalizedRole === 'landlord' &&
        (activeItem === 'records' || activeItem === 'tenants' || activeItem === 'properties'));

    if (!shouldPoll) return undefined;

    runLiveRefresh();
    const intervalId = setInterval(runLiveRefresh, DASHBOARD_FALLBACK_POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        runLiveRefresh();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [
    normalizedRole,
    activeItem,
    tenantFilterPropertyId,
    selectedRoomId,
    selectedPropertyId,
    selectedRoom?.tenant?.id
  ]);

  useEffect(() => {
    if (normalizedRole !== 'tenant' && normalizedRole !== 'landlord') return undefined;
    const token = localStorage.getItem('token');
    if (!token) return undefined;
    const base = String(api.defaults.baseURL || '').replace(/\/$/, '');
    const url = `${base}/dashboard/stream?token=${encodeURIComponent(token)}`;
    let es;
    try {
      es = new EventSource(url);
    } catch {
      return undefined;
    }
    const onRefresh = () => {
      const fn = runLiveRefreshRef.current;
      if (typeof fn === 'function') fn();
    };
    es.addEventListener('refresh', onRefresh);
    return () => {
      es.removeEventListener('refresh', onRefresh);
      es.close();
    };
  }, [normalizedRole]);

  useEffect(() => {
    if (!cashReviewOpen || !cashReviewDetail?.hasPhoto) {
      setCashReviewPhotoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return '';
      });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const blob = await getCashRequestPhotoBlob(cashReviewDetail.id);
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setCashReviewPhotoUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch {
        if (!cancelled) {
          setCashReviewPhotoUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return '';
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cashReviewOpen, cashReviewDetail?.id, cashReviewDetail?.hasPhoto]);

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
    setCashFormOpen(false);
    setCashFormDescription('');
    setCashPhotoFile(null);
    setCashFormError('');
    setRecordsSubTab('payments');
    setCashReviewOpen(false);
    setCashReviewDetail(null);
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
    if (isEnrollmentCodeActive(selectedRoom)) return;
    setGeneratingRoomCode(true);
    try {
      await generateRoomCode(selectedRoom.id);
      await refreshLandlord();
    } finally {
      setGeneratingRoomCode(false);
    }
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
    setPaymentError('');
    setCashFormError('');
    if (tenantCashPending) {
      setCashPaymentNotice(
        'You already have a cash payment request waiting for your landlord to review. You can submit another one only after they accept or reject it.'
      );
      return;
    }
    setCashFormDescription('');
    setCashPhotoFile(null);
    setCashFormOpen(true);
  };

  const handleSubmitCashForm = async (e) => {
    e.preventDefault();
    setCashFormSubmitting(true);
    setCashFormError('');
    try {
      await submitCashPaymentRequest({ description: cashFormDescription, photo: cashPhotoFile });
      setCashFormOpen(false);
      setCashPaymentNotice('Cash payment request submitted. Your landlord will review it from their Records tab.');
      const s = await getTenantCashStatus();
      setTenantCashPending(Boolean(s.hasPendingRequest));
    } catch (error) {
      const msg = error.response?.data?.message || error.response?.data?.error || error.message;
      setCashFormError(typeof msg === 'string' ? msg : 'Could not submit cash request.');
    } finally {
      setCashFormSubmitting(false);
    }
  };

  const openLandlordCashReview = async (id) => {
    setCashReviewLoading(true);
    setCashReviewOpen(true);
    setCashReviewDetail(null);
    try {
      const detail = await getLandlordCashRequestDetail(id);
      setCashReviewDetail(detail);
    } catch {
      setCashReviewOpen(false);
      alert('Could not load this cash request.');
    } finally {
      setCashReviewLoading(false);
    }
  };

  const closeLandlordCashReview = () => {
    setCashReviewOpen(false);
    setCashReviewDetail(null);
  };

  const handleAcceptCashRequest = async () => {
    if (!cashReviewDetail) return;
    setCashReviewActionLoading(true);
    try {
      await acceptLandlordCashRequest(cashReviewDetail.id);
      setPaymentRecords(await getLandlordPaymentRecords());
      setLandlordCashRequests(await getLandlordCashRequests());
      closeLandlordCashReview();
    } catch (error) {
      const msg = error.response?.data?.message || error.message;
      alert(typeof msg === 'string' ? msg : 'Could not accept.');
    } finally {
      setCashReviewActionLoading(false);
    }
  };

  const handleRejectCashRequest = async () => {
    if (!cashReviewDetail) return;
    setCashReviewActionLoading(true);
    try {
      await rejectLandlordCashRequest(cashReviewDetail.id);
      setLandlordCashRequests(await getLandlordCashRequests());
      closeLandlordCashReview();
    } catch (error) {
      const msg = error.response?.data?.message || error.message;
      alert(typeof msg === 'string' ? msg : 'Could not reject.');
    } finally {
      setCashReviewActionLoading(false);
    }
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
                {normalizedRole === 'landlord' ? (
                  <div className="records-nested">
                    <div className="records-subtabs" role="tablist" aria-label="Records views">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={recordsSubTab === 'payments'}
                        aria-label="Payment records"
                        className={`records-subtab ${recordsSubTab === 'payments' ? 'active' : ''}`}
                        onClick={() => setRecordsSubTab('payments')}
                      >
                        Payments
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={recordsSubTab === 'cash'}
                        aria-label={`Payment requests, ${landlordCashRequests.length} pending`}
                        className={`records-subtab ${recordsSubTab === 'cash' ? 'active' : ''}`}
                        onClick={() => setRecordsSubTab('cash')}
                      >
                        Payment requests ({landlordCashRequests.length})
                      </button>
                    </div>
                    {recordsSubTab === 'payments' ? (
                      paymentRecords.length ? (
                        <table className="payment-records-table">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Tenant</th>
                              <th>Property</th>
                              <th>Room</th>
                              <th>Amount</th>
                              <th>Method</th>
                              <th>Status</th>
                              <th>Reference</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paymentRecords.map((row) => (
                              <tr key={row.id}>
                                <td>{formatRecordedAt(row.recordedAt)}</td>
                                <td>{row.tenantName}</td>
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
                      )
                    ) : landlordCashRequests.length ? (
                      <table className="payment-records-table cash-requests-table">
                        <thead>
                          <tr>
                            <th>Submitted</th>
                            <th>Tenant</th>
                            <th>Property</th>
                            <th>Room</th>
                            <th>Photo</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {landlordCashRequests.map((row) => (
                            <tr key={row.id}>
                              <td>{formatRecordedAt(row.submittedAt)}</td>
                              <td>{row.tenantName}</td>
                              <td>{row.propertyName}</td>
                              <td>{row.roomNumber}</td>
                              <td>{row.hasPhoto ? 'Yes' : '—'}</td>
                              <td>
                                <button type="button" className="linkish-btn" onClick={() => openLandlordCashReview(row.id)}>
                                  Review
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p>No pending cash payment requests.</p>
                    )}
                  </div>
                ) : paymentRecords.length ? (
                  <table className="payment-records-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Landlord</th>
                        <th>Property</th>
                        <th>Room</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Status</th>
                        <th>Reference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentRecords.map((row) => (
                        <tr key={row.id}>
                          <td>{formatRecordedAt(row.recordedAt)}</td>
                          <td>{row.landlordName}</td>
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
                        {selectedRoom.status === 'AVAILABLE' ? (
                          <div className="room-code-box">
                            <button
                              type="button"
                              className="secondary-btn"
                              onClick={handleGenerateCode}
                              disabled={
                                generatingRoomCode ||
                                isEnrollmentCodeActive(selectedRoom)
                              }
                            >
                              {generatingRoomCode
                                ? 'Generating…'
                                : isEnrollmentCodeActive(selectedRoom)
                                  ? 'Code active'
                                  : 'Generate 9-digit Code'}
                            </button>
                            {isEnrollmentCodeActive(selectedRoom) ? (
                              <p>
                                Code: <strong>{selectedRoom.enrollmentCode}</strong>
                                <span className="room-code-expiry">
                                  {' '}
                                  (time left:{' '}
                                  {formatEnrollmentTimeRemaining(
                                    selectedRoom.enrollmentExpiresAt,
                                    codeCountdownTick
                                  )}
                                  )
                                </span>
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                        {selectedRoom.tenant ? (
                          <div className="tenant-thumb-list">
                            <h5>Tenant</h5>
                            <button type="button" className="tenant-thumb tenant-thumb-inner active">
                              <span className="tenant-thumb-name">{selectedRoom.tenant.fullName}</span>
                              {selectedRoomPaymentStatus ? (
                                <span
                                  className={`tenant-list-payment tenant-list-payment--${(selectedRoomPaymentStatus || 'unknown').toLowerCase()}`}
                                >
                                  {formatRentStatus(selectedRoomPaymentStatus)}
                                </span>
                              ) : null}
                            </button>
                          </div>
                        ) : null}
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
                            <div
                              className={`tenant-list-payment tenant-list-payment--${(tenant.paymentStatus || 'unknown').toLowerCase()}`}
                            >
                              {formatRentStatus(tenant.paymentStatus)}
                            </div>
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
                          <p><strong>Payment status:</strong> {formatRentStatus(selectedTenant.paymentStatus)}</p>
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
              tenantRentLoading ? (
                <div className="tenant-rent-loading" role="status" aria-live="polite">
                  <p>Loading your rent details…</p>
                </div>
              ) : tenantRent ? (
                <div className="tenant-rent-view">
                  <div className="tenant-rent-column">
                    <h3>This Month&apos;s Payment</h3>
                    {tenantCashPending ? (
                      <p className="cash-pending-notice" role="status">
                        A cash payment request is waiting for your landlord to review. You cannot send another until they accept or reject it.
                      </p>
                    ) : null}
                    <p><strong>Next due:</strong> {tenantRent.currentBillingMonth || '-'}</p>
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
                      disabled={paymentLoading || paymentConfirming || rentPaidForCurrentMonth}
                      aria-busy={paymentConfirming || paymentLoading}
                    >
                      {paymentConfirming
                        ? 'Checking payment…'
                        : paymentLoading
                          ? 'Redirecting…'
                          : rentPaidForCurrentMonth
                            ? 'Paid for this month'
                            : 'Pay Now'}
                    </button>
                  </div>
                  <div className="tenant-rent-column">
                    <h3>Boarding House Details</h3>
                    <p><strong>Property:</strong> {tenantRent.propertyName}</p>
                    <p><strong>Address:</strong> {tenantRent.propertyAddress}</p>
                    <p><strong>Room:</strong> {tenantRent.roomNumber}</p>
                    <p><strong>Monthly Rate:</strong> {tenantRent.monthlyRate}</p>
                    <p><strong>Enrolled Date:</strong> {tenantRent.enrolledAt ? new Date(tenantRent.enrolledAt).toLocaleString() : '-'}</p>
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

        {cashFormOpen ? (
          <div className="confirm-modal-backdrop">
            <div className="confirm-modal cash-form-modal" role="dialog" aria-labelledby="cash-form-title">
              <h3 id="cash-form-title">Pay with cash</h3>
              <p className="cash-form-lead">
                Submit a request for your landlord to confirm. Optional note and proof photo.
              </p>
              <form className="cash-payment-form" onSubmit={handleSubmitCashForm}>
                <label htmlFor="cash-desc">Description (optional)</label>
                <textarea
                  id="cash-desc"
                  value={cashFormDescription}
                  onChange={(e) => setCashFormDescription(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="e.g. Paid in person on …"
                />
                <label htmlFor="cash-photo">Attach photo (optional)</label>
                <input
                  id="cash-photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => setCashPhotoFile(e.target.files?.[0] ?? null)}
                />
                {cashFormError ? (
                  <p className="payment-error" role="alert">
                    {cashFormError}
                  </p>
                ) : null}
                <div className="form-actions">
                  <button type="button" className="secondary-btn" disabled={cashFormSubmitting} onClick={() => setCashFormOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="primary-btn" disabled={cashFormSubmitting}>
                    {cashFormSubmitting ? 'Submitting…' : 'Submit request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {cashReviewOpen ? (
          <div className="confirm-modal-backdrop">
            <div className="confirm-modal cash-review-modal" role="dialog" aria-labelledby="cash-review-title">
              <h3 id="cash-review-title">Review cash payment</h3>
              {cashReviewLoading ? (
                <p>Loading…</p>
              ) : cashReviewDetail ? (
                <>
                  <div className="cash-review-body">
                    <p>
                      <strong>Tenant:</strong> {cashReviewDetail.tenantName}{' '}
                      <span className="cash-review-email">({cashReviewDetail.tenantEmail})</span>
                    </p>
                    <p>
                      <strong>Property / room:</strong> {cashReviewDetail.propertyName} — Room {cashReviewDetail.roomNumber}
                    </p>
                    <p>
                      <strong>Monthly rate:</strong> ₱{cashReviewDetail.monthlyRatePesos}
                    </p>
                    {cashReviewDetail.description ? (
                      <p>
                        <strong>Tenant note:</strong> {cashReviewDetail.description}
                      </p>
                    ) : (
                      <p className="cash-review-muted">No description provided.</p>
                    )}
                    {cashReviewDetail.hasPhoto ? (
                      cashReviewPhotoUrl ? (
                        <img src={cashReviewPhotoUrl} alt="Tenant payment proof" className="cash-review-photo" />
                      ) : (
                        <p className="cash-review-muted">Loading image…</p>
                      )
                    ) : (
                      <p className="cash-review-muted">No photo attached.</p>
                    )}
                  </div>
                  <div className="form-actions cash-review-actions">
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={handleAcceptCashRequest}
                      disabled={cashReviewActionLoading || cashReviewDetail.status !== 'PENDING'}
                    >
                      {cashReviewActionLoading ? 'Working…' : 'Accept'}
                    </button>
                    <button
                      type="button"
                      className="danger-btn"
                      onClick={handleRejectCashRequest}
                      disabled={cashReviewActionLoading || cashReviewDetail.status !== 'PENDING'}
                    >
                      Reject
                    </button>
                    <button type="button" className="secondary-btn" onClick={closeLandlordCashReview} disabled={cashReviewActionLoading}>
                      Close
                    </button>
                  </div>
                </>
              ) : (
                <p>Could not load request.</p>
              )}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
};

export default Dashboard;