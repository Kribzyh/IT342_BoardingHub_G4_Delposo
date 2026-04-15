package com.boardinghub.service;

import com.boardinghub.dto.CashPaymentRequestDetailDto;
import com.boardinghub.dto.CashPaymentRequestSummaryDto;
import com.boardinghub.dto.TenantCashStatusResponse;
import com.boardinghub.entity.CashPaymentRequest;
import com.boardinghub.entity.RentPayment;
import com.boardinghub.entity.Room;
import com.boardinghub.entity.User;
import com.boardinghub.repository.CashPaymentRequestRepository;
import com.boardinghub.repository.RentPaymentRepository;
import com.boardinghub.repository.RoomRepository;
import com.boardinghub.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.FORBIDDEN;
import static org.springframework.http.HttpStatus.NOT_FOUND;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;

@Service
@RequiredArgsConstructor
public class CashPaymentService {

    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of(
            "image/jpeg", "image/png", "image/webp", "image/gif"
    );
    private static final int MAX_DESCRIPTION = 2000;

    private final CashPaymentRequestRepository cashPaymentRequestRepository;
    private final UserRepository userRepository;
    private final RoomRepository roomRepository;
    private final RentPaymentRepository rentPaymentRepository;
    private final DashboardSseService dashboardSseService;

    @Value("${app.upload-dir:uploads}")
    private String uploadDir;

    private Path cashUploadPath;

    @PostConstruct
    public void initUploadDir() throws IOException {
        cashUploadPath = Paths.get(uploadDir, "cash").toAbsolutePath().normalize();
        Files.createDirectories(cashUploadPath);
    }

    public TenantCashStatusResponse getTenantCashStatus(String email) {
        User tenant = requireTenant(email);
        boolean pending = cashPaymentRequestRepository.existsByTenantAndStatus(tenant, CashPaymentRequest.Status.PENDING);
        return new TenantCashStatusResponse(pending);
    }

    @Transactional
    public void submitCashRequest(String email, String description, MultipartFile photo) {
        User tenant = requireTenant(email);
        if (cashPaymentRequestRepository.existsByTenantAndStatus(tenant, CashPaymentRequest.Status.PENDING)) {
            throw new ResponseStatusException(CONFLICT, "You already have a cash payment request awaiting landlord review.");
        }
        Room room = roomRepository.findByTenant(tenant)
                .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Tenant is not enrolled in a room."));

        String desc = sanitizeDescription(description);
        String photoName = null;
        if (photo != null && !photo.isEmpty()) {
            photoName = storePhoto(photo);
        }

        CashPaymentRequest req = new CashPaymentRequest();
        req.setRoom(room);
        req.setTenant(tenant);
        req.setStatus(CashPaymentRequest.Status.PENDING);
        req.setDescription(desc);
        req.setPhotoFileName(photoName);
        req.setSubmittedAt(LocalDateTime.now());
        cashPaymentRequestRepository.save(req);
        try {
            dashboardSseService.publish(tenant.getEmail());
            dashboardSseService.publish(room.getProperty().getLandlord().getEmail());
        } catch (Exception ignored) {
            /* ignore */
        }
    }

    @Transactional(readOnly = true)
    public List<CashPaymentRequestSummaryDto> listPendingForLandlord(String email) {
        User landlord = requireLandlord(email);
        List<CashPaymentRequest> list = cashPaymentRequestRepository.findAllForLandlordByStatus(
                landlord, CashPaymentRequest.Status.PENDING);
        List<CashPaymentRequestSummaryDto> out = new ArrayList<>();
        for (CashPaymentRequest c : list) {
            Room r = c.getRoom();
            out.add(new CashPaymentRequestSummaryDto(
                    c.getId(),
                    c.getTenant().getFullName(),
                    c.getTenant().getEmail(),
                    r.getProperty().getName(),
                    r.getRoomNumber(),
                    c.getSubmittedAt(),
                    c.getPhotoFileName() != null && !c.getPhotoFileName().isBlank()
            ));
        }
        return out;
    }

    @Transactional(readOnly = true)
    public CashPaymentRequestDetailDto getDetailForLandlord(String email, Long id) {
        User landlord = requireLandlord(email);
        CashPaymentRequest c = cashPaymentRequestRepository.findByIdWithRelations(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Cash request not found."));
        if (!c.getRoom().getProperty().getLandlord().getId().equals(landlord.getId())) {
            throw new ResponseStatusException(FORBIDDEN, "Not your property.");
        }
        return toDetailDto(c);
    }

    @Transactional(readOnly = true)
    public CashPaymentRequestDetailDto getDetailForTenant(String email, Long id) {
        User tenant = requireTenant(email);
        CashPaymentRequest c = cashPaymentRequestRepository.findByIdWithRelations(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Cash request not found."));
        if (!c.getTenant().getId().equals(tenant.getId())) {
            throw new ResponseStatusException(FORBIDDEN, "Not your request.");
        }
        return toDetailDto(c);
    }

    @Transactional
    public void accept(String landlordEmail, Long id) {
        User landlord = requireLandlord(landlordEmail);
        CashPaymentRequest c = cashPaymentRequestRepository.findByIdWithRelations(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Cash request not found."));
        if (!c.getRoom().getProperty().getLandlord().getId().equals(landlord.getId())) {
            throw new ResponseStatusException(FORBIDDEN, "Not your property.");
        }
        if (c.getStatus() != CashPaymentRequest.Status.PENDING) {
            throw new ResponseStatusException(BAD_REQUEST, "This request is no longer pending.");
        }

        Room room = c.getRoom();
        User tenant = c.getTenant();
        String syntheticPi = "cash-" + c.getId();

        if (rentPaymentRepository.findByPaymongoPaymentIntentId(syntheticPi).isPresent()) {
            throw new ResponseStatusException(CONFLICT, "Payment already recorded for this request.");
        }

        BigDecimal amount = room.getMonthlyRate();
        RentPayment rp = new RentPayment();
        rp.setPaymongoPaymentIntentId(syntheticPi);
        rp.setRoom(room);
        rp.setTenant(tenant);
        rp.setAmountPesos(amount);
        rp.setCurrency("PHP");
        rp.setPaymentMethodType("cash");
        rp.setPaymongoStatus("accepted");
        rp.setRecordedAt(LocalDateTime.now());
        rentPaymentRepository.save(rp);

        c.setStatus(CashPaymentRequest.Status.ACCEPTED);
        c.setReviewedAt(LocalDateTime.now());
        cashPaymentRequestRepository.save(c);
        try {
            dashboardSseService.publish(tenant.getEmail());
            dashboardSseService.publish(landlord.getEmail());
        } catch (Exception ignored) {
            /* ignore */
        }
    }

    @Transactional
    public void reject(String landlordEmail, Long id) {
        User landlord = requireLandlord(landlordEmail);
        CashPaymentRequest c = cashPaymentRequestRepository.findByIdWithRelations(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Cash request not found."));
        if (!c.getRoom().getProperty().getLandlord().getId().equals(landlord.getId())) {
            throw new ResponseStatusException(FORBIDDEN, "Not your property.");
        }
        if (c.getStatus() != CashPaymentRequest.Status.PENDING) {
            throw new ResponseStatusException(BAD_REQUEST, "This request is no longer pending.");
        }
        c.setStatus(CashPaymentRequest.Status.REJECTED);
        c.setReviewedAt(LocalDateTime.now());
        cashPaymentRequestRepository.save(c);
        try {
            dashboardSseService.publish(c.getTenant().getEmail());
            dashboardSseService.publish(landlord.getEmail());
        } catch (Exception ignored) {
            /* ignore */
        }
    }

    public record AuthorizedPhoto(Resource resource, MediaType mediaType) {}

    public AuthorizedPhoto loadAuthorizedPhoto(String userEmail, Long requestId) {
        CashPaymentRequest c = cashPaymentRequestRepository.findByIdWithRelations(requestId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Cash request not found."));
        if (c.getPhotoFileName() == null || c.getPhotoFileName().isBlank()) {
            throw new ResponseStatusException(NOT_FOUND, "No photo for this request.");
        }

        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResponseStatusException(UNAUTHORIZED, "User not found."));
        boolean allowed = false;
        if (user.getRole() == User.Role.TENANT && c.getTenant().getId().equals(user.getId())) {
            allowed = true;
        } else if (user.getRole() == User.Role.LANDLORD
                && c.getRoom().getProperty().getLandlord().getId().equals(user.getId())) {
            allowed = true;
        }
        if (!allowed) {
            throw new ResponseStatusException(FORBIDDEN, "Cannot access this photo.");
        }

        Path file = cashUploadPath.resolve(c.getPhotoFileName()).normalize();
        if (!file.startsWith(cashUploadPath) || !Files.isRegularFile(file)) {
            throw new ResponseStatusException(NOT_FOUND, "Photo file missing.");
        }
        MediaType mediaType = mediaTypeForFileName(c.getPhotoFileName());
        return new AuthorizedPhoto(new FileSystemResource(file), mediaType);
    }

    private static MediaType mediaTypeForFileName(@Nullable String name) {
        if (name == null) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }
        String lower = name.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".png")) return MediaType.IMAGE_PNG;
        if (lower.endsWith(".gif")) return MediaType.IMAGE_GIF;
        if (lower.endsWith(".webp")) return MediaType.parseMediaType("image/webp");
        return MediaType.IMAGE_JPEG;
    }

    private CashPaymentRequestDetailDto toDetailDto(CashPaymentRequest c) {
        Room r = c.getRoom();
        String rate = r.getMonthlyRate() != null ? r.getMonthlyRate().toPlainString() : "";
        return new CashPaymentRequestDetailDto(
                c.getId(),
                c.getTenant().getFullName(),
                c.getTenant().getEmail(),
                r.getProperty().getName(),
                r.getRoomNumber(),
                rate,
                c.getDescription(),
                c.getPhotoFileName() != null && !c.getPhotoFileName().isBlank(),
                c.getSubmittedAt(),
                c.getStatus().name()
        );
    }

    private String sanitizeDescription(String description) {
        if (description == null) return null;
        String t = description.trim();
        if (t.isEmpty()) return null;
        if (t.length() > MAX_DESCRIPTION) {
            throw new ResponseStatusException(BAD_REQUEST, "Description must be at most " + MAX_DESCRIPTION + " characters.");
        }
        return t;
    }

    private String storePhoto(MultipartFile photo) {
        String ct = Optional.ofNullable(photo.getContentType()).map(String::toLowerCase).orElse("");
        if (!ALLOWED_IMAGE_TYPES.contains(ct)) {
            throw new ResponseStatusException(BAD_REQUEST, "Photo must be JPEG, PNG, WebP, or GIF.");
        }
        String ext = extensionForContentType(ct);
        String name = UUID.randomUUID() + ext;
        Path target = cashUploadPath.resolve(name).normalize();
        if (!target.startsWith(cashUploadPath)) {
            throw new ResponseStatusException(BAD_REQUEST, "Invalid path.");
        }
        try {
            Files.copy(photo.getInputStream(), target);
        } catch (IOException e) {
            throw new ResponseStatusException(BAD_REQUEST, "Could not save photo.");
        }
        return name;
    }

    private static String extensionForContentType(String ct) {
        return switch (ct) {
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            case "image/gif" -> ".gif";
            default -> ".jpg";
        };
    }

    private User requireTenant(String email) {
        User u = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(UNAUTHORIZED, "User not found."));
        if (u.getRole() != User.Role.TENANT) {
            throw new ResponseStatusException(FORBIDDEN, "Tenant only.");
        }
        return u;
    }

    private User requireLandlord(String email) {
        User u = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(UNAUTHORIZED, "User not found."));
        if (u.getRole() != User.Role.LANDLORD) {
            throw new ResponseStatusException(FORBIDDEN, "Landlord only.");
        }
        return u;
    }
}
