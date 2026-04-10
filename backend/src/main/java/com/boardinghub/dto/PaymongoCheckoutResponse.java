package com.boardinghub.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;

@Data
@AllArgsConstructor
public class PaymongoCheckoutResponse {
    private String redirectUrl;
    private String paymentIntentId;
    private String status;
    /** Monthly rent in PHP from the enrolled room (database). */
    private BigDecimal amountPesos;
    /**
     * PayMongo {@code amount} field: smallest currency units (centavos), {@code pesos × 100}.
     * Example: ₱2,000.00 → {@code 200000}.
     */
    private Long amountCentavos;
}
