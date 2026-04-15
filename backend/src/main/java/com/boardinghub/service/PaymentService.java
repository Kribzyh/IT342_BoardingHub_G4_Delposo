package com.boardinghub.service;

import com.boardinghub.config.PayMongoProperties;
import com.boardinghub.dto.PaymentRecordDto;
import com.boardinghub.dto.PaymongoCheckoutRequest;
import com.boardinghub.dto.PaymongoCheckoutResponse;
import com.boardinghub.dto.PaymongoCompleteResponse;
import com.boardinghub.entity.RentPayment;
import com.boardinghub.entity.Room;
import com.boardinghub.entity.User;
import com.boardinghub.repository.RentPaymentRepository;
import com.boardinghub.repository.RoomRepository;
import com.boardinghub.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR;
import static org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE;

@Service
@RequiredArgsConstructor
public class PaymentService {
    private static final List<String> ALLOWED_METHODS = List.of("gcash", "paymaya");

    private final UserRepository userRepository;
    private final RoomRepository roomRepository;
    private final RentPaymentRepository rentPaymentRepository;
    private final DashboardSseService dashboardSseService;
    private final PayMongoProperties payMongoProperties;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public PaymongoCheckoutResponse startPaymongoCheckout(String email, PaymongoCheckoutRequest request) {
        if (payMongoProperties.getSecretKey() == null || payMongoProperties.getSecretKey().isBlank()) {
            throw new ResponseStatusException(SERVICE_UNAVAILABLE, "PayMongo is not configured (missing PAYMONGO_SECRET_KEY).");
        }

        User tenant = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED, "User not found"));
        if (tenant.getRole() != User.Role.TENANT) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN, "Only tenants can pay rent.");
        }

        String method = Optional.ofNullable(request.getPaymentMethod()).orElse("gcash").trim().toLowerCase(Locale.ROOT);
        if (!ALLOWED_METHODS.contains(method)) {
            throw new ResponseStatusException(BAD_REQUEST, "paymentMethod must be gcash or paymaya.");
        }

        Room room = roomRepository.findByTenant(tenant)
                .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Tenant is not enrolled in a room."));
        BigDecimal monthlyPesos = room.getMonthlyRate();
        long amountCentavos = pesosToPaymongoCentavos(monthlyPesos);

        String returnUrl = Optional.ofNullable(request.getReturnUrl())
                .filter(s -> !s.isBlank())
                .orElse(payMongoProperties.getDefaultReturnUrl());
        if (!returnUrl.startsWith("http://") && !returnUrl.startsWith("https://")) {
            throw new ResponseStatusException(BAD_REQUEST, "returnUrl must be an absolute http(s) URL.");
        }

        String billingName = Optional.ofNullable(request.getBillingName()).filter(s -> !s.isBlank()).orElse(tenant.getFullName());
        String billingPhone = Optional.ofNullable(request.getBillingPhone()).filter(s -> !s.isBlank()).orElse("09000000000");

        String description = "Rent — " + room.getProperty().getName() + " / Room " + room.getRoomNumber();

        JsonNode pi = postPaymongo("/payment_intents", buildPaymentIntentPayload(amountCentavos, description));
        String paymentIntentId = text(pi, "id");
        String clientKey = text(pi.path("attributes"), "client_key");

        JsonNode pm = postPaymongo("/payment_methods", buildPaymentMethodPayload(method, billingName, email, billingPhone));
        String paymentMethodId = text(pm, "id");

        JsonNode attached = postPaymongo(
                "/payment_intents/" + paymentIntentId + "/attach",
                buildAttachPayload(clientKey, paymentMethodId, returnUrl)
        );

        JsonNode attrs = attached.path("attributes");
        String status = text(attrs, "status");
        String redirectUrl = text(attrs.path("next_action").path("redirect"), "url");

        if (redirectUrl == null || redirectUrl.isBlank()) {
            throw new ResponseStatusException(INTERNAL_SERVER_ERROR, "PayMongo did not return a redirect URL (status: " + status + ").");
        }

        return new PaymongoCheckoutResponse(redirectUrl, paymentIntentId, status, monthlyPesos, amountCentavos);
    }

    /**
     * PayMongo {@code amount} uses the smallest PHP unit (centavos): multiply pesos by 100
     * (e.g. ₱2,000.00 → {@code 200000}).
     */
    private long pesosToPaymongoCentavos(BigDecimal monthlyPesos) {
        if (monthlyPesos == null || monthlyPesos.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(BAD_REQUEST, "Invalid rent amount from room rate.");
        }
        long centavos = monthlyPesos.multiply(BigDecimal.valueOf(100)).setScale(0, RoundingMode.HALF_UP).longValueExact();
        if (centavos < 100) {
            throw new ResponseStatusException(BAD_REQUEST, "Amount is below the minimum charge.");
        }
        return centavos;
    }

    @Transactional
    public PaymongoCompleteResponse completePaymongoPayment(String email, String paymentIntentId) {
        if (payMongoProperties.getSecretKey() == null || payMongoProperties.getSecretKey().isBlank()) {
            throw new ResponseStatusException(SERVICE_UNAVAILABLE, "PayMongo is not configured (missing PAYMONGO_SECRET_KEY).");
        }
        String piId = Optional.ofNullable(paymentIntentId).map(String::trim).filter(s -> !s.isEmpty())
                .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "paymentIntentId is required."));
        if (!piId.startsWith("pi_")) {
            throw new ResponseStatusException(BAD_REQUEST, "Invalid payment intent id.");
        }

        Optional<RentPayment> already = rentPaymentRepository.findByPaymongoPaymentIntentId(piId);
        if (already.isPresent()) {
            notifyDashboardPaymentChanged(already.get());
            return new PaymongoCompleteResponse(true, "Payment already recorded.", toDto(already.get()));
        }

        User tenant = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED, "User not found"));
        if (tenant.getRole() != User.Role.TENANT) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN, "Only tenants can confirm rent payments.");
        }

        Room room = roomRepository.findByTenant(tenant)
                .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Tenant is not enrolled in a room."));

        JsonNode data = getPaymongo("/payment_intents/" + piId);
        JsonNode attrs = data.path("attributes");
        String status = text(attrs, "status");
        if (status == null || !"succeeded".equalsIgnoreCase(status)) {
            throw new ResponseStatusException(BAD_REQUEST,
                    "Payment is not successful yet (status: " + Optional.ofNullable(status).orElse("unknown") + "). Try again in a moment.");
        }

        long amountCentavos = attrs.path("amount").asLong(0);
        if (amountCentavos <= 0) {
            throw new ResponseStatusException(BAD_REQUEST, "Invalid amount from PayMongo.");
        }
        long expectedCentavos = pesosToPaymongoCentavos(room.getMonthlyRate());
        if (amountCentavos != expectedCentavos) {
            throw new ResponseStatusException(BAD_REQUEST, "Paid amount does not match your current rent.");
        }

        String currency = Optional.ofNullable(text(attrs, "currency")).filter(s -> !s.isBlank()).orElse("PHP");
        String methodType = extractPaymentMethodType(attrs);
        BigDecimal amountPesos = BigDecimal.valueOf(amountCentavos).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);

        RentPayment rp = new RentPayment();
        rp.setPaymongoPaymentIntentId(piId);
        rp.setRoom(room);
        rp.setTenant(tenant);
        rp.setAmountPesos(amountPesos);
        rp.setCurrency(currency);
        rp.setPaymentMethodType(methodType);
        rp.setPaymongoStatus(status);
        RentPayment saved = rentPaymentRepository.save(rp);
        notifyDashboardPaymentChanged(saved);

        return new PaymongoCompleteResponse(true, "Payment recorded.", toDto(saved));
    }

    private void notifyDashboardPaymentChanged(RentPayment rp) {
        try {
            dashboardSseService.publish(rp.getTenant().getEmail());
            dashboardSseService.publish(rp.getRoom().getProperty().getLandlord().getEmail());
        } catch (Exception ignored) {
            // SSE must not affect payment persistence
        }
    }

    @Transactional(readOnly = true)
    public List<PaymentRecordDto> listTenantPaymentRecords(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED, "User not found"));
        if (user.getRole() != User.Role.TENANT) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN, "Tenant only.");
        }
        List<PaymentRecordDto> out = new ArrayList<>();
        for (RentPayment rp : rentPaymentRepository.findAllForTenant(user)) {
            out.add(toDto(rp));
        }
        return out;
    }

    @Transactional(readOnly = true)
    public List<PaymentRecordDto> listLandlordPaymentRecords(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED, "User not found"));
        if (user.getRole() != User.Role.LANDLORD) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN, "Landlord only.");
        }
        List<PaymentRecordDto> out = new ArrayList<>();
        for (RentPayment rp : rentPaymentRepository.findAllForLandlord(user)) {
            out.add(toDto(rp));
        }
        return out;
    }

    private PaymentRecordDto toDto(RentPayment rp) {
        Room room = rp.getRoom();
        String propertyName = room.getProperty().getName();
        String roomNumber = room.getRoomNumber();
        String tenantName = rp.getTenant().getFullName();
        String landlordName = room.getProperty().getLandlord().getFullName();
        return new PaymentRecordDto(
                rp.getId(),
                rp.getPaymongoPaymentIntentId(),
                rp.getAmountPesos(),
                rp.getCurrency(),
                rp.getPaymentMethodType(),
                rp.getPaymongoStatus(),
                rp.getRecordedAt(),
                propertyName,
                roomNumber,
                tenantName,
                landlordName
        );
    }

    private String extractPaymentMethodType(JsonNode attrs) {
        JsonNode payments = attrs.path("payments");
        if (payments.isArray()) {
            for (JsonNode pay : payments) {
                String t = text(pay.path("attributes").path("source"), "type");
                if (t != null && !t.isBlank()) {
                    return t;
                }
            }
        }
        return "ewallet";
    }

    private JsonNode getPaymongo(String pathSuffix) {
        String url = payMongoProperties.getApiBase().replaceAll("/$", "") + pathSuffix;
        HttpHeaders headers = new HttpHeaders();
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        headers.set(HttpHeaders.AUTHORIZATION, basicAuth(payMongoProperties.getSecretKey()));
        try {
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, new HttpEntity<>(headers), String.class);
            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new ResponseStatusException(INTERNAL_SERVER_ERROR, "Unexpected PayMongo response.");
            }
            JsonNode root = objectMapper.readTree(response.getBody());
            if (root.has("errors")) {
                throw new ResponseStatusException(BAD_REQUEST, summarizePaymongoErrors(root.path("errors")));
            }
            return root.path("data");
        } catch (HttpStatusCodeException e) {
            String msg = e.getResponseBodyAsString();
            try {
                JsonNode errRoot = objectMapper.readTree(msg);
                if (errRoot.has("errors")) {
                    throw new ResponseStatusException(BAD_REQUEST, summarizePaymongoErrors(errRoot.path("errors")));
                }
            } catch (ResponseStatusException rse) {
                throw rse;
            } catch (Exception ignored) {
                // fall through
            }
            throw new ResponseStatusException(BAD_REQUEST, "PayMongo request failed: " + e.getStatusCode());
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(INTERNAL_SERVER_ERROR, "PayMongo error: " + e.getMessage());
        }
    }

    private ObjectNode buildPaymentIntentPayload(long amountCentavos, String description) {
        ObjectNode root = objectMapper.createObjectNode();
        ObjectNode data = root.putObject("data");
        ObjectNode attr = data.putObject("attributes");
        attr.put("amount", amountCentavos);
        attr.put("currency", "PHP");
        attr.put("capture_type", "automatic");
        attr.put("description", description);
        attr.put("statement_descriptor", truncateDescriptor(payMongoProperties.getStatementDescriptor()));
        ArrayNode allowed = attr.putArray("payment_method_allowed");
        allowed.add("gcash");
        allowed.add("paymaya");
        return root;
    }

    private static String truncateDescriptor(String s) {
        if (s == null) return "BoardingHub";
        String t = s.trim();
        return t.length() > 22 ? t.substring(0, 22) : t;
    }

    private ObjectNode buildPaymentMethodPayload(String type, String name, String email, String phone) {
        ObjectNode root = objectMapper.createObjectNode();
        ObjectNode data = root.putObject("data");
        ObjectNode attr = data.putObject("attributes");
        attr.put("type", type);
        ObjectNode billing = attr.putObject("billing");
        billing.put("name", name);
        billing.put("email", email);
        billing.put("phone", phone);
        return root;
    }

    private ObjectNode buildAttachPayload(String clientKey, String paymentMethodId, String returnUrl) {
        ObjectNode root = objectMapper.createObjectNode();
        ObjectNode data = root.putObject("data");
        ObjectNode attr = data.putObject("attributes");
        attr.put("client_key", clientKey);
        attr.put("payment_method", paymentMethodId);
        attr.put("return_url", returnUrl);
        return root;
    }

    private JsonNode postPaymongo(String path, ObjectNode body) {
        String url = payMongoProperties.getApiBase().replaceAll("/$", "") + path;
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set(HttpHeaders.AUTHORIZATION, basicAuth(payMongoProperties.getSecretKey()));
        try {
            ResponseEntity<String> response = restTemplate.postForEntity(url, new HttpEntity<>(body.toString(), headers), String.class);
            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new ResponseStatusException(INTERNAL_SERVER_ERROR, "Unexpected PayMongo response.");
            }
            JsonNode root = objectMapper.readTree(response.getBody());
            if (root.has("errors")) {
                throw new ResponseStatusException(BAD_REQUEST, summarizePaymongoErrors(root.path("errors")));
            }
            return root.path("data");
        } catch (HttpStatusCodeException e) {
            String msg = e.getResponseBodyAsString();
            try {
                JsonNode errRoot = objectMapper.readTree(msg);
                if (errRoot.has("errors")) {
                    throw new ResponseStatusException(BAD_REQUEST, summarizePaymongoErrors(errRoot.path("errors")));
                }
            } catch (Exception ignored) {
                // fall through
            }
            throw new ResponseStatusException(BAD_REQUEST, "PayMongo request failed: " + e.getStatusCode());
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(INTERNAL_SERVER_ERROR, "PayMongo error: " + e.getMessage());
        }
    }

    private static String summarizePaymongoErrors(JsonNode errors) {
        if (!errors.isArray() || errors.isEmpty()) {
            return "PayMongo rejected the request.";
        }
        StringBuilder sb = new StringBuilder();
        for (JsonNode e : errors) {
            if (e.has("detail")) {
                if (sb.length() > 0) sb.append(" ");
                sb.append(e.path("detail").asText());
            }
        }
        return sb.length() > 0 ? sb.toString() : "PayMongo rejected the request.";
    }

    private static String basicAuth(String secretKey) {
        String raw = secretKey + ":";
        return "Basic " + Base64.getEncoder().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    private static String text(JsonNode node, String field) {
        if (node == null || node.isMissingNode()) return null;
        JsonNode v = node.get(field);
        if (v == null || v.isNull()) return null;
        return v.asText();
    }
}
