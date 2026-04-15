package com.boardinghub.controller;

import com.boardinghub.dto.CashPaymentRequestDetailDto;
import com.boardinghub.dto.CashPaymentRequestSummaryDto;
import com.boardinghub.dto.TenantCashStatusResponse;
import com.boardinghub.service.CashPaymentService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/payments")
@RequiredArgsConstructor
public class CashPaymentRequestController {

    private final CashPaymentService cashPaymentService;

    @PostMapping(value = "/cash/request", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Void> submitCashRequest(
            Authentication authentication,
            @RequestParam(value = "description", required = false) String description,
            @RequestParam(value = "photo", required = false) MultipartFile photo
    ) {
        cashPaymentService.submitCashRequest(authentication.getName(), description, photo);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/tenant/cash-status")
    public ResponseEntity<TenantCashStatusResponse> tenantCashStatus(Authentication authentication) {
        return ResponseEntity.ok(cashPaymentService.getTenantCashStatus(authentication.getName()));
    }

    @GetMapping("/landlord/cash-requests")
    public ResponseEntity<List<CashPaymentRequestSummaryDto>> listLandlordCashRequests(Authentication authentication) {
        return ResponseEntity.ok(cashPaymentService.listPendingForLandlord(authentication.getName()));
    }

    @GetMapping("/landlord/cash-requests/{id}")
    public ResponseEntity<CashPaymentRequestDetailDto> landlordCashDetail(
            Authentication authentication,
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(cashPaymentService.getDetailForLandlord(authentication.getName(), id));
    }

    @PostMapping("/landlord/cash-requests/{id}/accept")
    public ResponseEntity<Void> accept(Authentication authentication, @PathVariable Long id) {
        cashPaymentService.accept(authentication.getName(), id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/landlord/cash-requests/{id}/reject")
    public ResponseEntity<Void> reject(Authentication authentication, @PathVariable Long id) {
        cashPaymentService.reject(authentication.getName(), id);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/cash-requests/{id}/photo")
    public ResponseEntity<Resource> getPhoto(Authentication authentication, @PathVariable Long id) {
        CashPaymentService.AuthorizedPhoto photo = cashPaymentService.loadAuthorizedPhoto(authentication.getName(), id);
        return ResponseEntity.ok()
                .contentType(photo.mediaType())
                .header(HttpHeaders.CACHE_CONTROL, "private, max-age=3600")
                .body(photo.resource());
    }
}
