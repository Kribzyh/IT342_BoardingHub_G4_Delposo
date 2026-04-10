package com.boardinghub.controller;

import com.boardinghub.dto.PaymentRecordDto;
import com.boardinghub.dto.PaymongoCheckoutRequest;
import com.boardinghub.dto.PaymongoCheckoutResponse;
import com.boardinghub.dto.PaymongoCompleteRequest;
import com.boardinghub.dto.PaymongoCompleteResponse;
import com.boardinghub.service.PaymentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/payments")
@RequiredArgsConstructor
public class PaymentController {
    private final PaymentService paymentService;

    @PostMapping("/paymongo/checkout")
    public ResponseEntity<PaymongoCheckoutResponse> checkout(
            Authentication authentication,
            @RequestBody(required = false) PaymongoCheckoutRequest request
    ) {
        PaymongoCheckoutRequest body = request != null ? request : new PaymongoCheckoutRequest();
        return ResponseEntity.ok(paymentService.startPaymongoCheckout(authentication.getName(), body));
    }

    @PostMapping("/paymongo/complete")
    public ResponseEntity<PaymongoCompleteResponse> complete(
            Authentication authentication,
            @RequestBody(required = false) PaymongoCompleteRequest request
    ) {
        String pi = request != null ? request.getPaymentIntentId() : null;
        return ResponseEntity.ok(paymentService.completePaymongoPayment(authentication.getName(), pi));
    }

    @GetMapping("/tenant/records")
    public ResponseEntity<List<PaymentRecordDto>> tenantRecords(Authentication authentication) {
        return ResponseEntity.ok(paymentService.listTenantPaymentRecords(authentication.getName()));
    }

    @GetMapping("/landlord/records")
    public ResponseEntity<List<PaymentRecordDto>> landlordRecords(Authentication authentication) {
        return ResponseEntity.ok(paymentService.listLandlordPaymentRecords(authentication.getName()));
    }
}
