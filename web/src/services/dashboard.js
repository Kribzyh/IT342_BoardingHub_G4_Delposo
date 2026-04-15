import api from './api';

export const getLandlordProperties = async () => {
  const response = await api.get('/dashboard/properties');
  return response.data;
};

export const createProperty = async (payload) => {
  const response = await api.post('/dashboard/properties', payload);
  return response.data;
};

export const updateProperty = async (propertyId, payload) => {
  const response = await api.put(`/dashboard/properties/${propertyId}`, payload);
  return response.data;
};

export const deleteProperty = async (propertyId) => {
  await api.delete(`/dashboard/properties/${propertyId}`);
};

export const createRoom = async (payload) => {
  const response = await api.post('/dashboard/rooms', payload);
  return response.data;
};

export const updateRoom = async (roomId, payload) => {
  const response = await api.put(`/dashboard/rooms/${roomId}`, payload);
  return response.data;
};

export const deleteRoom = async (roomId) => {
  await api.delete(`/dashboard/rooms/${roomId}`);
};

export const generateRoomCode = async (roomId) => {
  const response = await api.post(`/dashboard/rooms/${roomId}/generate-code`);
  return response.data;
};

export const enrollTenant = async (code) => {
  const response = await api.post('/dashboard/tenant/enroll', { code });
  return response.data;
};

export const getTenantRent = async () => {
  const response = await api.get('/dashboard/tenant/rent');
  return response.data;
};

export const getLandlordTenants = async (propertyId) => {
  const response = await api.get('/dashboard/landlord/tenants', {
    params: propertyId ? { propertyId } : {}
  });
  return response.data;
};

/** Same shape as tenant GET /dashboard/tenant/current-rent; landlord must own the property. */
export const getLandlordTenantCurrentRent = async (tenantId) => {
  const response = await api.get(`/dashboard/landlord/tenant/${tenantId}/current-rent`);
  return response.data;
};

export const getTenantCurrentRent = async () => {
  const response = await api.get('/dashboard/tenant/current-rent');
  return response.data;
};

export const createPaymongoCheckout = async (payload = {}) => {
  const response = await api.post('/payments/paymongo/checkout', payload);
  return response.data;
};

export const completePaymongoPayment = async (paymentIntentId) => {
  const response = await api.post('/payments/paymongo/complete', { paymentIntentId });
  return response.data;
};

export const getTenantPaymentRecords = async () => {
  const response = await api.get('/payments/tenant/records');
  return response.data;
};

export const getLandlordPaymentRecords = async () => {
  const response = await api.get('/payments/landlord/records');
  return response.data;
};
